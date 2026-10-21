import type { Blueprint } from './types.ts';

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

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { error: 'Сервер схем недоступен' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const listSchemes = () => call<SchemeSummary[]>('GET', '/api/schemes');
export const getScheme = (id: string) => call<Scheme>('GET', `/api/schemes/${encodeURIComponent(id)}`);
export const createScheme = (name: string, doc: Blueprint) => call<Scheme>('POST', '/api/schemes', { name, doc });
export const saveScheme = (id: string, name: string, doc: Blueprint, version: number) => call<Scheme>('PUT', `/api/schemes/${encodeURIComponent(id)}`, { name, doc, version });

export function emptyScheme(name: string, rock: boolean): Blueprint {
  return {
    formatVersion: '2.0',
    meta: { name, gameVersion: '2026-10', tags: rock ? ['custom', 'god-rock'] : ['custom'] },
    defaults: { grade: 'twig' },
    elements: [],
    deployables: [],
    ...(rock ? { terrain: [{ id: 'rock', kind: 'god-rock' as const, position: [0, 0, 0] as [number, number, number], rotation: 0, scale: 1 }] } : {}),
  };
}
