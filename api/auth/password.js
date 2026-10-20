import { handler, readJsonBody, assertSameOrigin, requireMethod, sendJson } from '../../lib/http.js';
import { requireSession, changeOwnPassword } from '../../lib/auth.js';

// POST /api/auth/password  { currentPassword, newPassword }
export default handler(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const session = await requireSession(req);
  const body = await readJsonBody(req);
  const cookies = await changeOwnPassword(session, body);
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookies });
});
