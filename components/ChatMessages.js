import { Text } from '@geist-ui/core';
import moment from 'moment';
import { HiDocuText } from '../config/icons';
import { GrDocumentCsv } from 'react-icons/gr';
import { contentTypeCheck } from '../config/functions';

const ASSET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets`;

const ChatMessages = ({ messagesList, publicChat }) => {
      return (
            <div>
                  {messagesList?.map((m, key) => (
                        <div
                              className={
                                    publicChat
                                          ? m.userType === 'customer'
                                                ? 'message-card push-message-right'
                                                : 'message-card'
                                          : m.userType === 'customer'
                                          ? 'message-card '
                                          : 'message-card push-message-right'
                              }
                              key={key}
                        >
                              <div className="message-line">
                                    {m.type === 'text' && !m.filePath && (
                                          <div className="message">
                                                <Text mb={0} mt={0}>
                                                      {m.message}
                                                </Text>
                                          </div>
                                    )}
                                    {m.filePath &&
                                          contentTypeCheck(m.type) ===
                                                'image' && (
                                          <div className="image">
                                                <a
                                                      href={`${ASSET_BASE}/${m.filePath}`}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                >
                                                      <img
                                                            alt={m.message}
                                                            className="chat-image"
                                                            src={`${ASSET_BASE}/${m.filePath}`}
                                                      />
                                                </a>
                                                <div className="image-alt">
                                                      <Text
                                                            small
                                                            type="secondary"
                                                      >
                                                            {m.message}
                                                      </Text>
                                                </div>
                                          </div>
                                    )}
                                    {m.filePath &&
                                          contentTypeCheck(m.type) === 'doc' && (
                                                <a
                                                      className="message pdf-message"
                                                      href={`${ASSET_BASE}/${m.filePath}`}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      download={m.message}
                                                >
                                                      <div className="chat-attach">
                                                            <HiDocuText />
                                                            <span>
                                                                  {m.message}
                                                            </span>
                                                      </div>
                                                </a>
                                          )}
                                    {m.filePath &&
                                          contentTypeCheck(m.type) ===
                                                'text' && (
                                                <a
                                                      className="message pdf-message"
                                                      href={`${ASSET_BASE}/${m.filePath}`}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      download={m.message}
                                                >
                                                      <div className="chat-attach">
                                                            <GrDocumentCsv />
                                                            <span>
                                                                  {m.message}
                                                            </span>
                                                      </div>
                                                </a>
                                          )}
                                    <br />
                                    <Text
                                          style={{ fontSize: 10 }}
                                          small
                                          type="secondary"
                                    >
                                          {moment(m.created_at).calendar()}
                                    </Text>
                              </div>
                        </div>
                  ))}
            </div>
      );
};

export default ChatMessages;
