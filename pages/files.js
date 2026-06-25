import { Input, Text } from '@geist-ui/core';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import Head from 'next/head';
import Link from 'next/link';
import moment from 'moment';
import { useMemo, useState } from 'react';
import DashboardSideNav from '../components/dashboardSideNav';
import { contentTypeCheck } from '../config/functions';

const ASSET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets`;

const Files = ({ files, users }) => {
      const [search, setSearch] = useState('');
      const usersById = useMemo(() => {
            const m = {};
            users.forEach((u) => (m[u.id] = u));
            return m;
      }, [users]);

      const visible = useMemo(() => {
            const q = search.trim().toLowerCase();
            if (!q) return files;
            return files.filter((f) =>
                  [f.message, usersById[f.userId]?.idString]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(q)
            );
      }, [files, usersById, search]);

      return (
            <div className="dashboard">
                  <Head>
                        <title>Files</title>
                        <link rel="icon" href="/favicon.png" />
                  </Head>
                  <div className="chat-container">
                        <DashboardSideNav active="files" />
                        <div className="queue-page">
                              <div className="queue-header">
                                    <div>
                                          <Text h3 style={{ margin: 0 }}>
                                                Files
                                          </Text>
                                          <Text type="secondary" small>
                                                {visible.length} shared file
                                                {visible.length === 1
                                                      ? ''
                                                      : 's'}
                                          </Text>
                                    </div>
                              </div>

                              <div className="queue-toolbar single">
                                    <Input
                                          placeholder="Search by filename or customer…"
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
                                                      '2.2fr 1.2fr 1fr 1fr 1fr',
                                          }}
                                    >
                                          <span>File</span>
                                          <span>Customer</span>
                                          <span>Type</span>
                                          <span>Shared</span>
                                          <span></span>
                                    </div>
                                    {visible.map((f) => {
                                          const cust = usersById[f.userId];
                                          const url = `${ASSET_BASE}/${f.filePath}`;
                                          const kind =
                                                contentTypeCheck(f.type) ||
                                                'file';
                                          return (
                                                <div
                                                      key={f.id}
                                                      className="queue-row"
                                                      style={{
                                                            gridTemplateColumns:
                                                                  '2.2fr 1.2fr 1fr 1fr 1fr',
                                                      }}
                                                >
                                                      <span className="queue-title">
                                                            {f.message}
                                                      </span>
                                                      <span className="queue-muted">
                                                            {cust?.idString ||
                                                                  '—'}
                                                      </span>
                                                      <span className="queue-muted">
                                                            {kind}
                                                      </span>
                                                      <span className="queue-muted">
                                                            {moment(
                                                                  f.created_at
                                                            ).fromNow()}
                                                      </span>
                                                      <span className="file-actions">
                                                            <a
                                                                  href={url}
                                                                  target="_blank"
                                                                  rel="noreferrer"
                                                            >
                                                                  View
                                                            </a>
                                                            {cust?.idString && (
                                                                  <Link
                                                                        href={`/dashboard/${cust.idString}/${f.ticketId}`}
                                                                  >
                                                                        Ticket
                                                                  </Link>
                                                            )}
                                                      </span>
                                                </div>
                                          );
                                    })}
                                    {visible.length === 0 && (
                                          <Text
                                                type="secondary"
                                                style={{ padding: 24 }}
                                          >
                                                No files shared yet.
                                          </Text>
                                    )}
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default Files;

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
      if (!me || me.role === 'customer')
            return { redirect: { destination: '/', permanent: false } };

      const { data: files } = await supabase
            .from('ticketMessages')
            .select(`id,message,type,filePath,userId,ticketId,created_at`)
            .not('filePath', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500);

      const { data: users } = await supabase
            .from('users')
            .select(`id,idString`)
            .limit(2000);

      return { props: { files: files || [], users: users || [] } };
};
