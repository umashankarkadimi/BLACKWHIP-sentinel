/**
 * BlackWhip SentinelX — outbound webhook notifications.
 *
 * When WEBHOOK_URL is configured, high/critical alerts and new incidents are
 * pushed as JSON to an external endpoint (Slack/Discord webhook URL, SIEM
 * ingest API, ticketing system, etc.). Fire-and-forget with a short timeout;
 * failures are logged (throttled) and never block the ingestion pipeline.
 */

import { logger } from './logger.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
let lastErrorLog = 0;

function logThrottled(error: any) {
  const now = Date.now();
  if (now - lastErrorLog > 60000) {
    lastErrorLog = now;
    logger.warn('webhook_send_failed', { error: error?.message || String(error) });
  }
}

export async function sendWebhook(type: string, payload: any): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, timestamp: new Date().toISOString(), payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.debug('webhook_sent', { type });
  } catch (e: any) {
    logThrottled(e);
  }
}

export const webhookConfigured = () => !!WEBHOOK_URL;
