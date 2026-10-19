import { iconUrl } from './icons.ts';

export type LinkKind = 'wire' | 'pipe' | 'belt';

export const LINK_KINDS: readonly LinkKind[] = ['wire', 'pipe', 'belt'];

export const LINK_LABEL: Record<LinkKind, string> = {
  wire: 'электричество',
  pipe: 'вода',
  belt: 'предметы',
};

export interface SchemeNode {
  id: string;
  x: number;
  y: number;
  w: number;
  flip: boolean;
  icon: string;
  title: string;
  sub: string;
  ins: string[];
  outs: string[];
}

export interface SchemeLink {
  kind: LinkKind;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  label: string;
}

export interface SchemeNote {
  x: number;
  y: number;
  lines: string[];
}

export interface Scheme {
  width: number;
  height: number;
  nodes: SchemeNode[];
  links: SchemeLink[];
  notes: SchemeNote[];
}

const NODE_W = 160;
const HEAD_H = 26;
const SUB_H = 16;
const PORT_H = 22;
const PAD_B = 8;
const ICON = 40;
const ICON_PAD = 6;

const NODE_RE = /^node\s+([a-z0-9_-]+)\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+w=(\d+))?(\s+flip)?(?:\s+icon=([a-z0-9._-]+))?\s+"([^"]*)"(?:\s+"([^"]*)")?(.*)$/i;
const LINK_RE = /^(wire|pipe|belt)\s+([a-z0-9_-]+)\.(.+?)\s*->\s*([a-z0-9_-]+)\.(.+?)(?:\s+"([^"]*)")?$/i;
const NOTE_RE = /^note\s+(-?\d+)\s*,\s*(-?\d+)\s+"([^"]*)"$/i;
const SIZE_RE = /^size\s+(\d+)\s*x\s*(\d+)$/i;

function portList(rest: string, key: 'in' | 'out'): string[] {
  const m = rest.match(key === 'in' ? /(?:^|\s)in:\s*(.*?)(?=\s+out:|$)/ : /(?:^|\s)out:\s*(.*?)(?=\s+in:|$)/);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}

export function parseScheme(src: string): Scheme {
  const scheme: Scheme = { width: 0, height: 0, nodes: [], links: [], notes: [] };
  const byId = new Map<string, SchemeNode>();
  src.replace(/\r\n/g, '\n').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const where = `схема, строка ${i + 1}`;
    let m: RegExpMatchArray | null;
    if ((m = line.match(SIZE_RE))) {
      scheme.width = Number(m[1]);
      scheme.height = Number(m[2]);
    } else if ((m = line.match(NODE_RE))) {
      if (byId.has(m[1])) throw new Error(`${where}: узел «${m[1]}» уже есть`);
      const node: SchemeNode = {
        id: m[1],
        x: Number(m[2]),
        y: Number(m[3]),
        w: m[4] ? Number(m[4]) : NODE_W,
        flip: !!m[5],
        icon: m[6] ?? '',
        title: m[7],
        sub: m[8] ?? '',
        ins: portList(m[9], 'in'),
        outs: portList(m[9], 'out'),
      };
      for (const list of [node.ins, node.outs]) {
        if (new Set(list).size !== list.length) throw new Error(`${where}: у узла «${node.id}» повторяются порты`);
      }
      byId.set(node.id, node);
      scheme.nodes.push(node);
    } else if ((m = line.match(LINK_RE))) {
      const link: SchemeLink = {
        kind: m[1].toLowerCase() as LinkKind,
        from: m[2],
        fromPort: m[3].trim(),
        to: m[4],
        toPort: m[5].trim(),
        label: m[6] ?? '',
      };
      const from = byId.get(link.from);
      const to = byId.get(link.to);
      if (!from) throw new Error(`${where}: нет узла «${link.from}»`);
      if (!to) throw new Error(`${where}: нет узла «${link.to}»`);
      if (!from.outs.includes(link.fromPort)) throw new Error(`${where}: у «${from.id}» нет выхода «${link.fromPort}»`);
      if (!to.ins.includes(link.toPort)) throw new Error(`${where}: у «${to.id}» нет входа «${link.toPort}»`);
      scheme.links.push(link);
    } else if ((m = line.match(NOTE_RE))) {
      scheme.notes.push({ x: Number(m[1]), y: Number(m[2]), lines: m[3].split('\\n') });
    } else {
      throw new Error(`${where}: не понял «${line}»`);
    }
  });
  if (!scheme.nodes.length) throw new Error('схема: нет узлов');
  for (const n of scheme.nodes) n.w = Math.max(n.w, minNodeWidth(n));
  for (const [i, a] of scheme.nodes.entries()) {
    for (const b of scheme.nodes.slice(i + 1)) {
      const apart = a.x + a.w + 12 <= b.x || b.x + b.w + 12 <= a.x || a.y + nodeHeight(a) + 12 <= b.y || b.y + nodeHeight(b) + 12 <= a.y;
      if (!apart) throw new Error(`схема: узлы «${a.id}» и «${b.id}» налезают друг на друга`);
    }
  }
  return scheme;
}

function minNodeWidth(n: SchemeNode): number {
  let ports = 0;
  for (let i = 0; i < Math.max(n.ins.length, n.outs.length); i++) {
    ports = Math.max(ports, textWidth(n.ins[i] ?? '', 11) + textWidth(n.outs[i] ?? '', 11) + 40);
  }
  const head = n.icon ? ICON + ICON_PAD * 2 + 12 : 24;
  return Math.ceil(Math.max(textWidth(n.title, 13.5) + head, textWidth(n.sub, 11) + head - 4, ports));
}

function headHeight(n: SchemeNode): number {
  const text = HEAD_H + (n.sub ? SUB_H : 0);
  return n.icon ? Math.max(text, ICON + ICON_PAD * 2) : text;
}

export function nodeHeight(n: SchemeNode): number {
  return headHeight(n) + PORT_H * Math.max(n.ins.length, n.outs.length, 1) + PAD_B;
}

function portY(n: SchemeNode, index: number): number {
  return n.y + headHeight(n) + PORT_H * index + PORT_H / 2 + 2;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textWidth(s: string, size: number): number {
  return s.length * size * 0.58;
}

interface Point { x: number; y: number }

function bottom(n: SchemeNode): number {
  return n.y + nodeHeight(n);
}

function inPort(n: SchemeNode, port: string): Point {
  return { x: n.flip ? n.x + n.w : n.x, y: portY(n, n.ins.indexOf(port)) };
}

function outPort(n: SchemeNode, port: string): Point {
  return { x: n.flip ? n.x : n.x + n.w, y: portY(n, n.outs.indexOf(port)) };
}

function detourY(from: SchemeNode, to: SchemeNode, a: Point, b: Point, x1: number, x2: number, gap: number, all: SchemeNode[]): number {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  const crossed = all.filter(n => n === from || n === to || (n.x < hi && n.x + n.w > lo));
  const free = (y: number) => crossed.every(n => y < n.y - 6 || y > bottom(n) + 6);
  const shift = (gap - 16) * 0.8;
  const top = Math.min(...crossed.map(n => n.y)) - gap;
  const low = Math.max(...crossed.map(bottom)) + gap;
  const candidates = [
    to.y >= bottom(from) + 24 ? (bottom(from) + to.y) / 2 + shift : null,
    from.y >= bottom(to) + 24 ? (bottom(to) + from.y) / 2 + shift : null,
    ...crossed.flatMap(n => [n.y - 14 - shift, bottom(n) + 14 + shift]),
  ].filter((y): y is number => y !== null && free(y) && y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y));
  if (candidates.length) return candidates.reduce((best, y) => (Math.abs(y - b.y) < Math.abs(best - b.y) ? y : best));
  return Math.abs(top - a.y) + Math.abs(top - b.y) < Math.abs(low - a.y) + Math.abs(low - b.y) ? top : low;
}

function linkPath(from: SchemeNode, fromPort: string, to: SchemeNode, toPort: string, lane: () => number, all: SchemeNode[]): { d: string; mid: Point; pts: Point[] } {
  const a = outPort(from, fromPort);
  const b = inPort(to, toPort);
  const ka = from.flip ? -1 : 1;
  const kb = to.flip ? -1 : 1;
  if (ka !== kb) {
    const x = ka > 0 ? Math.max(a.x, b.x) + 50 : Math.min(a.x, b.x) - 50;
    const d = `M${a.x},${a.y} C${x},${a.y} ${x},${b.y} ${b.x},${b.y}`;
    const mid = { x: 0.75 * x + 0.125 * (a.x + b.x), y: (a.y + b.y) / 2 };
    return { d, mid, pts: [a, b, mid] };
  }
  const k = ka;
  if (k * (b.x - a.x) >= 16) {
    const dx = k * Math.max(24, Math.abs(b.x - a.x) / 2);
    const d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
    return { d, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pts: [a, b] };
  }
  const r = 8;
  const gap = 16 + lane() * 10;
  const out = a.x + k * gap;
  const back = b.x - k * gap;
  const y = detourY(from, to, a, b, out, back, gap, all);
  const s1 = y > a.y ? 1 : -1;
  const s2 = y > b.y ? 1 : -1;
  const d = [
    `M${a.x},${a.y}`,
    `H${out - k * r}`, `Q${out},${a.y} ${out},${a.y + s1 * r}`,
    `V${y - s1 * r}`, `Q${out},${y} ${out - k * r},${y}`,
    `H${back + k * r}`, `Q${back},${y} ${back},${y - s2 * r}`,
    `V${b.y + s2 * r}`, `Q${back},${b.y} ${back + k * r},${b.y}`,
    `H${b.x}`,
  ].join(' ');
  return { d, mid: { x: (out + back) / 2, y }, pts: [{ x: out, y }, { x: back, y }, a, b] };
}

export function renderScheme(s: Scheme): string {
  const byId = new Map(s.nodes.map(n => [n.id, n]));
  const portKind = new Map<string, LinkKind>();
  for (const l of s.links) {
    portKind.set(`${l.from}>${l.fromPort}`, l.kind);
    portKind.set(`${l.to}<${l.toPort}`, l.kind);
  }

  let minY = 0;
  let maxX = s.width;
  let maxY = s.height;
  const grow = (x: number, y: number) => {
    maxX = Math.max(maxX, x + 8);
    maxY = Math.max(maxY, y + 8);
    minY = Math.min(minY, y - 8);
  };
  for (const n of s.nodes) grow(n.x + n.w, n.y + nodeHeight(n));
  for (const n of s.notes) {
    n.lines.forEach((line, i) => grow(n.x + textWidth(line, 12), n.y + i * 15 + 4));
  }

  const links: string[] = [];
  const labels: string[] = [];
  let lane = 0;
  for (const l of s.links) {
    const from = byId.get(l.from)!;
    const to = byId.get(l.to)!;
    const { d, mid, pts } = linkPath(from, l.fromPort, to, l.toPort, () => lane++, s.nodes);
    for (const p of pts) grow(p.x, p.y);
    links.push(`<path class="sch-link sch-link--${l.kind}" d="${d}"/>`);
    if (l.label) {
      const w = textWidth(l.label, 11) + 10;
      grow(mid.x + w / 2, mid.y + 9);
      labels.push(
        `<g class="sch-label"><rect x="${mid.x - w / 2}" y="${mid.y - 9}" width="${w}" height="18" rx="4"/>` +
        `<text x="${mid.x}" y="${mid.y + 4}" text-anchor="middle">${esc(l.label)}</text></g>`,
      );
    }
  }

  const nodes = s.nodes.map(n => {
    const h = nodeHeight(n);
    const parts = [`<rect class="sch-node" x="${n.x}" y="${n.y}" width="${n.w}" height="${h}" rx="6"/>`];
    if (n.icon) {
      const ix = n.x + ICON_PAD;
      const iy = n.y + ICON_PAD;
      const tx = ix + ICON + 10;
      const ty = n.y + (headHeight(n) - (n.sub ? SUB_H : 0)) / 2 + 5;
      parts.push(
        `<rect class="sch-node__icon-bg" x="${ix}" y="${iy}" width="${ICON}" height="${ICON}" rx="5"/>`,
        `<image class="sch-node__icon" href="${esc(iconUrl(n.icon))}" x="${ix + 2}" y="${iy + 2}" width="${ICON - 4}" height="${ICON - 4}"/>`,
        `<text class="sch-node__title" x="${tx}" y="${ty}">${esc(n.title)}</text>`,
      );
      if (n.sub) parts.push(`<text class="sch-node__sub" x="${tx}" y="${ty + SUB_H}">${esc(n.sub)}</text>`);
    } else {
      parts.push(`<text class="sch-node__title" x="${n.x + n.w / 2}" y="${n.y + 17}" text-anchor="middle">${esc(n.title)}</text>`);
      if (n.sub) parts.push(`<text class="sch-node__sub" x="${n.x + n.w / 2}" y="${n.y + HEAD_H + 9}" text-anchor="middle">${esc(n.sub)}</text>`);
    }
    const port = (p: string, i: number, key: string, left: boolean) => {
      const y = portY(n, i);
      const kind = portKind.get(`${n.id}${key}${p}`);
      const x = left ? n.x : n.x + n.w;
      parts.push(
        `<circle class="sch-port${kind ? ` sch-port--${kind}` : ''}" cx="${x}" cy="${y}" r="4"/>`,
        `<text class="sch-port__label" x="${left ? x + 9 : x - 9}" y="${y + 4}"${left ? '' : ' text-anchor="end"'}>${esc(p)}</text>`,
      );
    };
    n.ins.forEach((p, i) => port(p, i, '<', !n.flip));
    n.outs.forEach((p, i) => port(p, i, '>', n.flip));
    return `<g>${parts.join('')}</g>`;
  });

  const notes = s.notes.map(n =>
    `<text class="sch-note" x="${n.x}" y="${n.y}">` +
    n.lines.map((line, i) => `<tspan x="${n.x}" dy="${i ? 15 : 0}">${esc(line)}</tspan>`).join('') +
    `</text>`,
  );

  maxX = Math.ceil(maxX);
  maxY = Math.ceil(maxY);
  minY = Math.floor(minY);
  const used = LINK_KINDS.filter(k => s.links.some(l => l.kind === k));
  const legend = used.map((k, i) => {
    const x = 8 + i * 130;
    const y = maxY + 14;
    return `<path class="sch-link sch-link--${k} sch-legend__line" d="M${x},${y} H${x + 26}"/>` +
      `<text class="sch-legend" x="${x + 32}" y="${y + 4}">${LINK_LABEL[k]}</text>`;
  });

  return (
    `<svg class="sch" viewBox="0 ${minY} ${maxX} ${maxY + 26 - minY}" width="${maxX}" role="img" xmlns="http://www.w3.org/2000/svg">` +
    `${links.join('')}${nodes.join('')}${labels.join('')}${notes.join('')}${legend.join('')}` +
    `</svg>`
  );
}

export function schemeToHtml(src: string): string {
  try {
    return `<figure class="sch-figure">${renderScheme(parseScheme(src))}</figure>`;
  } catch (e) {
    return `<pre class="sch-error">${esc((e as Error).message)}</pre>`;
  }
}
