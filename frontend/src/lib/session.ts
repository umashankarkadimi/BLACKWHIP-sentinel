/**
 * Session storage with four tiers: URL fragment → localStorage →
 * sessionStorage → memory.
 *
 * The URL fragment (`#soc_token=...`) is the ONLY carrier that survives a full
 * iframe reload when both cookies and storage are blocked (embedded previews).
 * Fragments are never sent to the server. The fragment is consumed and removed
 * on boot so it does not linger. Never throws.
 */

const memory: { token: string | null; user: any | null } = { token: null, user: null };
const FRAGMENT_KEY = 'soc_token';

function getStore(name: 'localStorage' | 'sessionStorage') {
  try {
    return window[name];
  } catch {
    return null;
  }
}

function safeGet(key: string): string | null {
  const local = getStore('localStorage');
  if (local) {
    try { const v = local.getItem(key); if (v !== null) return v; } catch { /* next tier */ }
  }
  const session = getStore('sessionStorage');
  if (session) {
    try { const v = session.getItem(key); if (v !== null) return v; } catch { /* next tier */ }
  }
  return null;
}

function safeSet(key: string, value: string) {
  const local = getStore('localStorage');
  if (local) { try { local.setItem(key, value); } catch { /* ignore */ } }
  const session = getStore('sessionStorage');
  if (session) { try { session.setItem(key, value); } catch { /* ignore */ } }
}

function safeRemove(key: string) {
  const local = getStore('localStorage');
  if (local) { try { local.removeItem(key); } catch { /* ignore */ } }
  const session = getStore('sessionStorage');
  if (session) { try { session.removeItem(key); } catch { /* ignore */ } }
}

function readFragmentToken(): string | null {
  try {
    const hash = window.location.hash || '';
    const m = hash.match(/[#&]soc_token=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function clearFragment() {
  try {
    if (window.location.hash.includes(FRAGMENT_KEY)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch {
    /* ignore */
  }
}

export const session = {
  getToken(): string | null {
    // ORDER MATTERS: memory first (always the freshest value — written by
    // this page at login). Then the URL fragment (freshest persisted carrier,
    // rewritten on every login). Storage LAST: in embedded iframes storage
    // READS may still return an old value even when WRITES silently fail —
    // a stale storage token must never override the current session.
    return memory.token || readFragmentToken() || safeGet('soc_token');
  },
  /** True if the session currently survives only via the URL fragment. */
  hasFragmentToken(): boolean {
    return readFragmentToken() !== null && !memory.token && !safeGet('soc_token');
  },
  getUser(): any | null {
    // Same ordering rationale as getToken.
    if (memory.user) return memory.user;
    const stored = safeGet('soc_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        safeRemove('soc_user');
      }
    }
    return null;
  },
  set(token: string, user: any) {
    memory.token = token;
    memory.user = user;
    safeSet('soc_token', token);
    safeSet('soc_user', JSON.stringify(user));
  },
  clear() {
    memory.token = null;
    memory.user = null;
    safeRemove('soc_token');
    safeRemove('soc_user');
    clearFragment();
  },
  /** Persist the token into the URL fragment so it survives a full reload
   *  even when cookies AND storage are blocked. Returns true on success. */
  persistToFragment(token: string): boolean {
    try {
      const url = new URL(window.location.href);
      url.hash = `${FRAGMENT_KEY}=${encodeURIComponent(token)}`;
      window.history.replaceState(null, '', url.toString());
      return true;
    } catch {
      return false;
    }
  },
};

/** Fired when the backend rejects the session (401) — AuthProvider listens and flips to the login view. */
export const AUTH_EXPIRED_EVENT = 'auth-expired';
export function fireAuthExpired() {
  session.clear();
  try {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  } catch {
    /* ignore */
  }
}
