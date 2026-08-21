import React from 'react';
import { Incident } from '../types';

export default function CaseManagement({ incidents, onSelectIncident }: { incidents: Incident[], onSelectIncident: (i: Incident) => void }) {
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">Case Management</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {incidents.map(incident => (
          <div key={incident.incident_id} className="p-4 bg-black border border-red-500/20 hover:border-red-500/50 cursor-pointer rounded transition-all" onClick={() => onSelectIncident(incident)}>
            <div className="text-sm font-mono text-neutral-500">{incident.incident_id}</div>
            <div className="font-bold text-neutral-100">{incident.title}</div>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-neutral-800 text-neutral-400'}`}>{incident.severity}</span>
              <span className="text-[10px] text-neutral-500">{incident.status}</span>
            </div>
          </div>
        ))}
        {incidents.length === 0 && <div className="text-neutral-500 font-mono text-sm">No cases available.</div>}
      </div>
    </div>
  );
}
