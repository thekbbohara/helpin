import { Select, Text, User } from '@geist-ui/core';
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import ReactCountryFlag from 'react-country-flag';
import moment from 'moment';
import { HiLocation, HiClock, HiFlag } from '../config/icons';
import CreateTicket from './createTicketForCustomer';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const TicketInfoForm = ({
      activeCustomerObj,
      ticketObj,
      agents = [],
      onTicketUpdate,
}) => {
      const supabase = useSupabaseClient();
      const [saving, setSaving] = useState(false);
      const ipInfo = activeCustomerObj?.ipInfo || {};

      const update = async (patch) => {
            if (!ticketObj) return;
            setSaving(true);
            const { data } = await supabase
                  .from('tickets')
                  .update(patch)
                  .eq('id', ticketObj.id)
                  .select()
                  .single();
            setSaving(false);
            if (data && onTicketUpdate) onTicketUpdate(data);
      };

      return (
            <div className="ticket-info-form">
                  <User
                        text={activeCustomerObj?.idString?.[0]?.toUpperCase() || 'U'}
                        name={activeCustomerObj?.idString}
                        style={{ padding: '20px 0px' }}
                  >
                        {activeCustomerObj?.email}
                  </User>

                  {(ipInfo.state || ipInfo.country) && (
                        <div className="svg-span">
                              <HiLocation />
                              <span>
                                    {[ipInfo.state, ipInfo.country]
                                          .filter(Boolean)
                                          .join(', ')}
                              </span>
                        </div>
                  )}
                  {ipInfo.timeZone && (
                        <div className="svg-span">
                              <HiClock />
                              <span>{ipInfo.timeZone}</span>
                        </div>
                  )}
                  {ipInfo.countryCode && (
                        <div className="svg-span">
                              <HiFlag />
                              <span>
                                    <ReactCountryFlag
                                          countryCode={ipInfo.countryCode}
                                    />
                              </span>
                        </div>
                  )}

                  {ticketObj && (
                        <div className="ticket-controls">
                              <Text small type="secondary" className="control-label">
                                    Status
                              </Text>
                              <Select
                                    width="100%"
                                    value={ticketObj.status || 'open'}
                                    disabled={saving}
                                    onChange={(v) => update({ status: v })}
                              >
                                    {STATUSES.map((s) => (
                                          <Select.Option key={s} value={s}>
                                                {s}
                                          </Select.Option>
                                    ))}
                              </Select>

                              <Text small type="secondary" className="control-label">
                                    Priority
                              </Text>
                              <Select
                                    width="100%"
                                    value={ticketObj.priority || 'normal'}
                                    disabled={saving}
                                    onChange={(v) => update({ priority: v })}
                              >
                                    {PRIORITIES.map((p) => (
                                          <Select.Option key={p} value={p}>
                                                {p}
                                          </Select.Option>
                                    ))}
                              </Select>

                              <Text small type="secondary" className="control-label">
                                    Assignee
                              </Text>
                              <Select
                                    width="100%"
                                    value={ticketObj.assignedTo || ''}
                                    disabled={saving}
                                    onChange={(v) =>
                                          update({ assignedTo: v || null })
                                    }
                              >
                                    <Select.Option value="">
                                          Unassigned
                                    </Select.Option>
                                    {agents.map((a) => (
                                          <Select.Option key={a.id} value={a.id}>
                                                {a.email || a.idString}
                                          </Select.Option>
                                    ))}
                              </Select>

                              {ticketObj.firstResponseDueAt &&
                                    !ticketObj.firstRespondedAt && (
                                          <Text
                                                small
                                                type="secondary"
                                                className="sla-note"
                                          >
                                                First response due{' '}
                                                {moment(
                                                      ticketObj.firstResponseDueAt
                                                ).fromNow()}
                                          </Text>
                                    )}
                        </div>
                  )}

                  <br />
                  {activeCustomerObj && (
                        <CreateTicket
                              btnType="primary"
                              activeCustomerObj={activeCustomerObj}
                        />
                  )}
            </div>
      );
};

export default TicketInfoForm;
