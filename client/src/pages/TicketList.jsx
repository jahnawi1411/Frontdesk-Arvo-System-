import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  Search, 
  RotateCcw, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { api } from '../api';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import SlaCountdown from '../components/SlaCountdown';

export default function TicketList({ initialView = 'all', onSelectTicket, searchQuery }) {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');

  useEffect(() => {
    async function fetchAgents() {
      try {
        const data = await api.getAgents().catch(() => ({ agents: [] }));
        setAgents(data.agents || []);
      } catch (e) {
        // non-critical
      }
    }
    fetchAgents();
  }, []);

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true);
        const params = {};
        if (initialView && initialView !== 'all') {
          params.view = initialView;
        }
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;
        if (agentFilter) params.assignedToId = agentFilter;
        if (slaFilter) params.slaState = slaFilter;
        if (searchQuery) params.search = searchQuery;

        const data = await api.getTickets(params);
        setTickets(data.tickets || []);
      } catch (err) {
        console.error('Failed to load tickets:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, [initialView, statusFilter, priorityFilter, agentFilter, slaFilter, searchQuery]);

  const resetFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setAgentFilter('');
    setSlaFilter('');
  };

  const getTitle = () => {
    switch (initialView) {
      case 'my': return 'My Assigned Tickets';
      case 'unassigned': return 'Unassigned Tickets (Needs Ownership)';
      case 'waiting': return 'Waiting for Customer (SLA Paused)';
      case 'overdue': return 'Overdue Tickets (Breached SLA)';
      case 'resolved': return 'Resolved & Closed Tickets';
      default: return 'All Support Tickets';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* View Header & Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{getTitle()}</h2>
            <p className="text-xs text-slate-500">
              Showing {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} matching current criteria
            </p>
          </div>

          {(statusFilter || priorityFilter || agentFilter || slaFilter) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Priority Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent (2h / Same day)</option>
              <option value="MEDIUM">Medium (Half day / ~3 days)</option>
              <option value="SMALL">Small (1 day / ~1 week)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Agent Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Assigned Agent
            </label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Support Staff</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* SLA State Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              SLA State
            </label>
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All SLA States</option>
              <option value="ON_TRACK">On Track</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAUSED">Paused (Waiting on Customer)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-sm">Fetching tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">No tickets found</div>
            <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Ticket ID</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Assigned Agent</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">SLA Countdown</th>
                  <th className="py-3.5 px-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 group-hover:underline">
                      {t.id}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-semibold text-slate-900 truncate">{t.subject}</div>
                      <div className="text-xs text-slate-500 truncate">{t.description}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{t.customer?.name}</div>
                      <div className="text-xs text-slate-500">{t.customer?.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="py-3.5 px-4">
                      {t.assignedTo ? (
                        <span className="font-medium text-slate-800">{t.assignedTo.name}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <SlaCountdown slaState={t.slaState} countdownText={t.slaCountdownText} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
