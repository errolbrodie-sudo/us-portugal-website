import { handler, readJsonBody, assertSameOrigin, clientIp, requireMethod, sendJson } from '../../lib/http.js';
import { login, sessionTokenFrom } from '../../lib/auth.js';
import { safeNextPath } from '../../lib/gate.js';

// POST /api/auth/login  { username, password, next }
export default handler(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const result = await login({
    username: body.username,
    password: body.password,
    ip: clientIp(req),
    previousToken: sessionTokenFrom(req)
  });
  sendJson(res, 200, { ok: true, role: result.role, redirect: safeNextPath(body.next) }, { 'Set-Cookie': result.cookies });
});
