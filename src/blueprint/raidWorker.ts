/**
 * Веб-воркер расчёта рейда: симуляция идёт вне главного потока, интерфейс не замирает.
 */
import { KINDS } from './catalog.ts';
import { resolveBlueprint } from './geometry.ts';
import { buildSpaceGraph, spacesValue } from './raid.ts';
import { bestSimulation, METHOD_EXPLOSIVES } from './splash.ts';
import type { RaidSimulation } from './splash.ts';
import type { Blueprint } from './types.ts';

export interface RaidRequest { id: number; blueprint: Blueprint; method: keyof typeof METHOD_EXPLOSIVES }
export interface RaidResponse { id: number; sim: RaidSimulation | null; value: number; targetPos: [number, number, number] | null; ms: number }

self.onmessage = (e: MessageEvent<RaidRequest>) => {
  const { id, blueprint, method } = e.data;
  const t0 = performance.now();
  const { resolved } = resolveBlueprint(blueprint);
  const tc = resolved.deployables.find(d => d.kind === 'tool-cupboard');
  const targetCell = tc?.parent ?? resolved.elements.find(el => KINDS[el.kind].isFoundation)?.id;
  if (!targetCell) { (self as unknown as Worker).postMessage({ id, sim: null, value: 0, targetPos: null, ms: 0 } satisfies RaidResponse); return; }
  const targetPos = tc?.position ?? resolved.elements.find(el => el.id === targetCell)!.position;
  const graph = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, graph, targetCell, METHOD_EXPLOSIVES[method]);
  const value = sim ? spacesValue(graph, sim.openedIds, resolved) : 0;
  (self as unknown as Worker).postMessage({ id, sim, value, targetPos, ms: performance.now() - t0 } satisfies RaidResponse);
};
