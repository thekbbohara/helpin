import { Input, Text } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import Head from 'next/head';
import Link from 'next/link';
import moment from 'moment';
import { useMemo, useState } from 'react';
import DashboardSideNav from '../components/dashboardSideNav';

const Customers = ({ customers, counts }) => {
      const [search, setSearch] = useState('');

      const visible = useMemo(() => {
            const q = search.trim().toLowerCase();
            if (!q) return customers;
            return customers.filter((c) =>
                  [c.idString, c.email, c.ipInfo?.country]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(q)
            );
      }, [customers, search]);

      return (
            <div className="dashboard">
                  <Head>
                        <title>Customers</title>
                        <link rel="icon" href="/favicon.png" />
                  </Head>
                  <div className="chat-container">
                        <DashboardSideNav active="customers" />
                        <div className="queue-page">
                              <div className="queue-header">
                                    <div>
                                          <Text h3 style={{ margin: 0 }}>
                                                Customers
                                          </Text>
                                          <Text type="secondary" small>
                                                {visible.length} of{' '}
                                                {customers.length}
                                          </Text>
                                    </div>
                              </div>

                              <div className="queue-toolbar single">
                                    <Input
                                          placeholder="Search by id, email, country…"
                                          value={search}
                                          width="100%"
                                          onChange={(e) =>
                                                setSearch(e.target.value)
                                          }
                                          clearable
                                    />
                              </div>

                              <div className="queue-list">
                                    <div
                                          className="queue-row queue-head"
                                          style={{
                                                gridTemplateColumns:
                                                      '1.6fr 1.4fr 1fr 1fr 1fr',
                                          }}
                                    >
                                          <span>Customer</span>
                                          <span>Email</span>
                                          <span>Location</span>
                                          <span>Tickets</span>
                                          <span>Joined</span>
                                    </div>
                                    {visible.map((c) => {
                                          const cnt = counts[c.id] || {
                                                total: 0,
                                                open: 0,
                                          };
                                          return (
                                                <Link
                                                      key={c.id}
                                                      href={`/dashboard/${c.idString}`}
                                                      className="queue-row"
                                                      style={{
                                                            gridTemplateColumns:
                                                                  '1.6fr 1.4fr 1fr 1fr 1fr',
                                                      }}
                                                >
                                                      <span className="queue-title">
                                                            {c.idString}
                                                      </span>
                                                      <span className="queue-muted">
                                                            {c.email || '—'}
                                                      </span>
                                                      <span className="queue-muted">
                                                            {c.ipInfo?.country ||
                                                                  '—'}
                                                      </span>
                                                      <span>
                                                            {cnt.open} open
                                                            <span className="queue-id">
                                                                  {' '}
                                                                  / {cnt.total}{' '}
                                                                  total
                                                            </span>
                                                      </span>
                                                      <span className="queue-muted">
                                                            {moment(
                                                                  c.created_at
                                                            ).format(
                                                                  'DD MMM YYYY'
                                                            )}
                                                      </span>
                                                </Link>
                                          );
                                    })}
                                    {visible.length === 0 && (
                                          <Text
                                                type="secondary"
                                                style={{ padding: 24 }}
                                          >
                                                No customers found.
                                          </Text>
                                    )}
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default Customers;

export const getServerSideProps = async (ctx) => {
      const supabase = createServerSupabaseClient(ctx);
      const {
            data: { session },
      } = await supabase.auth.getSession();
      if (!session)
            return { redirect: { destination: '/', permanent: false } };

      const { user } = session;
      const { data: me } = await supabase
            .from('users')
            .select(`role`)
            .eq('id', user.id)
            .single();
      if (me?.role !== 'agent' && me?.role !== 'admin')
            return { redirect: { destination: '/', permanent: false } };

      const { data: customers } = await supabase
            .from('users')
            .select(`id,idString,email,ipInfo,created_at`)
            .eq('role', 'customer')
            .order('created_at', { ascending: false });

      const { data: tickets } = await supabase
            .from('tickets')
            .select(`userId,status`);

      const counts = {};
      (tickets || []).forEach((t) => {
            const c = (counts[t.userId] = counts[t.userId] || {
                  total: 0,
                  open: 0,
            });
            c.total += 1;
            if (t.status === 'open' || t.status === 'pending') c.open += 1;
      });

      return { props: { customers: customers || [], counts } };
};
