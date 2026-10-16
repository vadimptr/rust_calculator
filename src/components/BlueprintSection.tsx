import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Viewer3D from './Viewer3D';
import type { CameraMode, EditorState, EditorTool, RadialItem } from './Viewer3D';
import { BLUEPRINT_PRESETS } from '../blueprint/presets.ts';
import { loadBlueprint } from '../blueprint/validate.ts';
import type { LoadResult } from '../blueprint/validate.ts';
import { KINDS } from '../blueprint/catalog.ts';
import { BUILD_PLAN, DEPLOY_PLAN, addDeployable, addElement, exportBlueprint, newBlueprint, removeDeployable, removeElement, settle, upgradeElement } from '../blueprint/editor.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, ElementKind, Grade, Resolved } from '../blueprint/types.ts';

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
  'drop-box': 'Дроп-бокс',
};

/** Переопределение материала и дверей поверх чертежа; иконки как в разделе строительства. */
type GradeChoice = 'wood' | 'stone' | 'metal' | 'armored';
type DoorChoice = 'wooden' | 'metal' | 'armored' | 'garage';
const GRADE_CHOICES: { id: GradeChoice; label: string; img: string }[] = [
  { id: 'wood', label: 'Дерево', img: '/icons/wood.png' },
  { id: 'stone', label: 'Камень', img: '/icons/stones.png' },
  { id: 'metal', label: 'Металл', img: '/icons/metal.refined.png' },
  { id: 'armored', label: 'МВК', img: '/icons/metal.fragments.png' },
];
const DOOR_CHOICES: { id: DoorChoice; label: string; img: string; wide?: boolean }[] = [
  { id: 'wooden', label: 'Деревянные двери', img: '/icons/wood.png' },
  { id: 'metal', label: 'Металлические двери', img: '/icons/metal.refined.png' },
  { id: 'armored', label: 'Двери из МВК', img: '/icons/metal.fragments.png' },
  { id: 'garage', label: 'Гаражные двери (в рамах)', img: '/icons/metal.refined.png', wide: true },
];
const SINGLE_BY_CHOICE: Record<DoorChoice, string> = { wooden: 'wooden-door', metal: 'sheet-metal-door', armored: 'armored-door', garage: 'sheet-metal-door' };
const FRAME_BY_CHOICE: Record<DoorChoice, string> = { wooden: 'wooden-double-door', metal: 'sheet-metal-double-door', armored: 'armored-double-door', garage: 'garage-door' };

/** Значок-уточнение на иконке материала двери: створка или широкая гаражная. */
const DoorBadge: React.FC<{ wide?: boolean }> = ({ wide }) => (
  <svg className="bp__icon-badge" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    {wide
      ? <><rect x="1" y="2.5" width="10" height="7" rx="1" fill="#e8d9b0" /><line x1="1" y1="5" x2="11" y2="5" stroke="#1a1410" strokeWidth="1" /><line x1="1" y1="7" x2="11" y2="7" stroke="#1a1410" strokeWidth="1" /></>
      : <><rect x="3.5" y="1" width="5" height="10" rx="1" fill="#e8d9b0" /><circle cx="7.3" cy="6" r="0.8" fill="#1a1410" /></>}
  </svg>
);
const SINGLE_DOOR_KINDS = ['wooden-door', 'sheet-metal-door', 'armored-door'];
const FRAME_DOOR_KINDS = ['wooden-double-door', 'sheet-metal-double-door', 'armored-double-door', 'garage-door'];

/** Применить переопределения к документу: материал всех элементов и тип всех дверей. */
function applyOverrides(data: unknown, grade: GradeChoice, door: DoorChoice): unknown {
  if (!data || typeof data !== 'object') return data;
  const doc = JSON.parse(JSON.stringify(data)) as { defaults?: { grade?: string }; elements?: { grade?: string }[]; deployables?: { kind: string }[] };
  doc.defaults = { ...(doc.defaults ?? {}), grade };
  for (const el of doc.elements ?? []) if (el.grade) el.grade = grade;
  for (const d of doc.deployables ?? []) {
    if (SINGLE_DOOR_KINDS.includes(d.kind)) d.kind = SINGLE_BY_CHOICE[door];
    else if (FRAME_DOOR_KINDS.includes(d.kind)) d.kind = FRAME_BY_CHOICE[door];
  }
  return doc;
}

/** Иконка двери: закрытая — полотно в проёме, открытая — полотно повёрнуто наружу. */
const DoorIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 21h16M6 21V3h12v18" />
    {open
      ? <><path d="M6 3l7 3v15l-7-0" fill="currentColor" fillOpacity="0.25" /><circle cx="11" cy="13" r="0.9" fill="currentColor" /></>
      : <><rect x="7.5" y="4.5" width="9" height="16.5" fill="currentColor" fillOpacity="0.25" /><circle cx="14.5" cy="13" r="0.9" fill="currentColor" /></>}
  </svg>
);

const GRADE_LABELS: Record<string, string> = {
  twig: 'ветки', wood: 'дерево', stone: 'камень', metal: 'металл', armored: 'броня',
};

/** Короткие подписи для кольца радиального меню. */
const SHORT_LABELS: Record<string, string> = {
  'square-foundation': 'Фундамент', 'triangle-foundation': 'Тр. фунд.', 'foundation-steps': 'Ступени', 'ramp': 'Съезд',
  'wall': 'Стена', 'half-wall': 'Полустена', 'low-wall': 'Низкая', 'doorway': 'Проём', 'window-frame': 'Окно', 'wall-frame': 'Рама',
  'square-floor': 'Пол', 'triangle-floor': 'Тр. пол', 'floor-frame': 'Рама пола', 'triangle-floor-frame': 'Тр. рама',
  'stairs-l-shape': 'Лестн. L', 'u-shaped-stairs': 'Лестн. U', 'spiral-stairs': 'Винтовая', 'roof': 'Крыша', 'roof-triangle': 'Тр. крыша',
  'wooden-door': 'Дер. дверь', 'sheet-metal-door': 'Мет. дверь', 'armored-door': 'МВК дверь',
  'wooden-double-door': 'Дер. двойная', 'sheet-metal-double-door': 'Мет. двойная', 'armored-double-door': 'МВК двойная', 'garage-door': 'Гаражная',
  'strengthened-glass-window': 'Стекло', 'reinforced-glass-window': 'Ус. стекло', 'metal-window-bars': 'Решётка',
  'tool-cupboard': 'Шкаф', 'drop-box': 'Дроп-бокс',
};

/** Радиальные меню: блоки строительного плана, объекты, апгрейд и снос киянкой. */
const RADIAL: Record<EditorTool, RadialItem[]> = {
  build: BUILD_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k] })),
  deploy: DEPLOY_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k] })),
  hammer: [
    { id: 'twig', label: 'Ветки' }, { id: 'wood', label: 'Дерево' }, { id: 'stone', label: 'Камень' },
    { id: 'metal', label: 'Металл' }, { id: 'armored', label: 'МВК' }, { id: 'remove', label: 'Снести' },
  ],
};

const EMPTY_RESOLVED: Resolved = { elements: [], deployables: [] };

/** Иконки нижней панели: строительный план, киянка, объект. */
const ToolIcon: React.FC<{ tool: EditorTool }> = ({ tool }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {tool === 'build' && <><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><path d="M3.5 9.5h17M9.5 9.5v11M14 14h4M14 17h4" /></>}
    {tool === 'hammer' && <><path d="M14.5 3.5l6 6-2.5 2.5-6-6z" /><path d="M13 8L4 17l3 3 9-9" /></>}
    {tool === 'deploy' && <><path d="M6 21V3h12v18" /><path d="M4 21h16" /><circle cx="14.5" cy="12" r="0.9" fill="currentColor" /></>}
  </svg>
);

function downloadFile(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface Source {
  label: string;
  /** Исходный документ (объект) — для повторной загрузки с переопределениями. */
  data: unknown;
}

function fromPreset(id: string, grade: GradeChoice = 'stone', door: DoorChoice = 'metal'): Source {
  const p = BLUEPRINT_PRESETS.find(x => x.id === id) ?? BLUEPRINT_PRESETS[0];
  // материал и двери из переключателей сразу применяются к чертежу
  return { label: p.label, data: applyOverrides(p.data, grade, door) };
}

/** Начальный пресет: ?bp=<id> в адресе, иначе первый. */
function initialPresetId(): string {
  const wanted = new URLSearchParams(window.location.search).get('bp');
  return BLUEPRINT_PRESETS.some(p => p.id === wanted) ? (wanted as string) : 'starter-2x1';
}

const BlueprintSection: React.FC = () => {
  const [activePreset, setActivePreset] = useState<string | null>(initialPresetId);
  const [source, setSource] = useState<Source>(() => fromPreset(initialPresetId()));
  const fileRef = useRef<HTMLInputElement>(null);
  const [doorsOpen, setDoorsOpen] = useState(() => new URLSearchParams(window.location.search).get('doors') === 'open');
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [raidOn, setRaidOn] = useState(() => new URLSearchParams(window.location.search).get('raid') === '1');
  const [raidMethod, setRaidMethod] = useState<RaidMethod>('optimal');
  const [raidPlay, setRaidPlay] = useState(0);
  const [showImpacts, setShowImpacts] = useState(true);
  const [gradeChoice, setGradeChoice] = useState<GradeChoice>('stone');
  const [doorChoice, setDoorChoice] = useState<DoorChoice>('metal');

  // Режим стройки включён всегда: документ правится напрямую
  const [tool, setTool] = useState<EditorTool>('build');
  const [buildKind, setBuildKind] = useState<ElementKind>('wall');
  const [deployKind, setDeployKind] = useState<DeployableKind>('wooden-door');

  // Документ с переопределениями → схема → геометрия
  const result: LoadResult = useMemo(
    () => (source.data === null ? { blueprint: null, resolved: EMPTY_RESOLVED, issues: [] } : loadBlueprint(source.data)),
    [source],
  );

  const choosePreset = (id: string) => {
    setActivePreset(id);
    setSource(fromPreset(id, gradeChoice, doorChoice));
    setRaidPlay(0);
  };
  /** Материал всех блоков и тип всех дверей — сразу в чертёж. */
  const chooseGrade = (g: GradeChoice) => {
    setGradeChoice(g);
    setSource(s => ({ label: s.label, data: applyOverrides(s.data, g, doorChoice) }));
    setRaidPlay(0);
  };
  const chooseDoor = (d: DoorChoice) => {
    setDoorChoice(d);
    setSource(s => ({ label: s.label, data: applyOverrides(s.data, gradeChoice, d) }));
    setRaidPlay(0);
  };

  // 1 / 2 / 3 — строительный план, киянка, объект (как слоты в игре)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const t = ({ Digit1: 'build', Digit2: 'hammer', Digit3: 'deploy' } as Record<string, EditorTool>)[e.code];
      if (t) { setTool(t); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const [collapsedNote, setCollapsedNote] = useState('');
  const applyDoc = useCallback((next: Blueprint) => {
    // после каждого действия — обрушение блоков без опоры, как в игре
    const { blueprint: settled, collapsed } = settle(next);
    setCollapsedNote(collapsed.length ? `Обрушилось без опоры: ${collapsed.length} (${collapsed.join(', ')})` : '');
    setSource(s => ({ label: s.label, data: settled }));
    setRaidPlay(0);
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setActivePreset(null);
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = { __invalid: text }; }
    setSource({ label: file.name, data });
    setRaidPlay(0);
    e.target.value = '';
  };

  const { blueprint, resolved, issues } = result;

  const editor = useMemo<EditorState | null>(() => {
    if (!blueprint && source.data !== null) return null;
    return {
      tool, kind: buildKind, deployKind, blueprint, radial: RADIAL,
      // новые блоки — из веток, как в игре; грейд меняется киянкой
      onPlace: (kind: ElementKind, attach: Attach) => blueprint && applyDoc(addElement(blueprint, kind, attach, 'twig')),
      onPlaceRoot: (kind: ElementKind) => applyDoc(newBlueprint('Новая постройка', kind)),
      onDeploy: (d: Omit<Deployable, 'id'>) => blueprint && applyDoc(addDeployable(blueprint, d)),
      onRemove: (id: string, deployable: boolean) => blueprint && applyDoc(deployable ? removeDeployable(blueprint, id) : removeElement(blueprint, id)),
      onRadial: (t: EditorTool, itemId: string, targetId: string | null, targetDeployable: boolean) => {
        if (t === 'build') setBuildKind(itemId as ElementKind);
        else if (t === 'deploy') setDeployKind(itemId as DeployableKind);
        else if (blueprint && targetId) {
          if (itemId === 'remove') applyDoc(targetDeployable ? removeDeployable(blueprint, targetId) : removeElement(blueprint, targetId));
          else if (!targetDeployable) applyDoc(upgradeElement(blueprint, targetId, itemId as Grade));
        }
      },
    };
  }, [blueprint, source.data, tool, buildKind, deployKind, applyDoc]);

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
    if (!raidOn || !blueprint || !resolved || !workerRef.current) { setRaid(null); return; }
    const id = ++requestId.current;
    setRaidBusy(true);
    const req: RaidRequest = { id, blueprint, method: raidMethod };
    workerRef.current.postMessage(req);
  }, [raidOn, blueprint, resolved, raidMethod]);

  const sim = raid?.sim ?? null;

  const raidView = useMemo<RaidView | null>(() => {
    if (!raidOn || !raid || !sim) return null;
    const line: [number, number, number][] = [
      ...sim.stages.map(st => st.shot.point),
      [raid.targetPos[0], raid.targetPos[1] + 0.8, raid.targetPos[2]],
    ];
    const view: RaidView = { ids: sim.broken, line, stages: sim.stages.map(st => ({ ids: st.broken })) };
    if (!showImpacts) return view;
    return { ...view, impacts: sim.stages.map(st => ({ point: st.shot.point, count: st.shot.count })) };
  }, [raidOn, raid, sim, showImpacts]);

  const describeUnits = (units: Partial<Record<string, number>>) =>
    Object.entries(units).filter(([, n]) => (n ?? 0) > 0)
      .map(([ex, n]) => `${EXPLOSIVE_SHORT_LABELS[ex as keyof typeof EXPLOSIVE_SHORT_LABELS] ?? ex} ×${n}`).join(' + ');

  const toggleRaid = (on: boolean) => { setRaidOn(on); setRaidPlay(0); };
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  const counts = useMemo(() => {
    if (!resolved) return [];
    const map = new Map<string, number>();
    for (const e of resolved.elements) map.set(`${e.kind}|${e.grade}`, (map.get(`${e.kind}|${e.grade}`) ?? 0) + 1);
    for (const d of resolved.deployables) map.set(`${d.kind}|`, (map.get(`${d.kind}|`) ?? 0) + 1);
    return [...map.entries()].map(([key, n]) => {
      const [kind, grade] = key.split('|');
      const isElement = kind in KINDS;
      return { key, label: KIND_LABELS[kind] ?? kind, grade: isElement ? GRADE_LABELS[grade] ?? grade : '', n };
    });
  }, [resolved]);

  const download = () => blueprint && downloadFile(`${(blueprint.meta.name || 'blueprint').replace(/[^\wа-яё-]+/gi, '_')}.json`, exportBlueprint(blueprint));

  return (
    <section className="bp">
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
      <div className="bp__layout">
        <nav className="bp__side" aria-label="Постройки">
          <div className="bp__side-title">Шаблоны</div>
          <ul className="bp__list">
            {BLUEPRINT_PRESETS.map(p => (
              <li key={p.id}>
                <button type="button" className={`bp__list-item${p.id === activePreset ? ' bp__list-item--active' : ''}`} onClick={() => choosePreset(p.id)} aria-pressed={p.id === activePreset}>
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="bp__side-actions">
            <div className="bp__row">
              <button type="button" className="bp__upload-btn bp__grow" onClick={() => fileRef.current?.click()}>Загрузить JSON</button>
              <a className="bp__icon-btn bp__help" href="https://github.com/vadimptr/rust_calculator/blob/main/docs/blueprint/SPEC.md" target="_blank" rel="noreferrer" data-tip="Формат чертежа: описание JSON">?</a>
            </div>
            <button type="button" className="raid-tier__btn bp__side-btn" disabled={!blueprint} onClick={download}>Скачать JSON</button>
          </div>
        </nav>

        <div className="bp__center">
          <div className="bp__overrides">
            <span className="bp__override-label">Материал</span>
            <div className="bp__icons" role="group" aria-label="Материал конструкций">
              {GRADE_CHOICES.map(c => (
                <button key={c.id} type="button" data-tip={`Все блоки — ${c.label.toLowerCase()}`} className={`bp__icon-btn${c.id === gradeChoice ? ' bp__icon-btn--active' : ''}`}
                  onClick={() => chooseGrade(c.id)} aria-pressed={c.id === gradeChoice} aria-label={c.label}>
                  <img src={c.img} alt="" />
                </button>
              ))}
            </div>
            <span className="bp__override-label">Двери</span>
            <div className="bp__icons" role="group" aria-label="Тип дверей">
              {DOOR_CHOICES.map(c => (
                <button key={c.id} type="button" data-tip={`Все двери — ${c.label.toLowerCase()}`} className={`bp__icon-btn${c.id === doorChoice ? ' bp__icon-btn--active' : ''}`}
                  onClick={() => chooseDoor(c.id)} aria-pressed={c.id === doorChoice} aria-label={c.label}>
                  <img src={c.img} alt="" /><DoorBadge wide={c.wide} />
                </button>
              ))}
            </div>
            <button type="button" className={`bp__icon-btn bp__doors-toggle${doorsOpen ? ' bp__icon-btn--active' : ''}`} onClick={() => setDoorsOpen(o => !o)} aria-pressed={doorsOpen}
              aria-label={doorsOpen ? 'Закрыть двери' : 'Открыть двери'} data-tip={doorsOpen ? 'Двери открыты — нажми, чтобы закрыть все двери' : 'Двери закрыты — нажми, чтобы открыть все двери и крыши-затворы'}>
              <DoorIcon open={doorsOpen} />
            </button>
          </div>
          <div className="bp__viewer">
            <Viewer3D resolved={resolved} mode={cameraMode} doorsOpen={doorsOpen} raid={raidView} raidPlay={raidOn ? raidPlay : 0} frameKey={source.label} editor={editor} />
            <div className="bp__camera" role="group" aria-label="Камера">
              <button type="button" className={`bp__icon-btn${cameraMode === 'orbit' ? ' bp__icon-btn--active' : ''}`} onClick={() => setCameraMode('orbit')} aria-pressed={cameraMode === 'orbit'} aria-label="Орбита" data-tip="Орбита: вращать перетаскиванием, колесо — приближать" data-tip-pos="left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-13.7 5.6" /><path d="M4 12a8 8 0 0 1 13.7-5.6" /><path d="M17.7 2.8v3.8h-3.8M6.3 21.2v-3.8h3.8" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
              </button>
              <button type="button" className={`bp__icon-btn${cameraMode === 'fly' ? ' bp__icon-btn--active' : ''}`} onClick={() => setCameraMode('fly')} aria-pressed={cameraMode === 'fly'} aria-label="Полёт" data-tip="Полёт: клик по сцене — захват мыши, WASD — лететь, Esc — отпустить" data-tip-pos="left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" /><path d="M10 13l4.5-4.5" /></svg>
              </button>
            </div>
            <div className="hotbar" role="group" aria-label="Инструменты">
              {([['build', 'Строительный план', KIND_LABELS[buildKind]], ['hammer', 'Киянка', 'Киянка'], ['deploy', 'Объект', KIND_LABELS[deployKind]]] as [EditorTool, string, string][]).map(([id, label, sub], i) => (
                <button key={id} type="button" className={`hotbar__slot${tool === id ? ' hotbar__slot--active' : ''}`} onClick={() => setTool(id)} aria-pressed={tool === id} aria-label={label}>
                  <span className="hotbar__key">{i + 1}</span>
                  <ToolIcon tool={id} />
                  <span className="hotbar__sub">{sub}</span>
                </button>
              ))}
            </div>
            <div className="bp__hint">
              {tool === 'build' && 'ЛКМ — поставить · зажать ПКМ — выбрать блок · R — другой вариант · средняя кнопка — сдвиг камеры'}
              {tool === 'hammer' && 'Наведи на блок · зажать ПКМ — апгрейд или снос · D — снести · средняя кнопка — сдвиг камеры'}
              {tool === 'deploy' && 'ЛКМ — поставить · зажать ПКМ — выбрать объект · R — направление дроп-бокса · средняя кнопка — сдвиг камеры'}
            </div>
          </div>
        </div>

        <aside className="bp__panel">
          <div className="bp__panel-title">{blueprint?.meta.name ?? source.label}</div>
          <div className="bp__meta">
            Источник: {source.label}
            {blueprint?.meta.gameVersion && <> · игра {blueprint.meta.gameVersion}</>}
          </div>

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

          {resolved && raidBusy && (
            <section className="raid-panel">
              <label className="bp__toggle raid-panel__toggle">
                <input type="checkbox" checked={raidOn} onChange={e => toggleRaid(e.target.checked)} />
                Показать рейд
              </label>
              <p className="raid-panel__hint">Считаю рейд…</p>
            </section>
          )}
          {resolved && !raidBusy && !raid && (
            <section className="raid-panel">
              <label className="bp__toggle raid-panel__toggle">
                <input type="checkbox" checked={raidOn} onChange={e => toggleRaid(e.target.checked)} />
                Показать рейд
              </label>
            </section>
          )}
          {resolved && !raidBusy && raid && sim && (
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

          {resolved && (
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
          )}
        </aside>
      </div>
    </section>
  );
};

export default BlueprintSection;
