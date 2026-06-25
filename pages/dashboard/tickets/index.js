import { Button, Input, Modal, Select, Text } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import moment from 'moment';
import { useMemo, useState } from 'react';
import DashboardSideNav from '../../../components/dashboardSideNav';
import { randomString } from '../../../config/functions';

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

const TicketQueue = ({ tickets, users }) => {
      const supabase = useSupabaseClient();
      const router = useRouter();

      const usersById = useMemo(() => {
            const map = {};
            users.forEach((u) => (map[u.id] = u));
            return map;
      }, [users]);

      const customers = useMemo(
            () => users.filter((u) => u.role === 'customer'),
            [users]
      );
      const agents = useMemo(
            () => users.filter((u) => u.role && u.role !== 'customer'),
            [users]
      );

      const [search, setSearch] = useState('');
      const [status, setStatus] = useState('all');
      const [priority, setPriority] = useState('all');
      const [assignee, setAssignee] = useState('all');
      const [sort, setSort] = useState('recent');

      const [creating, setCreating] = useState(false);
      const [showCreate, setShowCreate] = useState(false);
      const [newCustomer, setNewCustomer] = useState('');
      const [newTitle, setNewTitle] = useState('');

      const visible = useMemo(() => {
            const q = search.trim().toLowerCase();
            let list = tickets.filter((t) => {
                  if (status !== 'all' && t.status !== status) return false;
                  if (priority !== 'all' && t.priority !== priority) return false;
                  if (assignee === 'unassigned' && t.assignedTo) return false;
                  if (
                        assignee !== 'all' &&
                        assignee !== 'unassigned' &&
                        t.assignedTo !== assignee
                  )
                        return false;
                  if (q) {
                        const cust = usersById[t.userId];
                        const hay = [
                              t.id,
                              t.title,
                              cust?.idString,
                              cust?.email,
                        ]
                              .filter(Boolean)
                              .join(' ')
                              .toLowerCase();
                        if (!hay.includes(q)) return false;
                  }
                  return true;
            });
            list = [...list].sort((a, b) => {
                  if (sort === 'recent')
                        return new Date(b.updated_at) - new Date(a.updated_at);
                  if (sort === 'oldest')
                        return new Date(a.created_at) - new Date(b.created_at);
                  if (sort === 'priority')
                        return (
                              (PRIORITY_RANK[a.priority] ?? 9) -
                              (PRIORITY_RANK[b.priority] ?? 9)
                        );
                  if (sort === 'sla') {
                        const av = a.firstResponseDueAt
                              ? new Date(a.firstResponseDueAt)
                              : Infinity;
                        const bv = b.firstResponseDueAt
                              ? new Date(b.firstResponseDueAt)
                              : Infinity;
                        return av - bv;
                  }
                  return 0;
            });
            return list;
      }, [tickets, usersById, search, status, priority, assignee, sort]);

      const createTicket = async () => {
            if (!newCustomer) return;
            setCreating(true);
            const customer = usersById[newCustomer];
            const id = randomString(6, '#');
            const { error } = await supabase
                  .from('tickets')
                  .insert({ userId: newCustomer, id, title: newTitle || null });
            setCreating(false);
            if (!error) router.push(`/dashboard/${customer.idString}/${id}`);
      };

      return (
            <div className="dashboard">
                  <Head>
                        <title>Tickets</title>
                        <link rel="icon" href="/favicon.png" />
                  </Head>
                  <div className="chat-container">
                        <DashboardSideNav active="tickets" />
                        <div className="queue-page">
                              <div className="queue-header">
                                    <div>
                                          <Text h3 style={{ margin: 0 }}>
                                                Tickets
                                          </Text>
                                          <Text type="secondary" small>
                                                {visible.length} of{' '}
                                                {tickets.length}
                                          </Text>
                                    </div>
                                    <Button
                                          type="secondary"
                                          scale={2 / 3}
                                          onClick={() => setShowCreate(true)}
                                    >
                                          New ticket
                                    </Button>
                              </div>

                              <div className="queue-toolbar">
                                    <Input
                                          placeholder="Search by id, title, customer…"
                                          value={search}
                                          width="100%"
                                          onChange={(e) =>
                                                setSearch(e.target.value)
                                          }
                                          clearable
                                    />
                                    <Select
                                          value={status}
                                          onChange={setStatus}
                                          placeholder="Status"
                                    >
                                          <Select.Option value="all">
                                                All statuses
                                          </Select.Option>
                                          <Select.Option value="open">
                                                Open
                                          </Select.Option>
                                          <Select.Option value="pending">
                                                Pending
                                          </Select.Option>
                                          <Select.Option value="resolved">
                                                Resolved
                                          </Select.Option>
                                          <Select.Option value="closed">
                                                Closed
                                          </Select.Option>
                                    </Select>
                                    <Select
                                          value={priority}
                                          onChange={setPriority}
                                          placeholder="Priority"
                                    >
                                          <Select.Option value="all">
                                                All priorities
                                          </Select.Option>
                                          <Select.Option value="urgent">
                                                Urgent
                                          </Select.Option>
                                          <Select.Option value="high">
                                                High
                                          </Select.Option>
                                          <Select.Option value="normal">
                                                Normal
                                          </Select.Option>
                                          <Select.Option value="low">
                                                Low
                                          </Select.Option>
                                    </Select>
                                    <Select
                                          value={assignee}
                                          onChange={setAssignee}
                                          placeholder="Assignee"
                                    >
                                          <Select.Option value="all">
                                                Anyone
                                          </Select.Option>
                                          <Select.Option value="unassigned">
                                                Unassigned
                                          </Select.Option>
                                          {agents.map((a) => (
                                                <Select.Option
                                                      key={a.id}
                                                      value={a.id}
                                                >
                                                      {a.email || a.idString}
                                                </Select.Option>
                                          ))}
                                    </Select>
                                    <Select
                                          value={sort}
                                          onChange={setSort}
                                          placeholder="Sort"
                                    >
                                          <Select.Option value="recent">
                                                Recently updated
                                          </Select.Option>
                                          <Select.Option value="oldest">
                                                Oldest first
                                          </Select.Option>
                                          <Select.Option value="priority">
                                                Priority
                                          </Select.Option>
                                          <Select.Option value="sla">
                                                SLA due
                                          </Select.Option>
                                    </Select>
                              </div>

                              <div className="queue-list">
                                    <div className="queue-row queue-head">
                                          <span>Ticket</span>
                                          <span>Customer</span>
                                          <span>Status</span>
                                          <span>Priority</span>
                                          <span>Assignee</span>
                                          <span>Updated</span>
                                    </div>
                                    {visible.map((t) => {
                                          const cust = usersById[t.userId];
                                          const asg = usersById[t.assignedTo];
                                          return (
                                                <Link
                                                      key={t.id}
                                                      href={`/dashboard/${cust?.idString}/${t.id}`}
                                                      className="queue-row"
                                                >
                                                      <span className="queue-title">
                                                            {t.title ||
                                                                  `Ticket #${t.id}`}
                                                            <span className="queue-id">
                                                                  #{t.id}
                                                            </span>
                                                      </span>
                                                      <span>
                                                            {cust?.idString ||
                                                                  '—'}
                                                      </span>
                                                      <span>
                                                            <span
                                                                  className={`status-badge status-${t.status}`}
                                                            >
                                                                  {t.status}
                                                            </span>
                                                      </span>
                                                      <span>
                                                            <span
                                                                  className={`priority-badge priority-${t.priority}`}
                                                            >
                                                                  {t.priority}
                                                            </span>
                                                      </span>
                                                      <span>
                                                            {asg?.email ||
                                                                  asg?.idString ||
                                                                  'Unassigned'}
                                                      </span>
                                                      <span className="queue-muted">
                                                            {moment(
                                                                  t.updated_at
                                                            ).fromNow()}
                                                      </span>
                                                </Link>
                                          );
                                    })}
                                    {visible.length === 0 && (
                                          <Text
                                                type="secondary"
                                                style={{ padding: 24 }}
                                          >
                                                No tickets match your filters.
                                          </Text>
                                    )}
                              </div>
                        </div>
                  </div>

                  <Modal
                        visible={showCreate}
                        onClose={() => setShowCreate(false)}
                  >
                        <Modal.Title>New ticket</Modal.Title>
                        <Modal.Content>
                              <Text small type="secondary">
                                    Customer
                              </Text>
                              <Select
                                    width="100%"
                                    value={newCustomer}
                                    onChange={setNewCustomer}
                                    placeholder="Select a customer"
                              >
                                    {customers.map((c) => (
                                          <Select.Option key={c.id} value={c.id}>
                                                {c.email || c.idString}
                                          </Select.Option>
                                    ))}
                              </Select>
                              <div style={{ height: 12 }} />
                              <Text small type="secondary">
                                    Title (optional)
                              </Text>
                              <Input
                                    width="100%"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Short summary"
                              />
                        </Modal.Content>
                        <Modal.Action
                              passive
                              onClick={() => setShowCreate(false)}
                        >
                              Cancel
                        </Modal.Action>
                        <Modal.Action
                              loading={creating}
                              disabled={!newCustomer}
                              onClick={createTicket}
                        >
                              Create
                        </Modal.Action>
                  </Modal>
            </div>
      );
};

export default TicketQueue;

export const getServerSideProps = async (ctx) => {
      const supabase = createServerSupabaseClient(ctx);
      const {
            data: { session },
      } = await supabase.auth.getSession();
      if (!session)
            return { redirect: { destination: '/', permanent: false } };

      const { user } = session;
      const { data: userObj } = await supabase
            .from('users')
            .select(`role`)
            .eq('id', user.id)
            .single();
      if (!userObj || userObj.role === 'customer')
            return { redirect: { destination: '/', permanent: false } };

      const { data: tickets } = await supabase
            .from('tickets')
            .select(`*`)
            .order('updated_at', { ascending: false })
            .limit(500);

      const { data: users } = await supabase
            .from('users')
            .select(`id,idString,email,role`)
            .limit(2000);

      return {
            props: { tickets: tickets || [], users: users || [] },
      };
};
