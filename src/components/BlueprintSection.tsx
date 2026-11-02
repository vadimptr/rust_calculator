import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Viewer3D from './Viewer3D';
import GradeDialog from './GradeDialog';
import type { CameraMode, EditorState, EditorTool, RadialItem } from './Viewer3D';
import { ApiError, createScheme, emptyScheme, getScheme, listSchemes, saveScheme } from '../blueprint/schemesApi.ts';
import type { SceneKind, SchemeSummary } from '../blueprint/schemesApi.ts';
import { BOAT_BLOCKS, BOAT_DEPLOY_PLAN, BOAT_PLAN, BOAT_RES_KEYS, DECAY_HOURS, DECAY_START_HOURS, DECK, DECK_GROUPS, DRAG_MAX, DRAG_MAX_WIDTH, DRAG_MIN, DRAG_MIN_WIDTH, HOUSE_DEPLOY_GROUPS, objectCost, ENGINE_FUEL_PER_SEC, ENGINE_LEVER, ENGINE_THRUST, MAX_BLOCKS, MIN_MASS, SAIL_LEVER, SAIL_THRUST, SHALLOW_FACTOR, STATION_COST, VELOCITY_MAX, boatStats, describeBlock, isBoatScheme } from '../blueprint/boat.ts';
import type { BoatResKey, Run, Yaw } from '../blueprint/boat.ts';
import { record, redo, startHistory, undo } from '../blueprint/history.ts';
import type { History } from '../blueprint/history.ts';
import { loadBlueprint } from '../blueprint/validate.ts';
import type { LoadResult } from '../blueprint/validate.ts';
import { GROUND_Y, KINDS } from '../blueprint/catalog.ts';
import { TERRAIN } from '../blueprint/terrain.ts';
import { RESOURCE_KEYS, costOf } from '../blueprint/cost.ts';
import { IO } from '../blueprint/io.ts';
import { simulate } from '../blueprint/iosim.ts';
import IOPanel from './IOPanel';
import type { ResourceKey } from '../blueprint/cost.ts';
import { BUILD_PLAN, DEPLOY_PLAN, addDeployable, addElement, addElementAt, addWire, removeWire, regradeElements, regradeTargets, removeDeployable, removeElement, rotateElement, settle, upgradeElement } from '../blueprint/editor.ts';
import type { Regrade } from '../blueprint/editor.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, ElementKind, Grade, Transform, Wire } from '../blueprint/types.ts';

import type { RaidView } from '../blueprint/raidOverlay.ts';
import type { RaidSimulation } from '../blueprint/splash.ts';
import type { RaidRequest, RaidResponse } from '../blueprint/raidWorker.ts';
import { EXPLOSIVE_SHORT_LABELS } from '../data/raidData.ts';
import type { RaidMethod } from '../types';
import { formatNum } from './ResourceRow';

const RAID_METHODS: { id: RaidMethod; label: string }[] = [
  { id: 'optimal', label: 'Оптимально' },
  { id: 'c4', label: 'C4' },
  { id: 'rocket', label: 'Ракеты' },
  { id: 'satchel', label: 'Сачели' },
  { id: 'explosiveAmmo', label: 'Ammo' },
];


const KIND_LABELS: Record<string, string> = {
  'square-foundation': 'Фундамент',
  'triangle-foundation': 'Треугольный фундамент',
  'wall': 'Стена',
  'half-wall': 'Половинная стена',
  'low-wall': 'Низкая стена',
  'doorway': 'Дверной проём',
  'window-frame': 'Оконный проём',
  'wall-frame': 'Рама стены',
  'square-floor': 'Пол',
  'triangle-floor': 'Треугольный пол',
  'floor-frame': 'Рама пола',
  'triangle-floor-frame': 'Треугольная рама пола',
  'stairs-l-shape': 'Лестница L',
  'u-shaped-stairs': 'Лестница U',
  'spiral-stairs': 'Винтовая лестница',
  'spiral-stairs-triangle': 'Треугольная винтовая лестница',
  'roof': 'Крыша',
  'roof-triangle': 'Треугольная крыша',
  'ramp': 'Съезд',
  'foundation-steps': 'Ступени фундамента',
  'tool-cupboard': 'Шкаф',
  'wooden-door': 'Деревянная дверь',
  'sheet-metal-door': 'Металлическая дверь',
  'armored-door': 'Бронированная дверь',
  'garage-door': 'Гаражная дверь',
  'wooden-double-door': 'Двойная деревянная дверь',
  'sheet-metal-double-door': 'Двойная металлическая дверь',
  'armored-double-door': 'Двойная бронированная дверь',
  'strengthened-glass-window': 'Укреплённое стекло',
  'reinforced-glass-window': 'Усиленное стекло',
  'metal-window-bars': 'Металлическая решётка',
  'metal-embrasure': 'Металлическая амбразура',
  'drop-box': 'Дроп-бокс',
  'boat-hull': 'Корпус',
  'boat-hull-triangle': 'Треугольный корпус',
  'boat-floor': 'Пол',
  'boat-floor-triangle': 'Треугольный пол',
  'boat-floor-frame': 'Рама пола',
  'boat-floor-frame-triangle': 'Треугольная рама пола',
  'boat-wall': 'Стена',
  'boat-doorway': 'Дверной проём',
  'boat-window': 'Оконный проём',
  'boat-low-wall': 'Низкая стена',
  'boat-low-wall-barrier': 'Низкая стена с ограждением',
  'boat-low-wall-cannon': 'Низкая стена с портом для пушки',
  'boat-stairs': 'Лестница',
  'sail': 'Парус',
  'small-engine': 'Лодочный мотор',
  'steering-wheel': 'Штурвал',
  'cannon': 'Пушка',
  'anchor': 'Якорь',
  'plank': 'Доска',
  'small-ramp': 'Трап',
};

const GRADE_TITLES: Record<Grade, string> = {
  twig: 'Солома', wood: 'Дерево', stone: 'Камень', metal: 'Металл', armored: 'МВК',
};

const GRADE_LABELS: Record<string, string> = {
  twig: 'солома', wood: 'дерево', stone: 'камень', metal: 'металл', armored: 'броня',
};

/** Короткие подписи для кольца радиального меню. */
const SHORT_LABELS: Record<string, string> = {
  'square-foundation': 'Фундамент', 'triangle-foundation': 'Тр. фунд.', 'foundation-steps': 'Ступени', 'ramp': 'Съезд',
  'wall': 'Стена', 'half-wall': 'Полустена', 'low-wall': 'Низкая', 'doorway': 'Проём', 'window-frame': 'Окно', 'wall-frame': 'Рама',
  'square-floor': 'Пол', 'triangle-floor': 'Тр. пол', 'floor-frame': 'Рама пола', 'triangle-floor-frame': 'Тр. рама',
  'stairs-l-shape': 'Лестн. L', 'u-shaped-stairs': 'Лестн. U', 'spiral-stairs': 'Винтовая', 'spiral-stairs-triangle': 'Тр. винтовая', 'roof': 'Крыша', 'roof-triangle': 'Тр. крыша',
  'wooden-door': 'Дер. дверь', 'sheet-metal-door': 'Мет. дверь', 'armored-door': 'МВК дверь',
  'wooden-double-door': 'Дер. двойная', 'sheet-metal-double-door': 'Мет. двойная', 'armored-double-door': 'МВК двойная', 'garage-door': 'Гаражная',
  'strengthened-glass-window': 'Стекло', 'reinforced-glass-window': 'Ус. стекло', 'metal-window-bars': 'Решётка', 'metal-embrasure': 'Амбразура',
  'tool-cupboard': 'Шкаф', 'drop-box': 'Дроп-бокс',
  'boat-hull': 'Корпус', 'boat-hull-triangle': 'Тр. корпус', 'boat-floor': 'Пол', 'boat-floor-triangle': 'Тр. пол', 'boat-floor-frame': 'Рама пола', 'boat-floor-frame-triangle': 'Тр. рама',
  'boat-wall': 'Стена', 'boat-doorway': 'Проём', 'boat-window': 'Окно', 'boat-low-wall': 'Низкая', 'boat-low-wall-barrier': 'Ограждение', 'boat-low-wall-cannon': 'Порт', 'boat-stairs': 'Лестница',
  'sail': 'Парус', 'small-engine': 'Мотор', 'steering-wheel': 'Штурвал', 'cannon': 'Пушка', 'anchor': 'Якорь', 'plank': 'Доска', 'small-ramp': 'Трап',
};

const BUILD_ICONS: Record<ElementKind, string> = {
  'square-foundation': 'foundation', 'triangle-foundation': 'foundation.triangle', 'foundation-steps': 'foundation.steps', 'ramp': 'ramp',
  'square-floor': 'floor', 'triangle-floor': 'floor.triangle', 'floor-frame': 'floor.frame', 'triangle-floor-frame': 'floor.triangle.frame',
  'wall': 'wall', 'doorway': 'wall.doorway', 'window-frame': 'wall.window', 'wall-frame': 'wall.frame', 'half-wall': 'wall.half', 'low-wall': 'wall.low',
  'stairs-l-shape': 'stairs_l', 'u-shaped-stairs': 'stairs_u', 'spiral-stairs': 'stairs_spiral', 'spiral-stairs-triangle': 'stairs.triangle.spiral', 'roof': 'roof', 'roof-triangle': 'roof.triangle',
  'boat-hull': 'hull_square', 'boat-hull-triangle': 'hull.triangle', 'boat-floor': 'floor', 'boat-floor-triangle': 'floor.triangle', 'boat-floor-frame': 'floor.frame', 'boat-floor-frame-triangle': 'floor.triangle.frame',
  'boat-wall': 'wall', 'boat-doorway': 'wall.doorway', 'boat-window': 'wall.window', 'boat-low-wall': 'wall.low', 'boat-low-wall-barrier': 'wall.low.barrier', 'boat-low-wall-cannon': 'wall.low.cannon',
  'boat-stairs': 'foundation.steps',
};

const BUILD_DESCRIPTIONS: Record<ElementKind, string> = {
  'square-foundation': 'Каждому дому нужен фундамент', 'triangle-foundation': 'Каждому дому нужен фундамент',
  'foundation-steps': 'Пристраиваются к фундаменту или ставятся на пол: подъём на уровень выше', 'ramp': 'Пандус для техники',
  'square-floor': 'Пол или потолок — смотря где стоишь', 'triangle-floor': 'Пол или потолок — смотря где стоишь',
  'floor-frame': 'Рама, в которую ставятся люки и решётки', 'triangle-floor-frame': 'Треугольная рама для люков и решёток',
  'wall': 'Защити базу, обнеся её стенами', 'doorway': 'Проход в комнату через дверь',
  'window-frame': 'Проём в стене для оконных решёток и стекла', 'wall-frame': 'Рама для гаражной и двойных дверей',
  'half-wall': 'Половина высоты обычной стены', 'low-wall': 'Треть высоты обычной стены',
  'stairs-l-shape': 'Лестница буквой Г', 'u-shaped-stairs': 'Лестница буквой П',
  'spiral-stairs': 'Винтовая лестница на половину высоты блока',
  'spiral-stairs-triangle': 'Винтовая лестница в треугольнике, на половину высоты блока', 'roof': 'Шапка для твоего дома', 'roof-triangle': 'Шапка для твоего дома',
  'boat-hull': 'Основа корабля, ставится на воду', 'boat-hull-triangle': 'Основа корабля, клином к носу снижает сопротивление',
  'boat-floor': 'Палуба на верху стен', 'boat-floor-triangle': 'Палуба на верху стен',
  'boat-floor-frame': 'Рама палубы для люков', 'boat-floor-frame-triangle': 'Треугольная рама палубы',
  'boat-wall': 'Борт или переборка', 'boat-doorway': 'Проход в рубку', 'boat-window': 'Стена с окном',
  'boat-low-wall': 'Фальшборт в треть высоты', 'boat-low-wall-barrier': 'Фальшборт с ограждением', 'boat-low-wall-cannon': 'Фальшборт с портом для пушки',
  'boat-stairs': 'Прямая лестница на палубу выше',
};

const DEPLOY_ICONS: Partial<Record<DeployableKind, string>> = {
  'wooden-door': 'door.hinged.wood', 'sheet-metal-door': 'door.hinged.metal', 'armored-door': 'door.hinged.toptier',
  'wooden-double-door': 'door.double.hinged.wood', 'sheet-metal-double-door': 'door.double.hinged.metal', 'armored-double-door': 'door.double.hinged.toptier',
  'garage-door': 'wall.frame.garagedoor', 'strengthened-glass-window': 'wall.window.glass.reinforced', 'reinforced-glass-window': 'wall.window.bars.toptier',
  'metal-window-bars': 'wall.window.bars.metal', 'metal-embrasure': 'shutter.metal.embrasure.a', 'tool-cupboard': 'cupboard.tool', 'drop-box': 'dropbox',
  ...Object.fromEntries(Object.entries(DECK).map(([k, v]) => [k, v.icon])),
};

for (const [k, v] of Object.entries(DECK)) {
  KIND_LABELS[k] = v.label;
  SHORT_LABELS[k] = v.short;
}

const DEPLOY_DESCRIPTIONS: Partial<Record<DeployableKind, string>> = {
  'sail': `Тяга ${SAIL_THRUST} Н по направлению паруса · на корпус или пол · R — повернуть на 45°`,
  'small-engine': `Тяга ${ENGINE_THRUST} Н, назад вдвое меньше · только на корпус · ${ENGINE_FUEL_PER_SEC} топлива в секунду`,
  'steering-wheel': 'Нужен ровно один: задаёт нос корабля · R — повернуть на 45°',
  'cannon': 'На корпус или пол · R — повернуть на 45°',
  'anchor': 'На внешнее ребро палубы, висит за бортом',
  'plank': 'Сходни на внешнем ребре палубы',
  'small-ramp': 'Трап на внешнем ребре палубы',
};

const blockDesc = (k: ElementKind) => {
  const b = BOAT_BLOCKS[k];
  return b ? `${BUILD_DESCRIPTIONS[k]} · ${b.mass} кг · ${b.health} HP` : BUILD_DESCRIPTIONS[k];
};

/** Радиальные меню: блоки строительного плана, объекты, апгрейд и снос киянкой. */
const RADIAL: Record<EditorTool, RadialItem[]> = {
  build: BUILD_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k], img: `/icons/build/${BUILD_ICONS[k]}.webp`, desc: BUILD_DESCRIPTIONS[k], mono: true })),
  deploy: DEPLOY_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k], img: `/icons/items/${DEPLOY_ICONS[k]}.webp` })),
  hammer: [
    { id: 'twig', label: 'Солома', img: '/icons/grade/straw.webp' }, { id: 'wood', label: 'Дерево' }, { id: 'stone', label: 'Камень' },
    { id: 'metal', label: 'Металл' }, { id: 'armored', label: 'МВК' }, { id: 'rotate', label: 'Повернуть', img: '/icons/grade/rotate.webp', mono: true }, { id: 'remove', label: 'Снести' },
  ],  view: [],
  wire: [],
};

const RADIAL_BOAT: Record<EditorTool, RadialItem[]> = {
  build: BOAT_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k], img: `/icons/build/${BUILD_ICONS[k]}.webp`, desc: blockDesc(k), mono: true })),
  deploy: BOAT_DEPLOY_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k], img: `/icons/items/${DEPLOY_ICONS[k]}.webp`, desc: DEPLOY_DESCRIPTIONS[k] })),
  hammer: [{ id: 'rotate', label: 'Повернуть', img: '/icons/grade/rotate.webp', mono: true }, { id: 'remove', label: 'Снести' }],
  view: [],
  wire: [],
};

const BOAT_RES_ITEMS: Record<BoatResKey, [string, string]> = {
  wood: ['wood', 'Дерево'], stone: ['stones', 'Камень'], lgf: ['lowgradefuel', 'Низкосортное топливо'], metal: ['metal.fragments', 'Металлические фрагменты'],
  hqm: ['metal.refined', 'МВК'], scrap: ['scrap', 'Металлолом'], cloth: ['cloth', 'Ткань'], tarp: ['tarp', 'Брезент'], gears: ['gears', 'Шестерёнки'],
  rope: ['rope', 'Верёвка'], techparts: ['techparts', 'Микросхемы'], sewingkit: ['sewingkit', 'Швейный набор'],
  bpbasic: ['basicblueprintfragment', 'Фрагменты чертежей'], bpadvanced: ['advancedblueprintfragment', 'Продвинутые фрагменты чертежей'],
  propane: ['propanetank', 'Пустой баллон пропана'], sheetmetal: ['sheetmetal', 'Листовой металл'], spring: ['metalspring', 'Металлическая пружина'],
  computer: ['targeting.computer', 'Компьютер наведения'], camera: ['cctv.camera', 'Камера видеонаблюдения'],
};
const BOAT_RES_ICONS = Object.fromEntries(Object.entries(BOAT_RES_ITEMS).map(([k, [icon]]) => [k, `/icons/items/${icon}.webp`])) as Record<BoatResKey, string>;
const BOAT_RES_LABELS = Object.fromEntries(Object.entries(BOAT_RES_ITEMS).map(([k, [, label]]) => [k, label])) as Record<BoatResKey, string>;

const speedText = (v: number) => `${v.toFixed(1)} м/с · ${Math.round(v * 3.6)} км/ч`;

const yawText = (yaw: Yaw) => `${yaw.left ? 'влево' : 'вправо'} · штурвал ${Math.round(yaw.hold * 100)}%`;

const RunRow: React.FC<{ title: string; run: Run | null; mass: number }> = ({ title, run, mass }) => (
  <tr>
    <td className="bp__counts-label">{title}</td>
    <td className="bp__counts-n" data-tip={run ? `Тяга ${formatNum(Math.round(run.force))} Н / ${formatNum(mass)} кг = ${run.accel.toFixed(2)} м/с² · сопротивление ${run.drag.toFixed(2)} (лобовая ширина ${run.width.toFixed(1)} м)${run.offBow > 1 ? ` · ход под ${Math.round(run.offBow)}° к носу` : ''} · ${run.yaw ? `уводит ${yawText(run.yaw)}` : 'идёт прямо'}` : undefined} data-tip-pos="left">
      {run ? speedText(run.speed) : '—'}
    </td>
  </tr>
);


const FOV = { min: 70, max: 90, default: 75, key: 'bp.fov' };

function usePref<T>(key: string, initial: T, valid: (v: unknown) => boolean): [T, (v: T | ((cur: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const v = JSON.parse(raw);
      return valid(v) ? v as T : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((v: T | ((cur: T) => T)) => setValue(cur => {
    const next = typeof v === 'function' ? (v as (c: T) => T)(cur) : v;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { return next; }
    return next;
  }), [key]);
  return [value, set];
}

function savedFov(): number {
  try {
    const v = Number(localStorage.getItem(FOV.key));
    return v >= FOV.min && v <= FOV.max ? v : FOV.default;
  } catch {
    return FOV.default;
  }
}

/** Содержание по дням и иконки ресурсов. */
const UPKEEP_DAYS = [1, 2, 3, 5, 10, 15, 20, 25, 30];
const RES_ICONS: Record<ResourceKey, string> = { wood: '/icons/items/wood.webp', stone: '/icons/items/stones.webp', metal: '/icons/items/metal.fragments.webp', hqm: '/icons/items/metal.refined.webp' };
const RES_LABELS: Record<ResourceKey, string> = { wood: 'Дерево', stone: 'Камень', metal: 'Металлические фрагменты', hqm: 'МВК' };

/** Иконки нижней панели: строительный план, киянка, объект. */
const ToolIcon: React.FC<{ tool: EditorTool }> = ({ tool }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {tool === 'build' && <><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><path d="M3.5 9.5h17M9.5 9.5v11M14 14h4M14 17h4" /></>}
    {tool === 'hammer' && <><path d="M14.5 3.5l6 6-2.5 2.5-6-6z" /><path d="M13 8L4 17l3 3 9-9" /></>}
    {tool === 'deploy' && <><path d="M6 21V3h12v18" /><path d="M4 21h16" /><circle cx="14.5" cy="12" r="0.9" fill="currentColor" /></>}
    {tool === 'wire' && <><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M6.5 16.5C9 12 8 9 12 9s5-1 5.5-1.5" /></>}
  </svg>
);

interface Current {
  id: string | null;
  version: number;
  saved: string;
}

function urlScheme(): string | null {
  return new URLSearchParams(window.location.search).get('bp');
}

function setUrlScheme(id: string | null): void {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('bp', id); else url.searchParams.delete('bp');
  window.history.replaceState(null, '', url);
}

const NO_RESULT: LoadResult = { blueprint: null, resolved: null, issues: [] };

const UpkeepDays: React.FC<{ upkeep: Record<ResourceKey, number> }> = ({ upkeep }) => {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const keys = RESOURCE_KEYS.filter(k => upkeep[k] > 0);
  return (
    <span
      className="upkeep__trigger"
      onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setPos({ left: r.left, top: Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 360)) }); }}
      onMouseLeave={() => setPos(null)}
    >
      в сутки
      {pos && (
        <div className="upkeep__popup" style={{ left: pos.left, top: pos.top }}>
          <table className="cost__days">
            <thead>
              <tr>
                <th>Дней</th>
                {keys.map(k => <th key={k}><img src={RES_ICONS[k]} alt={RES_LABELS[k]} title={RES_LABELS[k]} /></th>)}
              </tr>
            </thead>
            <tbody>
              {UPKEEP_DAYS.map(d => (
                <tr key={d}>
                  <td>{d}</td>
                  {keys.map(k => <td key={k}>{formatNum(Math.ceil(upkeep[k] * d))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </span>
  );
};

const BlueprintSection: React.FC = () => {
  const [schemes, setSchemes] = useState<SchemeSummary[] | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [hist, setHist] = useState<History<Blueprint> | null>(null);
  const [status, setStatus] = useState<{ text: string; bad?: boolean; reload?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<{ name: string; scene: SceneKind } | null>(null);
  const [collapsedNote, setCollapsedNote] = useState('');
  const [gradeOpen, setGradeOpen] = useState(false);
  const [cameraMode, setCameraMode] = usePref<CameraMode>('bp.camera', 'fly', v => v === 'fly' || v === 'orbit');
  const [showSockets, setShowSockets] = usePref('bp.sockets', false, v => typeof v === 'boolean');
  const [showPrivilege, setShowPrivilege] = usePref('bp.zones', true, v => typeof v === 'boolean');
  const [deckGroup, setDeckGroup] = usePref('bp.deckGroup', DECK_GROUPS[0].group, v => DECK_GROUPS.some(g => g.group === v));
  const [houseGroup, setHouseGroup] = usePref('bp.houseGroup', HOUSE_DEPLOY_GROUPS[0].group, v => HOUSE_DEPLOY_GROUPS.some(g => g.group === v));
  const [fov, setFov] = useState(savedFov);
  const changeFov = (v: number) => {
    setFov(v);
    try { localStorage.setItem(FOV.key, String(v)); } catch { return; }
  };
  const [raidOn, setRaidOn] = useState(() => new URLSearchParams(window.location.search).get('raid') === '1');
  const [raidMethod, setRaidMethod] = useState<RaidMethod>('optimal');
  const [raidPlay, setRaidPlay] = useState(0);
  const [showImpacts, setShowImpacts] = useState(true);

  // Режим стройки включён всегда: документ правится напрямую
  const [tool, setTool] = useState<EditorTool>('view');
  const [buildKind, setBuildKind] = useState<ElementKind>('square-foundation');
  const [deployKind, setDeployKind] = useState<DeployableKind>('wooden-door');

  const doc = hist?.present ?? null;
  const result: LoadResult = useMemo(() => (doc ? loadBlueprint(doc) : NO_RESULT), [doc]);
  const docJson = useMemo(() => (doc ? JSON.stringify(doc) : ''), [doc]);
  const dirty = !!current && !!doc && docJson !== current.saved;

  const open = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const sc = await getScheme(id);
      setCurrent({ id: sc.id, version: sc.version, saved: JSON.stringify(sc.doc) });
      setHist(startHistory(sc.doc));
      setUrlScheme(sc.id);
      setStatus(null);
      setRaidPlay(0);
      setCollapsedNote('');
    } catch (e) {
      setStatus({ text: (e as Error).message, bad: true });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    listSchemes().then(list => {
      setSchemes(list);
      const wanted = urlScheme();
      const id = list.find(x => x.id === wanted)?.id ?? list[0]?.id;
      if (id) open(id);
      else { setCurrent({ id: null, version: 0, saved: '' }); setHist(startHistory(emptyScheme('Новая постройка', 'empty'))); }
    }).catch((e: Error) => {
      setSchemes([]);
      setStatus({ text: `${e.message}: схемы не загрузить и не сохранить, можно только строить`, bad: true });
      setCurrent(null);
      setHist(startHistory(emptyScheme('Новая постройка', 'empty')));
    });
  }, [open]);

  const confirmLeave = () => !dirty || window.confirm('В схеме есть несохранённые изменения. Уйти без сохранения?');
  const chooseScheme = (id: string) => {
    if (id === current?.id || !confirmLeave()) return;
    open(id);
  };

  const create = async () => {
    if (!creating) return;
    const name = creating.name.trim() || (creating.scene === 'boat' ? 'Новый корабль' : 'Новая постройка');
    setBusy(true);
    try {
      const sc = await createScheme(name, emptyScheme(name, creating.scene));
      setSchemes(list => [...(list ?? []), sc]);
      setCurrent({ id: sc.id, version: sc.version, saved: JSON.stringify(sc.doc) });
      setHist(startHistory(sc.doc));
      setUrlScheme(sc.id);
      setCreating(null);
      setStatus({ text: 'Схема создана' });
      setRaidPlay(0);
      setCollapsedNote('');
    } catch (e) {
      setStatus({ text: (e as Error).message, bad: true });
    } finally {
      setBusy(false);
    }
  };

  const save = useCallback(async () => {
    if (!current?.id || !doc || busy) return;
    setBusy(true);
    try {
      const sc = await saveScheme(current.id, doc.meta.name, doc, current.version);
      setCurrent({ id: sc.id, version: sc.version, saved: JSON.stringify(sc.doc) });
      setHist(h => (h && JSON.stringify(h.present) === JSON.stringify(sc.doc) ? h : h && { ...h, present: sc.doc }));
      setSchemes(list => (list ?? []).map(x => (x.id === sc.id ? { ...sc } : x)));
      setStatus({ text: 'Сохранено' });
    } catch (e) {
      const conflict = e instanceof ApiError && e.status === 409;
      setStatus({ text: conflict ? 'Схему уже сохранили в другом окне. Загрузи сохранённую версию, твои правки при этом пропадут' : (e as Error).message, bad: true, reload: conflict });
    } finally {
      setBusy(false);
    }
  }, [current, doc, busy]);

  const doUndo = useCallback(() => setHist(h => (h ? undo(h) : h)), []);
  const doRedo = useCallback(() => setHist(h => (h ? redo(h) : h)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!(e.metaKey || e.ctrlKey) || document.querySelector('dialog[open]')) return;
      if (e.code === 'KeyZ') { (e.shiftKey ? doRedo : doUndo)(); e.preventDefault(); }
      else if (e.code === 'KeyY') { doRedo(); e.preventDefault(); }
      else if (e.code === 'KeyS') { save(); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!status || status.bad) return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [status]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || document.querySelector('dialog[open]')) return;
      const t = ({ Digit1: 'build', Digit2: 'hammer', Digit3: 'deploy', Digit4: 'wire' } as Record<string, EditorTool>)[e.code];
      if (t) { setTool(cur => (cur === t ? 'view' : t)); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const applyDoc = useCallback((next: Blueprint) => {
    const { blueprint: settled, collapsed } = settle(next);
    setCollapsedNote(collapsed.length ? `Обрушилось без опоры: ${collapsed.length} (${collapsed.join(', ')})` : '');
    setHist(h => (h ? record(h, settled) : h));
    setRaidPlay(0);
  }, []);
  const rename = (name: string) => setHist(h => (h ? record(h, { ...h.present, meta: { ...h.present.meta, name } }, 'name') : h));

  const { blueprint, resolved, issues } = result;
  const isBoat = isBoatScheme(blueprint ?? doc);
  useEffect(() => {
    setBuildKind(isBoat ? 'boat-hull' : 'square-foundation');
    setDeployKind(isBoat ? 'steering-wheel' : 'wooden-door');
  }, [isBoat]);
  const rock = blueprint?.terrain?.[0];
  const rockInfo = rock ? TERRAIN[rock.kind] : null;
  const rockOffset = rock ? Math.round((rock.position[1] - GROUND_Y) * 100) / 100 : 0;
  const setRockOffset = (offset: number) => setHist(h => {
    const d = h?.present;
    if (!h || !d?.terrain?.length) return h;
    const y = Math.round((GROUND_Y + offset) * 1000) / 1000 + 0;
    return record(h, { ...d, terrain: d.terrain.map((t, i) => (i === 0 ? { ...t, position: [t.position[0], y, t.position[2]] as [number, number, number] } : t)) }, 'rock');
  });
  const hasCupboard = !!resolved?.deployables.some(d => d.kind === 'tool-cupboard');
  const raidActive = raidOn && hasCupboard;

  const editor = useMemo<EditorState | null>(() => {
    if (!blueprint) return null;
    return {
      tool, kind: buildKind, deployKind, blueprint, radial: isBoat ? RADIAL_BOAT : RADIAL,
      // новые блоки — из веток, как в игре; грейд меняется киянкой
      onPlace: (kind: ElementKind, attach: Attach) => applyDoc(addElement(blueprint, kind, attach, isBoat ? 'wood' : 'twig')),
      onPlaceFree: (kind: ElementKind, t: Transform) => applyDoc(addElementAt(blueprint, kind, t, isBoat ? 'wood' : 'twig')),
      onDeploy: (d: Omit<Deployable, 'id'>) => applyDoc(addDeployable(blueprint, d)),
      onRemove: (id: string, deployable: boolean) => applyDoc(deployable ? removeDeployable(blueprint, id) : removeElement(blueprint, id)),
      onWire: (w: Omit<Wire, 'id'>) => applyDoc(addWire(blueprint, w)),
      onUnwire: (id: string) => applyDoc(removeWire(blueprint, id)),
      onRadial: (t: EditorTool, itemId: string, targetId: string | null, targetDeployable: boolean) => {
        if (t === 'build') setBuildKind(itemId as ElementKind);
        else if (t === 'deploy') setDeployKind(itemId as DeployableKind);
        else if (targetId) {
          if (itemId === 'rotate') { if (!targetDeployable) applyDoc(rotateElement(blueprint, targetId)); }
          else if (itemId === 'remove') applyDoc(targetDeployable ? removeDeployable(blueprint, targetId) : removeElement(blueprint, targetId));
          else if (!targetDeployable) applyDoc(upgradeElement(blueprint, targetId, itemId as Grade));
        }
      },
    };
  }, [blueprint, tool, buildKind, deployKind, applyDoc, isBoat]);

  // Рейд считается в веб-воркере и только когда включён показ: интерфейс не замирает
  const [raid, setRaid] = useState<{ sim: RaidSimulation; targetPos: [number, number, number]; value: number } | null>(null);
  const [raidBusy, setRaidBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    const w = new Worker(new URL('../blueprint/raidWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<RaidResponse>) => {
      if (e.data.id !== requestId.current) return;
      setRaidBusy(false);
      setRaid(e.data.sim && e.data.targetPos ? { sim: e.data.sim, targetPos: e.data.targetPos, value: e.data.value } : null);
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []);
  useEffect(() => {
    if (!raidActive || !blueprint || !resolved || !workerRef.current) { setRaid(null); return; }
    const id = ++requestId.current;
    setRaidBusy(true);
    const req: RaidRequest = { id, blueprint, method: raidMethod };
    workerRef.current.postMessage(req);
  }, [raidActive, blueprint, resolved, raidMethod]);

  const sim = raid?.sim ?? null;

  const raidView = useMemo<RaidView | null>(() => {
    if (!raidActive || !raid || !sim) return null;
    const line: [number, number, number][] = [
      ...sim.stages.map(st => st.shot.point),
      [raid.targetPos[0], raid.targetPos[1] + 0.8, raid.targetPos[2]],
    ];
    const view: RaidView = { ids: sim.broken, line, stages: sim.stages.map(st => ({ ids: st.broken })) };
    if (!showImpacts) return view;
    return { ...view, impacts: sim.stages.map(st => ({ point: st.shot.point, count: st.shot.count })) };
  }, [raidActive, raid, sim, showImpacts]);

  const describeUnits = (units: Partial<Record<string, number>>) =>
    Object.entries(units).filter(([, n]) => (n ?? 0) > 0)
      .map(([ex, n]) => `${EXPLOSIVE_SHORT_LABELS[ex as keyof typeof EXPLOSIVE_SHORT_LABELS] ?? ex} ×${n}`).join(' + ');

  const toggleRaid = (on: boolean) => { setRaidOn(on); setRaidPlay(0); };
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  const cost = useMemo(() => (!isBoat && resolved && resolved.elements.length > 0 ? costOf(resolved) : null), [resolved, isBoat]);
  const ioSim = useMemo(() => (resolved && resolved.deployables.some(d => IO[d.kind] || d.kind.endsWith('planter')) ? simulate(resolved) : null), [resolved]);
  const objectsCost = useMemo(() => {
    if (isBoat || !resolved) return null;
    const sum: Partial<Record<BoatResKey, number>> = {};
    for (const d of resolved.deployables) {
      if (!(d.kind in DECK)) continue;
      for (const [k, v] of Object.entries(objectCost(d.kind)) as [BoatResKey, number][]) sum[k] = (sum[k] ?? 0) + v;
    }
    return Object.keys(sum).length ? sum : null;
  }, [resolved, isBoat]);
  const boat = useMemo(() => (isBoat && resolved ? boatStats(resolved) : null), [resolved, isBoat]);

  const counts = useMemo(() => {
    if (!resolved) return [];
    const map = new Map<string, number>();
    for (const e of resolved.elements) map.set(`${e.kind}|${e.grade}`, (map.get(`${e.kind}|${e.grade}`) ?? 0) + 1);
    for (const d of resolved.deployables) map.set(`${d.kind}|`, (map.get(`${d.kind}|`) ?? 0) + 1);
    return [...map.entries()].map(([key, n]) => {
      const [kind, grade] = key.split('|');
      const isElement = kind in KINDS;
      return { key, label: KIND_LABELS[kind] ?? kind, grade: isElement && !KINDS[kind as ElementKind].boat ? GRADE_LABELS[grade] ?? grade : '', n };
    });
  }, [resolved]);

  return (
    <section className="bp">
      <div className="bp__layout">
        <div className="bp__left">
          <div className="bp__preset">
            <span className="bp__side-title">Схема</span>
            <div className="bp__scheme-row">
              <select className="bp__preset-select" value={current?.id ?? ''} onChange={e => chooseScheme(e.target.value)} disabled={!schemes?.length || busy} aria-label="Схема">
                {!current?.id && <option value="">{schemes ? 'Без схемы' : 'Загрузка…'}</option>}
                {(schemes ?? []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <button type="button" className="bp__icon-btn" onClick={() => setCreating(c => (c ? null : { name: 'Новая постройка', scene: 'empty' }))} disabled={busy || schemes === null} aria-expanded={!!creating} aria-label="Новая схема" data-tip="Новая схема" data-tip-pos="left">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            {creating && (
              <form className="bp__new" onSubmit={e => { e.preventDefault(); if (confirmLeave()) create(); }}>
                <input className="bp__name" value={creating.name} onChange={e => setCreating({ ...creating, name: e.target.value })} maxLength={120} autoFocus aria-label="Название новой схемы" />
                <div className="bp__new-kind" role="radiogroup" aria-label="Сцена">
                  {([['empty', 'Пустое пространство', 'Новая постройка'], ['rock', 'Скала God Rock', 'Новая постройка'], ['boat', 'Корабль на воде', 'Новый корабль']] as [SceneKind, string, string][]).map(([id, label, def]) => (
                    <label key={id}>
                      <input type="radio" checked={creating.scene === id} onChange={() => setCreating(c => c && { scene: id, name: c.name === 'Новая постройка' || c.name === 'Новый корабль' ? def : c.name })} /> {label}
                    </label>
                  ))}
                </div>
                <div className="bp__range-actions">
                  <button type="submit" className="bp__upload-btn" disabled={busy}>Создать</button>
                  <button type="button" className="raid-tier__btn" onClick={() => setCreating(null)}>Отмена</button>
                </div>
              </form>
            )}
          </div>
          <aside className="bp__panel">
            {doc ? (
              <input className="bp__panel-title bp__title-input" value={doc.meta.name} onChange={e => rename(e.target.value)} maxLength={120} aria-label="Название схемы" />
            ) : (
              <div className="bp__panel-title">Загрузка…</div>
            )}
            <div className="bp__toolbar" role="toolbar" aria-label="Правка">
              <button type="button" className="bp__icon-btn" onClick={doUndo} disabled={!hist?.past.length} aria-label="Отменить" data-tip="Отменить (Cmd+Z)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
              </button>
              <button type="button" className="bp__icon-btn" onClick={doRedo} disabled={!hist?.future.length} aria-label="Вернуть" data-tip="Вернуть (Shift+Cmd+Z)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>
              </button>
              {!isBoat && <button type="button" className="raid-tier__btn" onClick={() => setGradeOpen(true)} disabled={!blueprint?.elements.length} data-tip="Сменить материал сразу у многих блоков">Материал</button>}
              <button type="button" className="bp__upload-btn bp__save" onClick={save} disabled={!dirty || busy || !current?.id}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
              <span className={`bp__save-state${dirty ? ' bp__save-state--dirty' : ''}`}>{!current?.id ? 'без базы' : dirty ? 'есть изменения' : 'сохранено'}</span>
            </div>
            {status && (
              <p className={`bp__status${status.bad ? ' bp__status--bad' : ''}`}>
                {status.text}
                {status.reload && current?.id && <> <button type="button" className="raid-tier__btn raid-tier__btn--sm" onClick={() => open(current.id!)}>Загрузить</button></>}
              </p>
            )}
            {blueprint?.meta.gameVersion && <div className="bp__meta">Игра {blueprint.meta.gameVersion}</div>}

            {rock && rockInfo && (
              <section className="bp__terrain">
                <div className="bp__section-title">{rockInfo.label}</div>
                <label className="bp__range">
                  <span>Высота</span>
                  <input
                    type="range" min={rockInfo.offset.min} max={rockInfo.offset.max} step={rockInfo.offset.step} value={rockOffset}
                    onChange={e => setRockOffset(Number(e.target.value))} aria-label={`${rockInfo.label}: высота над землёй`}
                  />
                  <output>{rockOffset > 0 ? '+' : ''}{rockOffset.toFixed(2)} м</output>
                </label>
                <div className="bp__range-actions">
                  <button type="button" className="raid-tier__btn raid-tier__btn--sm" onClick={() => setRockOffset(Math.max(rockInfo.offset.min, rockOffset - rockInfo.offset.nudge))}>−{rockInfo.offset.nudge} м</button>
                  <button type="button" className="raid-tier__btn raid-tier__btn--sm" onClick={() => setRockOffset(Math.min(rockInfo.offset.max, rockOffset + rockInfo.offset.nudge))}>+{rockInfo.offset.nudge} м</button>
                  <button type="button" className="raid-tier__btn raid-tier__btn--sm" onClick={() => setRockOffset(0)} disabled={rockOffset === 0}>Сбросить</button>
                </div>
                <p className="bp__range-hint">{rockInfo.hint}</p>
              </section>
            )}

            {errors.length > 0 && (
              <div className="bp__issues bp__issues--error">
                <div className="bp__issues-title">Ошибки ({errors.length})</div>
                <ul>
                  {errors.map((i, idx) => (
                    <li key={idx}><code>{i.code}</code>{i.id ? <> «{i.id}»</> : null}: {i.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="bp__issues bp__issues--warning">
                <div className="bp__issues-title">Предупреждения ({warnings.length})</div>
                <ul>
                  {warnings.map((i, idx) => (
                    <li key={idx}><code>{i.code}</code>{i.id ? <> «{i.id}»</> : null}: {i.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {collapsedNote && <p className="palette__note">{collapsedNote}</p>}


            {resolved && hasCupboard && raidBusy && (
              <section className="raid-panel">
                <label className="bp__toggle raid-panel__toggle">
                  <input type="checkbox" checked={raidOn} onChange={e => toggleRaid(e.target.checked)} />
                  Показать рейд
                </label>
                <p className="raid-panel__hint">Считаю рейд…</p>
              </section>
            )}
            {resolved && hasCupboard && !raidBusy && !raid && (
              <section className="raid-panel">
                <label className="bp__toggle raid-panel__toggle">
                  <input type="checkbox" checked={raidOn} onChange={e => toggleRaid(e.target.checked)} />
                  Показать рейд
                </label>
              </section>
            )}
            {resolved && hasCupboard && !raidBusy && raid && sim && (
              <section className="raid-panel">
                <label className="bp__toggle raid-panel__toggle">
                  <input type="checkbox" checked={raidOn} onChange={e => toggleRaid(e.target.checked)} />
                  Показать рейд
                </label>

                {raidOn && (
                  <>
                    <div className="bp__presets raid-panel__methods" role="group" aria-label="Чем рейдим">
                      {RAID_METHODS.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className={`raid-tier__btn raid-tier__btn--sm${m.id === raidMethod ? ' raid-tier__btn--active' : ''}`}
                          onClick={() => { setRaidMethod(m.id); setRaidPlay(0); }}
                          aria-pressed={m.id === raidMethod}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="raid-panel__best">
                      <div className="raid-panel__best-line">
                        <b>{formatNum(sim!.sulfur)}</b> серы · {describeUnits(sim!.units)}
                      </div>
                      <div className="raid-panel__best-line">
                        открывает {sim!.openedIds.length} {sim!.openedIds.length === 1 ? 'полость' : sim!.openedIds.length < 5 ? 'полости' : 'полостей'} · ценность {raid.value} · этапов {sim!.stages.length}
                      </div>
                    </div>

                    <label className="bp__toggle">
                      <input type="checkbox" checked={showImpacts} onChange={e => setShowImpacts(e.target.checked)} />
                      Показать точки удара
                    </label>

                    {sim && sim.stages.length > 0 && (
                      <div className="raid-panel__actions">
                        <button type="button" className="bp__upload-btn" onClick={() => setRaidPlay(n => n + 1)}>Воспроизвести</button>
                        <button type="button" className="raid-tier__btn" onClick={() => setRaidPlay(0)} disabled={raidPlay === 0}>Сбросить</button>
                      </div>
                    )}
                    <p className="raid-panel__hint">Урон по правилам и данным игры: защита грейда и дверей, падение урона до ближайшей точки коробки блока, видимость по двум лучам. C4 и сачель сажаются на блок, ракета и разрывные бьют по области. «Оптимально» смешивает ракеты, C4 и разрывные.</p>
                  </>
                )}
              </section>
            )}

            {resolved && counts.length > 0 && (
              <>
                <div className="bp__section-title">Состав</div>
                <table className="bp__counts">
                  <tbody>
                    {counts.map(c => (
                      <tr key={c.key}>
                        <td className="bp__counts-label">{c.label}{c.grade ? <span className="bp__counts-grade"> · {c.grade}</span> : null}</td>
                        <td className="bp__counts-n">×{c.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {boat && (
              <section className="cost boat">
                <div className="bp__section-title">Корабль</div>
                <table className="bp__counts">
                  <tbody>
                    <tr><td className="bp__counts-label">Масса</td><td className="bp__counts-n" data-tip={`Сумма масс блоков ${formatNum(boat.massBlocks)} кг, в физике не меньше ${formatNum(MIN_MASS)} кг; объекты массу не добавляют`} data-tip-pos="left">{formatNum(boat.mass)} кг</td></tr>
                    <tr><td className="bp__counts-label">Прочность</td><td className="bp__counts-n" data-tip="Общее здоровье корабля — сумма вкладов блоков; урон по любому блоку и объекту идёт в него" data-tip-pos="left">{formatNum(boat.health)} HP</td></tr>
                    {boat.bow && <tr><td className="bp__counts-label">Сопротивление воде</td><td className="bp__counts-n" data-tip={`При ходе носом вперёд: лобовая ширина корпуса ${boat.bow.width.toFixed(1)} м. Диапазон ${DRAG_MIN}–${DRAG_MAX}: ширина до ${DRAG_MIN_WIDTH} м даёт минимум, от ${DRAG_MAX_WIDTH} м — максимум. Нос по штурвалу${boat.hasWheel ? '' : ' (штурвала нет, нос по оси X)'}`} data-tip-pos="left">{boat.bow.drag.toFixed(2)} · {boat.bow.width.toFixed(1)} м</td></tr>}
                    <tr><td className="bp__counts-label">Блоков</td><td className="bp__counts-n">{boat.blocks} из {MAX_BLOCKS}</td></tr>
                  </tbody>
                </table>
                <div className="bp__section-title">Скорость хода</div>
                <table className="bp__counts">
                  <tbody>
                    <RunRow title={`Паруса ×${boat.count['sail'] ?? 0}`} run={boat.sails} mass={boat.mass} />
                    <RunRow title={`Моторы ×${boat.count['small-engine'] ?? 0}`} run={boat.engines} mass={boat.mass} />
                    <RunRow title="Паруса и моторы" run={boat.full} mass={boat.mass} />
                    <RunRow title="Задний ход" run={boat.reverse} mass={boat.mass} />
                    {boat.full && <tr><td className="bp__counts-label">Увод на полном ходу</td><td className="bp__counts-n" data-tip={`Паруса и моторы не на оси корабля разворачивают его вокруг центра масс (центр габарита блоков). В игре плечо паруса — ${SAIL_LEVER * 100}% расстояния до центра, мотора — ${ENGINE_LEVER * 100}%. Процент — сколько штурвала держать, чтобы идти прямо; больше 100% — не удержать. Инерция корабля посчитана приближённо по блокам`} data-tip-pos="left">{boat.full.yaw ? yawText(boat.full.yaw) : 'идёт прямо'}</td></tr>}
                  </tbody>
                </table>
                {boat.fuelPerMinute > 0 && <p className="cost__note">Моторы жгут {formatNum(boat.fuelPerMinute)} топлива в минуту, {formatNum(boat.fuelPerMinute * 60)} в час.</p>}
                <p className="cost__note">Установившаяся скорость: min(тяга / масса, 13 м/с²) / сопротивление, не выше {VELOCITY_MAX} м/с. Сопротивление растёт с лобовой шириной корпуса: клин из треугольных корпусов на носу его снижает. У берега и на мели предел падает до {(VELOCITY_MAX * SHALLOW_FACTOR).toFixed(1)} м/с. Нос — по штурвалу{boat.hasWheel ? '' : ' (штурвала нет, нос по оси X)'}.</p>
                <ul className="boat__checks">
                  {boat.checks.map(c => <li key={c.text} className={c.ok ? 'boat__check--ok' : 'boat__check--bad'}>{c.ok ? '✓' : '✗'} {c.text}</li>)}
                </ul>
                {boat.blocked.size > 0 && (
                  <ul className="boat__checks">
                    {[...boat.blocked].map(([id, b]) => <li key={id} className="boat__check--bad">Парус «{id}»: {describeBlock(b)}</li>)}
                  </ul>
                )}
                <p className="cost__note">Парус тянет, только если ему ничего не мешает сзади: из двух точек на высоте 3.4 и 4.7 м назад на 2 м проверяется сфера радиусом 0.5 м, и сверху не должно быть пола или крыши. Заслонённый парус в сцене со стрелкой красного цвета, в скорости он не учитывается.</p>
                <div className="bp__section-title">Стоимость постройки</div>
                <div className="cost__row">
                  {BOAT_RES_KEYS.filter(k => boat.build[k] > 0).map(k => (
                    <span key={k} className="cost__res" title={BOAT_RES_LABELS[k]}><img src={BOAT_RES_ICONS[k]} alt="" />{formatNum(boat.build[k])}</span>
                  ))}
                </div>
                <p className="cost__note">Блок стоит 300 дерева и 15 топлива × множитель формы, объекты — по рецепту крафта. Сама верфь: {BOAT_RES_KEYS.filter(r => STATION_COST[r]).map(r => `${STATION_COST[r]} ${BOAT_RES_LABELS[r].toLowerCase()}`).join(' + ')}.</p>
                <p className="cost__note">Распад: готовый корабль начинает гнить через {DECAY_START_HOURS} ч без использования и теряет всё здоровье за {DECAY_HOURS} ч; под крышей не гниёт.</p>
              </section>
            )}

            {cost && (
              <section className="cost">
                <div className="bp__section-title">Стоимость постройки</div>
                <div className="cost__row">
                  {RESOURCE_KEYS.filter(k => cost.build[k] > 0).map(k => (
                    <span key={k} className="cost__res" title={RES_LABELS[k]}><img src={RES_ICONS[k]} alt="" />{formatNum(cost.build[k])}</span>
                  ))}
                </div>
                {objectsCost && (
                  <>
                    <div className="bp__section-title">Объекты</div>
                    <div className="cost__row">
                      {BOAT_RES_KEYS.filter(k => (objectsCost[k] ?? 0) > 0).map(k => (
                        <span key={k} className="cost__res" title={BOAT_RES_LABELS[k]}><img src={BOAT_RES_ICONS[k]} alt="" />{formatNum(objectsCost[k]!)}</span>
                      ))}
                    </div>
                  </>
                )}
                <div className="bp__section-title">Содержание <UpkeepDays upkeep={cost.upkeep} /></div>
                <div className="cost__row">
                  {RESOURCE_KEYS.filter(k => cost.upkeep[k] > 0).map(k => (
                    <span key={k} className="cost__res" title={RES_LABELS[k]}><img src={RES_ICONS[k]} alt="" />{formatNum(Math.ceil(cost.upkeep[k]))}</span>
                  ))}
                </div>
                <p className="cost__note">Ставка {(cost.rate * 100).toFixed(1)} % от стоимости за {cost.count} {cost.count === 1 ? 'блок' : cost.count < 5 ? 'блока' : 'блоков'} (брекеты игры: 15 по 10 %, 50 по 15 %, 125 по 20 %, дальше 33.3 %), один игрок; шкаф и дроп-боксы не учитываются.</p>
              </section>
            )}
            {ioSim && <IOPanel sim={ioSim} />}
          </aside>
        </div>

        <div className="bp__center">
          <div className="bp__viewer">
            <Viewer3D water={isBoat} resolved={resolved} mode={cameraMode} raid={raidView} raidPlay={raidActive ? raidPlay : 0} frameKey={current?.id ?? 'local'} editor={editor} showSockets={showSockets} fov={fov} showPrivilege={showPrivilege && hasCupboard} />
            <div className="bp__camera" role="group" aria-label="Камера">
              {hasCupboard && (
                <button type="button" className={`bp__zones${showPrivilege ? ' bp__zones--on' : ''}`} onClick={() => setShowPrivilege(v => !v)} aria-pressed={showPrivilege} data-tip="Зона привилегии шкафа: 16 м от блоков здания со шкафом — оболочка в сцене и граница на земле" data-tip-pos="left">
                  {showPrivilege ? 'Убрать зоны строительства' : 'Показать зоны строительства'}
                </button>
              )}
              <label className="bp__fov" data-tip={`Угол обзора по вертикали, как graphics.fov в игре: ${FOV.min}–${FOV.max}°, по умолчанию ${FOV.default}°`} data-tip-pos="left">
                <span>FOV</span>
                <input type="range" min={FOV.min} max={FOV.max} step={1} value={fov} onChange={e => changeFov(Number(e.target.value))} onDoubleClick={() => changeFov(FOV.default)} aria-label="Угол обзора" />
                <output>{fov}°</output>
              </label>
              <button type="button" className={`bp__icon-btn${showSockets ? ' bp__icon-btn--active' : ''}`} onClick={() => setShowSockets(v => !v)} aria-pressed={showSockets} aria-label="Сокеты" data-tip="Сокеты: зелёным — зоны выбора, куда встанет блок; ярче — выбранная" data-tip-pos="left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></svg>
              </button>
              <button type="button" className={`bp__icon-btn${cameraMode === 'orbit' ? ' bp__icon-btn--active' : ''}`} onClick={() => setCameraMode('orbit')} aria-pressed={cameraMode === 'orbit'} aria-label="Орбита" data-tip="Орбита: вращать перетаскиванием, колесо — приближать" data-tip-pos="left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-13.7 5.6" /><path d="M4 12a8 8 0 0 1 13.7-5.6" /><path d="M17.7 2.8v3.8h-3.8M6.3 21.2v-3.8h3.8" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
              </button>
              <button type="button" className={`bp__icon-btn${cameraMode === 'fly' ? ' bp__icon-btn--active' : ''}`} onClick={() => setCameraMode('fly')} aria-pressed={cameraMode === 'fly'} aria-label="Полёт" data-tip="Полёт: клик по сцене — захват мыши, WASD — лететь, Esc — отпустить" data-tip-pos="left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" /><path d="M10 13l4.5-4.5" /></svg>
              </button>
            </div>
            {tool === 'deploy' && (() => {
              const groups = isBoat ? DECK_GROUPS : HOUSE_DEPLOY_GROUPS;
              const active = isBoat ? deckGroup : houseGroup;
              const choose = isBoat ? setDeckGroup : setHouseGroup;
              return (
                <div className="deck-palette" role="group" aria-label={isBoat ? 'Объекты на палубу' : 'Объекты'}>
                  <div className="deck-palette__tabs">
                    {groups.map(g => (
                      <button key={g.group} type="button" className={`deck-palette__tab${g.group === active ? ' deck-palette__tab--active' : ''}`} onClick={() => choose(g.group)}>{g.group}</button>
                    ))}
                  </div>
                  <div className="deck-palette__items">
                    {(groups.find(g => g.group === active) ?? groups[0]).kinds.map(k => (
                      <button key={k} type="button" className={`deck-palette__item${k === deployKind ? ' deck-palette__item--active' : ''}`} onClick={() => setDeployKind(k)} data-tip={KIND_LABELS[k]} aria-label={KIND_LABELS[k]} aria-pressed={k === deployKind}>
                        <img src={`/icons/items/${DEPLOY_ICONS[k]}.webp`} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="hotbar" role="group" aria-label="Инструменты">
              {([['build', 'Строительный план', KIND_LABELS[buildKind]], ['hammer', 'Киянка', 'Киянка'], ['deploy', 'Объект', KIND_LABELS[deployKind]], ['wire', 'Провод и шланг', 'Провод']] as [EditorTool, string, string][]).map(([id, label, sub], i) => (
                <button key={id} type="button" className={`hotbar__slot${tool === id ? ' hotbar__slot--active' : ''}`} onClick={() => setTool(cur => (cur === id ? 'view' : id))} aria-pressed={tool === id} aria-label={label}>
                  <span className="hotbar__key">{i + 1}</span>
                  <ToolIcon tool={id} />
                  <span className="hotbar__sub">{sub}</span>
                </button>
              ))}
            </div>
            <div className="bp__hint">
              {tool === 'build' && 'ЛКМ — поставить · зажать ПКМ — выбрать блок · R — другой вариант · средняя кнопка — сдвиг камеры'}
              {tool === 'hammer' && 'Наведи на блок · зажать ПКМ — апгрейд или снос · R — снести · средняя кнопка — сдвиг камеры'}
              {tool === 'view' && 'Просмотр: ЛКМ по двери — открыть или закрыть · 1 / 2 / 3 / 4 — взять инструмент · средняя кнопка — сдвиг камеры'}
              {tool === 'wire' && 'ЛКМ по выходу или входу — начать, по стенам и полу — точки крепления, по слоту другого объекта — подключить · ЛКМ по занятому слоту — отсоединить · ПКМ или Esc — отменить'}
              {tool === 'deploy' && (isBoat
                ? 'ЛКМ — поставить · объект — в палитре над панелью или зажатой ПКМ · R — повернуть на 45° от курса · средняя кнопка — сдвиг камеры'
                : 'ЛКМ — поставить · объект — в палитре над панелью или зажатой ПКМ · R — повернуть (шкаф, мебель) или сменить направление дроп-бокса · средняя кнопка — сдвиг камеры')}
            </div>
          </div>
        </div>

      </div>
      <GradeDialog
        open={gradeOpen}
        blueprint={blueprint}
        kindLabels={KIND_LABELS}
        gradeLabels={GRADE_TITLES}
        onClose={() => setGradeOpen(false)}
        onApply={(r: Regrade) => {
          if (!blueprint) return;
          const n = regradeTargets(blueprint, r).length;
          applyDoc(regradeElements(blueprint, r));
          setGradeOpen(false);
          setStatus({ text: `Материал изменён у блоков: ${n}` });
        }}
      />
    </section>
  );
};

export default BlueprintSection;
