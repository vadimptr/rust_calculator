import sealedTriangle from '../../docs/blueprint/examples/sealed-triangle-tc.json';
import starter2x1 from '../../docs/blueprint/examples/starter-2x1.json';
import house2x2 from '../../docs/blueprint/examples/house-2x2.json';

export interface BlueprintPreset {
  id: string;
  label: string;
  data: unknown;
}

/** Предзагруженные чертежи. Источник — docs/blueprint/examples. */
export const BLUEPRINT_PRESETS: BlueprintPreset[] = [
  { id: 'starter-2x1', label: 'Дом 2×1 с аирлоком', data: starter2x1 },
  { id: 'house-2x2', label: 'Дом 2×2', data: house2x2 },
  { id: 'sealed-triangle-tc', label: 'Шкаф в треугольном бункере', data: sealedTriangle },
];
