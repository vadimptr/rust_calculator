import type { ResolvedTerrain, TerrainKind } from './types.ts';

interface TerrainInfo {
  cave: [number, number, number];
  entrance: number;
}

export const TERRAIN: Record<TerrainKind, TerrainInfo> = {
  'god-rock': { cave: [-2, 1.5, 2], entrance: 240 },
};

export function caveView(t: ResolvedTerrain, eyeHeight: number, distance = 42): { eye: [number, number, number]; target: [number, number, number] } {
  const info = TERRAIN[t.kind];
  const a = (t.rotation * Math.PI) / 180;
  const [cx, , cz] = info.cave.map(v => v * t.scale);
  const target: [number, number, number] = [t.position[0] + cx * Math.cos(a) - cz * Math.sin(a), eyeHeight, t.position[2] + cx * Math.sin(a) + cz * Math.cos(a)];
  const e = ((info.entrance + t.rotation) * Math.PI) / 180;
  const d = distance * t.scale;
  return { eye: [target[0] + d * Math.cos(e), eyeHeight, target[2] + d * Math.sin(e)], target };
}
