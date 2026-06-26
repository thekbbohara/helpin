import { Text, useToasts } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import Head from 'next/head';
import Link from 'next/link';
import DashboardSideNav from '../components/dashboardSideNav';

const AVAILABLE = [
      { name: 'Email forwarding', desc: 'Turn inbound emails into tickets.' },
      { name: 'Slack', desc: 'Get notified of new tickets in a channel.' },
      { name: 'Webhooks', desc: 'Post ticket events to your own endpoint.' },
];

const Integrations = ({ websites, origin }) => {
      const { setToast } = useToasts();

      const snippet = (wid) =>
            `<script src="${origin}/widget.js" data-wid="${wid}" async></script>`;

      const copy = (text) => {
            navigator.clipboard?.writeText(text);
            setToast({ text: 'Snippet copied to clipboard.' });
      };

      return (
            <div className="dashboard">
                  <Head>
                        <title>Integrations</title>
                        <link rel="icon" href="/favicon.png" />
                  </Head>
                  <div className="chat-container">
                        <DashboardSideNav active="integrations" />
                        <div className="queue-page">
                              <div className="queue-header">
                                    <Text h3 style={{ margin: 0 }}>
                                          Integrations
                                    </Text>
                              </div>

                              <Text b style={{ fontSize: 14 }}>
                                    Connected websites
                              </Text>
                              {websites.length === 0 ? (
                                    <Text type="secondary" small>
                                          No website connected yet.{' '}
                                          <Link href="/setup">
                                                <u>Set up a website</u>
                                          </Link>{' '}
                                          to embed the chat widget.
                                    </Text>
                              ) : (
                                    websites.map((w) => (
                                          <div
                                                key={w.id}
                                                className="integration-card"
                                          >
                                                <div className="integration-head">
                                                      <div>
                                                            <Text
                                                                  b
                                                                  style={{
                                                                        margin: 0,
                                                                  }}
                                                            >
                                                                  {w.name ||
                                                                        w.url}
                                                            </Text>
                                                            <Text
                                                                  small
                                                                  type="secondary"
                                                                  style={{
                                                                        margin: 0,
                                                                  }}
                                                            >
                                                                  {w.url}
                                                            </Text>
                                                      </div>
                                                      <button
                                                            className="copy-btn"
                                                            onClick={() =>
                                                                  copy(
                                                                        snippet(
                                                                              w.wid
                                                                        )
                                                                  )
                                                            }
                                                      >
                                                            Copy snippet
                                                      </button>
                                                </div>
                                                <pre className="snippet mono">
                                                      {snippet(w.wid)}
                                                </pre>
                                          </div>
                                    ))
                              )}

                              <br />
                              <Text b style={{ fontSize: 14 }}>
                                    Available integrations
                              </Text>
                              <div className="integration-grid">
                                    {AVAILABLE.map((i) => (
                                          <div
                                                key={i.name}
                                                className="integration-tile"
                                          >
                                                <Text
                                                      b
                                                      style={{ margin: 0 }}
                                                >
                                                      {i.name}
                                                </Text>
                                                <Text
                                                      small
                                                      type="secondary"
                                                      style={{ margin: '4px 0 10px' }}
                                                >
                                                      {i.desc}
                                                </Text>
                                                <span className="status-badge status-resolved">
                                                      Coming soon
                                                </span>
                                          </div>
                                    ))}
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default Integrations;

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

      const { data: websites } = await supabase
            .from('websites')
            .select(`id,wid,name,url`)
            .order('created_at', { ascending: false });

      const proto = ctx.req.headers['x-forwarded-proto'] || 'https';
      const origin = `${proto}://${ctx.req.headers.host}`;

      return { props: { websites: websites || [], origin } };
};
