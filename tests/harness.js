/* Local stand-in for Vercel: Routing Middleware -> static files from the Vite build,
   /api/* -> the real function handlers, database -> PGlite (real Postgres compiled to WASM). */

import http from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'vite';
import { setDbForTesting } from '../lib/db.js';
import middleware from '../middleware.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const migrationPath = path.join(root, 'supabase/migrations/20261019000000_reloplan_users.sql');

const ROUTES = {
  '/api/auth/login': 'api/auth/login.js',
  '/api/auth/register': 'api/auth/register.js',
  '/api/auth/logout': 'api/auth/logout.js',
  '/api/auth/refresh': 'api/auth/refresh.js',
  '/api/auth/me': 'api/auth/me.js',
  '/api/auth/password': 'api/auth/password.js',
  '/api/admin/users': 'api/admin/users.js'
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

export async function buildSite() {
  const outDir = await mkdtemp(path.join(tmpdir(), 'reloplan-build-'));
  await build({ root, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  return outDir;
}

export async function openDatabase(dataDir) {
  const db = new PGlite(dataDir);
  await db.waitReady;
  // Stand-ins for Supabase's API roles so the migration's REVOKE/RLS can be exercised.
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;`);
  return db;
}

export async function migrate(db) {
  await db.exec(await readFile(migrationPath, 'utf8'));
}

export function useDatabase(db) {
  setDbForTesting(db && {
    query: (text, params) => db.query(text, params),
    transaction: fn => db.transaction(tx => fn({ query: (text, params) => tx.query(text, params) }))
  });
}

export async function startServer(outDir) {
  const handlers = {};
  for (const [route, file] of Object.entries(ROUTES)) {
    handlers[route] = (await import(new URL(`../${file}`, import.meta.url))).default;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const fn = handlers[url.pathname];
      if (!fn) { res.statusCode = 404; res.end('Not found'); return; }
      await fn(req, res);
      return;
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const result = await middleware(new Request(url, { method: req.method, headers }));
    if (!result.headers.get('x-middleware-next')) {
      res.statusCode = result.status;
      result.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }

    const file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const full = path.join(outDir, file);
    if (!full.startsWith(outDir)) { res.statusCode = 400; res.end(); return; }
    try {
      const body = await readFile(full);
      res.setHeader('Content-Type', TYPES[path.extname(full)] || 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

// A minimal browser: keeps cookies, sends Origin on POST, never follows redirects automatically.
export class Client {
  constructor(base, ip = '203.0.113.10') {
    this.base = base;
    this.ip = ip;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  }

  async request(method, pathname, { json, headers = {}, page = false } = {}) {
    const h = { 'x-forwarded-for': this.ip, ...headers };
    if (this.cookies.size) h.cookie = this.cookieHeader();
    if (page) h.accept = 'text/html,application/xhtml+xml';
    if (method !== 'GET') h.origin ??= this.base;
    let body;
    if (json !== undefined) {
      h['content-type'] = 'application/json';
      body = JSON.stringify(json);
    }
    const response = await fetch(this.base + pathname, { method, headers: h, body, redirect: 'manual' });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const idx = pair.indexOf('=');
      const name = pair.slice(0, idx).trim();
      const value = decodeURIComponent(pair.slice(idx + 1).trim());
      const expired = attrs.some(a => a.trim().toLowerCase() === 'max-age=0');
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: response.status, location: response.headers.get('location'), headers: response.headers, text, data };
  }

  get(pathname, options) { return this.request('GET', pathname, options); }
  post(pathname, json, options = {}) { return this.request('POST', pathname, { ...options, json }); }

  // Follows redirects like a browser navigation would.
  async visit(pathname, maxHops = 5) {
    let current = pathname;
    for (let i = 0; i < maxHops; i++) {
      const r = await this.get(current, { page: true });
      if (r.status !== 302) return { ...r, finalPath: current };
      current = new URL(r.location, this.base).pathname + new URL(r.location, this.base).search;
    }
    throw new Error('Too many redirects');
  }
}
