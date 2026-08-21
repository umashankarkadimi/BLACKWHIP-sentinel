/**
 * BlackWhip SentinelX — Structured JSON logger (zero-dependency).
 *
 * Emits one JSON object per line to stdout (info/debug) or stderr (warn/error)
 * so the event -> alert -> incident pipeline can be traced end-to-end with
 * standard log tooling (jq, Loki, CloudWatch, etc.).
 *
 * Level filtering is controlled by LOG_LEVEL env var (debug | info | warn | error).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel: number = LOG_LEVELS[(process.env.LOG_LEVEL || 'info') as LogLevel] ?? 20;

function emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < configuredLevel) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...ctx });
  if (level === 'warn' || level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};
