import { authFetch } from '../utils';
import React, { useEffect, useState } from 'react';
import { Workflow, Shield, ShieldCheck, RefreshCw } from 'lucide-react';

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  enabled: boolean;
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/workflows');
      setWorkflows(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load workflows');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAutoContainment = async (wf: WorkflowDef) => {
    if (wf.id !== 'auto-containment') return;
    setToggling(true);
    try {
      const res = await authFetch('/api/state/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !wf.enabled })
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setWorkflows(prev => prev.map(w => w.id === 'auto-containment' ? { ...w, enabled: data.autonomousDefense } : w));
    } catch (e: any) {
      setError(e.message || 'Failed to toggle workflow');
    }
    setToggling(false);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">
          <Workflow className="w-5 h-5 text-red-700 dark:text-red-500" />
          SOAR Workflows
        </h2>
        <button onClick={load} className="p-2 border border-neutral-800 rounded bg-black hover:bg-neutral-900 transition-colors text-neutral-400" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-neutral-500 font-mono">
        Active playbooks executed by the backend engine. Enable states reflect live configuration.
      </p>

      {error && <div className="text-red-500 text-xs font-mono">{error}</div>}

      {loading ? (
        <div className="text-neutral-500 font-mono text-sm">Loading workflows...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          {workflows.map(wf => (
            <div key={wf.id} className={`p-4 bg-black border rounded flex flex-col gap-3 ${wf.enabled ? 'border-red-500/20' : 'border-neutral-800 opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {wf.enabled
                    ? <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <Shield className="w-4 h-4 text-neutral-600 shrink-0" />}
                  <div>
                    <div className="font-bold text-neutral-100 text-sm">{wf.name}</div>
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${wf.enabled ? 'text-emerald-500' : 'text-neutral-500'}`}>
                      {wf.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>
                {wf.id === 'auto-containment' && (
                  <button
                    onClick={() => toggleAutoContainment(wf)}
                    disabled={toggling}
                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest border transition-colors disabled:opacity-50 ${
                      wf.enabled
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50 hover:bg-emerald-900/40'
                        : 'bg-zinc-950/40 text-neutral-400 border-zinc-800 hover:text-neutral-200'
                    }`}
                  >
                    {toggling ? '...' : wf.enabled ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{wf.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {wf.triggers.map(t => (
                  <span key={t} className="text-[9px] font-mono text-cyan-700 dark:text-cyan-500 bg-cyan-950/20 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
