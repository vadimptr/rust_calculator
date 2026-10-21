/**
 * Движок геометрии (SPEC §4.7). Документ 2.0 хранит каждый блок с позой в мире, как сущности в игре;
 * документ 1.0 (дерево attach) разворачивается в позы и переводится в 2.0. socketPose — поза блока,
 * поставленного в сокет соседа: ею пользуется и установка в редакторе.
 */
import {
  BLOCK_FEMALE_Y, FOUNDATION_TOP, KINDS, RAMP_DROP, RAMP_HIGH_RISE, RAMP_MALE_H, ROOF_RISE, SPIRAL_H, apothem, canAttach, cellVertices, defaultSelfSocket, edgeAngle,
  edgeIndex, openingAccepts, socketsOf, wallHeight,
} from './catalog.ts';
import type {
  Attach, Blueprint, Deployable, Element, ElementKind, Grade, Issue, LegacyBlueprint, LegacyElement, Resolved, ResolvedDeployable, ResolvedElement,
  Socket, Transform,
} from './types.ts';

const DEG = Math.PI / 180;

function dir(angleDeg: number): [number, number] {
  return [Math.cos(angleDeg * DEG), Math.sin(angleDeg * DEG)];
}

function norm360(a: number): number {
  return ((a % 360) + 360) % 360;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000 + 0;
}

function err(code: string, id: string | undefined, message: string): Issue {
  return { code, level: 'error', id, message };
}

/** Слот сокета для V05: ребро ячейки имеет два слота (сосед и стена), остальные — один. */
function slotKey(parent: LegacyElement, socket: Socket, child: LegacyElement, flip: boolean): string {
  const p = KINDS[parent.kind];
  const c = KINDS[child.kind];
  if (p.category === 'cell' && edgeIndex(socket) !== null) {
    // сосед-ячейка, крыша над соседней позицией и стена-тип — три разных слота одного ребра
    return `${parent.id}/${socket}/${c.category === 'wallType' ? 'wall' : c.category === 'roof' ? 'roof' : 'neighbor'}`;
  }
  if ((p.category === 'wallType' && socket === 'top') || (p.category === 'roof' && socket === 'edge:2')) {
    if (c.category === 'wallType') return `${parent.id}/${socket}/wall`;
    // с каждой стороны верха стены — один пол и одна крыша: крыша над полом (чердак) допустима
    return `${parent.id}/${socket}/${flip ? 'back' : 'front'}/${c.category === 'roof' ? 'roof' : 'cell'}`;
  }
  if (p.category === 'cell' && socket === 'top') return `${parent.id}/top/stairs`;
  return `${parent.id}/${socket}`;
}

export interface PoseHost extends Transform { kind: ElementKind; inverted?: boolean }

export function socketPose(parent: PoseHost, kind: ElementKind, a: Attach): Transform {
  const t = placeChild(parent, kind, a, a.selfSocket ?? defaultSelfSocket(kind)!);
  const out: Transform = { ...t, rotation: norm360(t.rotation) };
  if (kind === 'roof-triangle' && parent.kind === 'roof-triangle' && a.socket !== 'edge:0' && !parent.inverted) out.inverted = true;
  return out;
}

function placeChild(parent: PoseHost, kind: ElementKind, a: Attach, selfSocket: Socket): Transform {
  if (a.socket === 'offset') {
    const [ox, oy, oz] = a.offset!;
    const [cx, cz] = dir(parent.rotation);
    const [px0, py0, pz0] = parent.position;
    return { position: [px0 + ox * cx - oz * cz, py0 + oy, pz0 + ox * cz + oz * cx], rotation: parent.rotation + (a.rotation ?? 0), level: parent.level + oy / 3 };
  }
  const p = KINDS[parent.kind];
  const c = KINDS[kind];
  const [px, py, pz] = parent.position;

  // Ячейка ребром к ребру ячейки
  if (p.category === 'cell' && edgeIndex(a.socket) !== null && (c.category === 'cell' || c.category === 'roof' || c.category === 'ramp')) {
    const k = edgeIndex(a.socket)!;
    const m = edgeIndex(selfSocket)!;
    const normal = parent.rotation + edgeAngle(p.shape!, k);
    const [nx, nz] = dir(normal);
    // крыша внутрь (flip): низкое ребро на ребре ячейки, скат поднимается над самой ячейкой
    if (c.category === 'roof' && a.flip === true) {
      const back = apothem(p.shape!) - apothem(c.shape!);
      return { position: [px + back * nx, py, pz + back * nz], rotation: normal - edgeAngle(c.shape!, m), level: parent.level };
    }
    const rot = normal + 180 - edgeAngle(c.shape!, m);
    const d = apothem(p.shape!) + apothem(c.shape!);
    // фундамент к фундаменту: сдвиг по высоте (ряды сокетов foundation-top/mid/bot)
    const rise = c.category === 'cell' ? a.rise ?? 0 : 0;
    return { position: [px + d * nx, py + rise, pz + d * nz], rotation: rot, level: parent.level + rise / 3 };
  }

  // Стена-тип на ребро ячейки
  if (p.category === 'cell' && edgeIndex(a.socket) !== null && c.category === 'wallType') {
    const k = edgeIndex(a.socket)!;
    const normal = parent.rotation + edgeAngle(p.shape!, k);
    const [nx, nz] = dir(normal);
    const d = apothem(p.shape!);
    return { position: [px + d * nx, py, pz + d * nz], rotation: normal + (a.flip ? 180 : 0), level: parent.level };
  }

  // Высокий край крыши — как верх стены высотой ROOF_RISE, развёрнутой от ската
  if (p.category === 'roof' && a.socket === 'edge:2') {
    const [hx, hz] = dir(parent.rotation + edgeAngle(p.shape!, 2));
    const base: PoseHost = { kind: parent.kind, position: [px + hx * apothem(p.shape!), py, pz + hz * apothem(p.shape!)], rotation: parent.rotation + 180, level: parent.level };
    return onTop(base, ROOF_RISE, kind, a, selfSocket);
  }

  // Съезд или ступени в саму ячейку (сокет Block у пола и фундамента): поднимаются от её верха
  if (p.category === 'cell' && a.socket === 'top' && c.category === 'ramp') {
    return { position: [px, py + BLOCK_FEMALE_Y + (a.rise ?? 0) + RAMP_MALE_H[kind]!, pz], rotation: parent.rotation + 90 * (a.turns ?? 0), level: parent.level };
  }

  // Следующий съезд от нижнего края съезда или ступеней
  if (p.category === 'ramp' && a.socket === 'edge:2') {
    const [bx, bz] = dir(parent.rotation + 180);
    return { position: [px + 3 * bx, py - RAMP_DROP[parent.kind]!, pz + 3 * bz], rotation: parent.rotation, level: parent.level };
  }

  // Винтовая лестница на винтовую
  if (p.category === 'stairs' && a.socket === 'top') {
    return { position: [px, py + SPIRAL_H, pz], rotation: parent.rotation + 90 * (a.turns ?? 0), level: parent.level + SPIRAL_H / 3 };
  }

  // Лестница на ячейку
  if (p.category === 'cell' && a.socket === 'top' && c.category === 'stairs') {
    return { position: [px, py, pz], rotation: parent.rotation + 90 * (a.turns ?? 0), level: parent.level };
  }

  // Крыша боком к крыше: как ячейка к ячейке по рёбрам
  if (p.category === 'roof' && c.category === 'roof') {
    const k = edgeIndex(a.socket)!;
    const m = edgeIndex(selfSocket)!;
    const normal = parent.rotation + edgeAngle(p.shape!, k);
    const rot = normal + 180 - edgeAngle(c.shape!, m);
    const [nx, nz] = dir(normal);
    const d = apothem(p.shape!) + apothem(c.shape!);
    return { position: [px + d * nx, py, pz + d * nz], rotation: rot, level: parent.level };
  }

  if (p.category === 'wallType' && a.socket === 'top') return onTop(parent, wallHeight(parent.kind), kind, a, selfSocket);

  throw new Error(`unsupported attachment ${parent.kind}.${a.socket} <- ${kind}.${selfSocket}`);
}

function onTop(parent: PoseHost, h: number, kind: ElementKind, a: Attach, selfSocket: Socket): Transform {
  const c = KINDS[kind];
  const [px, py, pz] = parent.position;

  // Стена-тип на верх стены-типа
  if (c.category === 'wallType') {
    return { position: [px, py + h, pz], rotation: parent.rotation + (a.flip ? 180 : 0), level: parent.level + h / 3 };
  }

  // Пол / крыша ребром на верх стены
  if (c.category === 'cell' || c.category === 'roof') {
    const m = edgeIndex(selfSocket)!;
    const [nx, nz] = dir(parent.rotation);
    const ac = apothem(c.shape!);
    const flip = a.flip === true;
    const rot = flip
      ? parent.rotation + 180 - edgeAngle(c.shape!, m)
      : parent.rotation - edgeAngle(c.shape!, m);
    const s = flip ? 1 : -1;
    return { position: [px + s * ac * nx, py + h, pz + s * ac * nz], rotation: rot, level: parent.level + h / 3 };
  }

  throw new Error(`unsupported attachment ${parent.kind}.${a.socket} <- ${kind}.${selfSocket}`);
}

function placeDeployable(parent: Transform, d: Deployable): Transform {
  const [px, py, pz] = parent.position;
  if (d.attach.socket === 'opening') {
    return { position: [px, py, pz], rotation: parent.rotation, level: parent.level };
  }
  if (d.attach.socket === 'face') {
    // дроп-бокс: на стене, смещение вдоль стены и по высоте; поворот = нормаль стены
    const [along, height] = d.offset ?? [0, 1.3];
    const [cx, cz] = dir(parent.rotation);
    return { position: [px - along * cz, py + height, pz + along * cx], rotation: parent.rotation, level: parent.level };
  }
  const [ox, oz] = d.offset ?? [0, 0];
  const [cx, cz] = dir(parent.rotation);
  // R(rot) · offset: локальный +x → (cx, cz), локальный +z → (-cz, cx)
  const x = px + ox * cx - oz * cz;
  const z = pz + ox * cz + oz * cx;
  return { position: [x, py, z], rotation: parent.rotation + (d.rotation ?? 0), level: parent.level };
}

function sameTransform(a: Transform, b: Transform, angleMod = 360): boolean {
  const d = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
  const da = Math.abs((((a.rotation - b.rotation) % angleMod) + angleMod) % angleMod);
  return d < 0.01 && (da < 0.5 || da > angleMod - 0.5);
}

/** Контур блока в плане (мир, [x, z]), усаженный на 5 см, чтобы соседи по ребру не считались пересечением. */
export function footprint(kind: ElementKind, t: Transform): [number, number][] {
  const shape = KINDS[kind].shape ?? 'square';
  const a = (t.rotation * Math.PI) / 180;
  const k = 1 - 0.05 / (shape === 'square' ? 1.5 : 0.866);
  return cellVertices(shape).map(([x, z]) => [t.position[0] + (x * Math.cos(a) - z * Math.sin(a)) * k, t.position[2] + (x * Math.sin(a) + z * Math.cos(a)) * k]);
}

/** Пересечение выпуклых многоугольников (разделяющая ось). */
export function polygonsOverlap(p: [number, number][], q: [number, number][]): boolean {
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

type Placed = Transform & { kind: ElementKind };

/**
 * Занимают ли два блока одно место. Крыша занимает объём над плоскостью уровня и с плитой того же
 * уровня не спорит (чердак над полом); крыши друг другу не мешают, как в игре, запрещён только точный
 * дубль. Фундамент занимает объём от земли до своего верха: крыша над его контуром не может начинаться
 * ниже верха. Стены на одном ребре — одно место при любой стороне нормали.
 */
export function clash(a: Placed, b: Placed): boolean {
  if (Math.abs(a.position[0] - b.position[0]) > 6 || Math.abs(a.position[2] - b.position[2]) > 6 || Math.abs(a.position[1] - b.position[1]) > 6) return false;
  const ca = KINDS[a.kind].category, cb = KINDS[b.kind].category;
  const roofIntoFoundation = (roof: Placed, f: Placed) => f.position[1] > roof.position[1] + 0.01 && polygonsOverlap(footprint(roof.kind, roof), footprint(f.kind, f));
  if (ca === 'roof' && KINDS[b.kind].isFoundation && roofIntoFoundation(a, b)) return true;
  if (cb === 'roof' && KINDS[a.kind].isFoundation && roofIntoFoundation(b, a)) return true;
  const place = (c: string) => (c === 'cell' || c === 'ramp' ? 'cell' : c);
  if (place(ca) !== place(cb)) return false;
  const underFoundation = (f: Placed, o: Placed) => KINDS[f.kind].isFoundation && o.position[1] < f.position[1] - 0.01 && polygonsOverlap(footprint(f.kind, f), footprint(o.kind, o));
  if (underFoundation(a, b) || underFoundation(b, a)) return true;
  if (ca === 'roof') return sameTransform(a, b) && !a.inverted === !b.inverted;
  if (KINDS[a.kind].isFoundation && KINDS[b.kind].isFoundation) return polygonsOverlap(footprint(a.kind, a), footprint(b.kind, b));
  if (ca === 'wallType') {
    const sameSpan = Math.abs(a.position[1] - b.position[1]) < 0.01
      || (a.position[1] > b.position[1] && a.position[1] < b.position[1] + wallHeight(b.kind) - 0.01)
      || (b.position[1] > a.position[1] && b.position[1] < a.position[1] + wallHeight(a.kind) - 0.01);
    return sameSpan && Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]) < 0.01 && Math.abs(((a.rotation - b.rotation) % 180 + 180) % 180) < 0.5;
  }
  if (Math.abs(a.position[1] - b.position[1]) > 0.01) return false;
  return polygonsOverlap(footprint(a.kind, a), footprint(b.kind, b));
}

export function overlaps(kind: ElementKind, t: Transform, resolved: Resolved, except?: string): boolean {
  return resolved.elements.some(e => e.id !== except && clash({ ...t, kind }, e));
}

export interface ResolveResult {
  resolved: Resolved;
  issues: Issue[];
}

function resolveDeployables(deployables: Deployable[], byId: Map<string, ResolvedElement>, issues: Issue[]): ResolvedDeployable[] {
  const out: ResolvedDeployable[] = [];
  const openings = new Map<string, string>();
  for (const d of deployables) {
    const parent = byId.get(d.attach.to);
    if (!parent) { issues.push(err('V02', d.id, `attach.to ссылается на несуществующий элемент «${d.attach.to}»`)); continue; }
    const info = KINDS[parent.kind];
    if (d.kind === 'tool-cupboard') {
      if (d.attach.socket !== 'top' || info.category !== 'cell' || info.isFrame) {
        issues.push(err('V04', d.id, `Шкаф ставится только на top фундамента или пола, а не на ${parent.kind}`));
        continue;
      }
    } else if (d.kind === 'drop-box') {
      if (d.attach.socket !== 'face' || info.category !== 'wallType' || info.opening || parent.kind === 'low-wall') {
        issues.push(err('V04', d.id, `Дроп-бокс вешается только на грань стены, а не на ${parent.kind}`));
        continue;
      }
    } else {
      if (d.attach.socket !== 'opening' || !info.opening) {
        issues.push(err('V04', d.id, `Дверь ставится только в opening проёма, а не в ${parent.kind}.${d.attach.socket}`));
        continue;
      }
      if (!openingAccepts(info.opening).includes(d.kind)) {
        issues.push(err('V11', d.id, `${d.kind} не подходит к ${parent.kind}`)); continue;
      }
      const prev = openings.get(parent.id);
      if (prev) { issues.push(err('V11', d.id, `В проёме «${parent.id}» уже стоит «${prev}»`)); continue; }
      openings.set(parent.id, d.id);
    }
    const t = placeDeployable(parent, d);
    out.push({
      id: d.id, kind: d.kind, parent: parent.id, hinge: d.hinge ?? 'left', opens: d.opens ?? 'outward', open: d.open === true, direction: d.direction,
      position: t.position.map(round3) as [number, number, number],
      rotation: round3(norm360(t.rotation)), level: t.level,
    } satisfies ResolvedDeployable);
  }
  return out;
}

function uniqueIds(items: { id: string }[], issues: Issue[]): void {
  const seen = new Set<string>();
  for (const x of items) {
    if (seen.has(x.id)) issues.push(err('V01', x.id, `Повторяющийся id «${x.id}»`));
    seen.add(x.id);
  }
}

function checkFoundationHeight(e: { id: string; kind: ElementKind; position: [number, number, number] }, issues: Issue[]): void {
  if (!KINDS[e.kind].isFoundation) return;
  const y = e.position[1];
  if (y < FOUNDATION_TOP.min - 1e-6 || y > FOUNDATION_TOP.max + 1e-6) issues.push(err('V12', e.id, `Фундамент на высоте ${round3(y)} м: верх должен быть от ${FOUNDATION_TOP.min} до ${FOUNDATION_TOP.max} м над землёй`));
}

export function isLegacy(bp: Blueprint | LegacyBlueprint): bp is LegacyBlueprint {
  return bp.formatVersion === '1.0';
}

export function resolveBlueprint(bp: Blueprint | LegacyBlueprint): ResolveResult {
  if (isLegacy(bp)) return resolveLegacy(bp);
  const issues: Issue[] = [];
  const elements = bp.elements ?? [];
  const deployables = bp.deployables ?? [];
  const defaultGrade: Grade = bp.defaults?.grade ?? 'twig';
  const terrain = bp.terrain ?? [];
  uniqueIds([...elements, ...deployables, ...terrain], issues);
  const resolved: Resolved = { elements: [], deployables: [] };
  if (terrain.length) {
    resolved.terrain = terrain.map(t => ({
      id: t.id, kind: t.kind, position: t.position.map(round3) as [number, number, number], rotation: round3(norm360(t.rotation)), scale: t.scale ?? 1,
    }));
  }
  for (const e of elements) {
    if (!KINDS[e.kind]) { issues.push(err('V03', e.id, `Неизвестный тип «${e.kind}»`)); continue; }
    checkFoundationHeight(e, issues);
    const r: ResolvedElement = {
      id: e.id, kind: e.kind, grade: e.grade ?? defaultGrade, ...(e.bunker ? { bunker: true } : {}), ...(e.inverted ? { inverted: true } : {}),
      position: e.position.map(round3) as [number, number, number],
      rotation: round3(norm360(e.rotation)), level: round3(e.position[1] / 3),
    };
    const other = resolved.elements.find(o => clash(r, o));
    if (other) issues.push(err('V05', e.id, `Место уже занято элементом «${other.id}»`));
    resolved.elements.push(r);
  }
  const byId = new Map(resolved.elements.map(e => [e.id, e]));
  resolved.deployables = resolveDeployables(deployables, byId, issues);
  return { resolved, issues };
}

export function upgradeLegacy(bp: LegacyBlueprint): { blueprint: Blueprint | null; issues: Issue[] } {
  const { resolved, issues } = resolveLegacy(bp);
  if (issues.some(i => i.level === 'error')) return { blueprint: null, issues };
  const src = new Map(bp.elements.map(e => [e.id, e]));
  const elements: Element[] = resolved.elements.map(r => {
    const e = src.get(r.id)!;
    const out: Element = { id: e.id, kind: e.kind, position: r.position, rotation: r.rotation };
    if (e.grade) out.grade = e.grade;
    if (r.inverted) out.inverted = true;
    if (e.bunker) out.bunker = true;
    if (e.label) out.label = e.label;
    if (e.notes) out.notes = e.notes;
    return out;
  });
  const { elements: _legacy, formatVersion: _v, ...rest } = bp;
  return { blueprint: { ...rest, formatVersion: '2.0', elements }, issues };
}

function resolveLegacy(bp: LegacyBlueprint): ResolveResult {
  const issues: Issue[] = [];
  const elements = bp.elements ?? [];
  const deployables = bp.deployables ?? [];
  const defaultGrade: Grade = bp.defaults?.grade ?? 'twig';

  uniqueIds([...elements, ...deployables], issues);

  const byId = new Map<string, LegacyElement>();
  for (const e of elements) if (!byId.has(e.id)) byId.set(e.id, e);

  // V02: ровно один корень, и это фундамент
  const roots = elements.filter(e => e.root === true || !e.attach);
  if (roots.length !== 1) {
    issues.push(err('V02', undefined, roots.length === 0
      ? 'Нет корневого фундамента (root: true)'
      : `Корней должно быть ровно один, найдено ${roots.length}: ${roots.map(r => r.id).join(', ')}`));
  } else if (!KINDS[roots[0].kind]?.isFoundation) {
    issues.push(err('V02', roots[0].id, `Корнем может быть только фундамент, а не ${roots[0].kind}`));
  }

  // V03/V04: сокеты существуют и совместимы
  const children = new Map<string, LegacyElement[]>();
  for (const e of elements) {
    if (!e.attach) continue;
    const parent = byId.get(e.attach.to);
    if (!parent) {
      issues.push(err('V02', e.id, `attach.to ссылается на несуществующий элемент «${e.attach.to}»`));
      continue;
    }
    if (!KINDS[e.kind]) { issues.push(err('V03', e.id, `Неизвестный тип «${e.kind}»`)); continue; }
    // крепление смещением: блок держится не сокетом, а положением относительно элемента `to`
    if (e.attach.socket === 'offset') {
      if (!e.attach.offset) { issues.push(err('V03', e.id, 'Для socket offset нужно поле offset')); continue; }
      const list = children.get(parent.id) ?? [];
      list.push(e);
      children.set(parent.id, list);
      continue;
    }
    if (!socketsOf(parent.kind).includes(e.attach.socket)) {
      issues.push(err('V03', e.id, `У ${parent.kind} «${parent.id}» нет сокета ${e.attach.socket}`));
      continue;
    }
    const self = e.attach.selfSocket ?? defaultSelfSocket(e.kind);
    if (!self) {
      issues.push(err('V03', e.id, `Для ${e.kind} нужно указать selfSocket`));
      continue;
    }
    if (!socketsOf(e.kind).includes(self)) {
      issues.push(err('V03', e.id, `У ${e.kind} нет сокета ${self}`));
      continue;
    }
    if (!canAttach(parent.kind, e.attach.socket, e.kind, self)) {
      issues.push(err('V04', e.id, `${e.kind}.${self} нельзя крепить к ${parent.kind}.${e.attach.socket}`));
      continue;
    }
    const rampHigh = e.kind === 'ramp' && e.attach.socket === 'top' && e.attach.rise === RAMP_HIGH_RISE;
    if (e.attach.rise && !rampHigh && !(KINDS[parent.kind].isFoundation && KINDS[e.kind].isFoundation && edgeIndex(e.attach.socket) !== null)) {
      issues.push(err('V04', e.id, 'rise допустим только у фундамента, приставленного к ребру фундамента, и у съезда на верху ячейки (0.75)'));
      continue;
    }
    const list = children.get(parent.id) ?? [];
    list.push(e);
    children.set(parent.id, list);
  }

  // V05: занятость слотов
  const slots = new Map<string, string>();
  for (const [pid, list] of children) {
    const parent = byId.get(pid)!;
    for (const c of list) {
      if (c.attach!.socket === 'offset') continue;
      const key = slotKey(parent, c.attach!.socket, c, c.attach!.flip === true);
      const prev = slots.get(key);
      if (prev) issues.push(err('V05', c.id, `Слот ${key} уже занят элементом «${prev}»`));
      else slots.set(key, c.id);
    }
  }

  const resolved: Resolved = { elements: [], deployables: [] };
  if (issues.length > 0 || roots.length !== 1) {
    return { resolved, issues };
  }

  // Обход от корня
  type Node = PoseHost & { el: LegacyElement };
  const placed = new Map<string, Node>();
  const root = roots[0];
  const origin = root.origin ?? { position: [0, 0, 0] as [number, number, number], rotation: 0 };
  const queue: Node[] = [{ el: root, kind: root.kind, position: [...origin.position], rotation: origin.rotation, level: origin.position[1] / 3 }];
  placed.set(root.id, queue[0]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const child of children.get(cur.el.id) ?? []) {
      if (placed.has(child.id)) continue;
      const t = socketPose(cur, child.kind, child.attach!);
      const pc: Node = { el: child, kind: child.kind, ...t };
      placed.set(child.id, pc);
      queue.push(pc);
    }
  }

  // V12: верх фундамента — на земле, на высоте полустены или стены
  for (const [id, p] of placed) checkFoundationHeight({ id, kind: p.kind, position: p.position }, issues);

  // V02: недостижимые элементы (циклы или оторванные ветки)
  for (const e of elements) {
    if (!placed.has(e.id)) issues.push(err('V02', e.id, `Элемент «${e.id}» не достижим от корня (цикл или оторванная ветка)`));
  }
  if (issues.length > 0) return { resolved, issues };

  for (const e of elements) {
    const p = placed.get(e.id)!;
    resolved.elements.push({
      id: e.id, kind: e.kind, grade: e.grade ?? defaultGrade, ...(e.bunker ? { bunker: true } : {}), ...(p.inverted ? { inverted: true } : {}),
      position: p.position.map(round3) as [number, number, number],
      rotation: round3(p.rotation), level: p.level,
    } satisfies ResolvedElement);
  }

  const byResolved = new Map(resolved.elements.map(e => [e.id, e]));
  resolved.deployables = resolveDeployables(deployables, byResolved, issues);
  return { resolved, issues };
}
