import React from 'react';
import { AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';

export default function PriorityBadge({ priority }) {
  const configs = {
    URGENT: {
      label: 'Urgent',
      bg: 'bg-orange-50 text-orange-700 border-orange-300 font-semibold',
      icon: AlertCircle,
      iconColor: 'text-orange-600',
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: ArrowUp,
      iconColor: 'text-sky-600',
    },
    SMALL: {
      label: 'Small',
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: ArrowDown,
      iconColor: 'text-slate-500',
    },
  };

  const config = configs[priority] || configs.MEDIUM;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border ${config.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      <span>{config.label}</span>
    </span>
  );
}
