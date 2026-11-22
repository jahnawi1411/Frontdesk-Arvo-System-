import React from 'react';
import { Clock, AlertTriangle, Pause } from 'lucide-react';

export default function SlaCountdown({ slaState, countdownText, compact = false }) {
  if (slaState === 'PAUSED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300`}>
        <Pause className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
        <span>SLA Paused</span>
        {!compact && countdownText && <span className="text-amber-700/80">({countdownText} left)</span>}
      </span>
    );
  }

  if (slaState === 'OVERDUE') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-300`}>
        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
        <span>Overdue</span>
        {!compact && countdownText && <span className="text-red-600/90 font-mono">({countdownText})</span>}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200`}>
      <Clock className="w-3.5 h-3.5 text-emerald-600" />
      <span>On Track</span>
      {!compact && countdownText && <span className="text-emerald-700/80 font-mono">({countdownText})</span>}
    </span>
  );
}
