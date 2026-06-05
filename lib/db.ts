import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Read-only data-access layer over the local SQLite database produced by the
 * Python pipeline. Uses Node's built-in `node:sqlite` (no native module).
 *
 * Postgres/Supabase swap: every query here is plain SQL with `?` placeholders.
 * To move to Postgres, reimplement `query`/`queryOne` against `pg` and convert
 * `?` to `$n` — nothing else in the app depends on the driver. See
 * docs/deployment.md.
 */

let _db: DatabaseSync | null = null;

export class DbUnavailableError extends Error {}

function dbPath(): string {
  const p = process.env.ALTIS_DB_PATH || './data/altis.db';
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const file = dbPath();
  if (!fs.existsSync(file)) {
    throw new DbUnavailableError(
      `Database not found at ${file}. Run the pipeline first:  npm run pipeline`,
    );
  }
  _db = new DatabaseSync(file, { readOnly: true });
  return _db;
}

export function query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

/** True if the DB exists and the core tables are populated. */
export function dbReady(): { ready: boolean; reason?: string } {
  try {
    const row = queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
    if (!row || row.n === 0) return { ready: false, reason: 'No transactions ingested.' };
    return { ready: true };
  } catch (e) {
    return { ready: false, reason: (e as Error).message };
  }
}
