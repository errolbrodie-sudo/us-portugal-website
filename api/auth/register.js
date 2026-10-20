import { handler, readJsonBody, assertSameOrigin, clientIp, requireMethod, sendJson } from '../../lib/http.js';
import { register } from '../../lib/auth.js';
import { safeNextPath } from '../../lib/gate.js';

// POST /api/auth/register  { email, password, next }
export default handler(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const result = await register({ email: body.email, password: body.password, ip: clientIp(req) });
  sendJson(res, 201, { ok: true, role: result.role, redirect: safeNextPath(body.next) }, { 'Set-Cookie': result.cookies });
});
