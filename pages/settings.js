import { Button, Grid, Text } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import DashboardSideNav from '../components/dashboardSideNav';

const Settings = ({ userObj }) => {
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
                  <div className="chat-container">
                        <DashboardSideNav active="settings" />

                        <Grid.Container>
                              <Grid xs={24}>
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
                                                            {userObj?.email}
                                                      </span>
                                                </div>
                                                <div className="settings-row">
                                                      <span className="settings-label">
                                                            Role
                                                      </span>
                                                      <span className="settings-value">
                                                            {userObj?.role ||
                                                                  '—'}
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
                              </Grid>
                        </Grid.Container>
                  </div>
            </div>
      );
};

export default Settings;

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
            .select(`email,role`)
            .eq('id', user.id)
            .single();

      return { props: { userObj: userObj || { email: user.email } } };
};
