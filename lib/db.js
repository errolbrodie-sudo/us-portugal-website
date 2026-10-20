/* ==========================================
   ReloPlan - Database access (server-side only)
   All queries are parameterized; never concatenate user input into SQL.
   ========================================== */

import pg from 'pg';

export class ConfigError extends Error {
  constructor(name) {
    super(`Missing required server configuration: ${name}`);
    this.name = 'ConfigError';
  }
}

let pool = null;
let override = null;

// Tests inject an in-process Postgres (PGlite) with the same { query, transaction } shape.
export function setDbForTesting(db) {
  override = db;
}

function sslOptions() {
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  // Encrypted, but the server certificate is not verified without the Supabase CA.
  return { rejectUnauthorized: false };
}

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new ConfigError('DATABASE_URL');

  // TLS is configured explicitly below; an sslmode in the URL would override it.
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');

  pool = new pg.Pool({
    connectionString: parsed.toString(),
    ssl: sslOptions(),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000
  });
  // An idle client error must not crash the function; the next query reconnects.
  pool.on('error', err => console.error('[db] idle client error:', err.code || err.message));
  return pool;
}

export async function query(text, params = []) {
  if (override) return override.query(text, params);
  return getPool().query(text, params);
}

export async function transaction(fn) {
  if (override) return override.transaction(fn);
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn({ query: (text, params = []) => client.query(text, params) });
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
