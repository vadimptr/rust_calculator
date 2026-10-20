import sealedTriangle from '../../docs/blueprint/examples/sealed-triangle-tc.json';
import starter2x1 from '../../docs/blueprint/examples/starter-2x1.json';
import house2x2 from '../../docs/blueprint/examples/house-2x2.json';
import triangleWindow from '../../docs/blueprint/examples/triangle-tc-window.json';
import bunker30 from '../../docs/blueprint/examples/bunker-30-rockets.json';
import roofBunker from '../../docs/blueprint/examples/roof-bunker.json';
import honeycomb2x2 from '../../docs/blueprint/examples/honeycomb-2x2.json';

export interface BlueprintPreset {
  id: string;
  label: string;
  data: unknown;
}

/** Предзагруженные чертежи. Источник — docs/blueprint/examples. */
export const BLUEPRINT_PRESETS: BlueprintPreset[] = [
  // пустой участок: первый поставленный фундамент станет корнем постройки
  { id: 'empty', label: 'Пустой участок', data: null },
  { id: 'starter-2x1', label: 'Дом 2×1 с аирлоком', data: starter2x1 },
  { id: 'house-2x2', label: 'Дом 2×2 с запрыгом', data: house2x2 },
  { id: 'sealed-triangle-tc', label: 'Шкаф в треугольном бункере', data: sealedTriangle },
  { id: 'triangle-tc-window', label: 'Шкаф в треугольнике с окном', data: triangleWindow },
  { id: 'bunker-30-rockets', label: 'Бункер на 30 ракет', data: bunker30 },
  { id: 'roof-bunker', label: 'Роф-бункер', data: roofBunker },
  { id: 'honeycomb-2x2', label: 'Хонейкомб 2×2 (гайд)', data: honeycomb2x2 },
];
