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
