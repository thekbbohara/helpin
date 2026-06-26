import { Button, Input, Select, Text, useToasts } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import moment from 'moment';
import { useState } from 'react';
import DashboardSideNav from '../components/dashboardSideNav';

const ROLES = ['agent', 'admin'];

const Teams = ({ agents: initialAgents, myId }) => {
      const supabase = useSupabaseClient();
      const { setToast } = useToasts();
      const [agents, setAgents] = useState(initialAgents);
      const [email, setEmail] = useState('');
      const [role, setRole] = useState('agent');
      const [adding, setAdding] = useState(false);

      const promote = async () => {
            const target = email.trim().toLowerCase();
            if (!target) return;
            setAdding(true);
            const { data, error } = await supabase
                  .from('users')
                  .update({ role })
                  .eq('email', target)
                  .select(`id,idString,email,role,created_at`)
                  .single();
            setAdding(false);
            if (error || !data) {
                  setToast({
                        text: 'No user found with that email (they must sign up first).',
                        type: 'error',
                  });
                  return;
            }
            setAgents((cur) => [
                  data,
                  ...cur.filter((a) => a.id !== data.id),
            ]);
            setEmail('');
            setToast({ text: `${data.email} is now ${data.role}.` });
      };

      const changeRole = async (member, nextRole) => {
            const { data } = await supabase
                  .from('users')
                  .update({ role: nextRole })
                  .eq('id', member.id)
                  .select(`id,idString,email,role,created_at`)
                  .single();
            if (nextRole === 'customer') {
                  setAgents((cur) => cur.filter((a) => a.id !== member.id));
            } else if (data) {
                  setAgents((cur) =>
                        cur.map((a) => (a.id === data.id ? data : a))
                  );
            }
      };

      return (
            <div className="dashboard">
                  <Head>
                        <title>Team</title>
                        <link rel="icon" href="/favicon.png" />
                  </Head>
                  <div className="chat-container">
                        <DashboardSideNav active="teams" />
                        <div className="queue-page">
                              <div className="queue-header">
                                    <div>
                                          <Text h3 style={{ margin: 0 }}>
                                                Team
                                          </Text>
                                          <Text type="secondary" small>
                                                {agents.length} member
                                                {agents.length === 1 ? '' : 's'}
                                          </Text>
                                    </div>
                              </div>

                              <div className="team-invite">
                                    <Input
                                          placeholder="teammate@email.com"
                                          value={email}
                                          onChange={(e) =>
                                                setEmail(e.target.value)
                                          }
                                          width="100%"
                                    />
                                    <Select
                                          value={role}
                                          onChange={setRole}
                                          width="120px"
                                    >
                                          {ROLES.map((r) => (
                                                <Select.Option key={r} value={r}>
                                                      {r}
                                                </Select.Option>
                                          ))}
                                    </Select>
                                    <Button
                                          type="secondary"
                                          scale={2 / 3}
                                          loading={adding}
                                          onClick={promote}
                                    >
                                          Add member
                                    </Button>
                              </div>
                              <Text small type="secondary" mt={0}>
                                    The person must have signed up already;
                                    adding them grants staff access.
                              </Text>

                              <div className="queue-list" style={{ marginTop: 16 }}>
                                    <div
                                          className="queue-row queue-head"
                                          style={{
                                                gridTemplateColumns:
                                                      '1.6fr 1.2fr 1.4fr 1fr',
                                          }}
                                    >
                                          <span>Member</span>
                                          <span>Role</span>
                                          <span>Joined</span>
                                          <span></span>
                                    </div>
                                    {agents.map((a) => (
                                          <div
                                                key={a.id}
                                                className="queue-row"
                                                style={{
                                                      gridTemplateColumns:
                                                            '1.6fr 1.2fr 1.4fr 1fr',
                                                }}
                                          >
                                                <span className="queue-title">
                                                      {a.email || a.idString}
                                                      {a.id === myId && (
                                                            <span className="queue-id">
                                                                  you
                                                            </span>
                                                      )}
                                                </span>
                                                <span>
                                                      <Select
                                                            value={a.role}
                                                            scale={2 / 3}
                                                            disabled={
                                                                  a.id === myId
                                                            }
                                                            onChange={(v) =>
                                                                  changeRole(
                                                                        a,
                                                                        v
                                                                  )
                                                            }
                                                      >
                                                            <Select.Option value="agent">
                                                                  agent
                                                            </Select.Option>
                                                            <Select.Option value="admin">
                                                                  admin
                                                            </Select.Option>
                                                      </Select>
                                                </span>
                                                <span className="queue-muted">
                                                      {moment(
                                                            a.created_at
                                                      ).format('DD MMM YYYY')}
                                                </span>
                                                <span>
                                                      {a.id !== myId && (
                                                            <Button
                                                                  type="error"
                                                                  ghost
                                                                  auto
                                                                  scale={1 / 3}
                                                                  onClick={() =>
                                                                        changeRole(
                                                                              a,
                                                                              'customer'
                                                                        )
                                                                  }
                                                            >
                                                                  Remove
                                                            </Button>
                                                      )}
                                                </span>
                                          </div>
                                    ))}
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default Teams;

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

      const { data: agents } = await supabase
            .from('users')
            .select(`id,idString,email,role,created_at`)
            .neq('role', 'customer')
            .order('created_at', { ascending: true });

      return { props: { agents: agents || [], myId: user.id } };
};
