'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

// Safety net: never let a Discord token reach the logs.
const TOKEN_PATTERN = /[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,}/g;

function redact(value) {
  const text = value instanceof Error ? value.stack || value.message : String(value);
  return text.replace(TOKEN_PATTERN, '[REDACTED_TOKEN]');
}

function log(level, args) {
  if (LEVELS[level] < threshold) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${args.map(redact).join(' ')}`;
  (level === 'error' ? console.error : console.log)(line);
}

module.exports = {
  debug: (...args) => log('debug', args),
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
};
