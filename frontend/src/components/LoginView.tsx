import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/AuthProvider';

export default function LoginView() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900 via-black to-black"></div>
      <div className="z-10 flex flex-col items-center w-full max-w-sm px-6">
        <ShieldAlert className="w-16 h-16 text-red-600 mb-6" />
        <h1 className="text-3xl font-bold text-red-600 tracking-widest uppercase mb-2 text-center">SOC Command</h1>
        <p className="text-neutral-500 tracking-widest uppercase text-xs mb-8 text-center">Unauthorized Access Prohibited</p>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Analyst Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full bg-black border border-red-900/50 text-red-500 px-4 py-2 outline-none focus:border-red-500 transition-colors"
              placeholder="analyst@company.com"
            />
          </div>
          <div>
            <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-black border border-red-900/50 text-red-500 px-4 py-2 outline-none focus:border-red-500 transition-colors"
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            />
          </div>
          {error && <div className="text-red-500 text-xs text-center uppercase tracking-widest">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-8 py-3 bg-red-900/20 border border-red-700/50 text-red-500 hover:bg-red-900/40 disabled:opacity-50 transition-colors uppercase tracking-widest text-sm font-bold"
          >
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );
}
