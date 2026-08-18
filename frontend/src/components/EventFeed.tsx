import React from 'react';
import { NormalizedEvent } from '../types';
import { formatTime } from '../utils';

export default function EventFeed({ events, mode }: { events: NormalizedEvent[], mode: 'LIVE' | 'SIMULATION' }) {
  return (
    <div className="flex flex-col divide-y divide-[#1a1a1a]">
      {events.map((e) => (
        <div key={e.event_id} className="p-4 hover:bg-black dark:hover:bg-neutral-800/50 transition-colors text-sm relative">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-neutral-500">{formatTime(e.timestamp)}</span>
            <div className="flex gap-2">
              <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded border ${mode === 'LIVE' ? 'bg-red-900/20 text-red-500 border-red-500/30' : 'bg-blue-900/20 text-blue-500 border-blue-500/30'}`}>
                {mode}
              </span>
              <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded border ${getEventSeverityColor(e.severity)}`}>
                {e.severity}
              </span>
            </div>
          </div>
          <div className="font-semibold text-neutral-200 dark:text-neutral-200 text-xs mb-1">{e.event_type}</div>
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
            <span>{e.hostname || e.src_ip || 'Unknown'}</span>
            <span className="italic">{e.source}</span>
          </div>
          {e.rule_name && (
            <div className="mt-2 text-[10px] text-red-900 dark:text-red-600 bg-red-600/10 dark:bg-red-900/30 px-2 py-1 rounded border border-red-600/30 dark:border-red-600/30">
              {e.rule_name}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function getEventSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-600/10 dark:bg-red-900/30 text-red-900 dark:text-red-600 border-red-600/30 dark:border-red-600/30';
    case 'HIGH': return 'bg-orange-500/10 dark:bg-orange-700/30 text-orange-700 dark:text-orange-500 border-orange-500/30 dark:border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
    case 'LOW': return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30';
    default: return 'bg-black dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700/50';
  }
}
