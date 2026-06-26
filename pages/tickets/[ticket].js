import { Avatar, Grid, Input, Text } from '@geist-ui/core';
import {
      createBrowserSupabaseClient,
      createServerSupabaseClient,
} from '@supabase/auth-helpers-nextjs';
import { useSession } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import UploadAvatar from '../../components/assetsUpload';
import ChatMessages from '../../components/ChatMessages';
import MiniSideNav from '../../components/miniSidebar';
import { randomString } from '../../config/functions';

const PAGE_SIZE = 30;

const HandlePage = ({ ticket, ticketMessagesList, hasMore: initialHasMore, ticketObj }) => {
      const messagesRef = useRef(null);
      const stickBottomRef = useRef(true);
      const [supabase] = useState(() => createBrowserSupabaseClient());
      const [message, setMessage] = useState('');
      const [messagesList, setMessagesList] = useState(ticketMessagesList);
      const [hasMore, setHasMore] = useState(initialHasMore);
      const [loadingMore, setLoadingMore] = useState(false);
      const session = useSession();
      const myIdRef = useRef(null);
      myIdRef.current = session?.user?.id;

      const appendMessage = (msg) => {
            stickBottomRef.current = true;
            setMessagesList((current) =>
                  current.some((m) => m.id === msg.id)
                        ? current
                        : [...current, msg]
            );
      };

      const loadOlder = async () => {
            if (loadingMore || !hasMore) return;
            setLoadingMore(true);
            stickBottomRef.current = false;
            const el = messagesRef.current;
            const prevHeight = el ? el.scrollHeight : 0;
            const { data } = await supabase
                  .from('ticketMessages')
                  .select('*')
                  .eq('ticketId', ticket)
                  .order('created_at', { ascending: false })
                  .range(messagesList.length, messagesList.length + PAGE_SIZE - 1);
            const older = (data || []).reverse();
            setMessagesList((cur) => {
                  const ids = new Set(cur.map((m) => m.id));
                  return [...older.filter((m) => !ids.has(m.id)), ...cur];
            });
            setHasMore(older.length === PAGE_SIZE);
            setLoadingMore(false);
            requestAnimationFrame(() => {
                  if (el) el.scrollTop = el.scrollHeight - prevHeight;
            });
      };

      const sendMessage = async (e) => {
            const { user } = session;

            if (user && message.trim() !== '' && e.key === 'Enter') {
                  const text = message;
                  setMessage('');
                  const { data: newMessage, error } = await supabase
                        .from('ticketMessages')
                        .upsert({
                              id: randomString(12, '#'),
                              message: text,
                              type: 'text',
                              userId: user.id,
                              userType: 'customer',
                              ticketId: ticket,
                        })
                        .select();
                  if (!error && newMessage?.[0]) appendMessage(newMessage[0]);
            }
      };

      const onUpload = async (filePath, fileObj) => {
            const { user } = session;

            if (user) {
                  const { data: newMessage, error } = await supabase
                        .from('ticketMessages')
                        .upsert({
                              id: randomString(12, '#'),
                              message: fileObj.name,
                              type: fileObj.type,
                              userId: user.id,
                              userType: 'customer',
                              ticketId: ticket,
                              filePath,
                        })
                        .select();
                  if (!error && newMessage?.[0]) appendMessage(newMessage[0]);
            }
      };

      useEffect(() => {
            if (stickBottomRef.current && messagesRef.current) {
                  messagesRef.current.scrollTop =
                        messagesRef.current.scrollHeight;
            }
      }, [messagesList]);

      // Load initial data and set up listeners
      useEffect(() => {
            // Listen for new and deleted messages

            const channel = supabase.channel('ticketMessages');

            channel.on(
                  'postgres_changes',
                  {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'ticketMessages',
                        filter: `ticketId=eq.${ticket}`,
                  },
                  (payload) => {
                        if (payload.new.userId === myIdRef.current) return;
                        stickBottomRef.current = true;
                        setMessagesList((current) =>
                              current.some((m) => m.id === payload.new.id)
                                    ? current
                                    : [...current, payload.new]
                        );
                  }
            );

            channel.subscribe(async (status) => {
                  console.log(status);
            });

            return () => {
                  supabase.removeChannel(channel);
            };
      }, []);

      return (
            <div className="dashboard">
                  <div>
                        <Head>
                              <title>{ticket}</title>
                              <link rel="icon" href="/favicon.png" />
                        </Head>

                        <div className="chat-container">
                              <MiniSideNav />

                              <div className="chat-box">
                                    <div className="chat-head support-head">
                                          <div className="support-avatar">P</div>
                                          <div className="support-meta">
                                                <Text
                                                      b
                                                      style={{
                                                            margin: 0,
                                                            fontSize: 16,
                                                      }}
                                                >
                                                      Peridot Support
                                                </Text>
                                                <Text
                                                      small
                                                      type="secondary"
                                                      style={{ margin: 0 }}
                                                >
                                                      {ticketObj?.title
                                                            ? ticketObj.title
                                                            : `Ticket #${ticket}`}
                                                </Text>
                                          </div>
                                    </div>
                                    <div
                                          style={{
                                                height: 'calc(100vh - 150px)',
                                                padding: '0px 20px',
                                                overflowY: 'scroll',
                                          }}
                                          ref={messagesRef}
                                          onScroll={(e) => {
                                                if (e.target.scrollTop < 80)
                                                      loadOlder();
                                          }}
                                    >
                                          {loadingMore && (
                                                <div className="chat-loading-more">
                                                      Loading…
                                                </div>
                                          )}
                                          <ChatMessages
                                                publicChat={true}
                                                messagesList={messagesList}
                                          />
                                    </div>
                                    <div className="chat-message-input">
                                          <div className="message-form">
                                                <div className="file-attach">
                                                      <UploadAvatar
                                                            uid={
                                                                  session?.user
                                                                        .id
                                                            }
                                                            onUpload={onUpload}
                                                      />
                                                </div>
                                                <div>
                                                      <Input
                                                            placeholder="Type a message"
                                                            width="100%"
                                                            value={message}
                                                            onChange={(e) =>
                                                                  setMessage(
                                                                        e.target
                                                                              .value
                                                                  )
                                                            }
                                                            onKeyDown={
                                                                  sendMessage
                                                            }
                                                            iconRight={
                                                                  <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                        strokeWidth={
                                                                              1.5
                                                                        }
                                                                        stroke="currentColor"
                                                                        className="w-6 h-6"
                                                                  >
                                                                        <path
                                                                              strokeLinecap="round"
                                                                              strokeLinejoin="round"
                                                                              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                                                                        />
                                                                  </svg>
                                                            }
                                                      />
                                                </div>
                                          </div>
                                    </div>
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default HandlePage;

export const getServerSideProps = async (ctx) => {
      const { ticket } = ctx.query;
      const supabase = createServerSupabaseClient(ctx);

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
      let ticketMessagesList = [];

      const { data: ticketObj, error: ticketError } = await supabase
            .from('tickets')
            .select(`*`)
            .eq('id', ticket)
            .single();

      if (!ticketObj || ticketObj.userId !== session.user.id)
            return {
                  redirect: {
                        destination: '/',
                        permanent: false,
                  },
            };

      const { data, count } = await supabase
            .from('ticketMessages')
            .select(`*`, { count: 'exact' })
            .eq('ticketId', ticket)
            .order('created_at', { ascending: false })
            .range(0, 29);
      if (data) ticketMessagesList = data.reverse();
      const hasMore = (count || 0) > 30;
      return { props: { ticket, ticketMessagesList, hasMore, ticketObj } };
};
