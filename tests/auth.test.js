/* ReloPlan authentication acceptance tests (local).
   Uses test-only credentials; the real administrator password must never appear in this public repository.
   Run: npm test */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSite, openDatabase, migrate, useDatabase, startServer, Client } from './harness.js';
import { hashPassword } from '../lib/auth.js';
import { signGate, verifyGate, GATE_COOKIE, SESSION_COOKIE } from '../lib/gate.js';

const ADMIN_USER = 'TestAdmin@1';
const ADMIN_PASS = 'Adm1n#99';
const SESSION_SECRET = 'test-session-secret-0123456789-abcdefghijklmnop';

process.env.SESSION_SECRET = SESSION_SECRET;
process.env.ADMIN_USERNAME = ADMIN_USER;
process.env.ADMIN_PASSWORD = ADMIN_PASS;
delete process.env.ADMIN_PASSWORD_HASH;
delete process.env.DATABASE_URL;

let db, dataDir, outDir, server, base;
let ipCounter = 1;
const client = () => new Client(base, `198.51.100.${ipCounter++}`);

async function registered(email, password) {
  const c = client();
  const r = await c.post('/api/auth/register', { email, password });
  assert.equal(r.status, 201, `register ${email}: ${r.text}`);
  return c;
}

async function adminClient() {
  const c = client();
  const r = await c.post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS });
  assert.equal(r.status, 200, r.text);
  return c;
}

async function findUserId(admin, email) {
  const r = await admin.get(`/api/admin/users?q=${encodeURIComponent(email)}`);
  return r.data.users.find(u => u.username === email).id;
}

before(async () => {
  outDir = await buildSite();
  dataDir = await mkdtemp(path.join(tmpdir(), 'reloplan-db-'));
  db = await openDatabase(dataDir);
  await migrate(db);
  useDatabase(db);
  ({ server, base } = await startServer(outDir));
});

after(async () => {
  server?.close();
  await db?.close();
});

test('11. administrator can log in and use the site when the user table is empty', async () => {
  const { rows } = await db.query('select count(*)::int as n from "ReloPlan_Users"');
  assert.equal(rows[0].n, 0);
  const admin = await adminClient();
  const home = await admin.visit('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Relocation Decision Platform/);
  assert.equal((await admin.get('/api/auth/me')).data.role, 'admin');
  assert.equal((await admin.visit('/admin.html')).status, 200);
});

test('10. administrator login uses the configured credentials (plain and hashed), not email validation', async () => {
  const wrong = await client().post('/api/auth/login', { username: ADMIN_USER, password: 'Adm1n#98' });
  assert.equal(wrong.status, 401);
  const wrongCase = await client().post('/api/auth/login', { username: ADMIN_USER.toLowerCase(), password: ADMIN_PASS });
  assert.equal(wrongCase.status, 401, 'admin username is matched exactly');

  // Hashed credential mode, as recommended for production.
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(ADMIN_PASS);
  delete process.env.ADMIN_PASSWORD;
  try {
    assert.equal((await client().post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS })).status, 200);
  } finally {
    delete process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD = ADMIN_PASS;
  }
});

test('10b. changing the admin credential invalidates existing admin sessions', async () => {
  const admin = await adminClient();
  process.env.ADMIN_PASSWORD = 'Ch@nged1';
  try {
    assert.equal((await admin.get('/api/auth/me')).status, 401);
    assert.equal((await client().post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS })).status, 401);
  } finally {
    process.env.ADMIN_PASSWORD = ADMIN_PASS;
  }
});

test('1. unauthenticated visitors cannot reach pages, data files, assets or APIs', async () => {
  const anon = client();
  for (const page of ['/', '/index.html', '/visa-report.html', '/admin.html', '/account.html', '/relocation-platforms-competitive-dossier.html']) {
    const r = await anon.get(page, { page: true });
    assert.equal(r.status, 302, page);
    assert.match(new URL(r.location, base).pathname, /^\/login\.html$/, page);
    assert.doesNotMatch(r.text, /Relocation Decision Platform/);
  }
  const assets = (await readdir(path.join(outDir, 'assets'))).map(f => `/assets/${f}`);
  for (const resource of ['/rent-data.json', '/visa-data.json', ...assets]) {
    assert.equal((await anon.get(resource)).status, 401, resource);
  }
  assert.equal((await anon.get('/api/auth/me')).status, 401);
  assert.equal((await anon.get('/api/admin/users')).status, 401);
  // The login page itself is public and self-contained.
  const login = await anon.get('/login.html', { page: true });
  assert.equal(login.status, 200);
  assert.doesNotMatch(login.text, /src="\/assets\//);
});

test('1b. a forged or tampered gate cookie is rejected', async () => {
  const anon = client();
  anon.cookies.set(SESSION_COOKIE, 'made-up-token');
  anon.cookies.set(GATE_COOKIE, await signGate({ role: 'admin', sessionToken: 'made-up-token' }, 'wrong-secret-wrong-secret-wrong-secret'));
  const r = await anon.get('/', { page: true });
  assert.equal(r.status, 302);
  assert.equal(new URL(r.location, base).pathname, '/api/auth/refresh');
  const followed = await anon.visit('/');
  assert.equal(followed.finalPath.split('?')[0], '/login.html');
});

test('2 & 4. users register and log in with passwords containing letters, digits, spaces, symbols and Unicode', async () => {
  const passwords = ['abcd1234', 'A b C 1 ', '!@#$%^&*', ' spaced ', 'pässwörd', 'ab🙂cdefg', 'Tab\there'];
  for (const [i, password] of passwords.entries()) {
    assert.equal([...password].length, 8);
    const email = `user${i}@example.com`;
    await registered(email, password);
    const c = client();
    const r = await c.post('/api/auth/login', { username: email, password });
    assert.equal(r.status, 200, `login with ${JSON.stringify(password)}: ${r.text}`);
    assert.equal((await c.visit('/visa-report.html')).status, 200);
  }
});

test('2b. registration logs the user in immediately', async () => {
  const c = await registered('fresh@example.com', 'Fresh#01');
  assert.equal((await c.get('/api/auth/me')).data.username, 'fresh@example.com');
  assert.equal((await c.visit('/')).status, 200);
});

test('3. wrong passwords are rejected with a generic message; passwords are case-sensitive and never trimmed', async () => {
  await registered('case@example.com', 'CaSe-123');
  const attempts = [
    { username: 'case@example.com', password: 'case-123' },
    { username: 'case@example.com', password: 'CaSe-124' },
    { username: 'nobody@example.com', password: 'CaSe-123' }
  ];
  const messages = new Set();
  for (const attempt of attempts) {
    const r = await client().post('/api/auth/login', attempt);
    assert.equal(r.status, 401);
    messages.add(r.data.error);
  }
  assert.equal(messages.size, 1, 'same message whether or not the email exists');

  await registered('spaces@example.com', ' x y z  ');
  assert.equal((await client().post('/api/auth/login', { username: 'spaces@example.com', password: 'x y z' })).status, 401);
  assert.equal((await client().post('/api/auth/login', { username: '  SPACES@Example.com ', password: ' x y z  ' })).status, 200);
});

test('5. passwords that are not exactly 8 characters are rejected at registration and on change', async () => {
  for (const password of ['', 'short', '1234567', '123456789', 'ab🙂cdef', 'a'.repeat(100)]) {
    const r = await client().post('/api/auth/register', { email: `len${[...password].length}@example.com`, password });
    assert.equal(r.status, 400, JSON.stringify(password));
  }
  const user = await registered('change@example.com', 'Orig-123');
  assert.equal((await user.post('/api/auth/password', { currentPassword: 'Orig-123', newPassword: 'toolong99' })).status, 400);
  assert.equal((await user.post('/api/auth/password', { currentPassword: 'Orig-123', newPassword: 'short' })).status, 400);
  const admin = await adminClient();
  const id = await findUserId(admin, 'change@example.com');
  assert.equal((await admin.post('/api/admin/users', { action: 'set-password', id, password: '1234567' })).status, 400);
  assert.equal((await admin.post('/api/admin/users', { action: 'create', email: 'x@example.com', password: '123456789' })).status, 400);
});

test('5b. a user can change their own password; other sessions end', async () => {
  const first = await registered('self@example.com', 'Self-123');
  const second = client();
  assert.equal((await second.post('/api/auth/login', { username: 'self@example.com', password: 'Self-123' })).status, 200);
  assert.equal((await first.post('/api/auth/password', { currentPassword: 'wrong', newPassword: 'Self-456' })).status, 400);
  assert.equal((await first.post('/api/auth/password', { currentPassword: 'Self-123', newPassword: 'Self-456' })).status, 200);
  assert.equal((await first.get('/api/auth/me')).status, 200, 'the changing browser stays signed in');
  assert.equal((await second.get('/api/auth/me')).status, 401, 'other sessions are ended');
  assert.equal((await client().post('/api/auth/login', { username: 'self@example.com', password: 'Self-123' })).status, 401);
  assert.equal((await client().post('/api/auth/login', { username: 'self@example.com', password: 'Self-456' })).status, 200);
});

test('6. passwords are stored as Argon2id hashes, never plain text', async () => {
  const { rows } = await db.query(`select "Password" as p from "ReloPlan_Users" where "Username" = 'case@example.com'`);
  assert.match(rows[0].p, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.ok(!rows[0].p.includes('CaSe-123'));
});

test('7. duplicate emails are rejected regardless of capitalization or surrounding spaces', async () => {
  await registered('dup@example.com', 'Dup-1234');
  for (const email of ['DUP@example.com', ' Dup@Example.COM ']) {
    const r = await client().post('/api/auth/register', { email, password: 'Other-12' });
    assert.equal(r.status, 409, email);
  }
  const admin = await adminClient();
  assert.equal((await admin.post('/api/admin/users', { action: 'create', email: 'DUP@EXAMPLE.COM', password: 'Other-12' })).status, 409);
  const { rows } = await db.query(`select count(*)::int as n from "ReloPlan_Users" where lower("Username") = 'dup@example.com'`);
  assert.equal(rows[0].n, 1);
});

test('7b. invalid emails are rejected', async () => {
  for (const email of ['', 'not-an-email', 'a@b', 'two words@example.com', `${'a'.repeat(250)}@example.com`]) {
    assert.equal((await client().post('/api/auth/register', { email, password: 'Valid-12' })).status, 400, email);
  }
});

test('8 & 9. deregistered users cannot log in and their existing sessions stop working', async () => {
  const user = await registered('leaver@example.com', 'Leave-12');
  assert.equal((await user.visit('/')).status, 200);
  const admin = await adminClient();
  const id = await findUserId(admin, 'leaver@example.com');

  const r = await admin.post('/api/admin/users', { action: 'deregister', id });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.status, 'deregistered');
  assert.match(r.data.user.deregistered, /^\d{4}-\d{2}-\d{2}$/);

  // APIs and the gate refresh deny immediately.
  assert.equal((await user.get('/api/auth/me')).status, 401);
  assert.equal((await user.post('/api/auth/password', { currentPassword: 'Leave-12', newPassword: 'Leave-34' })).status, 401);
  user.cookies.delete(GATE_COOKIE); // simulate the short-lived gate cookie expiring
  const page = await user.visit('/');
  assert.equal(page.finalPath.split('?')[0], '/login.html');

  const login = await client().post('/api/auth/login', { username: 'leaver@example.com', password: 'Leave-12' });
  assert.equal(login.status, 401);

  // Reactivation restores access and keeps the original registration date.
  const before = (await db.query(`select "Date of Registration" as d from "ReloPlan_Users" where id = $1`, [id])).rows[0].d;
  const re = await admin.post('/api/admin/users', { action: 'reactivate', id });
  assert.equal(re.data.user.status, 'active');
  assert.equal(re.data.user.deregistered, null);
  const after = (await db.query(`select "Date of Registration" as d from "ReloPlan_Users" where id = $1`, [id])).rows[0].d;
  assert.deepEqual(after, before);
  assert.equal((await client().post('/api/auth/login', { username: 'leaver@example.com', password: 'Leave-12' })).status, 200);
});

test('9b. the gate cookie expires within 60 seconds, bounding access by a revoked session', async () => {
  const token = 'some-session-token';
  const gate = await signGate({ role: 'user', sessionToken: token }, SESSION_SECRET);
  assert.ok(await verifyGate(gate, token, SESSION_SECRET));
  assert.equal(await verifyGate(gate, token, SESSION_SECRET, Date.now() + 61_000), null);
  assert.equal(await verifyGate(gate, 'another-token', SESSION_SECRET), null, 'bound to its session');
});

test('9c. admin password reset ends the user\'s sessions', async () => {
  const user = await registered('reset@example.com', 'Reset-12');
  const admin = await adminClient();
  const id = await findUserId(admin, 'reset@example.com');
  assert.equal((await admin.post('/api/admin/users', { action: 'set-password', id, password: 'Reset-34' })).status, 200);
  assert.equal((await user.get('/api/auth/me')).status, 401);
  assert.equal((await client().post('/api/auth/login', { username: 'reset@example.com', password: 'Reset-34' })).status, 200);
});

test('12. ordinary users cannot use administrator functions', async () => {
  const user = await registered('plain@example.com', 'Plain-12');
  assert.equal((await user.get('/api/admin/users')).status, 403);
  assert.equal((await user.post('/api/admin/users', { action: 'create', email: 'evil@example.com', password: 'Evil-123' })).status, 403);
  assert.equal((await user.get('/admin.html', { page: true })).status, 403);
  // Forging an admin gate cookie without the server secret does not help.
  user.cookies.set(GATE_COOKIE, await signGate({ role: 'admin', sessionToken: user.cookies.get(SESSION_COOKIE) }, 'not-the-real-secret-not-the-real-secret'));
  assert.notEqual((await user.get('/admin.html', { page: true })).status, 200);
  assert.equal((await user.get('/api/admin/users')).status, 403);
});

test('12b. admin search, filtering and listing never expose password hashes', async () => {
  const admin = await adminClient();
  const all = await admin.get('/api/admin/users');
  assert.ok(all.data.total >= 10);
  assert.ok(!/argon2|"password"/i.test(all.text));
  const search = await admin.get('/api/admin/users?q=CASE@');
  assert.deepEqual(search.data.users.map(u => u.username), ['case@example.com']);
  const wildcard = await admin.get('/api/admin/users?q=%25');
  assert.equal(wildcard.data.total, 0, 'LIKE wildcards are escaped');
  const active = await admin.get('/api/admin/users?status=deregistered');
  assert.ok(active.data.users.every(u => u.status === 'deregistered'));
});

test('13. secrets never reach the browser', async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full); else files.push(full);
    }
  }
  await walk(outDir);
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const secret of [ADMIN_PASS, SESSION_SECRET, 'DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET', 'argon2']) {
      assert.ok(!text.includes(secret), `${secret} found in ${file}`);
    }
  }
  // Cookies are HttpOnly, Secure and SameSite.
  const r = await client().post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS });
  for (const line of r.headers.getSetCookie()) {
    assert.match(line, /HttpOnly/);
    assert.match(line, /Secure/);
    assert.match(line, /SameSite=Lax/);
    assert.match(line, /^__Host-/);
  }
  assert.ok(!r.text.includes(ADMIN_PASS));
});

test('14. Supabase API roles (anon, authenticated) cannot read or change user records', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      for (const sql of [
        'select * from "ReloPlan_Users"',
        `insert into "ReloPlan_Users" ("Username", "Password") values ('x@y.z', 'h')`,
        'update "ReloPlan_Users" set "Password" = \'h\'',
        'delete from "ReloPlan_Users"',
        'select * from reloplan_sessions'
      ]) {
        await assert.rejects(db.query(sql), /permission denied/, `${role}: ${sql}`);
      }
    } finally {
      await db.exec('reset role');
    }
  }
  const rls = await db.query(`select relname, relrowsecurity from pg_class where relname in ('ReloPlan_Users', 'reloplan_sessions', 'reloplan_rate_events')`);
  assert.ok(rls.rows.length === 3 && rls.rows.every(r => r.relrowsecurity));
});

test('16. simultaneous registrations do not create duplicates', async () => {
  const same = await Promise.all(Array.from({ length: 12 }, () => client().post('/api/auth/register', { email: 'race@example.com', password: 'Race-123' })));
  assert.equal(same.filter(r => r.status === 201).length, 1);
  assert.equal(same.filter(r => r.status === 409).length, 11);
  const different = await Promise.all(Array.from({ length: 12 }, (_, i) => client().post('/api/auth/register', { email: `crowd${i}@example.com`, password: 'Crowd-12' })));
  assert.ok(different.every(r => r.status === 201));
  const { rows } = await db.query(`select count(*)::int as n from "ReloPlan_Users" where "Username" like 'crowd%' or "Username" = 'race@example.com'`);
  assert.equal(rows[0].n, 13);
});

test('17. logout ends access, and a replayed session cookie is rejected', async () => {
  const user = await registered('logout@example.com', 'Bye-1234');
  const stolenSession = user.cookies.get(SESSION_COOKIE);
  const r = await user.post('/api/auth/logout');
  assert.equal(r.status, 200);
  assert.equal(user.cookies.size, 0, 'both cookies cleared');
  assert.equal((await user.visit('/')).finalPath.split('?')[0], '/login.html');

  const replay = client();
  replay.cookies.set(SESSION_COOKIE, stolenSession);
  assert.equal((await replay.get('/api/auth/me')).status, 401);
  assert.equal((await replay.visit('/')).finalPath.split('?')[0], '/login.html');
});

test('17b. login regenerates the session identifier', async () => {
  const c = await registered('regen@example.com', 'Regen-12');
  const firstToken = c.cookies.get(SESSION_COOKIE);
  assert.equal((await c.post('/api/auth/login', { username: 'regen@example.com', password: 'Regen-12' })).status, 200);
  assert.notEqual(c.cookies.get(SESSION_COOKIE), firstToken);
  const old = client();
  old.cookies.set(SESSION_COOKIE, firstToken);
  assert.equal((await old.get('/api/auth/me')).status, 401, 'previous session revoked');
});

test('security: cross-site POSTs and non-JSON bodies are rejected (CSRF)', async () => {
  const c = client();
  assert.equal((await c.post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS }, { headers: { origin: 'https://evil.example' } })).status, 403);
  const form = await c.request('POST', '/api/auth/register', { headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 415);
  const admin = await adminClient();
  assert.equal((await admin.post('/api/auth/logout', {}, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await admin.get('/api/auth/me')).status, 200, 'cross-site logout attempt had no effect');
});

test('security: open redirects are blocked', async () => {
  const r = await client().post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS, next: '//evil.example/x' });
  assert.equal(r.data.redirect, '/');
  const ok = await client().post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS, next: '/rent-report.html?x=1' });
  assert.equal(ok.data.redirect, '/rent-report.html?x=1');
});

test('security: repeated failed logins are throttled per account and per IP', async () => {
  await registered('target@example.com', 'Target-1');
  for (let i = 0; i < 5; i++) {
    assert.equal((await client().post('/api/auth/login', { username: 'target@example.com', password: `wrong-${i}0` })).status, 401);
  }
  const locked = await client().post('/api/auth/login', { username: 'TARGET@example.com', password: 'Target-1' });
  assert.equal(locked.status, 429, 'correct password is refused while the account is throttled');

  const attacker = new Client(base, '192.0.2.250');
  for (let i = 0; i < 30; i++) await attacker.post('/api/auth/login', { username: `spray${i}@example.com`, password: 'Guess-12' });
  assert.equal((await attacker.post('/api/auth/login', { username: 'dup@example.com', password: 'Dup-1234' })).status, 429);
});

test('security: administrator login is throttled without locking out other IPs', async () => {
  const attacker = new Client(base, '192.0.2.251');
  for (let i = 0; i < 5; i++) assert.equal((await attacker.post('/api/auth/login', { username: ADMIN_USER, password: `Bad-pw${i}0` })).status, 401);
  assert.equal((await attacker.post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS })).status, 429);
  assert.equal((await client().post('/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASS })).status, 200);
});

test('15 & 19. data survives a restart, and re-running the migration keeps every record', async () => {
  const before = (await db.query('select count(*)::int as n from "ReloPlan_Users"')).rows[0].n;
  assert.ok(before > 20);
  await db.close();
  db = await openDatabase(dataDir);
  useDatabase(db);
  assert.equal((await db.query('select count(*)::int as n from "ReloPlan_Users"')).rows[0].n, before);
  await migrate(db);
  await migrate(db);
  assert.equal((await db.query('select count(*)::int as n from "ReloPlan_Users"')).rows[0].n, before);
  assert.equal((await client().post('/api/auth/login', { username: 'case@example.com', password: 'CaSe-123' })).status, 200);
});

test('18. database failures return safe messages without secrets', async () => {
  useDatabase(null);
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    delete process.env.DATABASE_URL;
    const missing = await client().post('/api/auth/login', { username: 'case@example.com', password: 'CaSe-123' });
    assert.equal(missing.status, 503);
    assert.ok(!missing.text.includes('DATABASE_URL'));

    process.env.DATABASE_URL = 'postgresql://postgres.ref:Sup3r-Secret-Pw@127.0.0.1:1/postgres';
    const r = await client().post('/api/auth/login', { username: 'case@example.com', password: 'CaSe-123' });
    assert.equal(r.status, 500);
    assert.equal(r.data.error, 'Something went wrong. Please try again.');
    assert.ok(!r.text.includes('Sup3r-Secret-Pw') && !r.text.includes('127.0.0.1'));
    assert.ok(errors.length > 0 && errors.every(e => !e.includes('Sup3r-Secret-Pw')), 'logged, without the password');
  } finally {
    console.error = originalError;
    delete process.env.DATABASE_URL;
    useDatabase(db);
  }
});
