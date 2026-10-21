import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { loadBlueprint } from '../src/blueprint/validate.ts';
import type { SchemeRow } from './db.ts';

const MAX_BODY = 2 * 1024 * 1024;
const MAX_SCHEMES = 5000;
const WRITES_PER_MINUTE = 30;
const NAME_MAX = 120;

class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Схема слишком большая');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Тело запроса — не JSON');
  }
}

function summary(row: SchemeRow) {
  const doc = JSON.parse(row.doc);
  return {
    id: row.id, name: row.name, version: row.version, updatedAt: row.updated_at,
    elements: Array.isArray(doc.elements) ? doc.elements.length : 0, terrain: Array.isArray(doc.terrain) && doc.terrain.length > 0,
  };
}

function full(row: SchemeRow) {
  return { ...summary(row), doc: JSON.parse(row.doc) };
}

function validName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'Нужно название схемы');
  const n = name.trim();
  if (n.length > NAME_MAX) throw new HttpError(400, `Название длиннее ${NAME_MAX} символов`);
  return n;
}

function validDoc(doc: unknown, name: string): string {
  const r = loadBlueprint(doc);
  const errors = r.issues.filter(i => i.level === 'error');
  if (!r.blueprint || errors.length) throw new HttpError(422, 'Схема не проходит проверку', { issues: errors.slice(0, 20) });
  const { $schema: _s, resolved: _r, ...clean } = r.blueprint;
  return JSON.stringify({ ...clean, meta: { ...clean.meta, name } });
}

function newId(): string {
  return 's' + Date.now().toString(36) + randomBytes(3).toString('hex');
}

export function createApp(db: DatabaseSync) {
  const writes = new Map<string, number[]>();
  const limitWrites = (req: IncomingMessage) => {
    const ip = (req.headers['x-real-ip'] as string | undefined) ?? req.socket.remoteAddress ?? '?';
    const now = Date.now();
    const recent = (writes.get(ip) ?? []).filter(t => now - t < 60_000);
    if (recent.length >= WRITES_PER_MINUTE) throw new HttpError(429, 'Слишком много сохранений, подожди минуту');
    recent.push(now);
    writes.set(ip, recent);
  };
  const get = db.prepare('SELECT * FROM schemes WHERE id = ?');

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
    if (path === '/api/schemes' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM schemes ORDER BY position, created_at').all() as unknown as SchemeRow[];
      return send(res, 200, rows.map(summary));
    }
    if (path === '/api/schemes' && req.method === 'POST') {
      limitWrites(req);
      const body = (await readJson(req)) as { name?: unknown; doc?: unknown };
      const name = validName(body?.name);
      const doc = validDoc(body?.doc, name);
      const { n, last } = db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS last FROM schemes').get() as { n: number; last: number };
      if (n >= MAX_SCHEMES) throw new HttpError(507, 'В базе уже слишком много схем');
      const id = newId();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO schemes (id, name, doc, version, position, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)').run(id, name, doc, last + 1, now, now);
      return send(res, 201, full(get.get(id) as unknown as SchemeRow));
    }
    const m = path.match(/^\/api\/schemes\/([a-z][a-z0-9_-]{0,63})$/);
    if (m && req.method === 'GET') {
      const row = get.get(m[1]) as unknown as SchemeRow | undefined;
      if (!row) throw new HttpError(404, 'Схема не найдена');
      return send(res, 200, full(row));
    }
    if (m && req.method === 'PUT') {
      limitWrites(req);
      const body = (await readJson(req)) as { name?: unknown; doc?: unknown; version?: unknown };
      const row = get.get(m[1]) as unknown as SchemeRow | undefined;
      if (!row) throw new HttpError(404, 'Схема не найдена');
      if (body?.version !== row.version) throw new HttpError(409, 'Схему уже сохранили в другом окне', { version: row.version });
      const name = validName(body?.name ?? row.name);
      const doc = validDoc(body?.doc, name);
      const now = new Date().toISOString();
      const r = db.prepare('UPDATE schemes SET name = ?, doc = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').run(name, doc, now, row.id, row.version);
      if (r.changes !== 1) throw new HttpError(409, 'Схему уже сохранили в другом окне');
      return send(res, 200, full(get.get(row.id) as unknown as SchemeRow));
    }
    if (path.startsWith('/api/')) throw new HttpError(m || path === '/api/schemes' ? 405 : 404, 'Нет такого метода');
    throw new HttpError(404, 'Не найдено');
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await route(req, res);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...e.extra });
      console.error(e);
      send(res, 500, { error: 'Внутренняя ошибка сервера' });
    }
  };
}
