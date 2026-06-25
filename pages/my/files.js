import { Table, Text } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useSession } from '@supabase/auth-helpers-react';
import moment from 'moment';
import Head from 'next/head';
import AuthBox from '../../components/authBox';
import MiniSideNav from '../../components/miniSidebar';
import { contentTypeCheck, formatBytes } from '../../config/functions';
import { HiDocuText } from '../../config/icons';

const CustomerFiles = ({ assetsList, user }) => {
      const session = useSession();
      const files = assetsList;

      const assetBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/assets/${user.id}`;
      const fileUrl = (name) => `${assetBase}/${name}`;

      const renderDate = (value) => moment(value).format('DD/MM/YYYY');

      const renderSize = (value, rowData) =>
            rowData.metadata?.size ? formatBytes(rowData.metadata.size) : '—';

      const fileType = (value, rowData) => rowData.metadata?.mimetype || '—';

      const renderFile = (value, rowData) => {
            const url = fileUrl(rowData.name);
            const isImage =
                  contentTypeCheck(rowData.metadata?.mimetype) === 'image';
            return (
                  <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="file-thumb"
                        title={rowData.name}
                  >
                        {isImage ? (
                              <img src={url} alt={rowData.name} />
                        ) : (
                              <HiDocuText />
                        )}
                  </a>
            );
      };

      const renderActions = (value, rowData) => (
            <div className="file-actions">
                  <a
                        href={fileUrl(rowData.name)}
                        target="_blank"
                        rel="noreferrer"
                  >
                        View
                  </a>
                  <a
                        href={`${fileUrl(rowData.name)}?download=${encodeURIComponent(
                              rowData.name
                        )}`}
                  >
                        Download
                  </a>
            </div>
      );

      return (
            <div className="dashboard">
                  <div>
                        <Head>
                              <title>My files</title>
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
                                          <Text h3 style={{ margin: 0 }}>
                                                My files
                                          </Text>
                                          <Text
                                                type="secondary"
                                                small
                                                style={{ marginTop: 4 }}
                                          >
                                                Files you&apos;ve shared across
                                                your tickets.
                                          </Text>
                                          <br />
                                          {files.length > 0 ? (
                                                <Table data={files}>
                                                      <Table.Column
                                                            label=""
                                                            render={renderFile}
                                                            width={60}
                                                      />
                                                      <Table.Column
                                                            prop="name"
                                                            label="Name"
                                                      />
                                                      <Table.Column
                                                            prop="size"
                                                            label="Size"
                                                            render={renderSize}
                                                      />
                                                      <Table.Column
                                                            prop="type"
                                                            label="Type"
                                                            render={fileType}
                                                      />
                                                      <Table.Column
                                                            prop="created_at"
                                                            label="Uploaded"
                                                            render={renderDate}
                                                      />
                                                      <Table.Column
                                                            label="Actions"
                                                            render={
                                                                  renderActions
                                                            }
                                                      />
                                                </Table>
                                          ) : (
                                                <Text
                                                      type="secondary"
                                                      style={{ marginTop: 20 }}
                                                >
                                                      No files yet. Attach a file
                                                      in a ticket and it will
                                                      appear here.
                                                </Text>
                                          )}
                                    </div>
                              </div>
                        )}
                  </div>
            </div>
      );
};

export default CustomerFiles;

export const getServerSideProps = async (ctx) => {
      // Create authenticated Supabase Client
      const supabase = createServerSupabaseClient(ctx);
      // Check if we have a session

      let assetsList = [];
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
      const { data: userObj, error: userError } = await supabase
            .from('users')
            .select(`email,id,role`)
            .eq('id', user.id)
            .single();
      const role = userObj?.role;
      if (role !== 'customer')
            return {
                  redirect: {
                        destination: '/dashboard',
                        permanent: false,
                  },
            };
      const { data, error } = await supabase.storage
            .from('assets')
            .list(`assets/${user.id}`, {
                  limit: 100,
                  offset: 0,
                  sortBy: { column: 'created_at', order: 'asc' },
            });

      assetsList = data || [];

      return { props: { assetsList, user } };
};
