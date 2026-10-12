import sealedTriangle from '../../docs/blueprint/examples/sealed-triangle-tc.json';
import starter2x1 from '../../docs/blueprint/examples/starter-2x1.json';
import house2x2 from '../../docs/blueprint/examples/house-2x2.json';
import triangleWindow from '../../docs/blueprint/examples/triangle-tc-window.json';
import housePeeks from '../../docs/blueprint/examples/house-peeks.json';

export interface BlueprintPreset {
  id: string;
  label: string;
  data: unknown;
}

/** Предзагруженные чертежи. Источник — docs/blueprint/examples. */
export const BLUEPRINT_PRESETS: BlueprintPreset[] = [
  { id: 'starter-2x1', label: 'Дом 2×1 с аирлоком', data: starter2x1 },
  { id: 'house-2x2', label: 'Дом 2×2 с запрыгом', data: house2x2 },
  { id: 'sealed-triangle-tc', label: 'Шкаф в треугольном бункере', data: sealedTriangle },
  { id: 'triangle-tc-window', label: 'Шкаф в треугольнике с окном', data: triangleWindow },
  { id: 'house-peeks', label: 'Дом с отстрелами', data: housePeeks },
];
