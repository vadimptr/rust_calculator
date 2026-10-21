export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  mark?: string;
  at?: number;
}

const LIMIT = 200;
const MERGE_MS = 800;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function record<T>(h: History<T>, next: T, mark?: string, now = Date.now()): History<T> {
  if (next === h.present) return h;
  if (mark && h.mark === mark && h.at !== undefined && now - h.at < MERGE_MS) return { ...h, present: next, future: [], at: now };
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [], mark, at: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
