import { Avatar, Grid, Input, Text } from '@geist-ui/core';
import {
      createBrowserSupabaseClient,
      createServerSupabaseClient,
} from '@supabase/auth-helpers-nextjs';
import { useSession } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import Link from 'next/link';
import Empty from '../../../components/empty';
import Layout from '../../../components/layout';
import DashboardSideNav from '../../../components/dashboardSideNav';
import moment from 'moment';
import { useState, useEffect, useRef } from 'react';
import { randomString } from '../../../config/functions';
import ChatMessages from '../../../components/ChatMessages';
import TicketInfoForm from '../../../components/ticketInfoForm';
import CustomerList from '../../../components/customerList';
import { HiEdit } from '../../../config/icons';
import EditTicket from '../../../components/editTicket';
import UploadAvatar from '../../../components/assetsUpload';

const PAGE_SIZE = 30;

const WebsiteDashboard = ({
      customer,
      ticket,
      customerList,
      customerTickets,
      ticketObjData,
      ticketMessagesList,
      hasMore: initialHasMore,
}) => {
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
      const [ticketObj, setTicketObj] = useState(ticketObjData);

      const cIndex = customerList.findIndex((x) => x.idString === customer);

      const activeCustomerObj = customerList[cIndex];

      const agents = customerList.filter(
            (u) => u.role && u.role !== 'customer'
      );

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
                        .insert({
                              id: randomString(12, '#'),
                              message: text,
                              type: 'text',
                              userId: user.id,
                              userType: 'owner',
                              ticketId: ticket,
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
                              userType: 'owner',
                              ticketId: ticket,
                              filePath,
                        })
                        .select();
                  if (!error && newMessage?.[0]) appendMessage(newMessage[0]);
            }
      };

      return (
            <>
                  <Head>
                        <title>Dashboard</title>
                        <link rel="icon" href="/favicon.png" />
                  </Head>
                  <div className="dashboard">
                        <div className="chat-container">
                              <DashboardSideNav active="dashboard" />
                              <Grid.Container>
                                    <Grid xs={24} md={6} xl={4}>
                                          <CustomerList
                                                customer={customer}
                                                customerList={customerList}
                                          />
                                    </Grid>
                                    <Grid
                                          xs={24}
                                          md={13}
                                          xl={16}
                                          className="chat-container-dash"
                                    >
                                          <div className="chat-box-dash dashboard-chat">
                                                <div className="chat-head">
                                                      <div className="ticket-meta">
                                                            <Text h3>
                                                                  <span>
                                                                        {
                                                                              ticketObj?.title
                                                                        }
                                                                  </span>
                                                                  <EditTicket
                                                                        ticketObj={
                                                                              ticketObj
                                                                        }
                                                                        triggerUpdate={(
                                                                              obj
                                                                        ) =>
                                                                              setTicketObj(
                                                                                    obj
                                                                              )
                                                                        }
                                                                  />
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
                                                            if (
                                                                  e.target
                                                                        .scrollTop <
                                                                  80
                                                            )
                                                                  loadOlder();
                                                      }}
                                                >
                                                      {loadingMore && (
                                                            <div className="chat-loading-more">
                                                                  Loading…
                                                            </div>
                                                      )}
                                                      <ChatMessages
                                                            publicChat={false}
                                                            messagesList={
                                                                  messagesList
                                                            }
                                                      />
                                                </div>
                                                <div className="chat-message-input">
                                                      <div className="message-form">
                                                            <div className="file-attach">
                                                                  <UploadAvatar
                                                                        uid={
                                                                              session
                                                                                    ?.user
                                                                                    .id
                                                                        }
                                                                        onUpload={
                                                                              onUpload
                                                                        }
                                                                  />
                                                            </div>
                                                            <div>
                                                                  <Input
                                                                        placeholder="Type a message"
                                                                        width="100%"
                                                                        value={
                                                                              message
                                                                        }
                                                                        onChange={(
                                                                              e
                                                                        ) =>
                                                                              setMessage(
                                                                                    e
                                                                                          .target
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
                                    </Grid>
                                    <Grid xs={24} md={5} xl={4}>
                                          <TicketInfoForm
                                                activeCustomerObj={
                                                      activeCustomerObj
                                                }
                                                ticketObj={ticketObj}
                                                agents={agents}
                                                onTicketUpdate={setTicketObj}
                                          />
                                    </Grid>
                              </Grid.Container>
                        </div>
                  </div>
            </>
      );
};

export default WebsiteDashboard;

export const getServerSideProps = async (ctx) => {
      const { customer, ticket } = ctx.query;
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

      // Retrieve provider_token & logged in user's third-party id from metadata
      const { user } = session;

      let customerList = [];

      // const { data: webObj, error } = await supabase
      //       .from('websites')
      //       .select(`*`)
      //       .eq('wid', websiteId)
      //       .single();

      const { data, error } = await supabase.from('users').select(`*`);
      customerList = data || [];

      const customerIndex = customerList.findIndex(
            (x) => x.idString === customer
      );

      const customerSessionIndex = customerList.findIndex(
            (x) => x.id === user.id
      );

      const activeCustomerObj = customerList[customerIndex];
      const sessionUser = customerList[customerSessionIndex];

      if (sessionUser?.role !== 'agent' && sessionUser?.role !== 'admin')
            return {
                  redirect: {
                        destination: '/',
                        permanent: false,
                  },
            };

      if (!activeCustomerObj)
            return {
                  redirect: {
                        destination: '/dashboard',
                        permanent: false,
                  },
            };

      const { id } = activeCustomerObj;

      const { data: customerTickets, error: errorOnTickets } = await supabase
            .from('tickets')
            .select(`*`)
            .eq('userId', id);

      const { data: ticketObjData, error: ticketError } = await supabase
            .from('tickets')
            .select(`*`)
            .eq('id', ticket)
            .single();

      let ticketMessagesList = [];

      const { data: messagesArray, count } = await supabase
            .from('ticketMessages')
            .select(`*`, { count: 'exact' })
            .eq('ticketId', ticket)
            .order('created_at', { ascending: false })
            .range(0, 29);
      if (messagesArray) ticketMessagesList = messagesArray.reverse();
      const hasMore = (count || 0) > 30;

      return {
            props: {
                  customerList,
                  customer,
                  customerTickets: customerTickets || [],
                  ticket,
                  ticketMessagesList,
                  hasMore,
                  ticketObjData,
            },
      };
};
