import { authFetch } from '../utils';
import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, ShieldCheck, Users } from 'lucide-react';

interface ManagedUser {
  id: string;
  email: string;
  role: string;
  created_at?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ANALYST' | 'ADMIN'>('ANALYST');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/users');
      setUsers(await res.json());
    } catch (e: any) {
      setMsg(e.message || 'Failed to load users');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg(`Created ${data.user.email} (${data.user.role})`);
        setEmail('');
        setPassword('');
        load();
      }
    } catch (e: any) {
      setMsg(e.message || 'Failed to create user');
    }
  };

  const remove = async (u: ManagedUser) => {
    if (!window.confirm(`Delete user ${u.email}? Their access is revoked immediately.`)) return;
    setMsg('');
    try {
      await authFetch(`/api/users/${u.id}`, { method: 'DELETE' });
      setMsg(`Deleted ${u.email}`);
      load();
    } catch (e: any) {
      setMsg(e.message || 'Failed to delete user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-neutral-300">
        <Users className="w-4 h-4 text-red-700 dark:text-red-500" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Provisioned Accounts</span>
      </div>

      {loading ? (
        <div className="text-neutral-500 font-mono text-xs">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="text-neutral-500 font-mono text-xs">No users found.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 border border-red-500/20 rounded bg-neutral-900/50">
              <div className="flex items-center gap-2">
                {u.role === 'ADMIN' || u.role === 'ROOT'
                  ? <ShieldCheck className="w-4 h-4 text-red-700 dark:text-red-500" />
                  : <Shield className="w-4 h-4 text-neutral-500" />}
                <div>
                  <div className="text-neutral-100 text-xs font-bold">{u.email}</div>
                  <div className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">{u.role}</div>
                </div>
              </div>
              <button
                onClick={() => remove(u)}
                className="p-1.5 text-neutral-500 hover:text-red-700 dark:hover:text-red-500 transition-colors"
                title="Delete user"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={create} className="space-y-3 border-t border-red-500/20 pt-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5" /> Create Analyst / Admin
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="analyst@company.com"
          className="w-full bg-black border border-red-500/20 rounded px-3 py-2 text-xs text-neutral-200 font-mono outline-none focus:border-red-500/50"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password (min 8 chars)"
          className="w-full bg-black border border-red-500/20 rounded px-3 py-2 text-xs text-neutral-200 font-mono outline-none focus:border-red-500/50"
        />
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'ANALYST' | 'ADMIN')}
            className="bg-black border border-red-500/20 rounded px-2 py-2 text-xs text-neutral-200 font-mono outline-none"
          >
            <option value="ANALYST">ANALYST</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-red-900/30 text-red-500 border border-red-500/30 rounded font-bold uppercase text-[10px] tracking-widest hover:bg-red-900/50 transition-colors"
          >
            Create
          </button>
        </div>
      </form>

      {msg && <div className="text-[11px] font-mono text-neutral-400">{msg}</div>}
    </div>
  );
}
