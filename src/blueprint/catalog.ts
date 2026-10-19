/**
 * Геометрический справочник (SPEC §4): формы, сокеты, матрица совместимости.
 */
import type { DeployableKind, ElementKind, Socket } from './types.ts';

export const GRID = 3;
export const SQ_APOTHEM = 1.5;
export const TRI_APOTHEM = GRID / (2 * Math.sqrt(3)); // 0.866
export const TRI_CIRCUM = GRID / Math.sqrt(3);        // 1.732
export const WALL_H = 3;
export const HALF_WALL_H = 1.5;
export const LOW_WALL_H = 1;
export const ROOF_RISE = 3;
export const FLOOR_T = 0.2;
export const SPIRAL_H = 1.5;
export const RAMP_DROP: Partial<Record<ElementKind, number>> = { 'ramp': 0.75, 'foundation-steps': 1.5 };

export type Shape = 'square' | 'triangle';
export type Category = 'cell' | 'wallType' | 'stairs' | 'roof' | 'ramp';

export interface KindInfo {
  category: Category;
  shape?: Shape;          // для cell и roof
  height?: number;        // для wallType
  isFoundation?: boolean;
  isFrame?: boolean;      // рамы пола: top не принимает объекты
  opening?: 'single' | 'frame' | 'window';
}

export const KINDS: Record<ElementKind, KindInfo> = {
  'square-foundation':    { category: 'cell', shape: 'square', isFoundation: true },
  'triangle-foundation':  { category: 'cell', shape: 'triangle', isFoundation: true },
  'square-floor':         { category: 'cell', shape: 'square' },
  'triangle-floor':       { category: 'cell', shape: 'triangle' },
  'floor-frame':          { category: 'cell', shape: 'square', isFrame: true },
  'triangle-floor-frame': { category: 'cell', shape: 'triangle', isFrame: true },
  'wall':                 { category: 'wallType', height: WALL_H },
  'half-wall':            { category: 'wallType', height: HALF_WALL_H },
  'low-wall':             { category: 'wallType', height: LOW_WALL_H },
  'doorway':              { category: 'wallType', height: WALL_H, opening: 'single' },
  'window-frame':         { category: 'wallType', height: WALL_H, opening: 'window' },
  'wall-frame':           { category: 'wallType', height: WALL_H, opening: 'frame' },
  'stairs-l-shape':       { category: 'stairs' },
  'u-shaped-stairs':      { category: 'stairs' },
  'spiral-stairs':        { category: 'stairs' },
  'roof':                 { category: 'roof', shape: 'square' },
  'roof-triangle':        { category: 'roof', shape: 'triangle' },
  // съезд и ступени: на ребро фундамента, занимают место соседней ячейки и спускаются на землю
  'ramp':                 { category: 'ramp', shape: 'square' },
  'foundation-steps':     { category: 'ramp', shape: 'square' },
};

export const SINGLE_DOORS: DeployableKind[] = ['wooden-door', 'sheet-metal-door', 'armored-door'];
export const FRAME_DOORS: DeployableKind[] = [
  'garage-door', 'wooden-double-door', 'sheet-metal-double-door', 'armored-double-door',
];
export const WINDOW_INSERTS: DeployableKind[] = [
  'strengthened-glass-window', 'reinforced-glass-window', 'metal-window-bars',
];

/** Что принимает opening данного типа проёма. */
export function openingAccepts(opening: 'single' | 'frame' | 'window'): DeployableKind[] {
  return opening === 'single' ? SINGLE_DOORS : opening === 'frame' ? FRAME_DOORS : WINDOW_INSERTS;
}

export function edgeCount(shape: Shape): number {
  return shape === 'square' ? 4 : 3;
}

export function apothem(shape: Shape): number {
  return shape === 'square' ? SQ_APOTHEM : TRI_APOTHEM;
}

/** Локальный угол внешней нормали ребра k (§4.3). */
export function edgeAngle(shape: Shape, k: number): number {
  return (360 / edgeCount(shape)) * k;
}

/** Вершины ячейки в локальных координатах плана [x, z] (§4.3). */
export function cellVertices(shape: Shape): [number, number][] {
  const n = edgeCount(shape);
  const r = shape === 'square' ? SQ_APOTHEM * Math.SQRT2 : TRI_CIRCUM;
  const start = shape === 'square' ? 45 : 60;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = ((start + (360 / n) * i) * Math.PI) / 180;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

export function edgeIndex(socket: Socket): number | null {
  const m = /^edge:(\d)$/.exec(socket);
  return m ? Number(m[1]) : null;
}

/** Сокеты, которые есть у типа элемента (§4.4). */
export function socketsOf(kind: ElementKind): Socket[] {
  const info = KINDS[kind];
  switch (info.category) {
    case 'cell': {
      const edges = Array.from({ length: edgeCount(info.shape!) }, (_, i) => `edge:${i}` as Socket);
      return [...edges, 'top'];
    }
    case 'wallType':
      return info.opening ? ['bottom', 'top', 'opening'] : ['bottom', 'top', 'face'];
    case 'stairs':
      return kind === 'spiral-stairs' ? ['bottom', 'top'] : ['bottom'];
    case 'roof':
      return Array.from({ length: edgeCount(info.shape!) }, (_, i) => `edge:${i}` as Socket);
    case 'ramp':
      return ['edge:0', 'edge:2', 'bottom'];
  }
}

/**
 * Матрица совместимости (§4.5): можно ли ребёнка `child` сокетом `selfSocket`
 * присоединить к сокету `socket` родителя `parent`.
 */
export function canAttach(
  parent: ElementKind, socket: Socket, child: ElementKind, selfSocket: Socket,
): boolean {
  const p = KINDS[parent];
  const c = KINDS[child];
  const pEdge = edgeIndex(socket) !== null;
  const cEdge = edgeIndex(selfSocket) !== null;

  if (p.category === 'cell' && pEdge) {
    if (c.category === 'cell' && cEdge) return !!p.isFoundation === !!c.isFoundation;
    if (c.category === 'wallType' && selfSocket === 'bottom') return true;
    if (c.category === 'roof' && selfSocket === 'edge:0') return true;
    if (c.category === 'ramp' && selfSocket === 'edge:0') return !!p.isFoundation;
    return false;
  }
  if (p.category === 'cell' && socket === 'top') {
    return (c.category === 'stairs' || c.category === 'ramp') && selfSocket === 'bottom' && p.shape === 'square' && !p.isFrame;
  }
  if (p.category === 'stairs' && socket === 'top') {
    return parent === 'spiral-stairs' && child === 'spiral-stairs' && selfSocket === 'bottom';
  }
  if (p.category === 'ramp' && socket === 'edge:2') {
    return c.category === 'ramp' && selfSocket === 'edge:0';
  }
  if (p.category === 'roof' && socket === 'edge:2') {
    if (p.shape !== 'square') return false;
    if (c.category === 'cell' && cEdge) return !c.isFoundation;
    if (c.category === 'wallType' && selfSocket === 'bottom') return true;
    if (c.category === 'roof' && selfSocket === 'edge:0') return true;
    return false;
  }
  if (p.category === 'wallType' && socket === 'top') {
    if (parent === 'low-wall') return false;
    // на верх стены — только полы и рамы: фундаменты стоят на земле (уровни полустены и стены из игры пока не моделируются)
    if (c.category === 'cell' && cEdge) return !c.isFoundation;
    if (c.category === 'wallType' && selfSocket === 'bottom') return true;
    if (c.category === 'roof' && selfSocket === 'edge:0') return true;
    return false;
  }
  if (p.category === 'roof' && (socket === 'edge:1' || socket === 'edge:3')) {
    return c.category === 'roof' && (selfSocket === 'edge:1' || selfSocket === 'edge:3') && p.shape === c.shape;
  }
  return false;
}

/** Единственный подходящий selfSocket, если он очевиден (§4.5). */
export function defaultSelfSocket(child: ElementKind): Socket | null {
  const c = KINDS[child];
  if (c.category === 'wallType' || c.category === 'stairs') return 'bottom';
  return null;
}

export function wallHeight(kind: ElementKind): number {
  return KINDS[kind].height ?? WALL_H;
}
