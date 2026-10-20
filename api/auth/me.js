import { handler, requireMethod, sendJson } from '../../lib/http.js';
import { requireSession } from '../../lib/auth.js';

// GET /api/auth/me -> { role, username }
export default handler(async (req, res) => {
  requireMethod(req, 'GET');
  const session = await requireSession(req);
  sendJson(res, 200, { role: session.role, username: session.username });
});
