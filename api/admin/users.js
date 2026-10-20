import { handler, readJsonBody, assertSameOrigin, clientIp, requireMethod, sendJson, HttpError } from '../../lib/http.js';
import { requireAdmin, normalizeEmail, assertValidEmail, assertValidNewPassword, hashPassword } from '../../lib/auth.js';
import { query, transaction } from '../../lib/db.js';

// Never selects the "Password" column: hashes are not returned to any client.
const USER_COLUMNS = `id, "Username" as username,
  to_char("Date of Registration", 'YYYY-MM-DD') as registered,
  to_char("Date of Deregistration", 'YYYY-MM-DD') as deregistered`;

const PAGE_SIZE = 50;

function toUser(row) {
  return {
    id: Number(row.id),
    username: row.username,
    registered: row.registered,
    deregistered: row.deregistered,
    status: row.deregistered ? 'deregistered' : 'active'
  };
}

function userId(body) {
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'Invalid user.');
  return id;
}

// GET /api/admin/users?q=&status=all|active|deregistered&page=1
async function listUsers(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const search = (params.get('q') || '').trim().toLowerCase().slice(0, 254);
  const status = params.get('status') || 'all';
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get('page'), 10) || 1));

  // Escape LIKE wildcards so the search is a plain substring match.
  const pattern = `%${search.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
  const statusFilter = status === 'active' ? 'and "Date of Deregistration" is null'
    : status === 'deregistered' ? 'and "Date of Deregistration" is not null' : '';

  const { rows } = await query(
    `select ${USER_COLUMNS}, count(*) over()::int as total
     from "ReloPlan_Users"
     where lower("Username") like $1 ${statusFilter}
     order by "Date of Registration" desc, id desc
     limit $2 offset $3`,
    [pattern, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );
  sendJson(res, 200, {
    users: rows.map(toUser),
    total: rows[0]?.total ?? 0,
    page,
    pageSize: PAGE_SIZE
  });
}

const ACTIONS = {
  async create(body) {
    if (typeof body.email !== 'string') throw new HttpError(400, 'Please enter a valid email address.');
    const email = normalizeEmail(body.email);
    assertValidEmail(email);
    assertValidNewPassword(body.password);
    const passwordHash = await hashPassword(body.password);
    const { rows } = await query(
      `insert into "ReloPlan_Users" ("Username", "Password", "Date of Registration", "Date of Deregistration")
       values ($1, $2, current_date, null)
       on conflict (lower("Username")) do nothing
       returning ${USER_COLUMNS}`,
      [email, passwordHash]
    );
    if (!rows[0]) throw new HttpError(409, 'A user with this email already exists.');
    return rows[0];
  },

  // Resetting a password also ends the user's existing sessions.
  async 'set-password'(body) {
    const id = userId(body);
    assertValidNewPassword(body.password);
    const passwordHash = await hashPassword(body.password);
    return transaction(async db => {
      const { rows } = await db.query(
        `update "ReloPlan_Users" set "Password" = $2, session_version = session_version + 1, updated_at = now()
         where id = $1 returning ${USER_COLUMNS}`,
        [id, passwordHash]
      );
      if (!rows[0]) throw new HttpError(404, 'User not found.');
      await db.query('update reloplan_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id]);
      return rows[0];
    });
  },

  // Sets the deregistration date, bumps the session version and revokes every session.
  async deregister(body) {
    const id = userId(body);
    return transaction(async db => {
      const { rows } = await db.query(
        `update "ReloPlan_Users"
         set "Date of Deregistration" = coalesce("Date of Deregistration", current_date),
             session_version = session_version + 1, updated_at = now()
         where id = $1 returning ${USER_COLUMNS}`,
        [id]
      );
      if (!rows[0]) throw new HttpError(404, 'User not found.');
      await db.query('update reloplan_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id]);
      return rows[0];
    });
  },

  // Clears the deregistration date; the original registration date is kept.
  async reactivate(body) {
    const id = userId(body);
    const { rows } = await query(
      `update "ReloPlan_Users" set "Date of Deregistration" = null, updated_at = now()
       where id = $1 returning ${USER_COLUMNS}`,
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'User not found.');
    return rows[0];
  }
};

// POST /api/admin/users  { action: 'create' | 'set-password' | 'deregister' | 'reactivate', ... }
async function changeUser(req, res) {
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const action = Object.hasOwn(ACTIONS, body.action) ? ACTIONS[body.action] : null;
  if (!action) throw new HttpError(400, 'Unknown action.');
  const row = await action(body);
  sendJson(res, body.action === 'create' ? 201 : 200, { ok: true, user: toUser(row) });
}

export default handler(async (req, res) => {
  requireMethod(req, 'GET', 'POST');
  // Authorization happens on the server for every request, before any data access.
  await requireAdmin(req, clientIp(req));
  if (req.method === 'GET') await listUsers(req, res);
  else await changeUser(req, res);
});
