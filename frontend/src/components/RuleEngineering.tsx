import { authFetch } from '../utils';
import React, { useState, useEffect } from 'react';

interface Rule {
  id: string;
  name: string;
  conditionStr: string;
  severity: string;
  tactic: string;
  technique: string;
}

export default function RuleEngineering() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/rules')
      .then(res => res.json())
      .then(data => { setRules(data); setLoading(false); })
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">Detection Rule Engineering</h2>
        <button className="px-4 py-2 bg-red-900/30 text-red-500 border border-red-500/30 rounded font-bold uppercase text-[10px] tracking-widest hover:bg-red-900/50">
          New Rule
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 overflow-y-auto">
        {loading ? (
          <div className="text-neutral-500 font-mono text-sm">Loading rules...</div>
        ) : rules.map(rule => (
          <div key={rule.id} className="p-4 bg-black border border-red-500/20 rounded flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-100 flex items-center gap-2">
                <span className="text-red-500 font-mono text-xs">{rule.id}</span>
                {rule.name}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-neutral-800 text-neutral-400'}`}>
                {rule.severity}
              </span>
            </div>
            <div className="text-xs text-neutral-500 font-mono flex items-center gap-4">
              <span>Tactic: <span className="text-neutral-300">{rule.tactic}</span></span>
              <span>Technique: <span className="text-neutral-300">{rule.technique}</span></span>
            </div>
            <div className="bg-neutral-900 p-2 rounded text-cyan-400 font-mono text-xs border border-neutral-800 mt-2">
              {rule.conditionStr}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
