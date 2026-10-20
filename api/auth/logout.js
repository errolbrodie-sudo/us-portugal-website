import { handler, assertSameOrigin, requireMethod, sendJson } from '../../lib/http.js';
import { logout } from '../../lib/auth.js';

// POST /api/auth/logout
export default handler(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const cookies = await logout(req);
  sendJson(res, 200, { ok: true, redirect: '/login.html' }, { 'Set-Cookie': cookies });
});
