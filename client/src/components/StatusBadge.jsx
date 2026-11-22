import React from 'react';
import { Clock, CheckCircle2, PauseCircle, PlayCircle, Archive } from 'lucide-react';

export default function StatusBadge({ status }) {
  const configs = {
    OPEN: {
      label: 'Open',
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
      icon: Clock,
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dot: 'bg-indigo-500',
      icon: PlayCircle,
    },
    WAITING_FOR_CUSTOMER: {
      label: 'Waiting for Customer',
      bg: 'bg-amber-50 text-amber-800 border-amber-300',
      dot: 'bg-amber-500',
      icon: PauseCircle,
    },
    RESOLVED: {
      label: 'Resolved',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
    },
    CLOSED: {
      label: 'Closed',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      dot: 'bg-slate-400',
      icon: Archive,
    },
  };

  const config = configs[status] || configs.OPEN;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <Icon className="w-3.5 h-3.5 opacity-75" />
      <span>{config.label}</span>
    </span>
  );
}
