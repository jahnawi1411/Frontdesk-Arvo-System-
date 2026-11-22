import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Send, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare,
  ShieldCheck,
  LogOut,
  User,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import SlaCountdown from '../components/SlaCountdown';

export default function CustomerPortal() {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Ticket Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Customer Reply State
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Reopen State
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopening, setReopening] = useState(false);

  // Alerts
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomerTickets();
      setTickets(data.tickets || []);
      if (!selectedTicketId && data.tickets?.length > 0) {
        setSelectedTicketId(data.tickets[0].id);
      }
    } catch (err) {
      console.error('Customer portal load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTicketDetail = async (id) => {
    try {
      setDetailLoading(true);
      setErrorMsg(null);
      const data = await api.getCustomerTicket(id);
      setTicketDetail(data.ticket);
    } catch (err) {
      console.error('Failed to load customer ticket:', err);
      setErrorMsg(err.message || 'Unable to view ticket.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    }
  }, [selectedTicketId]);

  // Create Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;

    try {
      setCreatingTicket(true);
      setErrorMsg(null);
      const res = await api.createCustomerTicket({
        subject: newSubject.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });

      setShowCreateModal(false);
      setNewSubject('');
      setNewDescription('');
      setNewPriority('MEDIUM');
      setSuccessMsg(`Ticket ${res.ticket.id} created successfully! Our team has been notified.`);
      await loadTickets();
      setSelectedTicketId(res.ticket.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  // Send Reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      setSendingReply(true);
      setErrorMsg(null);
      await api.customerReply(selectedTicketId, replyContent.trim());
      setReplyContent('');
      setSuccessMsg('Your reply has been sent to our support team.');
      await loadTicketDetail(selectedTicketId);
      await loadTickets();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  // Reopen Ticket
  const handleReopenTicket = async (e) => {
    e.preventDefault();
    try {
      setReopening(true);
      setErrorMsg(null);
      await api.reopenTicket(selectedTicketId, reopenReason.trim());
      setShowReopenModal(false);
      setReopenReason('');
      setSuccessMsg('Your ticket has been reopened and placed back in our agent queue.');
      await loadTicketDetail(selectedTicketId);
      await loadTickets();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reopen ticket.');
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Customer Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">Arvo Systems Support Portal</h1>
            <span className="text-[11px] text-slate-500 font-medium">Customer Help Desk</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold">{user?.name}</span>
            <span className="text-slate-400">({user?.email})</span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 font-medium px-2 py-1 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-5">
        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your Support Requests</h2>
            <p className="text-xs text-slate-500">Track and respond to your active technical issues and service requests.</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit New Ticket</span>
          </button>
        </div>

        {/* 2-Column Split: Ticket List (Left) / Detail Conversation (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Tickets List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[75vh]">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tickets ({tickets.length})
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading your tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  You have not submitted any tickets yet. Click "Submit New Ticket" to get help!
                </div>
              ) : (
                tickets.map((t) => {
                  const isSelected = t.id === selectedTicketId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-blue-600">{t.id}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-sm font-bold text-slate-800 truncate">{t.subject}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                        <PriorityBadge priority={t.priority} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Ticket Conversation & Details */}
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col h-[75vh] overflow-hidden">
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Loading ticket conversation...
              </div>
            ) : !ticketDetail ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Select a ticket from the left to view conversation.
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-600">{ticketDetail.id}</span>
                      <PriorityBadge priority={ticketDetail.priority} />
                      <StatusBadge status={ticketDetail.status} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{ticketDetail.subject}</h3>
                  </div>

                  {/* Reopen Action (Section 5 requirement) */}
                  {ticketDetail.status === 'RESOLVED' && ticketDetail.canReopen && (
                    <button
                      onClick={() => setShowReopenModal(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Ticket</span>
                    </button>
                  )}
                </div>

                {/* Conversation Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* Original Customer Problem Description */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-200/60">
                      <span className="font-bold text-slate-700">Initial Problem Statement</span>
                      <span>{new Date(ticketDetail.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-line">{ticketDetail.description}</p>
                  </div>

                  {/* Public Messages Only (INC-0304 Guarantee) */}
                  {ticketDetail.messages?.map((msg) => {
                    const isFromAgent = msg.senderRole !== 'CUSTOMER';

                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl p-4 border text-sm space-y-1.5 ${
                          isFromAgent
                            ? 'bg-blue-50/70 border-blue-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-black/5">
                          <span className="font-bold text-slate-800">
                            {msg.senderName} {isFromAgent && <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-semibold ml-1">Arvo Support</span>}
                          </span>
                          <span className="text-slate-400">
                            {new Date(msg.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Customer Reply Composer */}
                {ticketDetail.status !== 'CLOSED' ? (
                  <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 bg-white space-y-2">
                    {ticketDetail.status === 'WAITING_FOR_CUSTOMER' && (
                      <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Our agents are waiting for your feedback. Sending a reply will automatically resume the ticket resolution clock.</span>
                      </div>
                    )}

                    <textarea
                      rows={3}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Type your response to the support team..."
                      className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={sendingReply || !replyContent.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-500">
                    This ticket has been permanently closed. Please submit a new ticket if you have another inquiry.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: SUBMIT NEW TICKET */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Submit Support Request</h3>
            <p className="text-xs text-slate-500">Provide details about your issue to Arvo Systems Support.</p>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="E.g., Unable to sync database on server restart"
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Severity / Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="URGENT">Urgent – Work completely blocked (2h reply commit)</option>
                  <option value="MEDIUM">Medium – Significant issue but partial workaround available</option>
                  <option value="SMALL">Small – General question or non-blocking request</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={4}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe what occurred, steps to reproduce, and any error messages..."
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {creatingTicket ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REOPEN TICKET */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Reopen Support Ticket</span>
            </h3>
            <p className="text-xs text-slate-500">
              You are permitted to reopen resolved tickets within 5 working days of resolution. Please tell us why the solution did not resolve the problem.
            </p>

            <form onSubmit={handleReopenTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Reopening</label>
                <textarea
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain what is still not functioning properly..."
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopening}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {reopening ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
