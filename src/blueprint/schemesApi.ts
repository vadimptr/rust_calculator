import type { Blueprint } from './types.ts';
import { BOAT_TAG } from './boat.ts';

export interface SchemeSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  elements: number;
  terrain: boolean;
}

export interface Scheme extends SchemeSummary {
  doc: Blueprint;
}

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : `Ошибка сервера ${status}`);
    this.status = status;
    this.body = body;
  }
}

const TOKEN_KEY = 'bp.writeToken';

function storedToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

async function send(method: string, path: string, body: unknown, token: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token && method !== 'GET') headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { error: 'Сервер схем недоступен' });
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let token = storedToken();
  let res = await send(method, path, body, token);
  while (res.status === 401 && method !== 'GET') {
    const entered = window.prompt(token ? 'Токен не подошёл. Введи токен записи ещё раз' : 'Сохранять схемы можно только с токеном записи. Введи его', '')?.trim();
    if (!entered) break;
    token = entered;
    res = await send(method, path, body, token);
    if (res.status !== 401) storeToken(token);
  }
  if (res.status === 401) storeToken('');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const listSchemes = () => call<SchemeSummary[]>('GET', '/api/schemes');
export const getScheme = (id: string) => call<Scheme>('GET', `/api/schemes/${encodeURIComponent(id)}`);
export const createScheme = (name: string, doc: Blueprint) => call<Scheme>('POST', '/api/schemes', { name, doc });
export const saveScheme = (id: string, name: string, doc: Blueprint, version: number) => call<Scheme>('PUT', `/api/schemes/${encodeURIComponent(id)}`, { name, doc, version });

export type SceneKind = 'empty' | 'rock' | 'boat';

export function emptyScheme(name: string, scene: SceneKind): Blueprint {
  const rock = scene === 'rock';
  return {
    formatVersion: '2.0',
    meta: { name, gameVersion: '2026-10', tags: rock ? ['custom', 'god-rock'] : scene === 'boat' ? ['custom', BOAT_TAG] : ['custom'] },
    defaults: { grade: scene === 'boat' ? 'wood' : 'twig' },
    elements: [],
    deployables: [],
    ...(rock ? { terrain: [{ id: 'rock', kind: 'god-rock' as const, position: [0, 0, 0] as [number, number, number], rotation: 0, scale: 1 }] } : {}),
  };
}
