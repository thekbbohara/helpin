import { Button, Text } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import AuthBox from '../../components/authBox';
import MiniSideNav from '../../components/miniSidebar';

const CustomerSettings = ({ userObj }) => {
      const session = useSession();
      const router = useRouter();
      const supabase = useSupabaseClient();
      const [signingOut, setSigningOut] = useState(false);

      const signOut = async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            router.push('/');
      };

      return (
            <div className="dashboard">
                  <div>
                        <Head>
                              <title>Settings</title>
                              <link rel="icon" href="/favicon.png" />
                        </Head>

                        {!session ? (
                              <AuthBox />
                        ) : (
                              <div
                                    className="chat-container"
                                    style={{ height: '100vh' }}
                              >
                                    <MiniSideNav />

                                    <div className="chat-box">
                                          <div className="settings-page">
                                                <Text h3 style={{ margin: 0 }}>
                                                      Settings
                                                </Text>
                                                <Text
                                                      type="secondary"
                                                      small
                                                      style={{ marginTop: 4 }}
                                                >
                                                      Manage your account.
                                                </Text>

                                                <div className="settings-card">
                                                      <div className="settings-row">
                                                            <span className="settings-label">
                                                                  Email
                                                            </span>
                                                            <span className="settings-value">
                                                                  {userObj?.email ||
                                                                        session
                                                                              .user
                                                                              .email}
                                                            </span>
                                                      </div>
                                                      <div className="settings-row">
                                                            <span className="settings-label">
                                                                  Account ID
                                                            </span>
                                                            <span className="settings-value">
                                                                  {userObj?.idString ||
                                                                        '—'}
                                                            </span>
                                                      </div>
                                                      <div className="settings-row">
                                                            <span className="settings-label">
                                                                  Role
                                                            </span>
                                                            <span className="settings-value">
                                                                  {userObj?.role ||
                                                                        'customer'}
                                                            </span>
                                                      </div>
                                                </div>

                                                <Button
                                                      type="error"
                                                      ghost
                                                      scale={2 / 3}
                                                      loading={signingOut}
                                                      onClick={signOut}
                                                >
                                                      Sign out
                                                </Button>
                                          </div>
                                    </div>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default CustomerSettings;

export const getServerSideProps = async (ctx) => {
      // Create authenticated Supabase Client
      const supabase = createServerSupabaseClient(ctx);
      // Check if we have a session
      const {
            data: { session },
      } = await supabase.auth.getSession();
      if (!session)
            return {
                  redirect: {
                        destination: '/',
                        permanent: false,
                  },
            };

      const { user } = session;
      const { data: userObj } = await supabase
            .from('users')
            .select(`email,idString,role`)
            .eq('id', user.id)
            .single();

      if (userObj?.role && userObj.role !== 'customer')
            return {
                  redirect: {
                        destination: '/dashboard',
                        permanent: false,
                  },
            };

      return { props: { userObj: userObj || null } };
};
