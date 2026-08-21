import { authFetch } from '../utils';
/**
 * Record a client-side audit event. The backend stamps the acting user from
 * the JWT and the timestamp server-side, so the client only supplies the
 * action name and details (identity can never be forged from the browser).
 */
export async function logAudit(action: string, details: any = {}) {
  try {
    await authFetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details })
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
