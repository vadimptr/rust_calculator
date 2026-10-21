/**
 * Режим стройки: чистые операции над документом чертежа. Призрак ставится в сокет наведённого
 * элемента, как в игре: для выбранного типа перебираются все совместимые сокеты хозяина, каждый
 * вариант прогоняется через движок геометрии (значит, учитываются занятость слотов и правила
 * совместимости), а из удавшихся берётся ближайший к точке наведения.
 */
import { FOUNDATION_TOP, KINDS, RAMP_HIGH_RISE, ROOF_RISE, apothem, canAttach, cellVertices, defaultSelfSocket, edgeAngle, edgeCount, socketsOf, wallHeight } from './catalog.ts';
import { overlaps, resolveBlueprint, socketPose } from './geometry.ts';
import { unstable } from './stability.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, Element, ElementKind, Grade, Resolved, ResolvedElement, Socket, Transform } from './types.ts';

const round3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const norm360 = (a: number) => ((a % 360) + 360) % 360;

export const GRADES: Grade[] = ['twig', 'wood', 'stone', 'metal', 'armored'];

/** Строительный план Rust: все конструкции в порядке игрового меню (Construction.info.order). */
export const BUILD_PLAN: { group: string; kinds: ElementKind[] }[] = [
  { group: 'Фундаменты', kinds: ['square-foundation', 'triangle-foundation', 'foundation-steps', 'ramp'] },
  { group: 'Полы', kinds: ['square-floor', 'triangle-floor', 'floor-frame', 'triangle-floor-frame'] },
  { group: 'Стены', kinds: ['wall', 'doorway', 'window-frame', 'wall-frame', 'half-wall', 'low-wall'] },
  { group: 'Лестницы', kinds: ['stairs-l-shape', 'u-shaped-stairs', 'spiral-stairs'] },
  { group: 'Крыши', kinds: ['roof', 'roof-triangle'] },
];

/** Объекты, которые ставятся в режиме стройки. */
export const DEPLOY_PLAN: { group: string; kinds: DeployableKind[] }[] = [
  { group: 'Двери', kinds: ['wooden-door', 'sheet-metal-door', 'armored-door'] },
  { group: 'Двойные и гаражные', kinds: ['wooden-double-door', 'sheet-metal-double-door', 'armored-double-door', 'garage-door'] },
  { group: 'В окно', kinds: ['strengthened-glass-window', 'reinforced-glass-window', 'metal-window-bars', 'metal-embrasure'] },
  { group: 'Прочее', kinds: ['tool-cupboard', 'drop-box'] },
];

const ID_PREFIX: Record<ElementKind, string> = {
  'square-foundation': 'f', 'triangle-foundation': 'tf', 'foundation-steps': 'fs', 'ramp': 'rp',
  'wall': 'w', 'half-wall': 'hw', 'low-wall': 'lw', 'doorway': 'dw', 'window-frame': 'wf', 'wall-frame': 'fr',
  'square-floor': 'c', 'triangle-floor': 'tc', 'floor-frame': 'ff', 'triangle-floor-frame': 'tff',
  'stairs-l-shape': 'st', 'u-shaped-stairs': 'us', 'spiral-stairs': 'ss', 'roof': 'r', 'roof-triangle': 'tr',
};

const DEPLOY_PREFIX: Partial<Record<DeployableKind, string>> = { 'tool-cupboard': 'cup', 'drop-box': 'box' };

/** Свободный id с префиксом по типу. */
export function freshId(bp: Blueprint, kind: ElementKind | DeployableKind): string {
  const prefix = (ID_PREFIX as Record<string, string>)[kind] ?? DEPLOY_PREFIX[kind as DeployableKind] ?? (kind.includes('window') ? 'win' : 'd');
  const used = new Set([...(bp.elements ?? []).map(e => e.id), ...(bp.deployables ?? []).map(d => d.id)]);
  for (let n = 1; ; n++) {
    const id = `${prefix}${n}`;
    if (!used.has(id)) return id;
  }
}

/** Пустая постройка: один квадратный фундамент из веток, как первый блок в игре. */
export function newBlueprint(name = 'Новая постройка', foundation: ElementKind = 'square-foundation', position: [number, number, number] = [0, 0, 0], rotation = 0): Blueprint {
  return {
    formatVersion: '2.0',
    meta: { name, gameVersion: '2026-09', tags: ['custom'] },
    defaults: { grade: 'twig' },
    elements: [{ id: 'f1', kind: foundation, position: position.map(round3) as [number, number, number], rotation: round3(norm360(rotation)) }],
    deployables: [],
  };
}

export interface Placement {
  attach: Attach;
  transform: Transform;
}

const GHOST = '__ghost__';

/** Середины рёбер ячейки или крыши в мире. */
export function edgeMids(kind: ElementKind, t: Transform): [number, number, number][] {
  const shape = KINDS[kind].shape ?? 'square';
  return Array.from({ length: edgeCount(shape) }, (_, k) => {
    const a = ((t.rotation + edgeAngle(shape, k)) * Math.PI) / 180;
    return [t.position[0] + apothem(shape) * Math.cos(a), t.position[1], t.position[2] + apothem(shape) * Math.sin(a)];
  });
}

/**
 * Опора крыши: под её низким ребром должен быть верх стены-типа или ребро ячейки того же уровня.
 * Иначе крыша, прицепленная боком к соседней крыше за углом здания, висела бы в воздухе.
 */
function roofSupported(kind: ElementKind, t: Transform, resolved: Resolved): boolean {
  const low = edgeMids(kind, t)[0];
  const near = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  return resolved.elements.some(e => {
    const info = KINDS[e.kind];
    if (info.category === 'wallType') return near([e.position[0], e.position[1] + wallHeight(e.kind), e.position[2]], low);
    if (info.category === 'cell') return edgeMids(e.kind, e).some(m => near(m, low));
    if (info.category === 'roof' && info.shape === 'square' && !e.inverted) {
      const high = edgeMids(e.kind, e)[2];
      return near([high[0], high[1] + ROOF_RISE, high[2]], low);
    }
    return false;
  });
}

/** Все возможные размещения элемента типа kind на сокетах хозяина hostId. */
export function candidatePlacements(_bp: Blueprint, resolved: Resolved, kind: ElementKind, hostId: string, dedupe = true): Placement[] {
  const host = resolved.elements.find(e => e.id === hostId);
  if (!host) return [];
  const out: Placement[] = [];
  const seen = new Set<string>();
  const selfSockets = KINDS[kind].category === 'wallType' || KINDS[kind].category === 'stairs' ? ['bottom' as Socket] : socketsOf(kind);
  for (const socket of socketsOf(host.kind)) {
    if (socket === 'opening' || socket === 'face') continue;
    for (const self of selfSockets) {
      if (!canAttach(host.kind, socket, kind, self)) continue;
      // две стороны: пол или крыша на верху стены — по обе стороны; крыша на ребре ячейки — наружу и внутрь
      const twoSided = (((KINDS[host.kind].category === 'wallType' && socket === 'top') || (KINDS[host.kind].category === 'roof' && socket === 'edge:2')) && KINDS[kind].category !== 'wallType')
        || (KINDS[host.kind].category === 'cell' && socket.startsWith('edge:') && KINDS[kind].category === 'roof');
      const flips = twoSided || KINDS[kind].category === 'wallType' ? [false, true] : [false];
      const spiralOnSpiral = kind === 'spiral-stairs' && host.kind === 'spiral-stairs';
      const turnsList = spiralOnSpiral ? [2, 0, 1, 3] : KINDS[kind].category === 'stairs' || (KINDS[kind].category === 'ramp' && socket === 'top') ? [0, 1, 2, 3] : [0];
      const rises = KINDS[host.kind].isFoundation && KINDS[kind].isFoundation
        ? [-3, -1.5, 0, 1.5, 3] : kind === 'ramp' && socket === 'top' ? [0, RAMP_HIGH_RISE] : [0];
      for (const flip of flips) for (const turns of turnsList) for (const rise of rises) {
        const attach: Attach = { to: hostId, socket };
        if (defaultSelfSocket(kind) !== self) attach.selfSocket = self;
        if (flip) attach.flip = true;
        if (turns) attach.turns = turns as 0 | 1 | 2 | 3;
        if (rise) attach.rise = rise as Attach['rise'];
        const pose = socketPose(host, kind, attach);
        if (KINDS[kind].isFoundation && (pose.position[1] < FOUNDATION_TOP.min - 1e-6 || pose.position[1] > FOUNDATION_TOP.max + 1e-6)) continue;
        const t: Transform = { ...pose, position: pose.position.map(round3) as [number, number, number], rotation: round3(pose.rotation) };
        // ячейка, приставленная разными своими рёбрами, занимает одно и то же место: поворот берётся
        // по модулю симметрии формы, первым остаётся вариант с edge:0
        const sym = dedupe && KINDS[kind].category === 'cell' ? 360 / (KINDS[kind].shape === 'square' ? 4 : 3) : 360;
        const key = `${t.position.map(v => v.toFixed(2)).join('|')}|${(((t.rotation % sym) + sym) % sym).toFixed(0)}|${turns}|${rise}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (overlaps(kind, t, resolved)) continue;
        if (KINDS[kind].category === 'roof' && !t.inverted && !roofSupported(kind, t, resolved)) continue;
        out.push({ attach, transform: { position: t.position, rotation: t.rotation, level: t.level, ...(t.inverted ? { inverted: true } : {}) } });
      }
    }
  }
  return out;
}

/** Размещения, отсортированные по близости к точке наведения. */
export function placementsNear(bp: Blueprint, resolved: Resolved, kind: ElementKind, hostId: string, point: [number, number, number]): Placement[] {
  const dist = (p: Placement) => {
    const [x, y, z] = p.transform.position;
    const h = KINDS[kind].category === 'wallType' ? wallHeight(kind) / 2 : 0;
    return Math.hypot(x - point[0], y + h - point[1], z - point[2]);
  };
  return candidatePlacements(bp, resolved, kind, hostId).sort((a, b) => dist(a) - dist(b));
}

/**
 * Якорь размещения — точка сокета, за который блок держится: середина своего ребра у ячеек, крыш и
 * съездов (ребро соседа или верх стены), позиция у стен и лестниц. Варианты с одним якорем — это
 * один и тот же «куда поставить» с разной ориентацией: крыша над зданием или наружу, пол по ту или
 * другую сторону стены, поворот лестницы.
 */
/** Точка якоря в мире: середина ребра опоры у ячеек и крыш, середина стены по высоте у стен. */
export function anchorPoint(kind: ElementKind, p: Placement): [number, number, number] {
  const cat = KINDS[kind].category;
  if (cat === 'cell' || cat === 'roof' || cat === 'ramp') {
    const k = p.attach.selfSocket ? Number(p.attach.selfSocket.slice(5)) : 0;
    return edgeMids(kind, p.transform)[k] ?? p.transform.position;
  }
  const [x, y, z] = p.transform.position;
  return [x, y + (cat === 'wallType' ? wallHeight(kind) / 2 : 0), z];
}

/**
 * Близость варианта к точке прицела: сначала ребро опоры (куда целится игрок), затем сама
 * позиция блока — она различает стороны одного ребра (крыша внутрь или наружу, пол по ту или
 * другую сторону стены). По одной позиции нельзя: у крыш внутрь на всех рёбрах ячейки центр общий.
 */
export function aimDistance(kind: ElementKind, p: Placement, aim: [number, number, number]): number {
  const a = anchorPoint(kind, p);
  const [x, y, z] = p.transform.position;
  const h = KINDS[kind].category === 'wallType' ? wallHeight(kind) / 2 : 0;
  return Math.hypot(a[0] - aim[0], a[1] - aim[1], a[2] - aim[2]) + 0.25 * Math.hypot(x - aim[0], y + h - aim[1], z - aim[2]);
}

export function placementAnchor(kind: ElementKind, p: Placement): string {
  const cat = KINDS[kind].category;
  const r = (v: number) => (Math.round(v * 100) / 100 + 0).toFixed(2);
  if (cat === 'cell' || cat === 'roof' || cat === 'ramp') {
    const k = p.attach.selfSocket ? Number(p.attach.selfSocket.slice(5)) : 0;
    const m = edgeMids(kind, p.transform)[k] ?? p.transform.position;
    // у фундамента высота — вариант того же места: R перебирает 0 / 1.5 / 3 м
    if (KINDS[kind].isFoundation) return `${r(m[0])}|${r(m[2])}`;
    if (cat === 'ramp' && p.attach.socket === 'top') return `${p.attach.to}|${Math.round(p.transform.rotation)}`;
    return `${r(m[0])}|${r(m[1])}|${r(m[2])}`;
  }
  return p.transform.position.map(r).join('|');
}

export function addElement(bp: Blueprint, kind: ElementKind, attach: Attach, grade?: Grade): Blueprint {
  const host = resolveBlueprint(bp).resolved.elements.find(e => e.id === attach.to);
  if (!host) return bp;
  const t = socketPose(host, kind, attach);
  const el: Element = { id: freshId(bp, kind), kind, position: t.position.map(round3) as [number, number, number], rotation: round3(t.rotation) };
  if (t.inverted) el.inverted = true;
  if (grade && grade !== bp.defaults?.grade) el.grade = grade;
  return { ...bp, elements: [...bp.elements, el] };
}

export function freePlacement(resolved: Resolved, kind: ElementKind, position: [number, number, number], rotation: number): Transform | null {
  const t: Transform = { position: position.map(round3) as [number, number, number], rotation: round3(norm360(rotation)), level: round3(position[1] / 3) };
  return overlaps(kind, t, resolved) ? null : t;
}

export function addElementAt(bp: Blueprint, kind: ElementKind, t: Transform, grade?: Grade): Blueprint {
  const el: Element = { id: freshId(bp, kind), kind, position: t.position, rotation: t.rotation };
  if (grade && grade !== bp.defaults?.grade) el.grade = grade;
  return { ...bp, elements: [...bp.elements, el] };
}

export function upgradeElement(bp: Blueprint, id: string, grade: Grade): Blueprint {
  return { ...bp, elements: bp.elements.map(e => (e.id === id ? { ...e, grade } : e)) };
}

export function rotatable(kind: ElementKind): boolean {
  const cat = KINDS[kind].category;
  return cat === 'wallType' || cat === 'stairs' || cat === 'ramp';
}

export function rotateElement(bp: Blueprint, id: string): Blueprint {
  const el = bp.elements.find(e => e.id === id);
  if (!el || !rotatable(el.kind)) return bp;
  const resolved = resolveBlueprint(bp).resolved;
  const cat = KINDS[el.kind].category;
  if (cat === 'ramp' && !resolved.elements.some(c => KINDS[c.kind].category === 'cell' && Math.hypot(c.position[0] - el.position[0], c.position[2] - el.position[2]) < 0.01 && el.position[1] > c.position[1])) return bp;
  const turned: Element = { ...el, rotation: round3(norm360(el.rotation + (cat === 'wallType' ? 180 : 90))) };
  if (cat !== 'wallType' && overlaps(el.kind, { ...turned, level: 0 }, resolved, id)) return bp;
  return { ...bp, elements: bp.elements.map(e => (e.id === id ? turned : e)) };
}

/** Элемент, в который рейкастом попал курсор, и доступные ему размещения с учётом текущего чертежа. */
export function transformOf(resolved: Resolved, id: string): ResolvedElement | undefined {
  return resolved.elements.find(e => e.id === id);
}

export function removeElement(bp: Blueprint, id: string): Blueprint {
  if (!bp.elements.some(e => e.id === id)) return bp;
  return { ...bp, elements: bp.elements.filter(e => e.id !== id), deployables: (bp.deployables ?? []).filter(d => d.attach.to !== id) };
}

export interface DeployPlacement {
  deployable: Omit<Deployable, 'id'>;
  transform: Transform;
}

/**
 * Размещение объекта на наведённом элементе: дверь или вставка — в свободный проём, шкаф — на верх
 * ячейки в точку наведения, дроп-бокс — на грань стены в точку наведения. local — точка наведения в
 * локальных осях хозяина (x по нормали, y вверх, z вдоль).
 */
export function deployPlacement(bp: Blueprint, resolved: Resolved, kind: DeployableKind, hostId: string, local: [number, number, number], rotation = 0): DeployPlacement | null {
  const host = bp.elements.find(e => e.id === hostId);
  const ht = resolved.elements.find(e => e.id === hostId);
  if (!host || !ht) return null;
  const info = KINDS[host.kind];
  const taken = (bp.deployables ?? []).filter(d => d.attach.to === hostId);
  let deployable: Omit<Deployable, 'id'>;
  if (kind === 'tool-cupboard') {
    if (info.category !== 'cell' || info.isFrame) return null;
    if (taken.some(d => d.kind === 'tool-cupboard')) return null;
    if (resolved.elements.some(e => KINDS[e.kind].category === 'stairs' && Math.hypot(e.position[0] - ht.position[0], e.position[2] - ht.position[2]) < 0.01 && Math.abs(e.position[1] - ht.position[1]) < 0.01)) return null;
    const spot = cupboardSpot(info.shape ?? 'square', local[0], local[2], rotation);
    if (!spot) return null;
    deployable = { kind, attach: { to: hostId, socket: 'top' }, offset: spot, rotation };
  } else if (kind === 'drop-box') {
    if (info.category !== 'wallType' || info.opening || host.kind === 'low-wall') return null;
    const h = wallHeight(host.kind);
    deployable = { kind, attach: { to: hostId, socket: 'face' }, offset: [Math.round(Math.max(-1.1, Math.min(1.1, local[2])) * 10) / 10, Math.round(Math.max(0.4, Math.min(h - 0.4, local[1])) * 10) / 10], direction: local[0] >= 0 ? 'in' : 'out' };
  } else {
    if (!info.opening) return null;
    if (taken.length > 0) return null;
    const accepts = info.opening === 'single' ? ['wooden-door', 'sheet-metal-door', 'armored-door']
      : info.opening === 'frame' ? ['garage-door', 'wooden-double-door', 'sheet-metal-double-door', 'armored-double-door']
        : ['strengthened-glass-window', 'reinforced-glass-window', 'metal-window-bars', 'metal-embrasure'];
    if (!accepts.includes(kind)) return null;
    deployable = { kind, attach: { to: hostId, socket: 'opening' } };
    if (info.opening !== 'window') {
      // петли с той стороны, куда ближе курсор (глядя снаружи по нормали: left = +z)
      deployable.hinge = local[2] >= 0 ? 'left' : 'right';
      deployable.opens = 'outward';
    }
  }
  const probe: Blueprint = { ...bp, deployables: [...(bp.deployables ?? []), { id: GHOST, ...deployable } as Deployable] };
  const r = resolveBlueprint(probe);
  if (r.issues.some(i => i.level === 'error')) return null;
  const t = r.resolved.deployables.find(d => d.id === GHOST);
  if (!t) return null;
  return { deployable, transform: { position: t.position, rotation: t.rotation, level: t.level } };
}

const CUPBOARD_HALF: [number, number] = [0.3, 0.55];
const CUPBOARD_MARGIN = 0.13;

function cupboardSpot(shape: 'square' | 'triangle', x: number, z: number, rotation: number): [number, number] | null {
  const verts = cellVertices(shape);
  const a = (rotation * Math.PI) / 180;
  const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => {
    const cx = sx * CUPBOARD_HALF[0], cz = sz * CUPBOARD_HALF[1];
    return [cx * Math.cos(a) - cz * Math.sin(a), cx * Math.sin(a) + cz * Math.cos(a)];
  });
  const edges = verts.map(([x1, z1], i) => {
    const [x2, z2] = verts[(i + 1) % verts.length];
    const len = Math.hypot(x2 - x1, z2 - z1);
    return { x1, z1, nx: -(z2 - z1) / len, nz: (x2 - x1) / len };
  });
  const slack = (px: number, pz: number) => Math.min(...edges.flatMap(e => corners.map(([cx, cz]) => (px + cx - e.x1) * e.nx + (pz + cz - e.z1) * e.nz - CUPBOARD_MARGIN)));
  if (slack(0, 0) < 0) return null;
  let px = x, pz = z;
  for (let iter = 0; iter < 8; iter++) {
    for (const e of edges) {
      const d = Math.min(...corners.map(([cx, cz]) => (px + cx - e.x1) * e.nx + (pz + cz - e.z1) * e.nz)) - CUPBOARD_MARGIN;
      if (d < 0) { px -= d * e.nx; pz -= d * e.nz; }
    }
  }
  if (slack(px, pz) < -1e-6) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (slack(px * m, pz * m) >= 0) lo = m; else hi = m; }
    px *= lo; pz *= lo;
  }
  const round = (v: number) => Math.trunc(v * 100) / 100;
  return [round(px), round(pz)];
}

export function addDeployable(bp: Blueprint, d: Omit<Deployable, 'id'>): Blueprint {
  const dep = { id: freshId(bp, d.kind), ...d } as Deployable;
  return { ...bp, deployables: [...(bp.deployables ?? []), dep] };
}

export function removeDeployable(bp: Blueprint, id: string): Blueprint {
  return { ...bp, deployables: (bp.deployables ?? []).filter(d => d.id !== id) };
}

/**
 * Обрушение, как в игре: блоки со стабильностью ниже 5% разрушаются, затем пересчёт — до
 * устойчивого состояния. Возвращает новый чертёж и id обрушившихся блоков.
 */
export function settle(bp: Blueprint): { blueprint: Blueprint; collapsed: string[] } {
  const collapsed: string[] = [];
  let cur = bp;
  for (let guard = 0; guard < 200; guard++) {
    const r = resolveBlueprint(cur);
    if (r.issues.some(i => i.level === 'error')) break;
    const fall = unstable(r.resolved).filter(id => cur.elements.some(e => e.id === id));
    if (fall.length === 0) break;
    const before = new Set(cur.elements.map(e => e.id));
    for (const id of fall) if (cur.elements.some(e => e.id === id)) cur = removeElement(cur, id);
    for (const id of before) if (!cur.elements.some(e => e.id === id)) collapsed.push(id);
  }
  return { blueprint: cur, collapsed };
}
