/* ==========================================
   ReloPlan - HTTP helpers for Vercel Node functions
   ========================================== */

import { ConfigError } from './db.js';

export class HttpError extends Error {
  constructor(status, message, extraHeaders = {}) {
    super(message);
    this.status = status;
    this.extraHeaders = extraHeaders;
  }
}

export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function redirect(res, location, cookies = []) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end();
}

export async function readJsonBody(req) {
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (!type.startsWith('application/json')) throw new HttpError(415, 'Expected a JSON request.');

  // Vercel pre-parses JSON bodies into req.body; elsewhere read the stream.
  if (req.body !== undefined) {
    if (typeof req.body === 'object' && req.body !== null) return req.body;
    if (typeof req.body === 'string') return parseJson(req.body);
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new HttpError(413, 'Request too large.');
  }
  return parseJson(raw);
}

function parseJson(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}

// CSRF defence for state-changing requests: SameSite=Lax cookies plus a same-origin check.
export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!origin || !host) throw new HttpError(403, 'Request blocked.');
  try {
    if (new URL(origin).host !== host) throw new Error('cross-origin');
  } catch {
    throw new HttpError(403, 'Request blocked.');
  }
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export function requireMethod(req, ...methods) {
  if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed.', { Allow: methods.join(', ') });
}

// Wraps a handler so failures never leak internals (stack traces, SQL, connection strings).
export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message }, err.extraHeaders);
      } else if (err instanceof ConfigError) {
        console.error('[config]', err.message);
        sendJson(res, 503, { error: 'The service is temporarily unavailable. Please try again later.' });
      } else {
        console.error('[api] unexpected error:', err?.code || err?.name || 'Error', err?.message ? String(err.message).slice(0, 200) : '');
        sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
      }
    }
  };
}
