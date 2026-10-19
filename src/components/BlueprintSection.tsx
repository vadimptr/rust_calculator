import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Viewer3D from './Viewer3D';
import type { CameraMode, EditorState, EditorTool, RadialItem } from './Viewer3D';
import { BLUEPRINT_PRESETS } from '../blueprint/presets.ts';
import { loadBlueprint } from '../blueprint/validate.ts';
import type { LoadResult } from '../blueprint/validate.ts';
import { KINDS } from '../blueprint/catalog.ts';
import { RESOURCE_KEYS, costOf } from '../blueprint/cost.ts';
import type { ResourceKey } from '../blueprint/cost.ts';
import { BUILD_PLAN, DEPLOY_PLAN, addDeployable, addElement, newBlueprint, removeDeployable, removeElement, settle, upgradeElement } from '../blueprint/editor.ts';
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

const BUILD_ICONS: Record<ElementKind, string> = {
  'square-foundation': 'foundation', 'triangle-foundation': 'foundation.triangle', 'foundation-steps': 'foundation.steps', 'ramp': 'ramp',
  'square-floor': 'floor', 'triangle-floor': 'floor.triangle', 'floor-frame': 'floor.frame', 'triangle-floor-frame': 'floor.triangle.frame',
  'wall': 'wall', 'doorway': 'wall.doorway', 'window-frame': 'wall.window', 'wall-frame': 'wall.frame', 'half-wall': 'wall.half', 'low-wall': 'wall.low',
  'stairs-l-shape': 'stairs_l', 'u-shaped-stairs': 'stairs_u', 'spiral-stairs': 'stairs_spiral', 'roof': 'roof', 'roof-triangle': 'roof.triangle',
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
  'spiral-stairs': 'Винтовая лестница на половину высоты блока', 'roof': 'Шапка для твоего дома', 'roof-triangle': 'Шапка для твоего дома',
};

const DEPLOY_ICONS: Record<DeployableKind, string> = {
  'wooden-door': 'door.hinged.wood', 'sheet-metal-door': 'door.hinged.metal', 'armored-door': 'door.hinged.toptier',
  'wooden-double-door': 'door.double.hinged.wood', 'sheet-metal-double-door': 'door.double.hinged.metal', 'armored-double-door': 'door.double.hinged.toptier',
  'garage-door': 'wall.frame.garagedoor', 'strengthened-glass-window': 'wall.window.glass.reinforced', 'reinforced-glass-window': 'wall.window.bars.toptier',
  'metal-window-bars': 'wall.window.bars.metal', 'tool-cupboard': 'cupboard.tool', 'drop-box': 'dropbox',
};

/** Радиальные меню: блоки строительного плана, объекты, апгрейд и снос киянкой. */
const RADIAL: Record<EditorTool, RadialItem[]> = {
  build: BUILD_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k], img: `/icons/build/${BUILD_ICONS[k]}.webp`, desc: BUILD_DESCRIPTIONS[k], mono: true })),
  deploy: DEPLOY_PLAN.flatMap(g => g.kinds).map(k => ({ id: k, label: KIND_LABELS[k], short: SHORT_LABELS[k], img: `/icons/items/${DEPLOY_ICONS[k]}.webp` })),
  hammer: [
    { id: 'twig', label: 'Ветки' }, { id: 'wood', label: 'Дерево' }, { id: 'stone', label: 'Камень' },
    { id: 'metal', label: 'Металл' }, { id: 'armored', label: 'МВК' }, { id: 'remove', label: 'Снести' },
  ],  view: [],
};

const EMPTY_RESOLVED: Resolved = { elements: [], deployables: [] };

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
  </svg>
);

interface Source {
  label: string;
  /** Исходный документ (объект). */
  data: unknown;
}

function fromPreset(id: string): Source {
  const p = BLUEPRINT_PRESETS.find(x => x.id === id) ?? BLUEPRINT_PRESETS[0];
  return { label: p.label, data: p.data };
}

/** Начальный пресет: ?bp=<id> в адресе, иначе первый. */
function initialPresetId(): string {
  const wanted = new URLSearchParams(window.location.search).get('bp');
  return BLUEPRINT_PRESETS.some(p => p.id === wanted) ? (wanted as string) : 'empty';
}

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
  const [activePreset, setActivePreset] = useState<string | null>(initialPresetId);
  const [source, setSource] = useState<Source>(() => fromPreset(initialPresetId()));
  const [cameraMode, setCameraMode] = useState<CameraMode>('fly');
  const [raidOn, setRaidOn] = useState(() => new URLSearchParams(window.location.search).get('raid') === '1');
  const [raidMethod, setRaidMethod] = useState<RaidMethod>('optimal');
  const [raidPlay, setRaidPlay] = useState(0);
  const [showImpacts, setShowImpacts] = useState(true);

  // Режим стройки включён всегда: документ правится напрямую
  const [tool, setTool] = useState<EditorTool>('build');
  const [buildKind, setBuildKind] = useState<ElementKind>('square-foundation');
  const [deployKind, setDeployKind] = useState<DeployableKind>('wooden-door');

  // Документ → схема → геометрия
  const result: LoadResult = useMemo(
    () => (source.data === null ? { blueprint: null, resolved: EMPTY_RESOLVED, issues: [] } : loadBlueprint(source.data)),
    [source],
  );

  const choosePreset = (id: string) => {
    setActivePreset(id);
    setSource(fromPreset(id));
    setRaidPlay(0);
  };
  // 1 / 2 / 3 — строительный план, киянка, объект (как слоты в игре)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const t = ({ Digit1: 'build', Digit2: 'hammer', Digit3: 'deploy' } as Record<string, EditorTool>)[e.code];
      if (t) { setTool(cur => (cur === t ? 'view' : t)); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const [collapsedNote, setCollapsedNote] = useState('');
  const applyDoc = useCallback((next: Blueprint) => {
    if (next.elements.length === 0) {
      setCollapsedNote('');
      setSource(s => ({ label: s.label, data: null }));
      setRaidPlay(0);
      return;
    }
    // после каждого действия — обрушение блоков без опоры, как в игре
    const { blueprint: settled, collapsed } = settle(next);
    setCollapsedNote(collapsed.length ? `Обрушилось без опоры: ${collapsed.length} (${collapsed.join(', ')})` : '');
    setSource(s => ({ label: s.label, data: settled }));
    setRaidPlay(0);
  }, []);

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

  const cost = useMemo(() => (resolved && resolved.elements.length > 0 ? costOf(resolved) : null), [resolved]);

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

  return (
    <section className="bp">
      <div className="bp__layout">
        <div className="bp__left">
          <label className="bp__preset">
            <span className="bp__side-title">Шаблон</span>
            <select className="bp__preset-select" value={activePreset ?? ''} onChange={e => choosePreset(e.target.value)}>
              {activePreset === null && <option value="" disabled>{source.label}</option>}
              {BLUEPRINT_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
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

            {cost && (
              <section className="cost">
                <div className="bp__section-title">Стоимость постройки</div>
                <div className="cost__row">
                  {RESOURCE_KEYS.filter(k => cost.build[k] > 0).map(k => (
                    <span key={k} className="cost__res" title={RES_LABELS[k]}><img src={RES_ICONS[k]} alt="" />{formatNum(cost.build[k])}</span>
                  ))}
                </div>
                <div className="bp__section-title">Содержание <UpkeepDays upkeep={cost.upkeep} /></div>
                <div className="cost__row">
                  {RESOURCE_KEYS.filter(k => cost.upkeep[k] > 0).map(k => (
                    <span key={k} className="cost__res" title={RES_LABELS[k]}><img src={RES_ICONS[k]} alt="" />{formatNum(Math.ceil(cost.upkeep[k]))}</span>
                  ))}
                </div>
                <p className="cost__note">Ставка {(cost.rate * 100).toFixed(1)} % от стоимости за {cost.count} {cost.count === 1 ? 'блок' : cost.count < 5 ? 'блока' : 'блоков'} (брекеты игры: 15 по 10 %, 50 по 15 %, 125 по 20 %, дальше 33.3 %), один игрок; шкаф и дроп-боксы не учитываются.</p>
              </section>
            )}
          </aside>
        </div>

        <div className="bp__center">
          <div className="bp__viewer">
            <Viewer3D resolved={resolved} mode={cameraMode} raid={raidView} raidPlay={raidOn ? raidPlay : 0} frameKey={source.label} editor={editor} />
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
              {tool === 'view' && 'Просмотр: ЛКМ по двери — открыть или закрыть · 1 / 2 / 3 — взять инструмент · средняя кнопка — сдвиг камеры'}
              {tool === 'deploy' && 'ЛКМ — поставить · зажать ПКМ — выбрать объект · R — поворот шкафа или направление дроп-бокса · средняя кнопка — сдвиг камеры'}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default BlueprintSection;
