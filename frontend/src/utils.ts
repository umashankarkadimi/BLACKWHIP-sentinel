import { session, fireAuthExpired } from './lib/session';
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(isoString: string) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour12: false });
  } catch {
    return '';
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});
    // Always attach the bearer token when available (works even when cookies
    // are blocked). The httpOnly cookie remains a fallback for requests that
    // cannot carry headers.
    const token = session.getToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const newOptions: RequestInit = { ...options, headers, credentials: 'include' };
    const res = await fetch(url, newOptions);

    // A 401 means the session is genuinely invalid/expired: clear it and flip
    // to the login view via an event. We deliberately DO NOT reload the page —
    // a hard reload is what turns a transient 401 into an infinite login loop
    // when storage is flaky (iframe previews, partitioned storage, stale tabs).
    if (res.status === 401) {
        console.warn('Auth error 401 — session invalid:', url);
        fireAuthExpired();
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const text = await res.text();
        console.error("API Error Response:", res.status, url, text.substring(0, 100));
        throw new Error(`API returned ${res.status}: ${text.substring(0, 20)}`);
    }
    return res;
}
