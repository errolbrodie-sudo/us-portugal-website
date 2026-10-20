/* ==========================================
   ReloPlan - Site access gate (Vercel Routing Middleware; Web APIs only, no database access)
   Runs before every page, data file and asset. Only the login page and the
   auth API are reachable without a session.
   ========================================== */

import { next } from '@vercel/functions';
import { SESSION_COOKIE, GATE_COOKIE, parseCookies, verifyGate, safeNextPath } from './lib/gate.js';

export const config = {
  // API routes authorize themselves; /_vercel serves platform endpoints (analytics).
  matcher: ['/((?!api/|_vercel/).*)']
};

const PUBLIC_PATHS = new Set(['/login.html', '/favicon.ico']);
const ADMIN_PATHS = new Set(['/admin.html']);

function isPageRequest(request) {
  return request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html');
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return next();

  const cookies = parseCookies(request.headers.get('cookie'));
  const sessionToken = cookies[SESSION_COOKIE];
  const gate = await verifyGate(cookies[GATE_COOKIE], sessionToken, process.env.SESSION_SECRET);

  if (gate) {
    if (ADMIN_PATHS.has(url.pathname) && gate.r !== 'admin') {
      return new Response('Administrator access required.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    return next();
  }

  const nextPath = safeNextPath(url.pathname + url.search);
  if (!isPageRequest(request)) {
    return new Response('Authentication required.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  // A session cookie without a valid gate: re-check the session in the database first.
  const target = sessionToken ? '/api/auth/refresh' : '/login.html';
  return Response.redirect(new URL(`${target}?next=${encodeURIComponent(nextPath)}`, url), 302);
}
