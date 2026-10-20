import { handler, redirect, requireMethod } from '../../lib/http.js';
import { refreshGate, clearedCookies } from '../../lib/auth.js';
import { safeNextPath } from '../../lib/gate.js';

// GET /api/auth/refresh?next=/page.html
// The middleware sends the browser here when its short-lived gate cookie expires.
// The session and account are re-checked in the database before access continues.
export default handler(async (req, res) => {
  requireMethod(req, 'GET');
  const next = safeNextPath(new URL(req.url, 'http://localhost').searchParams.get('next'));
  const gateCookie = await refreshGate(req);
  if (!gateCookie) {
    redirect(res, `/login.html?next=${encodeURIComponent(next)}`, clearedCookies());
    return;
  }
  redirect(res, next, [gateCookie]);
});
