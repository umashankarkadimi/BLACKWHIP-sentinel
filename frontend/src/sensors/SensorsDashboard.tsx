import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Laptop, Server, HardDrive, RefreshCw } from 'lucide-react';
import { authFetch } from '../utils';

export default function SensorsDashboard() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/wazuh/agents');
      if (!res.ok) throw new Error('Wazuh Offline');
      const data = await res.json();
      setAgents(data);
    } catch (e: any) {
      setError(e.message || 'Error loading agents');
    }
    setLoading(false);
  };

  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    loadAgents();
    // Live fleet status: auto-refresh agent inventory every 15s so the
    // Sensors tab tracks Wazuh in near real time.
    const timer = setInterval(() => { loadAgents(); }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading) setLastUpdated(new Date().toLocaleTimeString([], { hour12: false }));
  }, [agents]);

  const total = agents.length;
  const active = agents.filter(a => a.status === 'active').length;
  const disconnected = agents.filter(a => a.status === 'disconnected').length;
  const neverConnected = agents.filter(a => a.status === 'never_connected').length;
  const windows = agents.filter(a => a.os?.toLowerCase().includes('windows')).length;
  const linux = agents.filter(a => a.os?.toLowerCase().includes('linux') || a.os?.toLowerCase().includes('ubuntu') || a.os?.toLowerCase().includes('centos')).length;
  const macos = agents.filter(a => a.os?.toLowerCase().includes('mac')).length;

  return (
    <div className="flex flex-col h-full gap-6 overflow-y-auto custom-scrollbar p-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-50 tracking-widest uppercase flex items-center gap-3">
          <Activity className="w-6 h-6 text-emerald-500" />
          Sensor Fleet Status
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            {lastUpdated ? `Updated ${lastUpdated} · auto-refresh 15s` : 'Loading...'}
          </span>
          <button onClick={loadAgents} disabled={loading} className="p-2 border border-neutral-800 rounded bg-black hover:bg-neutral-900 transition-colors text-neutral-400">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-xl text-red-500 text-center font-mono uppercase tracking-widest">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-80" />
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-black border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Activity className="w-12 h-12" /></div>
                <div className="text-3xl font-bold text-neutral-200">{total}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mt-1">Total Agents</div>
            </div>
            <div className="bg-black border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-emerald-500"><ShieldCheck className="w-12 h-12" /></div>
                <div className="text-3xl font-bold text-emerald-500">{active}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mt-1">Active Agents</div>
            </div>
            <div className="bg-black border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-red-500"><ShieldAlert className="w-12 h-12" /></div>
                <div className="text-3xl font-bold text-red-500">{disconnected}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mt-1">Disconnected</div>
            </div>
            <div className="bg-black border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><HardDrive className="w-12 h-12" /></div>
                <div className="text-3xl font-bold text-neutral-400">{neverConnected}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mt-1">Never Connected</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-black border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Laptop className="w-5 h-5 text-blue-400" />
                   <span className="text-sm font-mono text-neutral-300">Windows</span>
                </div>
                <span className="text-lg font-bold text-neutral-200">{windows}</span>
             </div>
             <div className="bg-black border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Server className="w-5 h-5 text-orange-400" />
                   <span className="text-sm font-mono text-neutral-300">Linux</span>
                </div>
                <span className="text-lg font-bold text-neutral-200">{linux}</span>
             </div>
             <div className="bg-black border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Laptop className="w-5 h-5 text-neutral-400" />
                   <span className="text-sm font-mono text-neutral-300">macOS</span>
                </div>
                <span className="text-lg font-bold text-neutral-200">{macos}</span>
             </div>
          </div>

          <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden mt-4">
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50">
              <h2 className="font-bold text-sm tracking-widest uppercase text-neutral-300">Agent Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900 text-neutral-500 font-mono text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">Hostname</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">OS</th>
                    <th className="p-4">Version</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 font-mono text-[11px] text-neutral-300">
                  {agents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-600">No agents found</td>
                    </tr>
                  ) : (
                    agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-neutral-900/50">
                        <td className="p-4 text-neutral-500">{agent.id}</td>
                        <td className="p-4 font-bold text-neutral-200">{agent.name}</td>
                        <td className="p-4">{agent.ip}</td>
                        <td className="p-4">{agent.os}</td>
                        <td className="p-4 text-neutral-500">{agent.version || 'N/A'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                            agent.status === 'active' 
                              ? 'bg-emerald-900/30 text-emerald-500 border border-emerald-500/30' 
                              : 'bg-red-900/30 text-red-500 border border-red-500/30'
                          }`}>
                            {agent.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
