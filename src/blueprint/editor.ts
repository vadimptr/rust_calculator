/**
 * Режим стройки: чистые операции над документом чертежа. Призрак ставится в сокет наведённого
 * элемента, как в игре: для выбранного типа перебираются все совместимые сокеты хозяина, каждый
 * вариант прогоняется через движок геометрии (значит, учитываются занятость слотов и правила
 * совместимости), а из удавшихся берётся ближайший к точке наведения.
 */
import { KINDS, apothem, canAttach, cellVertices, defaultSelfSocket, edgeAngle, edgeCount, socketsOf, wallHeight } from './catalog.ts';
import { resolveBlueprint } from './geometry.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, Element, ElementKind, Grade, Resolved, ResolvedElement, Socket, Transform } from './types.ts';

export const GRADES: Grade[] = ['twig', 'wood', 'stone', 'metal', 'armored'];

/** Строительный план Rust: все конструкции, по группам, как в игровом меню. */
export const BUILD_PLAN: { group: string; kinds: ElementKind[] }[] = [
  { group: 'Фундаменты', kinds: ['square-foundation', 'triangle-foundation', 'foundation-steps', 'ramp'] },
  { group: 'Стены', kinds: ['wall', 'half-wall', 'low-wall', 'doorway', 'window-frame', 'wall-frame'] },
  { group: 'Полы', kinds: ['square-floor', 'triangle-floor', 'floor-frame', 'triangle-floor-frame'] },
  { group: 'Лестницы', kinds: ['stairs-l-shape', 'u-shaped-stairs', 'spiral-stairs'] },
  { group: 'Крыши', kinds: ['roof', 'roof-triangle'] },
];

/** Объекты, которые ставятся в режиме стройки. */
export const DEPLOY_PLAN: { group: string; kinds: DeployableKind[] }[] = [
  { group: 'Двери', kinds: ['wooden-door', 'sheet-metal-door', 'armored-door'] },
  { group: 'Двойные и гаражные', kinds: ['wooden-double-door', 'sheet-metal-double-door', 'armored-double-door', 'garage-door'] },
  { group: 'В окно', kinds: ['strengthened-glass-window', 'reinforced-glass-window', 'metal-window-bars'] },
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
export function newBlueprint(name = 'Новая постройка', foundation: ElementKind = 'square-foundation'): Blueprint {
  return {
    formatVersion: '1.0',
    meta: { name, gameVersion: '2026-09', tags: ['custom'] },
    defaults: { grade: 'twig' },
    elements: [{ id: 'f1', kind: foundation, root: true }],
    deployables: [],
  };
}

export interface Placement {
  attach: Attach;
  transform: Transform;
}

const GHOST = '__ghost__';

function sameTransform(a: Transform, b: Transform, angleMod = 360): boolean {
  const d = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
  const da = Math.abs((((a.rotation - b.rotation) % angleMod) + angleMod) % angleMod);
  return d < 0.01 && (da < 0.5 || da > angleMod - 0.5);
}

/** Пересекается ли новый элемент с уже стоящим: та же категория места и та же позиция. */
function overlaps(kind: ElementKind, t: Transform, resolved: Resolved): boolean {
  const cat = KINDS[kind].category;
  // крыша занимает объём над плоскостью уровня и с плитой того же уровня не спорит (чердак над полом);
  // две крыши в одной позиции — пересечение при любом наклоне
  const place = (c: string) => (c === 'cell' || c === 'ramp' ? 'cell' : c);
  return resolved.elements.some(e => {
    if (place(KINDS[e.kind].category) !== place(cat)) return false;
    if (cat === 'roof') return Math.hypot(e.position[0] - t.position[0], e.position[1] - t.position[1], e.position[2] - t.position[2]) < 0.01;
    if (cat === 'wallType') {
      // стены на одном ребре: одна позиция, нормали могут смотреть в разные стороны
      const sameSpan = Math.abs(e.position[1] - t.position[1]) < 0.01
        || (t.position[1] > e.position[1] && t.position[1] < e.position[1] + wallHeight(e.kind) - 0.01)
        || (e.position[1] > t.position[1] && e.position[1] < t.position[1] + wallHeight(kind) - 0.01);
      return sameSpan && Math.hypot(e.position[0] - t.position[0], e.position[2] - t.position[2]) < 0.01 && Math.abs(((e.rotation - t.rotation) % 180 + 180) % 180) < 0.5;
    }
    // ячейки, крыши, съезды и лестницы одного уровня: пересечение контуров в плане (треугольник
    // внутри квадрата — тоже пересечение); поворот не важен, одну плиту можно прикрепить любым ребром
    if (Math.abs(e.position[1] - t.position[1]) > 0.01) return false;
    return polygonsOverlap(footprint(e.kind, e), footprint(kind, t));
  });
}

/** Контур блока в плане (мир, [x, z]), усаженный на 5 см, чтобы соседи по ребру не считались пересечением. */
function footprint(kind: ElementKind, t: Transform): [number, number][] {
  const shape = KINDS[kind].shape ?? 'square';
  const a = (t.rotation * Math.PI) / 180;
  const k = 1 - 0.05 / (shape === 'square' ? 1.5 : 0.866);
  return cellVertices(shape).map(([x, z]) => [t.position[0] + (x * Math.cos(a) - z * Math.sin(a)) * k, t.position[2] + (x * Math.sin(a) + z * Math.cos(a)) * k]);
}

/** Пересечение выпуклых многоугольников (разделяющая ось). */
function polygonsOverlap(p: [number, number][], q: [number, number][]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
      const nx = z1 - z2, nz = x2 - x1;
      const proj = (pts: [number, number][]) => pts.map(([x, z]) => x * nx + z * nz);
      const a = proj(p), b = proj(q);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
    }
  }
  return true;
}

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
    return false;
  });
}

/** Все возможные размещения элемента типа kind на сокетах хозяина hostId. */
export function candidatePlacements(bp: Blueprint, resolved: Resolved, kind: ElementKind, hostId: string, dedupe = true): Placement[] {
  const host = bp.elements.find(e => e.id === hostId);
  if (!host) return [];
  const out: Placement[] = [];
  const seen = new Set<string>();
  const selfSockets = KINDS[kind].category === 'wallType' || KINDS[kind].category === 'stairs' ? ['bottom' as Socket] : socketsOf(kind);
  for (const socket of socketsOf(host.kind)) {
    if (socket === 'opening' || socket === 'face') continue;
    for (const self of selfSockets) {
      if (!canAttach(host.kind, socket, kind, self)) continue;
      const flips = KINDS[host.kind].category === 'wallType' && socket === 'top' && KINDS[kind].category !== 'wallType' ? [false, true] : [false];
      const turnsList = KINDS[kind].category === 'stairs' ? [0, 1, 2, 3] : [0];
      for (const flip of flips) for (const turns of turnsList) {
        const attach: Attach = { to: hostId, socket };
        if (defaultSelfSocket(kind) !== self) attach.selfSocket = self;
        if (flip) attach.flip = true;
        if (turns) attach.turns = turns as 0 | 1 | 2 | 3;
        const ghost: Element = { id: GHOST, kind, attach };
        const r = resolveBlueprint({ ...bp, elements: [...bp.elements, ghost], deployables: [] });
        if (r.issues.some(i => i.level === 'error')) continue;
        const t = r.resolved.elements.find(e => e.id === GHOST);
        if (!t) continue;
        // ячейка, приставленная разными своими рёбрами, занимает одно и то же место: поворот берётся
        // по модулю симметрии формы, первым остаётся вариант с edge:0
        const sym = dedupe && KINDS[kind].category === 'cell' ? 360 / (KINDS[kind].shape === 'square' ? 4 : 3) : 360;
        const key = `${t.position.map(v => v.toFixed(2)).join('|')}|${(((t.rotation % sym) + sym) % sym).toFixed(0)}|${turns}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (overlaps(kind, t, resolved)) continue;
        if (KINDS[kind].category === 'roof' && !roofSupported(kind, t, resolved)) continue;
        out.push({ attach, transform: { position: t.position, rotation: t.rotation, level: t.level } });
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
export function placementAnchor(kind: ElementKind, p: Placement): string {
  const cat = KINDS[kind].category;
  const r = (v: number) => (Math.round(v * 100) / 100 + 0).toFixed(2);
  if (cat === 'cell' || cat === 'roof' || cat === 'ramp') {
    const k = p.attach.selfSocket ? Number(p.attach.selfSocket.slice(5)) : 0;
    const m = edgeMids(kind, p.transform)[k] ?? p.transform.position;
    return `${r(m[0])}|${r(m[1])}|${r(m[2])}`;
  }
  return p.transform.position.map(r).join('|');
}

export function addElement(bp: Blueprint, kind: ElementKind, attach: Attach, grade?: Grade): Blueprint {
  const el: Element = { id: freshId(bp, kind), kind, attach };
  if (grade && grade !== bp.defaults?.grade) el.grade = grade;
  return { ...bp, elements: [...bp.elements, el] };
}

export function upgradeElement(bp: Blueprint, id: string, grade: Grade): Blueprint {
  return { ...bp, elements: bp.elements.map(e => (e.id === id ? { ...e, grade } : e)) };
}

/** Элемент, в который рейкастом попал курсор, и доступные ему размещения с учётом текущего чертежа. */
export function transformOf(resolved: Resolved, id: string): ResolvedElement | undefined {
  return resolved.elements.find(e => e.id === id);
}

/**
 * Снос элемента. Дети, висевшие на нём, перецепляются к любому другому элементу, дающему ту же
 * позицию (как в игре, где блок держится на всех соседях); кому перецепиться не к кому — сносятся
 * тоже, вместе со своими объектами. Корень снести нельзя.
 */
export function removeElement(bp: Blueprint, id: string): Blueprint {
  const target = bp.elements.find(e => e.id === id);
  if (!target || target.root) return bp;
  const before = resolveBlueprint(bp).resolved;
  let elements = bp.elements.filter(e => e.id !== id);
  let deployables = bp.deployables ?? [];
  const removed = new Set([id]);
  for (;;) {
    const orphan = elements.find(e => e.attach && removed.has(e.attach.to));
    if (!orphan) break;
    const want = before.elements.find(e => e.id === orphan.id);
    const rest = elements.filter(e => e.id !== orphan.id);
    // для пробы крепления берём только то, что сейчас держится на корне: сироты и их поддеревья
    // (в том числе ещё не разобранные) сами по себе не разрешатся
    const live = subtree(elements, elements.find(e => e.root)!.id);
    const probe = { ...bp, elements: elements.filter(e => live.has(e.id)), deployables: deployables.filter(d => live.has(d.attach.to)) };
    const re = want ? reattach(probe, orphan, want) : null;
    if (re) {
      elements = rest.concat({ ...orphan, attach: re.attach });
      if (re.flipped) ({ elements, deployables } = flipWall({ ...bp, elements, deployables }, orphan.id));
    } else {
      elements = rest;
      removed.add(orphan.id);
    }
  }
  deployables = deployables.filter(d => !removed.has(d.attach.to));
  return { ...bp, elements, deployables };
}

/** id элемента и всех, кто висит на нём по цепочке attach. */
function subtree(elements: Element[], rootId: string): Set<string> {
  const out = new Set([rootId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of elements) if (e.attach && out.has(e.attach.to) && !out.has(e.id)) { out.add(e.id); grew = true; }
  }
  return out;
}

/**
 * Найти для элемента другое крепление с той же позицией среди соседей в радиусе одной ячейки.
 * Поворот должен совпасть точно (иначе сдвинутся дети, висящие на рёбрах); стене-типу на общем
 * ребре разрешён разворот на 180° — крепление к ячейке с другой стороны ребра, — тогда вызывающий
 * код разворачивает всё, что на ней висит (flipWall).
 */
function reattach(bp: Blueprint, el: Element, want: Transform): { attach: Attach; flipped: boolean } | null {
  const resolved = resolveBlueprint(bp).resolved;
  if (resolved.elements.length === 0) return null;
  const near = resolved.elements.filter(e => Math.hypot(e.position[0] - want.position[0], e.position[2] - want.position[2]) < 4.5 && Math.abs(e.position[1] - want.position[1]) < 3.5);
  let flipped: Attach | null = null;
  for (const host of near) {
    for (const p of candidatePlacements(bp, resolved, el.kind, host.id, false)) {
      if (sameTransform(p.transform, want)) return { attach: p.attach, flipped: false };
      if (!flipped && KINDS[el.kind].category === 'wallType' && sameTransform(p.transform, want, 180)) flipped = p.attach;
    }
  }
  return flipped ? { attach: flipped, flipped: true } : null;
}

/**
 * Стена-тип развёрнута на 180° (нормаль смотрит в другую сторону): всё, что на ней висит, описано
 * относительно нормали, поэтому компенсируется — полы и крыши на верху меняют flip, стены сверху
 * разворачиваются так же (рекурсивно), у дверей меняются петли и сторона открывания, у дроп-боксов
 * направление и знак смещения вдоль стены. В мире ничего не сдвигается.
 */
function flipWall(bp: Blueprint, wallId: string): { elements: Element[]; deployables: Deployable[] } {
  let elements = bp.elements;
  let deployables = bp.deployables ?? [];
  const stacked: string[] = [];
  elements = elements.map(e => {
    if (!e.attach || e.attach.to !== wallId) return e;
    const cat = KINDS[e.kind].category;
    if (cat === 'wallType') { stacked.push(e.id); return e; }
    return { ...e, attach: { ...e.attach, flip: !e.attach.flip } };
  });
  deployables = deployables.map(d => {
    if (d.attach.to !== wallId) return d;
    if (d.kind === 'drop-box') return { ...d, direction: d.direction === 'in' ? 'out' : 'in', offset: d.offset ? [-d.offset[0], d.offset[1]] : d.offset };
    if (d.kind === 'tool-cupboard') return d;
    const hinge = (d.hinge ?? 'left') === 'left' ? 'right' : 'left';
    const opens = (d.opens ?? 'outward') === 'outward' ? 'inward' : 'outward';
    return { ...d, hinge, opens };
  });
  let out = { elements, deployables };
  for (const id of stacked) out = flipWall({ ...bp, ...out }, id);
  return out;
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
export function deployPlacement(bp: Blueprint, resolved: Resolved, kind: DeployableKind, hostId: string, local: [number, number, number]): DeployPlacement | null {
  const host = bp.elements.find(e => e.id === hostId);
  const ht = resolved.elements.find(e => e.id === hostId);
  if (!host || !ht) return null;
  const info = KINDS[host.kind];
  const taken = (bp.deployables ?? []).filter(d => d.attach.to === hostId);
  let deployable: Omit<Deployable, 'id'>;
  if (kind === 'tool-cupboard') {
    if (info.category !== 'cell' || info.isFrame) return null;
    if (taken.some(d => d.kind === 'tool-cupboard')) return null;
    const r = (info.shape === 'square' ? 1.5 : 0.866) - 0.35;
    const clamp = (v: number) => Math.max(-r, Math.min(r, v));
    deployable = { kind, attach: { to: hostId, socket: 'top' }, offset: [Math.round(clamp(local[0]) * 100) / 100, Math.round(clamp(local[2]) * 100) / 100], rotation: 0 };
  } else if (kind === 'drop-box') {
    if (info.category !== 'wallType' || info.opening || host.kind === 'low-wall') return null;
    const h = wallHeight(host.kind);
    deployable = { kind, attach: { to: hostId, socket: 'face' }, offset: [Math.round(Math.max(-1.1, Math.min(1.1, local[2])) * 10) / 10, Math.round(Math.max(0.4, Math.min(h - 0.4, local[1])) * 10) / 10], direction: local[0] >= 0 ? 'in' : 'out' };
  } else {
    if (!info.opening) return null;
    if (taken.length > 0) return null;
    const accepts = info.opening === 'single' ? ['wooden-door', 'sheet-metal-door', 'armored-door']
      : info.opening === 'frame' ? ['garage-door', 'wooden-double-door', 'sheet-metal-double-door', 'armored-double-door']
        : ['strengthened-glass-window', 'reinforced-glass-window', 'metal-window-bars'];
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

export function addDeployable(bp: Blueprint, d: Omit<Deployable, 'id'>): Blueprint {
  const dep = { id: freshId(bp, d.kind), ...d } as Deployable;
  return { ...bp, deployables: [...(bp.deployables ?? []), dep] };
}

export function removeDeployable(bp: Blueprint, id: string): Blueprint {
  return { ...bp, deployables: (bp.deployables ?? []).filter(d => d.id !== id) };
}

/** Документ для скачивания: без вычисляемого слоя, с отступами. */
export function exportBlueprint(bp: Blueprint): string {
  const { resolved: _resolved, ...rest } = bp as Blueprint & { resolved?: unknown };
  void _resolved;
  return JSON.stringify({ $schema: 'https://github.com/vadimptr/rust_calculator/docs/blueprint/schema/blueprint.schema.json', ...rest }, null, 2) + '\n';
}
