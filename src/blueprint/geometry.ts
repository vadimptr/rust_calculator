/**
 * Движок геометрии (SPEC §4.7): разворачивает дерево attach в мировые трансформы.
 * Попутно проверяет структурные правила V01–V05 и V11; без них геометрия не считается.
 */
import {
  KINDS, apothem, canAttach, defaultSelfSocket, edgeAngle,
  edgeIndex, openingAccepts, socketsOf, wallHeight,
} from './catalog.ts';
import type {
  Blueprint, Deployable, Element, Grade, Issue, Resolved, ResolvedDeployable, ResolvedElement,
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
function slotKey(parent: Element, socket: Socket, child: Element, flip: boolean): string {
  const p = KINDS[parent.kind];
  const c = KINDS[child.kind];
  if (p.category === 'cell' && edgeIndex(socket) !== null) {
    return `${parent.id}/${socket}/${c.category === 'wallType' ? 'wall' : 'neighbor'}`;
  }
  if (p.category === 'wallType' && socket === 'top') {
    if (c.category === 'wallType') return `${parent.id}/top/wall`;
    return `${parent.id}/top/${flip ? 'back' : 'front'}`;
  }
  if (p.category === 'cell' && socket === 'top') return `${parent.id}/top/stairs`;
  return `${parent.id}/${socket}`;
}

interface Placed extends Transform { el: Element }

function placeChild(parent: Placed, child: Element, selfSocket: Socket): Transform {
  const a = child.attach!;
  const p = KINDS[parent.el.kind];
  const c = KINDS[child.kind];
  const [px, py, pz] = parent.position;

  // Ячейка ребром к ребру ячейки
  if (p.category === 'cell' && edgeIndex(a.socket) !== null && (c.category === 'cell' || c.category === 'roof')) {
    const k = edgeIndex(a.socket)!;
    const m = edgeIndex(selfSocket)!;
    const normal = parent.rotation + edgeAngle(p.shape!, k);
    const rot = normal + 180 - edgeAngle(c.shape!, m);
    const [nx, nz] = dir(normal);
    const d = apothem(p.shape!) + apothem(c.shape!);
    return { position: [px + d * nx, py, pz + d * nz], rotation: rot, level: parent.level };
  }

  // Стена-тип на ребро ячейки
  if (p.category === 'cell' && edgeIndex(a.socket) !== null && c.category === 'wallType') {
    const k = edgeIndex(a.socket)!;
    const rot = parent.rotation + edgeAngle(p.shape!, k);
    const [nx, nz] = dir(rot);
    const d = apothem(p.shape!);
    return { position: [px + d * nx, py, pz + d * nz], rotation: rot, level: parent.level };
  }

  // Стена-тип на верх стены-типа
  if (p.category === 'wallType' && a.socket === 'top' && c.category === 'wallType') {
    const h = wallHeight(parent.el.kind);
    return { position: [px, py + h, pz], rotation: parent.rotation, level: parent.level + h / 3 };
  }

  // Пол / крыша ребром на верх стены
  if (p.category === 'wallType' && a.socket === 'top' && (c.category === 'cell' || c.category === 'roof')) {
    const m = edgeIndex(selfSocket)!;
    const h = wallHeight(parent.el.kind);
    const [nx, nz] = dir(parent.rotation);
    const ac = apothem(c.shape!);
    const flip = a.flip === true;
    const rot = flip
      ? parent.rotation + 180 - edgeAngle(c.shape!, m)
      : parent.rotation - edgeAngle(c.shape!, m);
    const s = flip ? 1 : -1;
    return { position: [px + s * ac * nx, py + h, pz + s * ac * nz], rotation: rot, level: parent.level + h / 3 };
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

  throw new Error(`unsupported attachment ${parent.el.kind}.${a.socket} <- ${child.kind}.${selfSocket}`);
}

function placeDeployable(parent: Placed, d: Deployable): Transform {
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

export interface ResolveResult {
  resolved: Resolved;
  issues: Issue[];
}

export function resolveBlueprint(bp: Blueprint): ResolveResult {
  const issues: Issue[] = [];
  const elements = bp.elements ?? [];
  const deployables = bp.deployables ?? [];
  const defaultGrade: Grade = bp.defaults?.grade ?? 'twig';

  // V01: уникальные id среди элементов и объектов
  const seen = new Set<string>();
  for (const x of [...elements, ...deployables]) {
    if (seen.has(x.id)) issues.push(err('V01', x.id, `Повторяющийся id «${x.id}»`));
    seen.add(x.id);
  }

  const byId = new Map<string, Element>();
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
  const children = new Map<string, Element[]>();
  for (const e of elements) {
    if (!e.attach) continue;
    const parent = byId.get(e.attach.to);
    if (!parent) {
      issues.push(err('V02', e.id, `attach.to ссылается на несуществующий элемент «${e.attach.to}»`));
      continue;
    }
    if (!KINDS[e.kind]) { issues.push(err('V03', e.id, `Неизвестный тип «${e.kind}»`)); continue; }
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
    const list = children.get(parent.id) ?? [];
    list.push(e);
    children.set(parent.id, list);
  }

  // V05: занятость слотов
  const slots = new Map<string, string>();
  for (const [pid, list] of children) {
    const parent = byId.get(pid)!;
    for (const c of list) {
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
  const placed = new Map<string, Placed>();
  const root = roots[0];
  const queue: Placed[] = [{ el: root, position: [0, 0, 0], rotation: 0, level: 0 }];
  placed.set(root.id, queue[0]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const child of children.get(cur.el.id) ?? []) {
      if (placed.has(child.id)) continue;
      const self = child.attach!.selfSocket ?? defaultSelfSocket(child.kind)!;
      const t = placeChild(cur, child, self);
      const pc: Placed = { el: child, ...t, rotation: norm360(t.rotation) };
      placed.set(child.id, pc);
      queue.push(pc);
    }
  }

  // V02: недостижимые элементы (циклы или оторванные ветки)
  for (const e of elements) {
    if (!placed.has(e.id)) issues.push(err('V02', e.id, `Элемент «${e.id}» не достижим от корня (цикл или оторванная ветка)`));
  }
  if (issues.length > 0) return { resolved, issues };

  for (const e of elements) {
    const p = placed.get(e.id)!;
    resolved.elements.push({
      id: e.id, kind: e.kind, grade: e.grade ?? defaultGrade,
      position: p.position.map(round3) as [number, number, number],
      rotation: round3(p.rotation), level: p.level,
    } satisfies ResolvedElement);
  }

  // Объекты: V04 (сокет), V11 (дверь ↔ проём, одна дверь на проём)
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
    const t = placeDeployable(placed.get(parent.id)!, d);
    resolved.deployables.push({
      id: d.id, kind: d.kind, parent: parent.id, hinge: d.hinge ?? 'left', opens: d.opens ?? 'outward', open: d.open === true, direction: d.direction,
      position: t.position.map(round3) as [number, number, number],
      rotation: round3(norm360(t.rotation)), level: t.level,
    } satisfies ResolvedDeployable);
  }

  // W04: шкаф не на корне
  for (const d of deployables) {
    if (d.kind === 'tool-cupboard' && d.attach.to !== root.id) {
      issues.push({ code: 'W04', level: 'warning', id: d.id, message: 'Шкаф стоит не на корневой ячейке' });
    }
  }

  return { resolved, issues };
}
