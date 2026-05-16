export interface Preset {
  id: string;
  label: string;
  quantities: Record<string, number>;
}

export const presets: Preset[] = [
  {
    id: 'tri-cell',
    label: 'Шкаф без окна',
    quantities: {
      'wall':                3,
      'triangle-foundation': 1,
      'triangle-floor':      1,
    },
  },
  {
    id: 'tri-cell-window',
    label: 'Шкаф с окном',
    quantities: {
      'wall':                       2,
      'triangle-foundation':        1,
      'triangle-floor':             1,
      'window-frame':               1,
      'strengthened-glass-window':  1,
    },
  },
  {
    id: 'sq-cell',
    label: 'Бункер с крышей',
    quantities: {
      'triangle-foundation': 1,
      'square-foundation':   1,
      'triangle-floor':      1,
      'roof':                1,
      'wall':                5,
    },
  },
];
