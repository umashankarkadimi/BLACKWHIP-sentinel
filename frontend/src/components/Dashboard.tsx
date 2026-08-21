import React, { useState, useEffect } from 'react';
import { SystemState, Incident } from '../types';
import { AlertTriangle, ShieldAlert, Monitor, Activity, Filter } from 'lucide-react';
import { formatTime } from '../utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard({ state, incidents, onSelectIncident }: { state: SystemState, incidents: Incident[], onSelectIncident: (i: Incident) => void }) {
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');

  const filteredIncidents = incidents.filter(i => {
    if (statusFilter === 'ACTIVE') return i.status !== 'RESOLVED';
    if (statusFilter === 'ALL') return true;
    return i.status === statusFilter;
  });

  
  const [chartData, setChartData] = useState<{time: string, events: number}[]>([]);

  useEffect(() => {
    setChartData(prev => {
      const now = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
      const newData = [...prev, { time: now, events: state.eps }];
      if (newData.length > 20) newData.shift();
      return newData;
    });
  }, [state.eps]);


  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Threat Level" value={state.threatLevel} icon={<ShieldAlert />} color={getThreatColor(state.threatLevel)} glowColor={getThreatGlow(state.threatLevel)} />
        <MetricCard title="Active Incidents" value={state.activeIncidents} icon={<AlertTriangle />} color="text-neutral-300 dark:text-neutral-300" glowColor="rgba(239, 68, 68, 0.5)" />
        <MetricCard title="High Alerts" value={state.highAlerts} icon={<Activity />} color="text-red-700 dark:text-red-500" glowColor="rgba(249, 115, 22, 0.5)" />
        <MetricCard title="Protected Endpoints" value={state.totalEndpoints} icon={<Monitor />} color="text-emerald-600" glowColor="rgba(52, 211, 153, 0.5)" />
      </div>

      {/* Threat Activity Chart */}
      <div className="hud-panel rounded-xl p-6 relative overflow-hidden group">
        <div className='absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity' style={{ backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.15) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
        <div className="relative z-10">
          <h2 className="font-bold text-lg mb-4 text-neutral-50 dark:text-neutral-50 tracking-[0.1em] flex items-center gap-2">
            <Activity className="w-5 h-5 text-neutral-300 dark:text-neutral-300" />
            LIVE THREAT TELEMETRY
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(239, 68, 68, 0.15)" vertical={false} />
                <XAxis dataKey="time" stroke="#f97316" fontSize={10} tickMargin={8} fontFamily="monospace" />
                <YAxis stroke="#f97316" fontSize={10} fontFamily="monospace" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--tooltip-bg)', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--tooltip-color)', borderRadius: '4px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#f97316' }}
                />
                <Line type="linear" dataKey="events" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 4" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Incidents */}
      <div className="hud-panel rounded-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-[2px] h-full bg-red-500/30 dark:bg-red-700/30 shadow-sm"></div>
        <div className="p-4 border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black/80 flex items-center justify-between">
          <h2 className="font-bold text-lg text-neutral-50 dark:text-neutral-50 tracking-[0.1em]">INCIDENT QUEUE</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            <div className="flex bg-black dark:bg-black/80 border border-red-500/20 dark:border-red-500/20 rounded p-1">
              {['ACTIVE', 'NEW', 'INVESTIGATING', 'RESOLVED', 'ALL'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 text-[10px] font-bold tracking-[0.1em] uppercase rounded transition-colors ${
                    statusFilter === filter 
                      ? 'bg-black dark:bg-black text-neutral-300 dark:text-neutral-300 shadow-sm' 
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-50 dark:hover:text-neutral-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black dark:bg-black/80 text-neutral-600 dark:text-neutral-400 font-mono text-[10px] tracking-[0.15em] uppercase border-b border-red-500/20 dark:border-red-500/20">
              <tr>
                <th className="p-4 font-bold">ID</th>
                <th className="p-4 font-bold">Severity</th>
                <th className="p-4 font-bold">Title</th>
                <th className="p-4 font-bold">Host</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Detection Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700/50 bg-black dark:bg-black">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-600 dark:text-neutral-400 font-mono text-xs uppercase tracking-widest">No incidents match the selected filter</td>
                </tr>
              ) : (
                filteredIncidents.map(incident => (
                  <tr 
                    key={incident.incident_id} 
                    onClick={() => onSelectIncident(incident)}
                    className="hover:bg-black dark:hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                  >
                    <td className="p-4 font-mono text-neutral-500 text-xs group-hover:text-neutral-300 dark:text-neutral-400 dark:group-hover:text-neutral-200 transition-colors">{incident.incident_id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider shadow-sm ${getSeverityStyles(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-neutral-50 dark:text-neutral-50">{incident.title}</td>
                    <td className="p-4 font-mono text-xs text-neutral-300 dark:text-neutral-300">{incident.affected_assets.join(', ')}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${getStatusStyles(incident.status)}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">{formatTime(incident.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, glowColor }: { title: string, value: string | number, icon: React.ReactNode, color: string, glowColor?: string }) {
  return (
    <div className="hud-panel p-5 rounded-xl flex items-center justify-between relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-16 h-16 opacity-20 group-hover:opacity-40 transition-opacity" style={{ background: `linear-gradient(rgba(239, 68, 68, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.15) 1px, transparent 1px)` }}></div>
      <div className="relative z-10">
        <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-widest mb-1">{title}</p>
        <p className={`text-3xl font-bold tracking-tight ${color}`} style={{ textShadow: `0 0 10px ${glowColor || 'transparent'}` }}>{value}</p>
      </div>
      <div className={`p-3 bg-black dark:bg-black/80 border border-red-500/20 dark:border-red-500/20 rounded-lg relative z-10 ${color}`}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
      </div>
    </div>
  );
}

export function getThreatGlow(level: string) {
  switch (level) {
    case 'CRITICAL': return 'rgba(249, 115, 22, 0.4)';
    case 'HIGH': return 'rgba(239, 68, 68, 0.4)';
    case 'ELEVATED': return 'rgba(234, 179, 8, 0.4)';
    case 'GUARDED': return 'rgba(59, 130, 246, 0.4)';
    default: return 'rgba(16, 185, 129, 0.4)';
  }
}

export function getThreatColor(level: string) {
  switch (level) {
    case 'CRITICAL': return 'text-red-700 dark:text-red-500';
    case 'HIGH': return 'text-red-900 dark:text-red-600';
    case 'ELEVATED': return 'text-amber-600 dark:text-amber-400';
    case 'GUARDED': return 'text-blue-600 dark:text-blue-400';
    default: return 'text-emerald-600 dark:text-emerald-400';
  }
}

export function getSeverityStyles(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500/20 dark:bg-red-700/30 text-red-700 dark:text-red-500 border border-red-500/30 dark:border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 dark:bg-orange-700/30 text-orange-700 dark:text-orange-500 border-orange-500/30 dark:border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
    case 'LOW': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30';
    default: return 'bg-black dark:bg-black text-neutral-600 dark:text-neutral-400 border border-red-500/20 dark:border-red-500/20';
  }
}

export function getStatusStyles(status: string) {
  switch (status) {
    case 'NEW': return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30';
    case 'INVESTIGATING': return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
    case 'RESOLVED': return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
    default: return 'bg-black dark:bg-black/80 text-neutral-600 dark:text-neutral-400 border-red-500/20 dark:border-red-500/20';
  }
}
