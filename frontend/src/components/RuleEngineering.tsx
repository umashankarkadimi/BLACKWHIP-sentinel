import { authFetch } from '../utils';
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Power } from 'lucide-react';

interface Rule {
  rule_id: string;
  description: string;
  severity: string;
  mitre_tactic: string;
  mitre_technique: string;
  enabled: boolean;
  condition: any;
}

const EMPTY_FORM = { description: '', severity: 'MEDIUM', mitre_tactic: '', mitre_technique: '', conditionStr: '{}' };

export default function RuleEngineering() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/rules');
      setRules(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load rules');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (rule: Rule) => {
    setMsg('');
    try {
      const res = await authFetch(`/api/rules/${rule.rule_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled })
      });
      const data = await res.json();
      if (data.error) { setMsg(data.error); return; }
      load();
    } catch (e: any) {
      setMsg(e.message || 'Failed to update rule');
    }
  };

  const remove = async (rule: Rule) => {
    if (!window.confirm(`Delete rule ${rule.rule_id} (${rule.description})? It stops matching immediately.`)) return;
    setMsg('');
    try {
      await authFetch(`/api/rules/${rule.rule_id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setMsg(e.message || 'Failed to delete rule');
    }
  };

  const startEdit = (rule: Rule) => {
    setEditingId(rule.rule_id);
    setForm({
      description: rule.description,
      severity: rule.severity,
      mitre_tactic: rule.mitre_tactic,
      mitre_technique: rule.mitre_technique,
      conditionStr: JSON.stringify(rule.condition || {}, null, 2)
    });
    setShowForm(true);
    setError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    let condition: any;
    try {
      condition = JSON.parse(form.conditionStr || '{}');
      if (typeof condition !== 'object' || Array.isArray(condition)) throw new Error('must be a JSON object');
    } catch {
      setError('condition must be valid JSON, e.g. { "event_type": "4625", "threshold": 5, "window_seconds": 300 }');
      return;
    }

    const body: any = {
      description: form.description.trim(),
      severity: form.severity,
      mitre_tactic: form.mitre_tactic.trim() || undefined,
      mitre_technique: form.mitre_technique.trim() || undefined,
      condition
    };

    try {
      const url = editingId ? `/api/rules/${editingId}` : '/api/rules';
      const res = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setMsg(editingId ? 'Rule updated — live in the detection engine.' : 'Rule created — live in the detection engine.');
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to save rule');
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">Detection Rule Engineering</h2>
        <button
          onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(!showForm); setError(''); }}
          className="px-4 py-2 bg-red-900/30 text-red-500 border border-red-500/30 rounded font-bold uppercase text-[10px] tracking-widest hover:bg-red-900/50 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> {showForm && !editingId ? 'Close' : 'New Rule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="p-4 bg-black border border-red-500/20 rounded flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Rule description (e.g. Suspicious PowerShell Download Cradle)"
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono outline-none focus:border-red-500/50"
            />
            <div className="flex gap-3">
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono outline-none"
              >
                {['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s}>{s}</option>)}
              </select>
              <input
                value={form.mitre_tactic}
                onChange={e => setForm({ ...form, mitre_tactic: e.target.value })}
                placeholder="MITRE tactic (e.g. Execution)"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono outline-none focus:border-red-500/50"
              />
              <input
                value={form.mitre_technique}
                onChange={e => setForm({ ...form, mitre_technique: e.target.value })}
                placeholder="Technique (e.g. T1059.001)"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <textarea
            value={form.conditionStr}
            onChange={e => setForm({ ...form, conditionStr: e.target.value })}
            rows={4}
            placeholder='{ "event_type": "4625", "threshold": 5, "window_seconds": 300 }'
            className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-cyan-400 font-mono outline-none focus:border-red-500/50"
          />
          <div className="flex items-center gap-3">
            <button type="submit" className="px-4 py-2 bg-red-900/30 text-red-500 border border-red-500/30 rounded font-bold uppercase text-[10px] tracking-widest hover:bg-red-900/50">
              {editingId ? 'Update Rule' : 'Create Rule'}
            </button>
            {error && <span className="text-red-500 text-xs font-mono">{error}</span>}
          </div>
          <div className="text-[10px] text-neutral-500 font-mono">
            Condition keys: event_type, command_includes[], process_name_includes[], threshold, window_seconds
          </div>
        </form>
      )}

      {msg && <div className="text-[11px] font-mono text-emerald-600">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 overflow-y-auto">
        {loading ? (
          <div className="text-neutral-500 font-mono text-sm">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="text-neutral-500 font-mono text-sm">No rules defined.</div>
        ) : rules.map(rule => (
          <div key={rule.rule_id} className={`p-4 bg-black border rounded flex flex-col gap-2 transition-opacity ${rule.enabled ? 'border-red-500/20' : 'border-neutral-800 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-100 flex items-center gap-2">
                <span className="text-red-500 font-mono text-xs">{rule.rule_id}</span>
                {rule.description}
                {!rule.enabled && <span className="text-[9px] font-mono uppercase text-neutral-500 border border-neutral-700 px-1.5 py-0.5 rounded">disabled</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : rule.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-500' : 'bg-neutral-800 text-neutral-400'}`}>
                  {rule.severity}
                </span>
                <button onClick={() => toggle(rule)} title={rule.enabled ? 'Disable' : 'Enable'} className="p-1.5 text-neutral-500 hover:text-amber-500 transition-colors">
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => startEdit(rule)} title="Edit" className="p-1.5 text-neutral-500 hover:text-cyan-400 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(rule)} title="Delete" className="p-1.5 text-neutral-500 hover:text-red-700 dark:hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-xs text-neutral-500 font-mono flex items-center gap-4">
              <span>Tactic: <span className="text-neutral-300">{rule.mitre_tactic || '—'}</span></span>
              <span>Technique: <span className="text-neutral-300">{rule.mitre_technique || '—'}</span></span>
            </div>
            <div className="bg-neutral-900 p-2 rounded text-cyan-400 font-mono text-xs border border-neutral-800 mt-2">
              {JSON.stringify(rule.condition || {})}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
