import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SchemeRow {
  id: string;
  name: string;
  doc: string;
  version: number;
  position: number;
  created_at: string;
  updated_at: string;
}

const SEED = [
  'god-rock', 'starter-2x1', 'house-2x2', 'sealed-triangle-tc', 'triangle-tc-window', 'bunker-30-rockets',
  'roof-bunker', 'honeycomb-2x2', 'metal-fort', 'roof-defense',
];

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      doc TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

export function seed(db: DatabaseSync, examplesDir: URL): number {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM schemes').get() as { n: number };
  if (n > 0) return 0;
  const insert = db.prepare('INSERT INTO schemes (id, name, doc, version, position, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)');
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    SEED.forEach((id, i) => {
      const doc = JSON.parse(readFileSync(new URL(`${id}.json`, examplesDir), 'utf8'));
      delete doc.$schema;
      insert.run(id, doc.meta?.name ?? id, JSON.stringify(doc), i, now, now);
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return SEED.length;
}
