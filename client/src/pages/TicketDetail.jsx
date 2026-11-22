import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Lock, 
  Globe, 
  UserPlus, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  ShieldAlert, 
  Info,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import SlaCountdown from '../components/SlaCountdown';

export default function TicketDetail({ ticketId, onBack }) {
  const { user, isAdmin, isStaff } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('conversation'); // 'conversation' | 'audit'

  // Composer state
  const [composerMode, setComposerMode] = useState('PUBLIC_REPLY'); // 'PUBLIC_REPLY' | 'INTERNAL_NOTE'
  const [replyContent, setReplyContent] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);

  // Action status/errors
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadTicket = async () => {
    try {
      const data = await api.getTicket(ticketId);
      setTicket(data.ticket);
    } catch (err) {
      console.error('Failed to load ticket:', err);
      setActionError(err.message || 'Failed to load ticket details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    api.getAgents().then(d => setAgents(d.agents || [])).catch(() => {});
  }, [ticketId]);

  // Action 1: Atomic Take Ticket (INC-0291 Concurrency Solution)
  const handleClaimTicket = async () => {
    try {
      setActionError(null);
      setActionSuccess(null);
      const res = await api.claimTicket(ticketId);
      setActionSuccess('You have successfully claimed this ticket!');
      await loadTicket();
    } catch (err) {
      // Meaningful concurrency error
      setActionError(err.message || 'Unable to claim ticket.');
    }
  };

  // Action 2: Reassign Ticket
  const handleReassign = async (agentId) => {
    try {
      setActionError(null);
      setActionSuccess(null);
      await api.assignTicket(ticketId, agentId);
      setActionSuccess('Ticket successfully reassigned.');
      await loadTicket();
    } catch (err) {
      setActionError(err.message || 'Failed to reassign ticket.');
    }
  };

  // Action 3: Change Priority
  const handlePriorityChange = async (newPriority) => {
    try {
      setActionError(null);
      setActionSuccess(null);
      await api.updatePriority(ticketId, newPriority);
      setActionSuccess(`Priority changed to ${newPriority}. SLA deadlines recalculated.`);
      await loadTicket();
    } catch (err) {
      setActionError(err.message || 'Failed to change priority.');
    }
  };

  // Action 4: Change Status
  const handleStatusChange = async (newStatus) => {
    try {
      setActionError(null);
      setActionSuccess(null);
      await api.updateStatus(ticketId, newStatus);
      setActionSuccess(`Status changed to ${newStatus}.`);
      await loadTicket();
    } catch (err) {
      setActionError(err.message || 'Failed to change status.');
    }
  };

  // Action 5: Send Message (Public Reply or Internal Note)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      setSubmittingMessage(true);
      setActionError(null);
      await api.sendMessage(ticketId, composerMode, replyContent.trim());
      setReplyContent('');
      setActionSuccess(composerMode === 'PUBLIC_REPLY' ? 'Public reply sent to customer.' : 'Private internal note saved.');
      await loadTicket();
    } catch (err) {
      setActionError(err.message || 'Failed to post message.');
    } finally {
      setSubmittingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Loading ticket details...</span>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <button onClick={onBack} className="text-sm text-blue-600 font-semibold flex items-center gap-1.5 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Tickets
        </button>
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
          Ticket not found or access denied.
        </div>
      </div>
    );
  }

  const isAssignedToMe = ticket.assignedToId === user?.id;
  const isUnassigned = !ticket.assignedToId;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button & Ticket Meta Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-lg font-bold text-blue-600">{ticket.id}</span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 leading-tight">{ticket.subject}</h1>
          </div>
        </div>

        {/* Claim / Ownership Controls (INC-0291 Protection) */}
        <div className="flex items-center gap-2">
          {isUnassigned ? (
            <button
              onClick={handleClaimTicket}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all hover:shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>Take This Ticket</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
              <span className="text-slate-500 font-medium">Assigned to:</span>
              <span className="font-bold text-slate-800">{ticket.assignedTo?.name}</span>
              {isAssignedToMe && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">(You)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Layout Grid: Left Content / Right Control Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Description Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                  {ticket.customer?.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{ticket.customer?.name}</div>
                  <div className="text-xs text-slate-500">{ticket.customer?.email} · {ticket.customer?.department || 'Customer'}</div>
                </div>
              </div>
              <span className="text-xs text-slate-400">
                Created {new Date(ticket.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>

            <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed pt-1">
              {ticket.description}
            </div>
          </div>

          {/* Navigation Tabs: Conversation vs Immutable Audit Timeline */}
          <div className="flex border-b border-slate-200 gap-4">
            <button
              onClick={() => setActiveTab('conversation')}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === 'conversation'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Conversation & Notes ({ticket.messages?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-3 text-sm font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Immutable Activity Audit ({ticket.auditLogs?.length || 0})</span>
            </button>
          </div>

          {/* TAB 1: CONVERSATION & COMPOSER */}
          {activeTab === 'conversation' && (
            <div className="space-y-5">
              {/* Message Feed */}
              <div className="space-y-4">
                {ticket.messages?.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                    No messages yet. Send a public reply to the customer or leave an internal note.
                  </div>
                ) : (
                  ticket.messages?.map((msg) => {
                    const isInternal = msg.type === 'INTERNAL_NOTE';
                    const isCustomer = msg.sender?.role === 'CUSTOMER';

                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl p-4 transition-all shadow-2xs border ${
                          isInternal
                            ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                            : isCustomer
                            ? 'bg-slate-50 border-slate-200 text-slate-900'
                            : 'bg-blue-50/60 border-blue-200 text-slate-900'
                        }`}
                      >
                        {/* Message Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">
                              {msg.sender?.name}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                              isInternal
                                ? 'bg-amber-200 text-amber-900 flex items-center gap-1'
                                : isCustomer
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-blue-200 text-blue-900'
                            }`}>
                              {isInternal && <Lock className="w-3 h-3" />}
                              {isInternal ? 'Private Team Note' : isCustomer ? 'Customer Reply' : 'Public Agent Reply'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {new Date(msg.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>

                        {/* Internal Note Banner Warning (INC-0304 Solution) */}
                        {isInternal && (
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 mb-2 bg-amber-100/60 px-2 py-1 rounded">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                            <span>Confidential Internal Note: NEVER visible to customers via screens, APIs, or exports.</span>
                          </div>
                        )}

                        {/* Message Content */}
                        <div className="text-sm whitespace-pre-line leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer Box (INC-0304 Strict Separation) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                {/* Switcher Mode Header */}
                <div className="flex border-b border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setComposerMode('PUBLIC_REPLY')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                      composerMode === 'PUBLIC_REPLY'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>Public Reply (Visible to Customer)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setComposerMode('INTERNAL_NOTE')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                      composerMode === 'INTERNAL_NOTE'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>Private Internal Note (Team Only)</span>
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSendMessage} className="p-4 space-y-3">
                  {composerMode === 'INTERNAL_NOTE' && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Private Note Mode:</strong> This note is strictly internal for support agents and managers. It will not be sent to or seen by the customer.
                      </span>
                    </div>
                  )}

                  <textarea
                    rows={4}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={
                      composerMode === 'PUBLIC_REPLY'
                        ? 'Write a public response to the customer...'
                        : 'Add private internal notes, handover details, or team handling instructions...'
                    }
                    className={`w-full p-3 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-all ${
                      composerMode === 'INTERNAL_NOTE'
                        ? 'bg-amber-50/30 border-amber-200 focus:border-amber-500 focus:ring-amber-500/20'
                        : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Press Send to post with immutable timestamp.
                    </span>

                    <button
                      type="submit"
                      disabled={submittingMessage || !replyContent.trim()}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 ${
                        composerMode === 'INTERNAL_NOTE'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {submittingMessage ? 'Posting...' : composerMode === 'INTERNAL_NOTE' ? 'Add Internal Note' : 'Send Public Reply'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: IMMUTABLE AUDIT TIMELINE (INC-0318 Solution) */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Immutable Chronological Audit Trail</h3>
                  <p className="text-xs text-slate-500">Every single state change, message, assignment, and pause event with exact server timestamps.</p>
                </div>
                <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold">
                  Tamper-Proof & Append-Only
                </div>
              </div>

              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 py-2">
                {ticket.auditLogs?.map((log, idx) => (
                  <div key={log.id || idx} className="relative pl-6">
                    {/* Circle Node */}
                    <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white absolute -left-[7px] top-1.5 shadow-xs" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div className="font-bold text-slate-800">
                        {log.action.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 mt-1">
                      Actor: <span className="font-semibold text-slate-900">{log.userName}</span> ({log.userRole})
                    </div>

                    {(log.previousValue || log.newValue) && (
                      <div className="mt-1 text-xs bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                        {log.previousValue && <span className="text-red-600">Old: {log.previousValue} </span>}
                        {log.previousValue && log.newValue && <span className="text-slate-400">→ </span>}
                        {log.newValue && <span className="text-emerald-700 font-semibold">New: {log.newValue}</span>}
                      </div>
                    )}

                    {log.metadata && (
                      <div className="mt-1 text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded truncate">
                        {log.metadata}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Control Sidebar (1/3) */}
        <div className="space-y-6">
          {/* SLA Tracking Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>SLA Performance Commitments</span>
              <SlaCountdown slaState={ticket.slaState} countdownText={ticket.slaCountdownText} compact />
            </h3>

            <div className="space-y-3 pt-1 text-xs">
              {/* First Response SLA */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>First Response Deadline</span>
                  <span>{ticket.firstResponseAt ? 'Met' : 'Pending'}</span>
                </div>
                <div className="text-slate-500">
                  Target: {new Date(ticket.firstResponseDeadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                {ticket.firstResponseAt ? (
                  <div className="text-emerald-700 font-semibold">
                    Completed at: {new Date(ticket.firstResponseAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                ) : (
                  <div className="text-blue-700 font-mono">
                    Time left: {ticket.remainingFirstResponseMinutes !== null ? `${Math.round(ticket.remainingFirstResponseMinutes)} mins` : 'N/A'}
                  </div>
                )}
              </div>

              {/* Resolution SLA */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Resolution Deadline</span>
                  <span className={ticket.slaState === 'OVERDUE' ? 'text-red-600 font-bold' : 'text-slate-600'}>
                    {ticket.slaState === 'PAUSED' ? 'Paused' : ticket.slaState}
                  </span>
                </div>
                <div className="text-slate-500">
                  Target: {new Date(ticket.resolutionDeadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div className="font-mono text-slate-800 font-semibold">
                  Working time remaining: {ticket.slaCountdownText}
                </div>
                {ticket.totalPausedSeconds > 0 && (
                  <div className="text-[11px] text-amber-700 pt-1">
                    Preserved paused time: {Math.round(ticket.totalPausedSeconds / 60)} minutes
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Status Controls */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Change Status</h3>
            <p className="text-xs text-slate-500">
              Setting status to <em>Waiting for Customer</em> automatically pauses the Resolution SLA timer.
            </p>

            <div className="space-y-1.5 pt-1">
              {['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  disabled={ticket.status === st}
                  onClick={() => handleStatusChange(st)}
                  className={`w-full py-2 px-3 text-xs font-semibold rounded-lg text-left transition-all flex items-center justify-between ${
                    ticket.status === st
                      ? 'bg-blue-50 text-blue-800 border border-blue-200 font-bold'
                      : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                  }`}
                >
                  <span>{st.replace(/_/g, ' ')}</span>
                  {ticket.status === st && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Controls */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Update Priority</h3>
            <p className="text-xs text-slate-500">
              Recalculates SLA deadlines using the configured Arvo priority policy.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {['URGENT', 'MEDIUM', 'SMALL'].map((pr) => (
                <button
                  key={pr}
                  disabled={ticket.priority === pr}
                  onClick={() => handlePriorityChange(pr)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg text-center transition-all border ${
                    ticket.priority === pr
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>

          {/* Reassignment Controls */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Reassign Agent</h3>
            <p className="text-xs text-slate-500">Transfer ownership with full audit logging.</p>

            <select
              value={ticket.assignedToId || ''}
              onChange={(e) => handleReassign(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>Select an agent...</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>{ag.name} ({ag.department})</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
