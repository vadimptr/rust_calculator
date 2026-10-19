/**
 * Условные модели (как ConditionalModel в игре, docs/research/rust-building-mechanics.md §6): форма
 * блока зависит от соседей. Реализовано по правилам игры WallTriangleLeft/Right: полная стена, на
 * которой ничего не стоит, стоящая на торце ската крыши того же уровня, показывается треугольником
 * под скатом — фронтон. Геометрия вариантов в игре берётся из префабов; здесь она строится по
 * размерам сетки (подъём крыши 3 м на 3 м).
 */
import { KINDS, apothem, edgeAngle, edgeCount, wallHeight } from './catalog.ts';
import type { Resolved, ResolvedElement } from './types.ts';

/** Фронтон: стена-треугольник; peak — знак локальной z стены, где высокий край ската. */
export interface GableShape { peak: 1 | -1 }

const DEG = Math.PI / 180;
const near = (a: number[], b: number[], eps = 0.05) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < eps;

function edgeMid(el: ResolvedElement, k: number): [number, number, number] {
  const shape = KINDS[el.kind].shape ?? 'square';
  const a = (el.rotation + edgeAngle(shape, k)) * DEG;
  return [el.position[0] + apothem(shape) * Math.cos(a), el.position[1], el.position[2] + apothem(shape) * Math.sin(a)];
}

/** Локальная z точки в системе стены (ось вдоль стены). */
function alongWall(w: ResolvedElement, p: [number, number, number]): number {
  const a = -w.rotation * DEG;
  const dx = p[0] - w.position[0], dz = p[2] - w.position[2];
  return dx * Math.sin(a) + dz * Math.cos(a);
}

/** Пусто ли на верху стены: ни стены сверху, ни пола или рамы ребром, ни крыши низким ребром. */
function topFree(w: ResolvedElement, resolved: Resolved): boolean {
  const top: [number, number, number] = [w.position[0], w.position[1] + wallHeight(w.kind), w.position[2]];
  return !resolved.elements.some(e => {
    if (e.id === w.id) return false;
    const info = KINDS[e.kind];
    if (info.category === 'wallType') return near(e.position, top);
    if (info.category === 'cell') return Array.from({ length: edgeCount(info.shape!) }, (_, k) => edgeMid(e, k)).some(m => near(m, top));
    if (info.category === 'roof') return near(edgeMid(e, 0), top);
    return false;
  });
}

/**
 * Стены-фронтоны. Условие игры: на стене ничего не стоит, а её нижняя кромка совпадает с боковым
 * ребром крыши того же уровня (крыша квадратная, сторона ската вдоль стены). Высокий край —
 * со стороны высокого ребра крыши.
 */
export function gableWalls(resolved: Resolved): Map<string, GableShape> {
  const out = new Map<string, GableShape>();
  const roofs = resolved.elements.filter(e => e.kind === 'roof');
  for (const w of resolved.elements) {
    if (w.kind !== 'wall') continue;
    const roof = roofs.find(r => Math.abs(r.position[1] - w.position[1]) < 0.05 && [1, 3].some(k => near(edgeMid(r, k), w.position)));
    if (!roof || !topFree(w, resolved)) continue;
    const high = edgeMid(roof, 2);
    out.set(w.id, { peak: alongWall(w, high) >= 0 ? 1 : -1 });
  }
  return out;
}

/**
 * Сращивание крыш (RoofLeft/RoofRight с углом 90°): две квадратные крыши одного грейда в одной
 * ячейке на одном уровне, скаты под прямым углом. Как угловые модели игры, каждая показывает только
 * часть ниже соседней — вместе они дают вальму (скат на угол). sides — знаки локальной z крыши, с
 * которых к ней примыкает соседний скат; крыша обрезается по диагонали x = s·z.
 */
export function hipRoofs(resolved: Resolved): Map<string, (1 | -1)[]> {
  const out = new Map<string, (1 | -1)[]>();
  const roofs = resolved.elements.filter(e => e.kind === 'roof');
  for (const a of roofs) {
    for (const b of roofs) {
      if (a === b || a.grade !== b.grade || !near(a.position, b.position)) continue;
      const d = (((b.rotation - a.rotation) % 360) + 360) % 360;
      if (Math.abs(d - 90) > 1 && Math.abs(d - 270) > 1) continue;
      // низкое ребро соседа в локальных координатах a: на стороне z = ±1.5
      const low = edgeMid(b, 0);
      const ang = -a.rotation * DEG;
      const z = (low[0] - a.position[0]) * Math.sin(ang) + (low[2] - a.position[2]) * Math.cos(ang);
      const s: 1 | -1 = z >= 0 ? 1 : -1;
      const list = out.get(a.id) ?? [];
      if (!list.includes(s)) list.push(s);
      out.set(a.id, list);
    }
  }
  return out;
}

/** Угловая стойка: заполняет внешний зазор там, где сходятся торцы двух стен (WallCornerLeft/Right). */
export interface CornerPost { position: [number, number, number]; rotation: number; height: number; grade: ResolvedElement['grade'] }

const CORNER_KINDS = new Set(['wall', 'half-wall', 'low-wall', 'doorway', 'window-frame']);

export function cornerPosts(resolved: Resolved): CornerPost[] {
  const walls = resolved.elements.filter(e => CORNER_KINDS.has(e.kind));
  const ends = (w: ResolvedElement) => {
    const a = w.rotation * DEG;
    const dx = -Math.sin(a) * 1.5, dz = Math.cos(a) * 1.5;
    return [[w.position[0] + dx, w.position[2] + dz], [w.position[0] - dx, w.position[2] - dz]];
  };
  const posts = new Map<string, CornerPost>();
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j];
    // тот же грейд и тот же низ — как в игре, угол только между одинаковыми стенами одного яруса
    if (a.grade !== b.grade || Math.abs(a.position[1] - b.position[1]) > 0.05) continue;
    const da = Math.abs(((((a.rotation - b.rotation) % 180) + 180) % 180));
    if (da < 10 || da > 170) continue;
    for (const p of ends(a)) for (const q of ends(b)) {
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) continue;
      const k = `${p[0].toFixed(2)}|${a.position[1].toFixed(2)}|${p[1].toFixed(2)}`;
      const height = Math.min(wallHeight(a.kind), wallHeight(b.kind));
      const prev = posts.get(k);
      if (!prev || prev.height < height) posts.set(k, { position: [p[0], a.position[1], p[1]], rotation: a.rotation, height, grade: a.grade });
    }
  }
  return [...posts.values()];
}

/**
 * Вставка между треугольными крышами в ряд (модель roof.straight.right, условие RoofRight с углом 0
 * и формой «треугольник»): две треугольные крыши одного грейда и уровня, смотрящие в одну сторону и
 * стоящие вплотную основаниями, сами закрывают просвет между собой перевёрнутым треугольником в той же
 * плоскости. Вставку рисует крыша, у которой сосед со стороны +z; центр вставки — (−0.866, 0, 1.5) в её
 * системе, поворот на 180°, ребро edge:0 у конька.
 */
export function triangleRoofFillers(resolved: Resolved): { owner: string; el: ResolvedElement }[] {
  const tris = resolved.elements.filter(e => e.kind === 'roof-triangle' && !e.inverted);
  const out: { owner: string; el: ResolvedElement }[] = [];
  for (const a of tris) {
    const ang = a.rotation * DEG;
    const at = (x: number, z: number): [number, number, number] => [a.position[0] + x * Math.cos(ang) - z * Math.sin(ang), a.position[1], a.position[2] + x * Math.sin(ang) + z * Math.cos(ang)];
    const next = at(0, 3);
    const b = tris.find(t => t !== a && t.grade === a.grade && near(t.position, next)
      && Math.abs(((((t.rotation - a.rotation) % 360) + 540) % 360) - 180) < 10);
    if (!b) continue;
    out.push({ owner: a.id, el: { id: `${a.id}~fill`, kind: 'roof-triangle', grade: a.grade, position: at(-TRI_APO, 1.5), rotation: a.rotation + 180, level: a.level, inverted: true } });
  }
  return out;
}

const TRI_APO = 0.866;
