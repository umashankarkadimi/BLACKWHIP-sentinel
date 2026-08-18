import { authFetch } from '../utils';
export async function logAudit(userId: string, userEmail: string, action: string, details: any) {
  try {
    await authFetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: new Date().toISOString(), userId, userEmail, action, details })
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}