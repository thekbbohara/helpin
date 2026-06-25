-- Helpin schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- camelCase columns are intentionally quoted: the app (PostgREST) queries them
-- case-sensitively, e.g. .eq('userId', ...) / .select('idString').

-- ---------------------------------------------------------------------------
-- users  (one row per auth user; row created on first login in pages/_app.js)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
      id            uuid primary key references auth.users (id) on delete cascade,
      email         text,
      role          text not null default 'customer',
      "idString"    text unique,
      "avatarColor" text,
      "ipInfo"      jsonb,
      created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tickets  (id is a short random string, e.g. randomString(6, '#'))
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
      id         text primary key,
      "userId"   uuid references public.users (id) on delete cascade,
      title      text,
      created_at timestamptz not null default now()
);

create index if not exists tickets_userId_idx on public.tickets ("userId");

-- ---------------------------------------------------------------------------
-- ticketMessages  (chat messages within a ticket)
-- ---------------------------------------------------------------------------
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

create index if not exists ticketMessages_ticketId_idx on public."ticketMessages" ("ticketId");

-- Live chat: stream new messages to the other party without a refresh.
alter publication supabase_realtime add table public."ticketMessages";

-- ---------------------------------------------------------------------------
-- websites  (created from pages/setup.js)
-- ---------------------------------------------------------------------------
create table if not exists public.websites (
      id         bigint generated always as identity primary key,
      wid        text unique,
      name       text,
      url        text,
      handle     text,
      "ownerId"  uuid references public.users (id) on delete cascade,
      created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The app accesses these tables from the browser/SSR with the logged-in
-- user's session (anon key). RLS must be ON so the public anon key cannot
-- read/write without a session. Policies below allow any authenticated user.
-- (Tighten later if customers should not see each other's data.)
-- ---------------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.tickets          enable row level security;
alter table public."ticketMessages" enable row level security;
alter table public.websites         enable row level security;

create policy "authenticated full access" on public.users
      for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.tickets
      for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public."ticketMessages"
      for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.websites
      for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded files (ChatMessages serves /object/public/assets/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

create policy "authenticated upload assets" on storage.objects
      for insert to authenticated with check (bucket_id = 'assets');

create policy "authenticated read assets" on storage.objects
      for select to authenticated using (bucket_id = 'assets');

create policy "public read assets" on storage.objects
      for select to anon using (bucket_id = 'assets');
