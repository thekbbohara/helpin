-- Helpin schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Idempotent / re-runnable. camelCase columns are quoted because PostgREST
-- queries them case-sensitively, e.g. .eq('userId', ...) / .select('idString').

-- ===========================================================================
-- Tables
-- ===========================================================================

-- users  (one row per auth user; row created on first login in pages/_app.js)
create table if not exists public.users (
      id            uuid primary key references auth.users (id) on delete cascade,
      email         text,
      role          text not null default 'customer',
      "idString"    text unique,
      "avatarColor" text,
      "ipInfo"      jsonb,
      created_at    timestamptz not null default now()
);

-- Backfill: rows created before the default existed may have a NULL/blank role.
-- A blank role must never be treated as staff (see is_agent()), so pin it to customer.
alter table public.users alter column role set default 'customer';
update public.users set role = 'customer' where role is null or role = '';
alter table public.users alter column role set not null;

-- tickets  (id is a short random string, e.g. randomString(6, '#'))
create table if not exists public.tickets (
      id         text primary key,
      "userId"   uuid references public.users (id) on delete cascade,
      title      text,
      created_at timestamptz not null default now()
);

-- Lifecycle / SLA columns (added separately so existing tables upgrade in place)
alter table public.tickets add column if not exists status text not null default 'open';
alter table public.tickets add column if not exists priority text not null default 'normal';
alter table public.tickets add column if not exists "assignedTo" uuid references public.users (id) on delete set null;
alter table public.tickets add column if not exists updated_at timestamptz not null default now();
alter table public.tickets add column if not exists "firstResponseDueAt" timestamptz;
alter table public.tickets add column if not exists "firstRespondedAt" timestamptz;
alter table public.tickets add column if not exists "resolvedAt" timestamptz;
alter table public.tickets add column if not exists "closedAt" timestamptz;

do $$ begin
      alter table public.tickets add constraint tickets_status_chk
            check (status in ('open', 'pending', 'resolved', 'closed'));
exception when duplicate_object then null; end $$;

do $$ begin
      alter table public.tickets add constraint tickets_priority_chk
            check (priority in ('low', 'normal', 'high', 'urgent'));
exception when duplicate_object then null; end $$;

create index if not exists tickets_userId_idx on public.tickets ("userId");
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_assignedTo_idx on public.tickets ("assignedTo");
create index if not exists tickets_updated_at_idx on public.tickets (updated_at desc);

-- ticketMessages  (chat messages within a ticket)
create table if not exists public."ticketMessages" (
      id         text primary key,
      "ticketId" text references public.tickets (id) on delete cascade,
      "userId"   uuid references public.users (id) on delete set null,
      "userType" text,            -- 'customer' | 'owner'
      type       text,            -- 'text' or a file mime type
      message    text,
      "filePath" text,
      created_at timestamptz not null default now()
);

alter table public."ticketMessages" add column if not exists edited_at timestamptz;
alter table public."ticketMessages" add column if not exists deleted_at timestamptz;

create index if not exists ticketMessages_ticketId_idx on public."ticketMessages" ("ticketId");
create index if not exists ticketMessages_ticketId_created_idx
      on public."ticketMessages" ("ticketId", created_at desc);

-- Live chat: stream new messages to the other party without a refresh.
do $$ begin
      alter publication supabase_realtime add table public."ticketMessages";
exception when duplicate_object then null; end $$;

-- ticketEvents  (audit log of lifecycle changes)
create table if not exists public."ticketEvents" (
      id         bigint generated always as identity primary key,
      "ticketId" text references public.tickets (id) on delete cascade,
      "actorId"  uuid references public.users (id) on delete set null,
      type       text not null,     -- created | status | priority | assigned | reopened
      data       jsonb,
      created_at timestamptz not null default now()
);
create index if not exists ticketEvents_ticketId_idx on public."ticketEvents" ("ticketId");

-- ticketMessageHistory  (edit/delete history)
create table if not exists public."ticketMessageHistory" (
      id                bigint generated always as identity primary key,
      "messageId"       text references public."ticketMessages" (id) on delete cascade,
      "ticketId"        text,
      "previousMessage" text,
      action            text not null,   -- edited | deleted
      "editedBy"        uuid references public.users (id) on delete set null,
      created_at        timestamptz not null default now()
);
create index if not exists ticketMessageHistory_messageId_idx on public."ticketMessageHistory" ("messageId");

-- websites  (created from pages/setup.js)
create table if not exists public.websites (
      id         bigint generated always as identity primary key,
      wid        text unique,
      name       text,
      url        text,
      handle     text,
      "ownerId"  uuid references public.users (id) on delete cascade,
      created_at timestamptz not null default now()
);

-- ===========================================================================
-- Helper functions (security definer so RLS policies can call them without
-- recursing on the same table)
-- ===========================================================================

create or replace function public.is_agent()
returns boolean language sql stable security definer set search_path = public as $$
      select exists (
            select 1 from public.users
            where id = auth.uid() and role in ('agent', 'admin')
      );
$$;

create or replace function public.owns_ticket(tid text)
returns boolean language sql stable security definer set search_path = public as $$
      select exists (
            select 1 from public.tickets
            where id = tid and "userId" = auth.uid()
      );
$$;

-- Add N business hours (Mon-Fri, 09:00-17:00 UTC) to a timestamp.
create or replace function public.add_business_hours(start_ts timestamptz, hrs int)
returns timestamptz language plpgsql immutable as $$
declare
      cur       timestamptz := start_ts;
      remaining numeric := hrs * 60;            -- minutes
      day_start time := time '09:00';
      day_end   time := time '17:00';
      step      numeric;
begin
      while remaining > 0 loop
            if extract(dow from cur) in (0, 6) then
                  cur := date_trunc('day', cur) + interval '1 day';
                  continue;
            end if;
            if cur::time < day_start then
                  cur := date_trunc('day', cur) + day_start;
            end if;
            if cur::time >= day_end then
                  cur := date_trunc('day', cur) + interval '1 day' + day_start;
                  continue;
            end if;
            step := least(
                  remaining,
                  extract(epoch from (date_trunc('day', cur) + day_end - cur)) / 60
            );
            cur := cur + make_interval(mins => step::int);
            remaining := remaining - step;
      end loop;
      return cur;
end;
$$;

-- ===========================================================================
-- Triggers: updated_at, SLA, audit, rate limiting, message history
-- ===========================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
      new.updated_at := now();
      return new;
end;
$$;

drop trigger if exists tickets_touch_updated_at on public.tickets;
create trigger tickets_touch_updated_at
      before update on public.tickets
      for each row execute function public.touch_updated_at();

-- On create: set first-response SLA target (8 business hours) + audit event.
create or replace function public.tickets_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
      update public.tickets
            set "firstResponseDueAt" = public.add_business_hours(new.created_at, 8)
            where id = new.id and "firstResponseDueAt" is null;
      insert into public."ticketEvents" ("ticketId", "actorId", type, data)
            values (new.id, auth.uid(), 'created', jsonb_build_object('title', new.title));
      return null;
end;
$$;

drop trigger if exists tickets_after_insert on public.tickets;
create trigger tickets_after_insert
      after insert on public.tickets
      for each row execute function public.tickets_after_insert();

-- On lifecycle change: stamp resolved/closed timestamps + write audit events.
create or replace function public.tickets_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
      if new.status is distinct from old.status then
            insert into public."ticketEvents" ("ticketId", "actorId", type, data)
                  values (new.id, auth.uid(), 'status',
                        jsonb_build_object('from', old.status, 'to', new.status));
            if new.status = 'resolved' then
                  update public.tickets set "resolvedAt" = now() where id = new.id;
            elsif new.status = 'closed' then
                  update public.tickets set "closedAt" = now() where id = new.id;
            elsif new.status = 'open' and old.status in ('resolved', 'closed') then
                  update public.tickets
                        set "resolvedAt" = null, "closedAt" = null where id = new.id;
                  insert into public."ticketEvents" ("ticketId", "actorId", type, data)
                        values (new.id, auth.uid(), 'reopened', null);
            end if;
      end if;
      if new.priority is distinct from old.priority then
            insert into public."ticketEvents" ("ticketId", "actorId", type, data)
                  values (new.id, auth.uid(), 'priority',
                        jsonb_build_object('from', old.priority, 'to', new.priority));
      end if;
      if new."assignedTo" is distinct from old."assignedTo" then
            insert into public."ticketEvents" ("ticketId", "actorId", type, data)
                  values (new.id, auth.uid(), 'assigned',
                        jsonb_build_object('to', new."assignedTo"));
      end if;
      return null;
end;
$$;

drop trigger if exists tickets_after_update on public.tickets;
create trigger tickets_after_update
      after update on public.tickets
      for each row execute function public.tickets_after_update();

-- Rate limit ticket creation for customers (skip agents).
create or replace function public.tickets_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
      recent int;
      open_count int;
begin
      if public.is_agent() then
            return new;
      end if;
      select count(*) into recent from public.tickets
            where "userId" = new."userId" and created_at > now() - interval '60 seconds';
      if recent > 0 then
            raise exception 'You are creating tickets too quickly. Please wait a moment.'
                  using errcode = 'check_violation';
      end if;
      select count(*) into open_count from public.tickets
            where "userId" = new."userId" and status in ('open', 'pending');
      if open_count >= 10 then
            raise exception 'You have too many open tickets. Please resolve some first.'
                  using errcode = 'check_violation';
      end if;
      return new;
end;
$$;

drop trigger if exists tickets_rate_limit on public.tickets;
create trigger tickets_rate_limit
      before insert on public.tickets
      for each row execute function public.tickets_rate_limit();

-- First agent reply stamps firstRespondedAt on the ticket.
create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
      if new."userType" = 'owner' then
            update public.tickets
                  set "firstRespondedAt" = now()
                  where id = new."ticketId" and "firstRespondedAt" is null;
      end if;
      return null;
end;
$$;

drop trigger if exists messages_after_insert on public."ticketMessages";
create trigger messages_after_insert
      after insert on public."ticketMessages"
      for each row execute function public.messages_after_insert();

-- Record edits / soft deletes of messages into history.
create or replace function public.messages_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
      if new.message is distinct from old.message and old.message is not null then
            new.edited_at := now();
            insert into public."ticketMessageHistory"
                  ("messageId", "ticketId", "previousMessage", action, "editedBy")
                  values (old.id, old."ticketId", old.message, 'edited', auth.uid());
      end if;
      if new.deleted_at is not null and old.deleted_at is null then
            insert into public."ticketMessageHistory"
                  ("messageId", "ticketId", "previousMessage", action, "editedBy")
                  values (old.id, old."ticketId", old.message, 'deleted', auth.uid());
      end if;
      return new;
end;
$$;

drop trigger if exists messages_before_update on public."ticketMessages";
create trigger messages_before_update
      before update on public."ticketMessages"
      for each row execute function public.messages_before_update();

-- ===========================================================================
-- Row Level Security
-- Customers can only touch their own user row, tickets, and messages.
-- Agents (role <> 'customer') have full access.
-- ===========================================================================
alter table public.users                   enable row level security;
alter table public.tickets                 enable row level security;
alter table public."ticketMessages"        enable row level security;
alter table public."ticketEvents"          enable row level security;
alter table public."ticketMessageHistory"  enable row level security;
alter table public.websites                enable row level security;

-- users
drop policy if exists "authenticated full access" on public.users;
drop policy if exists "users self or agent read"   on public.users;
drop policy if exists "users self insert"           on public.users;
drop policy if exists "users self or agent update"  on public.users;
create policy "users self or agent read" on public.users
      for select to authenticated using (id = auth.uid() or public.is_agent());
create policy "users self insert" on public.users
      for insert to authenticated with check (id = auth.uid());
create policy "users self or agent update" on public.users
      for update to authenticated using (id = auth.uid() or public.is_agent());

-- tickets
drop policy if exists "authenticated full access" on public.tickets;
drop policy if exists "tickets owner or agent read"   on public.tickets;
drop policy if exists "tickets owner or agent insert" on public.tickets;
drop policy if exists "tickets owner or agent update" on public.tickets;
create policy "tickets owner or agent read" on public.tickets
      for select to authenticated using ("userId" = auth.uid() or public.is_agent());
create policy "tickets owner or agent insert" on public.tickets
      for insert to authenticated with check ("userId" = auth.uid() or public.is_agent());
create policy "tickets owner or agent update" on public.tickets
      for update to authenticated using ("userId" = auth.uid() or public.is_agent());

-- ticketMessages
drop policy if exists "authenticated full access" on public."ticketMessages";
drop policy if exists "messages read"   on public."ticketMessages";
drop policy if exists "messages insert" on public."ticketMessages";
drop policy if exists "messages update" on public."ticketMessages";
create policy "messages read" on public."ticketMessages"
      for select to authenticated
      using (public.is_agent() or public.owns_ticket("ticketId"));
create policy "messages insert" on public."ticketMessages"
      for insert to authenticated
      with check ("userId" = auth.uid()
            and (public.is_agent() or public.owns_ticket("ticketId")));
create policy "messages update" on public."ticketMessages"
      for update to authenticated
      using ("userId" = auth.uid() or public.is_agent());

-- ticketEvents (read-only to clients; rows written by security-definer triggers)
drop policy if exists "events read" on public."ticketEvents";
create policy "events read" on public."ticketEvents"
      for select to authenticated
      using (public.is_agent() or public.owns_ticket("ticketId"));

-- ticketMessageHistory (read-only to clients)
drop policy if exists "history read" on public."ticketMessageHistory";
create policy "history read" on public."ticketMessageHistory"
      for select to authenticated
      using (public.is_agent() or public.owns_ticket("ticketId"));

-- websites
drop policy if exists "authenticated full access" on public.websites;
drop policy if exists "websites owner or agent" on public.websites;
create policy "websites owner or agent" on public.websites
      for all to authenticated
      using ("ownerId" = auth.uid() or public.is_agent())
      with check ("ownerId" = auth.uid() or public.is_agent());

-- ===========================================================================
-- Storage bucket for uploaded files
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

drop policy if exists "authenticated upload assets" on storage.objects;
drop policy if exists "authenticated read assets"   on storage.objects;
drop policy if exists "public read assets"          on storage.objects;
create policy "authenticated upload assets" on storage.objects
      for insert to authenticated with check (bucket_id = 'assets');
create policy "authenticated read assets" on storage.objects
      for select to authenticated using (bucket_id = 'assets');
create policy "public read assets" on storage.objects
      for select to anon using (bucket_id = 'assets');
