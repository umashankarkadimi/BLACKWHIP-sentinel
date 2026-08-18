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
    const token = localStorage.getItem('soc_token');
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const newOptions = { ...options, headers };
    const res = await fetch(url, newOptions);
    if (res.status === 401 || res.status === 403) {
        console.warn('Auth error', res.status);
        // Force re-auth
        localStorage.removeItem('soc_token');
        localStorage.removeItem('soc_user');
        window.location.reload();
        return new Promise<Response>(() => {}); // Halt execution while reloading
    }
    
    if (!res.ok) {
        const text = await res.text();
        console.error("API Error Response:", res.status, text.substring(0, 100));
        throw new Error(`API returned ${res.status}: ${text.substring(0, 20)}`);
    }
    return res;

}
