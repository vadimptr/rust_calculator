export interface Preset {
  id: string;
  label: string;
  icon: string;
  quantities: Record<string, number>;
}

export const presets: Preset[] = [
  {
    id: 'tri-cell',
    label: 'Треугольная ячейка',
    icon: '△',
    quantities: {
      'wall':                3,
      'triangle-foundation': 1,
      'triangle-floor':      1,
    },
  },
  {
    id: 'tri-cell-window',
    label: 'Треугольная ячейка с окном',
    icon: '▲',
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
    label: 'Квадратная секция',
    icon: '⬜',
    quantities: {
      'triangle-foundation': 1,
      'square-foundation':   1,
      'triangle-floor':      1,
      'roof':                1,
      'wall':                5,
    },
  },
];
