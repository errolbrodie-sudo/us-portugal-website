/* ==========================================
   ReloPlan - Gate token (shared by Edge middleware and API functions)
   Uses Web Crypto only, so it runs in both runtimes.
   ========================================== */

export const SESSION_COOKIE = '__Host-rp_sid';
export const GATE_COOKIE = '__Host-rp_gate';

// The gate token is short-lived; when it expires the middleware sends the browser
// through /api/auth/refresh, which re-checks the session and account in the database.
// This bounds how long a revoked or deregistered session can keep loading pages.
export const GATE_TTL_SECONDS = 60;

const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Binds a gate token to the session cookie, so clearing the session cookie (logout)
// immediately makes any leftover gate cookie useless.
export async function sessionBinding(sessionToken) {
  return (await sha256Hex(`gate:${sessionToken}`)).slice(0, 32);
}

export async function signGate({ role, sessionToken }, secret, now = Date.now()) {
  const payload = {
    r: role,
    b: await sessionBinding(sessionToken),
    e: Math.floor(now / 1000) + GATE_TTL_SECONDS
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

// Returns the payload if the signature is valid, unexpired and bound to this session token.
export async function verifyGate(token, sessionToken, secret, now = Date.now()) {
  if (!token || !sessionToken || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64Url(parts[1]), encoder.encode(parts[0]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    if (typeof payload.e !== 'number' || payload.e <= Math.floor(now / 1000)) return null;
    if (payload.r !== 'user' && payload.r !== 'admin') return null;
    if (payload.b !== await sessionBinding(sessionToken)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[name] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

// Only same-site relative paths are allowed as post-login destinations.
export function safeNextPath(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  if (next.startsWith('/login.html') || next.startsWith('/api/')) return '/';
  return next;
}
