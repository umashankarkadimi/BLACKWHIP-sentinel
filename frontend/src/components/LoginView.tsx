import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/AuthProvider';
import { session } from '../lib/session';
import { APP_VERSION } from '../version';

export default function LoginView() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [probe, setProbe] = useState('');
  const [debug, setDebug] = useState('');

  // --- Session probe: tries the bearer token first (primary), then the
  // httpOnly cookie (fallback). Shows which auth path actually works. ---
  const testSession = async () => {
    setProbe('checking…');
    try {
      const token = session.getToken();
      const r = await fetch('/api/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const j = await r.json().catch(() => ({}));
      setProbe(r.ok
        ? `session OK via ${token ? 'token' : 'cookie'}: ${j.email} (${j.role})`
        : `no session (HTTP ${r.status})`);
      return r.ok;
    } catch (e: any) {
      setProbe(`probe failed: ${e.message || e}`);
      return false;
    }
  };

  // --- Report environment + any failure to the server log (for diagnosis) ---
  const report = async (stage: string, extra: any = {}) => {
    try {
      const token = session.getToken();
      await fetch('/api/debug/client-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ stage, ...extra })
      });
    } catch { /* ignore */ }
  };

  React.useEffect(() => {
    let storageStatus = 'memory-only';
    try { localStorage.setItem('__probe', '1'); localStorage.removeItem('__probe'); storageStatus = 'localStorage OK'; }
    catch { try { sessionStorage.setItem('__probe', '1'); sessionStorage.removeItem('__probe'); storageStatus = 'sessionStorage only'; } catch { /* memory only */ } }
    const hasToken = !!session.getToken();
    setDebug(`storage: ${storageStatus} · token: ${hasToken ? 'yes' : 'no'}`);
    report('login-view-mount', { storageStatus, hasToken, url: window.location.href.slice(0, 200) });
    testSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    report('login-submit', { email });
    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      report('login-failed', { error: result.error });
    } else {
      // Success — verify we can actually reach an authenticated endpoint.
      report('login-ok', { email, token: !!session.getToken() });
      const ok = await testSession();
      setDebug(d => `${d} · after-login /api/me: ${ok ? 'OK' : 'FAILED'}`);
      report('login-after-probe', { authed: ok });
      if (!ok) {
        setError('Login succeeded but session verification failed — see server log.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900 via-black to-black"></div>
      <div className="z-10 flex flex-col items-center w-full max-w-sm px-6">
        <ShieldAlert className="w-16 h-16 text-red-600 mb-6" />
        <h1 className="text-3xl font-bold text-red-600 tracking-widest uppercase mb-2 text-center">SOC Command</h1>
        <p className="text-neutral-500 tracking-widest uppercase text-xs mb-8 text-center">Unauthorized Access Prohibited</p>
        <div className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest mb-2">Build v{APP_VERSION}</div>

        <div className="w-full mb-4 flex flex-col gap-1 text-neutral-500 font-mono text-[9px]">
          <div>{debug}</div>
          <div>session probe: <button type="button" onClick={testSession} className="text-neutral-400 hover:text-neutral-200 underline transition-colors">re-check →</button> <span className="text-neutral-300">{probe}</span></div>
        </div>

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
          {notice && <div className="text-amber-400 text-xs text-center uppercase tracking-widest">{notice}</div>}
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
