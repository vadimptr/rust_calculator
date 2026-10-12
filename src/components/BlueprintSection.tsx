import React, { useEffect, useMemo, useRef, useState } from 'react';
import Viewer3D from './Viewer3D';
import type { CameraMode } from './Viewer3D';
import { BLUEPRINT_PRESETS } from '../blueprint/presets.ts';
import { loadBlueprint } from '../blueprint/validate.ts';
import type { LoadResult } from '../blueprint/validate.ts';
import { KINDS } from '../blueprint/catalog.ts';

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
  'roof': 'Крыша',
  'roof-triangle': 'Треугольная крыша',
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

/** В рейде пол ломают сверху, поэтому называем его потолком. */
const RAID_KIND_LABELS: Record<string, string> = {
  'square-floor': 'Потолок',
  'triangle-floor': 'Треугольный потолок',
};
const raidLabel = (kind: string) => RAID_KIND_LABELS[kind] ?? KIND_LABELS[kind] ?? kind;

const GRADE_LABELS: Record<string, string> = {
  twig: 'ветки', wood: 'дерево', stone: 'камень', metal: 'металл', armored: 'броня',
};

interface Source {
  label: string;
  /** Исходный документ (объект) — для повторной загрузки с переопределениями. */
  data: unknown;
}

function fromPreset(id: string): Source {
  const p = BLUEPRINT_PRESETS.find(x => x.id === id) ?? BLUEPRINT_PRESETS[0];
  return { label: p.label, data: p.data };
}

/** Начальный пресет: ?bp=<id> в адресе, иначе первый. */
function initialPresetId(): string {
  const wanted = new URLSearchParams(window.location.search).get('bp');
  return BLUEPRINT_PRESETS.some(p => p.id === wanted) ? (wanted as string) : BLUEPRINT_PRESETS[0].id;
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

  // Документ с переопределениями → схема → геометрия
  const result: LoadResult = useMemo(() => loadBlueprint(applyOverrides(source.data, gradeChoice, doorChoice)), [source, gradeChoice, doorChoice]);

  const choosePreset = (id: string) => {
    setActivePreset(id);
    setSource(fromPreset(id));
    setRaidPlay(0);
  };

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

  return (
    <section className="bp">
      <div className="bp__toolbar">
        <div className="bp__presets" role="group" aria-label="Готовые постройки">
          {BLUEPRINT_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`raid-tier__btn${p.id === activePreset ? ' raid-tier__btn--active' : ''}`}
              onClick={() => choosePreset(p.id)}
              aria-pressed={p.id === activePreset}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="bp__upload">
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
          <div className="bp__presets" role="group" aria-label="Камера">
            {([['orbit', 'Орбита'], ['fly', 'Полёт']] as [CameraMode, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`raid-tier__btn${id === cameraMode ? ' raid-tier__btn--active' : ''}`}
                onClick={() => setCameraMode(id)}
                aria-pressed={id === cameraMode}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="bp__toggle">
            <input type="checkbox" checked={doorsOpen} onChange={e => setDoorsOpen(e.target.checked)} />
            Открыть двери
          </label>
        </div>
        <div className="bp__upload bp__overrides">
          <span className="bp__override-label">Материал</span>
          <div className="bp__icons" role="group" aria-label="Материал конструкций">
            {GRADE_CHOICES.map(c => (
              <button key={c.id} type="button" title={c.label} className={`bp__icon-btn${c.id === gradeChoice ? ' bp__icon-btn--active' : ''}`}
                onClick={() => { setGradeChoice(c.id); setRaidPlay(0); }} aria-pressed={c.id === gradeChoice} aria-label={c.label}>
                <img src={c.img} alt="" />
              </button>
            ))}
          </div>
          <span className="bp__override-label">Двери</span>
          <div className="bp__icons" role="group" aria-label="Тип дверей">
            {DOOR_CHOICES.map(c => (
              <button key={c.id} type="button" title={c.label} className={`bp__icon-btn${c.id === doorChoice ? ' bp__icon-btn--active' : ''}`}
                onClick={() => { setDoorChoice(c.id); setRaidPlay(0); }} aria-pressed={c.id === doorChoice} aria-label={c.label}>
                <img src={c.img} alt="" /><DoorBadge wide={c.wide} />
              </button>
            ))}
          </div>
          <button type="button" className="bp__upload-btn" onClick={() => fileRef.current?.click()}>
            Загрузить JSON
          </button>
          <a className="bp__spec-link" href="https://github.com/vadimptr/rust_calculator/blob/main/docs/blueprint/SPEC.md" target="_blank" rel="noreferrer">
            формат чертежа
          </a>
        </div>
      </div>

      <div className="bp__layout">
        <div className="bp__viewer">
          <Viewer3D resolved={resolved} mode={cameraMode} doorsOpen={doorsOpen} raid={raidView} raidPlay={raidOn ? raidPlay : 0} />
          <div className="bp__hint">
            {cameraMode === 'orbit'
              ? 'ЛКМ — вращать · колесо — приближать · ПКМ — сдвигать'
              : 'Клик по сцене — захват мыши · мышь — смотреть · WASD — лететь · Space / C — вверх / вниз · Shift — быстрее · Esc — отпустить'}
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
                  <p className="raid-panel__hint">Путь ищется по стенам, дверям, полам и крыше; мягкая сторона стен не учитывается. «Оптимально» смешивает ракеты, C4 и разрывные; сплеш у каждого свой, радиусы приблизительные, закрытые двери и полы его не пропускают.</p>
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
