export interface Resources {
  straw: number;
  wood: number;
  stone: number;
  metal: number;
  hqm: number;
}

export interface BuildingBlock {
  id: string;
  name: string;
  category: 'foundation' | 'floor' | 'wall' | 'opening' | 'roof' | 'stairs' | 'window';
  buildCost: Resources;
  upkeepCost: Resources;
}

export type Quantities = Record<string, number>;
