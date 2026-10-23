import type { ResolvedTerrain, TerrainKind } from './types.ts';

interface TerrainInfo {
  label: string;
  ground: boolean;
  offset: { min: number; max: number; step: number; nudge: number };
  hint: string;
  cave?: { center: [number, number, number]; entrance: number };
}

export const TERRAIN: Record<TerrainKind, TerrainInfo> = {
  'god-rock': {
    label: 'Скала',
    ground: true,
    offset: { min: -8, max: 4, step: 0.05, nudge: 0.5 },
    hint: 'Рельеф под скалой в игре бывает разным: подними или опусти её, чтобы пол полости встал как на твоём сервере.',
    cave: { center: [-2, 1.5, 2], entrance: 240 },
  },
  'hot-air-balloon': {
    label: 'Воздушный шар',
    ground: false,
    offset: { min: 0, max: 150, step: 0.5, nudge: 5 },
    hint: 'Высота — от дна корзины, её в модели нет: купол начинается на 4.9 м выше и заканчивается на 22.7 м.',
  },
};

export function groundTerrain(terrain: { kind: TerrainKind }[] | undefined): boolean {
  return !!terrain?.some(t => TERRAIN[t.kind].ground);
}

export function caveView(t: ResolvedTerrain, eyeHeight: number, distance = 42): { eye: [number, number, number]; target: [number, number, number] } | null {
  const info = TERRAIN[t.kind].cave;
  if (!info) return null;
  const a = (t.rotation * Math.PI) / 180;
  const [cx, , cz] = info.center.map(v => v * t.scale);
  const target: [number, number, number] = [t.position[0] + cx * Math.cos(a) - cz * Math.sin(a), eyeHeight, t.position[2] + cx * Math.sin(a) + cz * Math.cos(a)];
  const e = ((info.entrance + t.rotation) * Math.PI) / 180;
  const d = distance * t.scale;
  return { eye: [target[0] + d * Math.cos(e), eyeHeight, target[2] + d * Math.sin(e)], target };
}
