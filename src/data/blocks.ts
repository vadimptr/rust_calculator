import { BuildingBlock } from '../types';

export const blocks: BuildingBlock[] = [
  {
    id: 'triangle-foundation',
    name: 'Triangle Foundation',
    category: 'foundation',
    buildCost:  { straw: 25,  wood: 100, stone: 150, metal: 100, hqm: 13 },
    upkeepCost: { stone: 15,  metal: 10, straw: 3,   wood: 10,   hqm: 1  },
  },
  {
    id: 'square-foundation',
    name: 'Square Foundation',
    category: 'foundation',
    buildCost:  { straw: 50,  wood: 200, stone: 300, metal: 200, hqm: 25 },
    upkeepCost: { stone: 30,  metal: 20, straw: 5,   wood: 20,   hqm: 3  },
  },
  {
    id: 'square-floor',
    name: 'Square Floor',
    category: 'floor',
    buildCost:  { straw: 25,  wood: 100, stone: 150, metal: 100, hqm: 13 },
    upkeepCost: { stone: 15,  metal: 10, straw: 3,   wood: 10,   hqm: 1  },
  },
  {
    id: 'triangle-floor',
    name: 'Triangle Floor',
    category: 'floor',
    buildCost:  { straw: 13,  wood: 50,  stone: 75,  metal: 50,  hqm: 7  },
    upkeepCost: { stone: 8,   metal: 5,  straw: 1,   wood: 5,    hqm: 1  },
  },
  {
    id: 'doorway',
    name: 'Doorway',
    category: 'opening',
    buildCost:  { straw: 35,  wood: 140, stone: 210, metal: 140, hqm: 18 },
    upkeepCost: { stone: 21,  metal: 14, straw: 4,   wood: 14,   hqm: 2  },
  },
  {
    id: 'half-wall',
    name: 'Half Wall',
    category: 'wall',
    buildCost:  { straw: 50,  wood: 200, stone: 300, metal: 200, hqm: 25 },
    upkeepCost: { stone: 30,  metal: 20, straw: 5,   wood: 20,   hqm: 3  },
  },
  {
    id: 'wall',
    name: 'Wall',
    category: 'wall',
    buildCost:  { straw: 50,  wood: 200, stone: 300, metal: 200, hqm: 25 },
    upkeepCost: { stone: 30,  metal: 20, straw: 5,   wood: 20,   hqm: 3  },
  },
  {
    id: 'wall-frame',
    name: 'Wall Frame',
    category: 'wall',
    buildCost:  { straw: 25,  wood: 100, stone: 150, metal: 100, hqm: 13 },
    upkeepCost: { stone: 15,  metal: 10, straw: 3,   wood: 10,   hqm: 1  },
  },
  {
    id: 'window-frame',
    name: 'Window Frame',
    category: 'opening',
    buildCost:  { straw: 35,  wood: 140, stone: 210, metal: 140, hqm: 18 },
    upkeepCost: { stone: 21,  metal: 14, straw: 4,   wood: 14,   hqm: 2  },
  },
  {
    id: 'strengthened-glass-window',
    name: 'Strengthened Glass Window',
    category: 'window',
    buildCost:  { straw: 0,   wood: 0,   stone: 0,   metal: 50,  hqm: 0  },
    upkeepCost: { straw: 0,   wood: 0,   stone: 0,   metal: 5,   hqm: 0  },
  },
  {
    id: 'stairs-l-shape',
    name: 'Stairs L Shape',
    category: 'stairs',
    buildCost:  { straw: 50,  wood: 200, stone: 300, metal: 200, hqm: 25 },
    upkeepCost: { stone: 30,  metal: 20, straw: 5,   wood: 20,   hqm: 3  },
  },
  {
    id: 'u-shaped-stairs',
    name: 'U Shaped Stairs',
    category: 'stairs',
    buildCost:  { straw: 50,  wood: 200, stone: 300, metal: 200, hqm: 25 },
    upkeepCost: { stone: 30,  metal: 20, straw: 5,   wood: 20,   hqm: 3  },
  },
  {
    id: 'roof',
    name: 'Roof',
    category: 'roof',
    buildCost:  { straw: 25,  wood: 100, stone: 150, metal: 100, hqm: 13 },
    upkeepCost: { stone: 15,  metal: 10, straw: 3,   wood: 10,   hqm: 1  },
  },
  {
    id: 'roof-triangle',
    name: 'Roof Triangle',
    category: 'roof',
    buildCost:  { straw: 25,  wood: 100, stone: 150, metal: 100, hqm: 13 },
    upkeepCost: { stone: 15,  metal: 10, straw: 3,   wood: 10,   hqm: 1  },
  },
];

export const UPKEEP_DAYS = [1, 3, 5, 7, 10, 12, 15, 20, 25, 30] as const;

export const CATEGORY_LABELS: Record<BuildingBlock['category'], string> = {
  foundation: 'Фундамент',
  floor:      'Пол',
  wall:       'Стена',
  opening:    'Проём',
  window:     'Окно',
  stairs:     'Лестница',
  roof:       'Крыша',
};
