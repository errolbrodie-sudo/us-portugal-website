/* ==========================================
   ReloPlan - Authentication core (server-side only)
   ========================================== */

import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { hash as argonHash, verify as argonVerify, Algorithm } from '@node-rs/argon2';
import { query, transaction, ConfigError } from './db.js';
import { HttpError } from './http.js';
import { SESSION_COOKIE, GATE_COOKIE, GATE_TTL_SECONDS, signGate, parseCookies } from './gate.js';

export const PASSWORD_LENGTH = 8;
const USER_SESSION_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const MAX_PASSWORD_INPUT = 256; // guards the hasher against oversized input; not a policy limit

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
const ARGON_OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

// --- Configuration -----------------------------------------------------------

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new ConfigError('SESSION_SECRET (at least 32 characters)');
  return secret;
}

function adminConfig() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || (!passwordHash && !password)) return null;
  return { username, passwordHash, password };
}

// Changes whenever the admin username or password changes, which invalidates admin sessions.
function adminFingerprint(admin) {
  return createHmac('sha256', sessionSecret())
    .update(`admin:${admin.username}\0${admin.passwordHash || admin.password}`)
    .digest('hex');
}

// --- Input rules -------------------------------------------------------------

// Counted in Unicode code points, so "é" or an emoji is one character. Never trimmed or normalized.
export function passwordLength(password) {
  return [...password].length;
}

export function assertValidNewPassword(password) {
  if (typeof password !== 'string' || passwordLength(password) !== PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be exactly ${PASSWORD_LENGTH} characters.`);
  }
}

export function normalizeEmail(email) {
  return String(email).normalize('NFC').trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertValidEmail(email) {
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }
}

export function hashPassword(password) {
  return argonHash(password, ARGON_OPTIONS);
}

// Used when the account does not exist, so response timing does not reveal registered emails.
let dummyHashPromise = null;
function dummyHash() {
  dummyHashPromise ??= argonHash(randomBytes(16).toString('hex'), ARGON_OPTIONS);
  return dummyHashPromise;
}

async function verifyPassword(storedHash, password) {
  try {
    return await argonVerify(storedHash, password);
  } catch {
    return false;
  }
}

function constantTimeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// --- Rate limiting -----------------------------------------------------------

const LIMITS = {
  'login-fail-user': { max: 5, windowSeconds: 15 * 60 },
  'login-fail-ip': { max: 30, windowSeconds: 15 * 60 },
  // Per-IP limit plus a global cap: ~1,440 guesses/day at most against the admin password,
  // without letting one client lock the real administrator out.
  'login-fail-admin-ip': { max: 5, windowSeconds: 30 * 60 },
  'login-fail-admin': { max: 30, windowSeconds: 30 * 60 },
  'register-ip': { max: 10, windowSeconds: 60 * 60 },
  'password-change-user': { max: 5, windowSeconds: 15 * 60 },
  'admin-op-ip': { max: 120, windowSeconds: 10 * 60 }
};

function rateKey(value) {
  return createHmac('sha256', sessionSecret()).update(`rate:${value}`).digest('hex');
}

async function isRateLimited(bucket, value) {
  const { max, windowSeconds } = LIMITS[bucket];
  const { rows } = await query(
    `select count(*)::int as n from reloplan_rate_events
     where bucket = $1 and key = $2 and created_at > now() - make_interval(secs => $3)`,
    [bucket, rateKey(value), windowSeconds]
  );
  return rows[0].n >= max;
}

async function recordRateEvent(bucket, value) {
  await query('insert into reloplan_rate_events (bucket, key) values ($1, $2)', [bucket, rateKey(value)]);
  // Occasional housekeeping keeps both tables small without a scheduled job.
  if (Math.random() < 0.02) {
    await query(`delete from reloplan_rate_events where created_at < now() - interval '1 day'`);
    await query(`delete from reloplan_sessions where expires_at < now() - interval '7 days'`);
  }
}

async function clearRateEvents(bucket, value) {
  await query('delete from reloplan_rate_events where bucket = $1 and key = $2', [bucket, rateKey(value)]);
}

function tooManyAttempts() {
  return new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', { 'Retry-After': '900' });
}

async function enforceLimit(bucket, value) {
  if (await isRateLimited(bucket, value)) throw tooManyAttempts();
  await recordRateEvent(bucket, value);
}

// --- Sessions ----------------------------------------------------------------

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearedCookies() {
  return [cookie(SESSION_COOKIE, '', 0), cookie(GATE_COOKIE, '', 0)];
}

async function issueCookies(token, role, sessionSeconds) {
  const gate = await signGate({ role, sessionToken: token }, sessionSecret());
  return [cookie(SESSION_COOKIE, token, sessionSeconds), cookie(GATE_COOKIE, gate, GATE_TTL_SECONDS)];
}

// A fresh random token on every login: the session identifier is always regenerated.
async function createUserSession(db, user) {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `insert into reloplan_sessions (token_hash, user_id, is_admin, session_version, expires_at)
     values ($1, $2, false, $3, now() + make_interval(secs => $4))`,
    [hashToken(token), user.id, user.session_version, USER_SESSION_SECONDS]
  );
  return issueCookies(token, 'user', USER_SESSION_SECONDS);
}

async function createAdminSession(admin) {
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into reloplan_sessions (token_hash, is_admin, admin_fingerprint, expires_at)
     values ($1, true, $2, now() + make_interval(secs => $3))`,
    [hashToken(token), adminFingerprint(admin), ADMIN_SESSION_SECONDS]
  );
  return issueCookies(token, 'admin', ADMIN_SESSION_SECONDS);
}

async function revokeToken(token) {
  if (token) await query('update reloplan_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null', [hashToken(token)]);
}

export function sessionTokenFrom(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}

// The authoritative check: session row, expiry, revocation, account status and session version.
export async function loadSession(req) {
  const token = sessionTokenFrom(req);
  if (!token) return null;
  const { rows } = await query(
    `select s.is_admin, s.user_id, s.session_version, s.admin_fingerprint,
            u."Username" as username, u."Date of Deregistration" as deregistered,
            u.session_version as current_version
     from reloplan_sessions s
     left join "ReloPlan_Users" u on u.id = s.user_id
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()`,
    [hashToken(token)]
  );
  const row = rows[0];
  if (!row) return null;

  if (row.is_admin) {
    const admin = adminConfig();
    if (!admin || row.admin_fingerprint !== adminFingerprint(admin)) return null;
    return { token, role: 'admin', username: admin.username };
  }
  if (row.username == null || row.deregistered != null || row.session_version !== row.current_version) return null;
  return { token, role: 'user', userId: Number(row.user_id), username: row.username };
}

export async function requireSession(req) {
  const session = await loadSession(req);
  if (!session) throw new HttpError(401, 'Please log in.');
  return session;
}

export async function requireAdmin(req, ip) {
  const session = await requireSession(req);
  if (session.role !== 'admin') throw new HttpError(403, 'Administrator access required.');
  await enforceLimit('admin-op-ip', ip);
  return session;
}

// Re-issues the short-lived gate cookie after re-validating the session.
export async function refreshGate(req) {
  const session = await loadSession(req);
  if (!session) return null;
  const gate = await signGate({ role: session.role, sessionToken: session.token }, sessionSecret());
  return cookie(GATE_COOKIE, gate, GATE_TTL_SECONDS);
}

// --- Flows -------------------------------------------------------------------

const INVALID_CREDENTIALS = 'The username or password is incorrect.';

export async function login({ username, password, ip, previousToken }) {
  sessionSecret(); // fail fast with a safe 503 if the server is not configured
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    throw new HttpError(400, 'Please enter your username and password.');
  }
  if (password.length > MAX_PASSWORD_INPUT) throw new HttpError(401, INVALID_CREDENTIALS);

  // Administrator: an explicit identity from server-side configuration, not an email account.
  const admin = adminConfig();
  if (admin && constantTimeEqual(username.trim(), admin.username)) {
    if (await isRateLimited('login-fail-admin-ip', ip) || await isRateLimited('login-fail-admin', 'admin')) throw tooManyAttempts();
    const ok = admin.passwordHash
      ? await verifyPassword(admin.passwordHash, password)
      : constantTimeEqual(password, admin.password);
    if (!ok) {
      await recordRateEvent('login-fail-admin-ip', ip);
      await recordRateEvent('login-fail-admin', 'admin');
      throw new HttpError(401, INVALID_CREDENTIALS);
    }
    await clearRateEvents('login-fail-admin-ip', ip);
    await revokeToken(previousToken);
    return { role: 'admin', cookies: await createAdminSession(admin) };
  }

  const email = normalizeEmail(username);
  if (await isRateLimited('login-fail-user', email) || await isRateLimited('login-fail-ip', ip)) throw tooManyAttempts();

  const { rows } = await query(
    `select id, "Password" as password_hash, "Date of Deregistration" as deregistered, session_version
     from "ReloPlan_Users" where lower("Username") = $1`,
    [email]
  );
  const user = rows[0];
  const passwordOk = user ? await verifyPassword(user.password_hash, password) : (await verifyPassword(await dummyHash(), password), false);

  if (!passwordOk || user.deregistered != null) {
    await recordRateEvent('login-fail-user', email);
    await recordRateEvent('login-fail-ip', ip);
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  await clearRateEvents('login-fail-user', email);
  await revokeToken(previousToken);
  return { role: 'user', cookies: await createUserSession({ query }, user) };
}

export async function register({ email: rawEmail, password, ip }) {
  sessionSecret();
  if (typeof rawEmail !== 'string') throw new HttpError(400, 'Please enter a valid email address.');
  const email = normalizeEmail(rawEmail);
  assertValidEmail(email);
  assertValidNewPassword(password);
  await enforceLimit('register-ip', ip);

  const passwordHash = await hashPassword(password);

  // Insert and session creation commit together; access is granted only after the commit.
  return transaction(async db => {
    const { rows } = await db.query(
      `insert into "ReloPlan_Users" ("Username", "Password", "Date of Registration", "Date of Deregistration")
       values ($1, $2, current_date, null)
       on conflict (lower("Username")) do nothing
       returning id, session_version`,
      [email, passwordHash]
    );
    if (!rows[0]) throw new HttpError(409, 'An account with this email already exists. Please log in instead.');
    return { role: 'user', cookies: await createUserSession(db, rows[0]) };
  });
}

export async function logout(req) {
  await revokeToken(sessionTokenFrom(req));
  return clearedCookies();
}

export async function changeOwnPassword(session, { currentPassword, newPassword }) {
  if (session.role !== 'user') throw new HttpError(400, 'The administrator password is changed in the server configuration.');
  if (typeof currentPassword !== 'string' || currentPassword.length > MAX_PASSWORD_INPUT) throw new HttpError(400, 'Your current password is incorrect.');
  assertValidNewPassword(newPassword);
  await enforceLimit('password-change-user', String(session.userId));

  const { rows } = await query('select "Password" as password_hash from "ReloPlan_Users" where id = $1', [session.userId]);
  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, currentPassword))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  const passwordHash = await hashPassword(newPassword);

  // New hash, bumped session version (ends all other sessions) and a fresh session for this browser.
  return transaction(async db => {
    const { rows: updated } = await db.query(
      `update "ReloPlan_Users"
       set "Password" = $2, session_version = session_version + 1, updated_at = now()
       where id = $1 and "Date of Deregistration" is null
       returning id, session_version`,
      [session.userId, passwordHash]
    );
    if (!updated[0]) throw new HttpError(401, 'Please log in.');
    await db.query('update reloplan_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [session.userId]);
    return createUserSession(db, updated[0]);
  });
}
