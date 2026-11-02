import type { DeployableKind } from './types.ts';

export type SlotType = 'power' | 'fluid';

export interface IOSlot {
  name: string;
  type: SlotType;
  pos: [number, number, number];
}

export interface IOInfo {
  inputs: IOSlot[];
  outputs: IOSlot[];
}

export const IO: Partial<Record<DeployableKind, IOInfo>> = {
  'sprinkler': { inputs: [{ name: 'Water In', type: 'fluid', pos: [0, 0.09, -0.25] }], outputs: [{ name: 'Passthrough', type: 'fluid', pos: [0, 0.09, 0.25] }] },
  'ceiling-light': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0, -0.03] }], outputs: [{ name: 'Passthrough', type: 'power', pos: [0, 0, 0.03] }] },
  'electric-heater': { inputs: [{ name: 'Power In', type: 'power', pos: [0.14, -0.07, -0.35] }], outputs: [{ name: 'Passthrough', type: 'power', pos: [0.14, -0.07, 0.35] }] },
  'water-pump': { inputs: [{ name: 'Power In', type: 'power', pos: [0.09, 0.65, -0.09] }], outputs: [{ name: 'Water Output', type: 'fluid', pos: [0, 0.74, 0.09] }] },
  'water-purifier': { inputs: [{ name: 'Water In', type: 'fluid', pos: [-0.03, 1.04, 0.08] }], outputs: [{ name: 'Water Out', type: 'fluid', pos: [0.33, 0.22, -0.62] }] },
  'powered-water-purifier': { inputs: [{ name: 'Water In', type: 'fluid', pos: [0.5, 1.08, -0.83] }, { name: 'Power In', type: 'power', pos: [0.02, 0.45, -1.14] }], outputs: [{ name: 'Water Out', type: 'fluid', pos: [0.69, 0.15, 0.65] }] },
  'small-water-catcher': { inputs: [{ name: 'Water In', type: 'fluid', pos: [0, 0.6, -0.4] }], outputs: [{ name: 'Water Out', type: 'fluid', pos: [0.59, 0.29, 0] }] },
  'large-water-catcher': { inputs: [{ name: 'Water In', type: 'fluid', pos: [0, 0.8, -0.86] }], outputs: [{ name: 'Water Out', type: 'fluid', pos: [1.03, 0.75, 0] }] },
  'fluid-splitter': { inputs: [{ name: 'Water In', type: 'fluid', pos: [0.03, 0.18, 0] }], outputs: [{ name: 'Water Out 1', type: 'fluid', pos: [0.03, 0, -0.15] }, { name: 'Water Out 2', type: 'fluid', pos: [0.03, 0, 0] }, { name: 'Water Out 3', type: 'fluid', pos: [0.03, 0, 0.15] }] },
  'fluid-combiner': { inputs: [{ name: 'Water In 1', type: 'fluid', pos: [0.03, 0.18, -0.15] }, { name: 'Water In 2', type: 'fluid', pos: [0.03, 0.18, 0] }, { name: 'Water In 3', type: 'fluid', pos: [0.03, 0.18, 0.15] }], outputs: [{ name: 'Water Out', type: 'fluid', pos: [0.03, 0, 0] }] },
  'fluid-switch': { inputs: [{ name: 'Fluid Input', type: 'fluid', pos: [0, 0, -0.07] }, { name: 'Toggle', type: 'power', pos: [0.03, 0.2, -0.04] }, { name: 'Pump Power', type: 'power', pos: [0, 0.2, -0.09] }], outputs: [{ name: 'Fluid Output', type: 'fluid', pos: [0, 0, 0.09] }] },
  'wind-turbine': { inputs: [], outputs: [{ name: 'Power Out', type: 'power', pos: [0, 0.35, 0.12] }] },
  'large-battery': { inputs: [{ name: 'Power In', type: 'power', pos: [0.67, 0.96, -0.18] }], outputs: [{ name: 'Power Output', type: 'power', pos: [0.67, 0.96, 0.18] }, { name: 'Fully Charged', type: 'power', pos: [0.67, 1.11, -0.31] }] },
  'splitter': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, 0.32, 0] }], outputs: [{ name: 'Power Out 1', type: 'power', pos: [0.03, -0.32, -0.11] }, { name: 'Power Out 2', type: 'power', pos: [0.03, -0.32, 0] }, { name: 'Power Out 3', type: 'power', pos: [0.03, -0.32, 0.11] }] },
  'root-combiner': { inputs: [{ name: 'Root Power 1', type: 'power', pos: [0.03, -0.12, -0.05] }, { name: 'Root Power 2', type: 'power', pos: [0.03, -0.12, 0.05] }], outputs: [{ name: 'Combined Power Out', type: 'power', pos: [0.03, 0.13, 0] }] },
  'branch': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.12, 0] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.13, 0.03] }, { name: 'Branch Out', type: 'power', pos: [0.03, 0.13, -0.03] }] },
  'blocker': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.12, 0] }, { name: 'Block Passthrough', type: 'power', pos: [0.03, 0, -0.08] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.13, 0] }] },
  'switch': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.22, 0] }, { name: 'Switch On', type: 'power', pos: [0.03, 0.07, 0.16] }, { name: 'Switch Off', type: 'power', pos: [0.03, -0.09, 0.16] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.2, 0] }] },
  'smart-switch': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.22, 0] }, { name: 'Switch On', type: 'power', pos: [0.03, 0.07, 0.16] }, { name: 'Switch Off', type: 'power', pos: [0.03, -0.09, 0.16] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.2, 0] }] },
  'button': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.12, 0] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.16, 0] }] },
  'timer': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.25, 0] }, { name: 'Toggle On', type: 'power', pos: [0.03, -0.01, 0.16] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.24, 0] }] },
  'and-switch': { inputs: [{ name: 'Input A', type: 'power', pos: [0.03, -0.23, -0.03] }, { name: 'Input B', type: 'power', pos: [0.03, -0.23, 0.03] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.24, 0] }] },
  'or-switch': { inputs: [{ name: 'Input A', type: 'power', pos: [0.03, -0.23, -0.03] }, { name: 'Input B', type: 'power', pos: [0.03, -0.23, 0.03] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.24, 0] }] },
  'xor-switch': { inputs: [{ name: 'Input A', type: 'power', pos: [0.03, -0.24, -0.03] }, { name: 'Input B', type: 'power', pos: [0.03, -0.24, 0.03] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.24, 0] }] },
  'counter': { inputs: [{ name: 'Power In', type: 'power', pos: [0.02, 0, 0] }, { name: 'Increment Counter', type: 'power', pos: [0.02, 0.15, 0.09] }, { name: 'Decrement Counter', type: 'power', pos: [0.02, 0.09, 0.09] }, { name: 'Reset Counter', type: 'power', pos: [0.02, 0.03, 0.09] }], outputs: [{ name: 'Passthrough', type: 'power', pos: [0.02, 0.18, 0] }] },
  'memory-cell': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.12, 0] }, { name: 'Set', type: 'power', pos: [0.03, 0.07, 0.07] }, { name: 'Reset', type: 'power', pos: [0.03, 0, 0.07] }, { name: 'Toggle', type: 'power', pos: [0.03, -0.07, 0.07] }], outputs: [{ name: 'Output', type: 'power', pos: [0.03, 0.13, 0.03] }, { name: 'Inverted Output', type: 'power', pos: [0.03, 0.13, -0.03] }] },
  'random-switch': { inputs: [{ name: 'Power In', type: 'power', pos: [0.03, -0.12, 0] }, { name: 'Set', type: 'power', pos: [0.03, 0.04, 0.07] }, { name: 'Reset', type: 'power', pos: [0.03, -0.04, 0.07] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.03, 0.13, 0] }] },
  'pressure-pad': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0, -0.49] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0, 0, 0.49] }] },
  'hbhf-sensor': { inputs: [{ name: 'Power In', type: 'power', pos: [0.1, 0, -0.08] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.1, 0, 0.08] }] },
  'simple-light': { inputs: [{ name: 'Power In', type: 'power', pos: [0.02, 0, -0.14] }], outputs: [{ name: 'Passthrough', type: 'power', pos: [0.02, 0, 0.14] }] },
  'flasher-light': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0.03, -0.06] }], outputs: [{ name: 'Passthrough', type: 'power', pos: [0, 0.03, 0.06] }] },
  'siren-light': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0.03, -0.11] }], outputs: [{ name: 'Passthrough', type: 'power', pos: [0, 0.03, 0.11] }] },
  'auto-turret': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0.59, 0.12] }], outputs: [{ name: 'Has Target', type: 'power', pos: [0.06, 0.59, -0.12] }, { name: 'Low Ammo', type: 'power', pos: [0, 0.59, -0.12] }, { name: 'No Ammo', type: 'power', pos: [-0.06, 0.59, -0.12] }] },
  'sam-site': { inputs: [{ name: 'Power In', type: 'power', pos: [-0.98, 0.58, 0] }, { name: 'Invert Mode', type: 'power', pos: [0, 0.58, 0.97] }], outputs: [{ name: 'Has Target', type: 'power', pos: [-0.16, 0.58, -0.95] }, { name: 'Low Ammo', type: 'power', pos: [0, 0.58, -0.95] }, { name: 'No Ammo', type: 'power', pos: [0.16, 0.58, -0.95] }, { name: 'Passthrough', type: 'power', pos: [0, 0.42, -0.95] }] },
  'tesla-coil': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0.03, 0] }], outputs: [] },
  'igniter': { inputs: [{ name: 'Power In', type: 'power', pos: [0, 0.05, -0.15] }], outputs: [] },
  'electric-furnace': { inputs: [{ name: 'Power In', type: 'power', pos: [-0.21, 1.05, 0.31] }], outputs: [] },
  'water-barrel': { inputs: [{ name: 'Water In', type: 'fluid', pos: [0, 2.03, -0.01] }], outputs: [{ name: 'Water Out', type: 'fluid', pos: [0.53, 1.1, 0] }] },
  'small-generator': { inputs: [{ name: 'Force Start', type: 'power', pos: [0.2, 0.32, 0.22] }, { name: 'Force Stop', type: 'power', pos: [0.1, 0.32, 0.22] }], outputs: [{ name: 'Power Out', type: 'power', pos: [0.01, 0.32, 0.22] }] },
  'small-battery': { inputs: [{ name: 'Power In', type: 'power', pos: [0.17, 0.32, 0.06] }], outputs: [{ name: 'Power Output', type: 'power', pos: [-0.17, 0.32, 0.06] }, { name: 'Fully Charged', type: 'power', pos: [0.22, 0.15, 0.06] }] },
  'medium-battery': { inputs: [{ name: 'Power In', type: 'power', pos: [0.31, 0.73, 0.16] }], outputs: [{ name: 'Power Output', type: 'power', pos: [0.34, 0.73, 0.27] }, { name: 'Fully Charged', type: 'power', pos: [0.28, 0.84, 0.11] }] },
  'large-solar-panel': { inputs: [], outputs: [{ name: 'Electric Output', type: 'power', pos: [0.97, 0, -0.18] }] },
};
