/**
 * Типы документа чертежа базы. Зеркало docs/blueprint/schema/blueprint.schema.json.
 */

export type Grade = 'twig' | 'wood' | 'stone' | 'metal' | 'armored';

export type ElementKind =
  | 'square-foundation'
  | 'triangle-foundation'
  | 'wall'
  | 'half-wall'
  | 'low-wall'
  | 'doorway'
  | 'window-frame'
  | 'wall-frame'
  | 'square-floor'
  | 'triangle-floor'
  | 'floor-frame'
  | 'triangle-floor-frame'
  | 'stairs-l-shape'
  | 'u-shaped-stairs'
  | 'spiral-stairs'
  | 'roof'
  | 'roof-triangle'
  | 'ramp'
  | 'foundation-steps';

export type DeployableKind =
  | 'tool-cupboard'
  | 'wooden-door'
  | 'sheet-metal-door'
  | 'armored-door'
  | 'garage-door'
  | 'wooden-double-door'
  | 'sheet-metal-double-door'
  | 'armored-double-door'
  | 'strengthened-glass-window'
  | 'reinforced-glass-window'
  | 'metal-window-bars'
  | 'metal-embrasure'
  | 'drop-box';

export type TerrainKind = 'god-rock';

export type Socket = `edge:${0 | 1 | 2 | 3}` | 'top' | 'bottom' | 'opening' | 'face' | 'offset';

export interface Attach {
  to: string;
  socket: Socket;
  selfSocket?: Socket;
  flip?: boolean;
  turns?: 0 | 1 | 2 | 3;
  /** Только фундамент к фундаменту: сдвиг по высоте в метрах (ряды сокетов foundation-top/mid/bot в игре). */
  rise?: -3 | -1.5 | 0 | 0.75 | 1.5 | 3;
  /** Только socket 'offset': положение и поворот в системе элемента `to` — блок, оставшийся без сокета-опоры (например, после сноса соседа). */
  offset?: [number, number, number];
  rotation?: number;
}

export interface Element {
  id: string;
  kind: ElementKind;
  grade?: Grade;
  position: [number, number, number];
  rotation: number;
  inverted?: boolean;
  /** Крыша-затвор роф-бункера: хозяин убирает её, ломая опору. Только для крыш. */
  bunker?: boolean;
  label?: string;
  notes?: string;
}

export interface LegacyElement {
  id: string;
  kind: ElementKind;
  grade?: Grade;
  root?: true;
  origin?: { position: [number, number, number]; rotation: number };
  attach?: Attach;
  bunker?: boolean;
  label?: string;
  notes?: string;
}

export interface Deployable {
  id: string;
  kind: DeployableKind;
  attach: { to: string; socket: 'top' | 'opening' | 'face' };
  /** Шкаф: [x, z] от центра ячейки; дроп-бокс: [вдоль стены, высота]. */
  offset?: [number, number];
  /** Дроп-бокс: out — изнутри наружу (по нормали стены), in — снаружи внутрь. */
  direction?: 'in' | 'out';
  rotation?: number;
  hinge?: 'left' | 'right';
  opens?: 'outward' | 'inward';
  open?: boolean;
  label?: string;
  notes?: string;
}

export interface Terrain {
  id: string;
  kind: TerrainKind;
  position: [number, number, number];
  rotation: number;
  scale?: number;
  label?: string;
  notes?: string;
}

export interface Blueprint {
  $schema?: string;
  formatVersion: '2.0';
  meta: {
    name: string;
    description?: string;
    author?: string;
    createdAt?: string;
    gameVersion?: string;
    tags?: string[];
  };
  defaults?: { grade?: Grade };
  elements: Element[];
  deployables?: Deployable[];
  terrain?: Terrain[];
  resolved?: unknown;
}

export interface LegacyBlueprint extends Omit<Blueprint, 'formatVersion' | 'elements'> {
  formatVersion: '1.0';
  elements: LegacyElement[];
}

/** Мировое положение элемента. position = [x, y, z], rotation — угол в плане (§4.1). */
export interface Transform {
  position: [number, number, number];
  rotation: number;
  level: number;
  /** Только треугольная крыша: перевёрнута (см. ResolvedElement.inverted). */
  inverted?: boolean;
}

export interface ResolvedElement extends Transform {
  id: string;
  kind: ElementKind;
  grade: Grade;
  bunker?: boolean;
  /** Треугольная крыша перевёрнута: ребро edge:0 у конька, вершина у края (заполняет просвет между соседними). */
  inverted?: boolean;
}

export interface ResolvedDeployable extends Transform {
  id: string;
  kind: DeployableKind;
  /** id элемента, к которому объект прикреплён. */
  parent: string;
  hinge: 'left' | 'right';
  opens: 'outward' | 'inward';
  open: boolean;
  direction?: 'in' | 'out';
}

export interface ResolvedTerrain {
  id: string;
  kind: TerrainKind;
  position: [number, number, number];
  rotation: number;
  scale: number;
}

export interface Resolved {
  elements: ResolvedElement[];
  deployables: ResolvedDeployable[];
  terrain?: ResolvedTerrain[];
}

export interface Issue {
  code: string;
  level: 'error' | 'warning';
  id?: string;
  message: string;
}
