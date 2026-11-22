import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, History, Clock } from 'lucide-react';
import { api } from '../api';

export default function AuditLogsView({ onSelectTicket }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (actionFilter) params.action = actionFilter;
      if (ticketSearch) params.ticketId = ticketSearch.trim().toUpperCase();

      const data = await api.getAuditLogs(params);
      setLogs(data.auditLogs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter, ticketSearch]);

  const actionTypes = [
    'TICKET_CREATED',
    'TICKET_ASSIGNED',
    'TICKET_REASSIGNED',
    'PRIORITY_CHANGED',
    'STATUS_CHANGED',
    'PUBLIC_REPLY_SENT',
    'INTERNAL_NOTE_ADDED',
    'SLA_PAUSED',
    'SLA_RESUMED',
    'TICKET_RESOLVED',
    'TICKET_CLOSED',
    'TICKET_REOPENED',
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Immutable System Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500">
            Append-only, server-timestamped records solving Incident INC-0318. Audit records cannot be modified or deleted.
          </p>
        </div>

        <div className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Server Timestamps: UTC Normalized</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Ticket ID (e.g. INC-0291)..."
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Audit Actions ({actionTypes.length})</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>{act.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading audit events...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No audit events match your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Exact Server UTC</th>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Previous Value</th>
                  <th className="py-3 px-4">New Value</th>
                  <th className="py-3 px-4">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-600">
                      <button
                        onClick={() => onSelectTicket && onSelectTicket(log.ticketId)}
                        className="hover:underline text-left"
                      >
                        {log.ticketId}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-sans font-semibold text-[11px] bg-slate-100 text-slate-700">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-800">
                      <span className="font-semibold">{log.userName}</span>{' '}
                      <span className="text-[10px] text-slate-400">({log.userRole})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                      {log.previousValue || '—'}
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold truncate max-w-xs">
                      {log.newValue || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                      {log.metadata || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
