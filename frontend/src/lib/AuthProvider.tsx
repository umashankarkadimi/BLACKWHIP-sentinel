import React, { createContext, useContext, useEffect, useState } from 'react';
import { session, AUTH_EXPIRED_EVENT } from './session';

interface AuthContextType {
  user: any | null;
  role: 'ADMIN' | 'ANALYST' | 'GUEST' | 'ROOT';
  loading: boolean;
  notice: string;
  signIn: (email: string, password: string) => Promise<{ success?: boolean, error?: string }>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'ANALYST' | 'GUEST' | 'ROOT'>('GUEST');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    // Restore the session. Order of preference:
    //  1. Stored token + profile        -> adopt immediately
    //  2. Stored token (no profile)     -> recover identity via /api/me
    //  3. NO local session at all       -> probe /api/me anyway; the httpOnly
    //     cookie (incl. partitioned cookie in embedded previews) may still be
    //     valid, e.g. after an iframe reload wiped memory/storage. Under
    //     AUTO_AUTH (demo/preview mode) /api/me always returns the admin, so
    //     the dashboard opens directly with NO login page.
    //
    // `loading` stays true until the probe settles so the login view never
    // flashes while the session is being restored.
    let cancelled = false;

    (async () => {
      const token = session.getToken();
      const storedUser = session.getUser();
      const adopt = (u: any) => { if (!cancelled) { setUser(u); setRole(u.role || 'ANALYST'); } };

      if (token && storedUser) {
        adopt(storedUser);
      } else {
        try {
          const r = await fetch('/api/me', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            credentials: 'include',
          });
          if (r.ok) {
            const me = await r.json();
            if (me && me.email) {
              const u = { id: '', email: me.email, role: me.role || 'ANALYST' };
              session.set(session.getToken() || '', u);
              adopt(u);
            }
          }
        } catch { /* no session — falls through to login (only without AUTO_AUTH) */ }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // 401 anywhere in the app → clear the session and show the login view.
    // No page reload: that's what previously turned transient 401s into an
    // infinite login loop.
    const onAuthExpired = () => {
      session.clear();
      setUser(null);
      setRole('GUEST');
      setNotice('Your session expired. Please sign in again.');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          return { error: `Login failed (HTTP ${res.status})` };
        }

        if (!res.ok || data.error) return { error: data.error || data.message || `Login failed (HTTP ${res.status})` };
        if (!data.token || !data.user) return { error: 'Invalid server response' };

        // Session lives in memory + storage (whichever is available). Also
        // persist to the URL fragment so a full reload keeps the session even
        // when cookies and storage are both blocked (embedded previews).
        session.set(data.token, data.user);
        session.persistToFragment(data.token);

        setUser(data.user);
        setRole(data.user.role);
        setNotice('');
        return { success: true };
    } catch (e) {
        console.error("Login failed", e);
        return { error: 'Connection failed' };
    }
  };

  const logOut = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error("Logout failed", e);
    }
    session.clear();
    setUser(null);
    setRole('GUEST');
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, notice, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};
