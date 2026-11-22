import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  UserCheck, 
  HelpCircle, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight,
  ShieldAlert,
  Flame,
  Activity
} from 'lucide-react';
import { api } from '../api';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import SlaCountdown from '../components/SlaCountdown';

export default function Dashboard({ onSelectTicket, onNavigateView }) {
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const [statsData, ticketsData] = await Promise.all([
          api.getStats(),
          api.getTickets({ limit: 6 }),
        ]);
        setStats(statsData);
        setRecentTickets(ticketsData.tickets || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Loading Frontdesk dashboard...</span>
        </div>
      </div>
    );
  }

  const summary = stats?.summary || {};
  const priorityDist = stats?.priorityDistribution || {};
  const statusDist = stats?.statusDistribution || {};
  const recentOverdue = stats?.recentOverdue || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* SLA Performance Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-slate-700/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <Activity className="w-4 h-4" />
            <span>Arvo SLA Compliance Engine</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Active SLA Compliance Rate: {summary.slaComplianceRate}%</h2>
          <p className="text-xs text-slate-300">
            Working schedule: Monday–Friday, 9:30 AM to 6:30 PM. Weekends and festival holidays excluded.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-lg border border-slate-700">
          <div className="text-right">
            <div className="text-[11px] text-slate-400 font-medium uppercase">Active Overdue</div>
            <div className={`text-lg font-bold ${summary.overdue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {summary.overdue} {summary.overdue === 1 ? 'Ticket' : 'Tickets'}
            </div>
          </div>
          <AlertTriangle className={`w-6 h-6 ${summary.overdue > 0 ? 'text-red-400' : 'text-slate-500'}`} />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Open */}
        <div 
          onClick={() => onNavigateView('all')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Open</span>
            <Inbox className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.totalOpen || 0}</div>
          <span className="text-[11px] text-slate-500">Unresolved workload</span>
        </div>

        {/* My Assigned */}
        <div 
          onClick={() => onNavigateView('my')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">My Assigned</span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-900">{summary.myAssigned || 0}</div>
          <span className="text-[11px] text-slate-500">Your direct queue</span>
        </div>

        {/* Unassigned */}
        <div 
          onClick={() => onNavigateView('unassigned')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Unassigned</span>
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-800">{summary.unassigned || 0}</div>
          <span className="text-[11px] text-slate-500">Ready to be claimed</span>
        </div>

        {/* Overdue */}
        <div 
          onClick={() => onNavigateView('overdue')}
          className={`bg-white p-4 rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
            summary.overdue > 0 ? 'border-red-300 bg-red-50/20 hover:border-red-400' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className={`w-4 h-4 ${summary.overdue > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${summary.overdue > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {summary.overdue || 0}
          </div>
          <span className="text-[11px] text-slate-500">Breached SLA deadline</span>
        </div>

        {/* Waiting for Customer */}
        <div 
          onClick={() => onNavigateView('waiting')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Waiting Customer</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.waitingForCustomer || 0}</div>
          <span className="text-[11px] text-slate-500">SLA clock paused</span>
        </div>

        {/* Resolved */}
        <div 
          onClick={() => onNavigateView('resolved')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{summary.resolved || 0}</div>
          <span className="text-[11px] text-slate-500">Completed solutions</span>
        </div>
      </div>

      {/* Overdue Attention Box (if any) */}
      {recentOverdue.length > 0 && (
        <div className="bg-red-50/60 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Critical Overdue Tickets Requiring Immediate Action</span>
            </div>
            <button 
              onClick={() => onNavigateView('overdue')}
              className="text-xs font-semibold text-red-700 hover:underline flex items-center gap-1"
            >
              <span>View All Overdue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentOverdue.map((ot) => (
              <div 
                key={ot.id}
                onClick={() => onSelectTicket(ot.id)}
                className="bg-white p-3 rounded-lg border border-red-200 hover:border-red-400 cursor-pointer shadow-2xs transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-700">{ot.id}</span>
                  <PriorityBadge priority={ot.priority} />
                </div>
                <div className="text-sm font-semibold text-slate-900 truncate">{ot.subject}</div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Owner: {ot.assignedTo}</span>
                  <span className="text-red-600 font-semibold">{Math.abs(Math.round(ot.remainingWorkingMinutes))}m late</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribution Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span>Priority Breakdown</span>
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-orange-700">Urgent (2h reply / same day fix)</span>
                <span className="font-mono text-slate-900">{priorityDist.URGENT || 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-orange-500 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, ((priorityDist.URGENT || 0) / (summary.totalOpen || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-700">Medium (Half day reply / ~3 days fix)</span>
                <span className="font-mono text-slate-900">{priorityDist.MEDIUM || 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, ((priorityDist.MEDIUM || 0) / (summary.totalOpen || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700">Small (1 day reply / ~1 week fix)</span>
                <span className="font-mono text-slate-900">{priorityDist.SMALL || 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-slate-500 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, ((priorityDist.SMALL || 0) / (summary.totalOpen || 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Workflow Status Breakdown</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium">Open</span>
              <div className="text-xl font-bold text-blue-900 mt-1">{statusDist.OPEN || 0}</div>
            </div>
            <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
              <span className="text-indigo-700 font-medium">In Progress</span>
              <div className="text-xl font-bold text-indigo-900 mt-1">{statusDist.IN_PROGRESS || 0}</div>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100">
              <span className="text-amber-800 font-medium">Waiting for Customer</span>
              <div className="text-xl font-bold text-amber-900 mt-1">{statusDist.WAITING_FOR_CUSTOMER || 0}</div>
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100">
              <span className="text-emerald-700 font-medium">Resolved / Closed</span>
              <div className="text-xl font-bold text-emerald-900 mt-1">{(statusDist.RESOLVED || 0) + (statusDist.CLOSED || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Recent Support Tickets</h3>
            <p className="text-xs text-slate-500">Live operational feed from Arvo database</p>
          </div>
          <button
            onClick={() => onNavigateView('all')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>View All Tickets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assigned Agent</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">SLA Countdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTickets.map((t) => (
                <tr 
                  key={t.id} 
                  onClick={() => onSelectTicket(t.id)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-blue-600">{t.id}</td>
                  <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">{t.subject}</td>
                  <td className="py-3 px-4 text-slate-600">{t.customer?.name}</td>
                  <td className="py-3 px-4"><PriorityBadge priority={t.priority} /></td>
                  <td className="py-3 px-4 text-slate-700">
                    {t.assignedTo ? (
                      <span className="font-medium text-slate-800">{t.assignedTo.name}</span>
                    ) : (
                      <span className="text-amber-600 text-xs font-semibold italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                  <td className="py-3 px-4">
                    <SlaCountdown slaState={t.slaState} countdownText={t.slaCountdownText} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
