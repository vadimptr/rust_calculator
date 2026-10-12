import React, { useMemo, useRef, useState } from 'react';
import Viewer3D from './Viewer3D';
import type { CameraMode } from './Viewer3D';
import { BLUEPRINT_PRESETS } from '../blueprint/presets.ts';
import { loadBlueprint, parseBlueprint } from '../blueprint/validate.ts';
import type { LoadResult } from '../blueprint/validate.ts';
import { KINDS } from '../blueprint/catalog.ts';
import { authoredRaidPath, cheapestRaidPath, raidPolyline } from '../blueprint/raid.ts';
import type { RaidPath } from '../blueprint/raid.ts';
import type { RaidView } from '../blueprint/raidOverlay.ts';
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

type PathChoice = 'cheapest' | 'authored';

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
};

const GRADE_LABELS: Record<string, string> = {
  twig: 'ветки', wood: 'дерево', stone: 'камень', metal: 'металл', armored: 'броня',
};

interface Source {
  label: string;
  result: LoadResult;
}

function fromPreset(id: string): Source {
  const p = BLUEPRINT_PRESETS.find(x => x.id === id) ?? BLUEPRINT_PRESETS[0];
  return { label: p.label, result: loadBlueprint(p.data) };
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
  const [pathChoice, setPathChoice] = useState<PathChoice>('cheapest');
  const [raidPlay, setRaidPlay] = useState(0);

  const choosePreset = (id: string) => {
    setActivePreset(id);
    setSource(fromPreset(id));
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setActivePreset(null);
    setSource({ label: file.name, result: parseBlueprint(text) });
    e.target.value = '';
  };

  const { blueprint, resolved, issues } = source.result;

  // Пути рейда: авторский (raidPath) и самый дешёвый до ячейки шкафа
  const raidPaths = useMemo(() => {
    if (!blueprint || !resolved) return null;
    const tc = resolved.deployables.find(d => d.kind === 'tool-cupboard');
    const targetCell = tc?.parent ?? blueprint.elements.find(e => e.root)?.id;
    if (!targetCell) return null;
    const targetPos = tc?.position ?? resolved.elements.find(e => e.id === targetCell)!.position;
    const cheapest = cheapestRaidPath(resolved, targetCell, raidMethod);
    const authored = blueprint.raidPath?.length ? authoredRaidPath(resolved, blueprint.raidPath, raidMethod) : null;
    const view = (p: RaidPath | null): RaidView | null => (p ? { ids: p.ids, line: raidPolyline(resolved, p, targetPos) } : null);
    return { cheapest, authored, cheapestView: view(cheapest), authoredView: view(authored) };
  }, [blueprint, resolved, raidMethod]);

  const activePath = raidPaths ? (pathChoice === 'authored' && raidPaths.authored ? raidPaths.authored : raidPaths.cheapest) : null;
  const raidView = raidOn && raidPaths
    ? (pathChoice === 'authored' && raidPaths.authoredView ? raidPaths.authoredView : raidPaths.cheapestView)
    : null;

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
          {blueprint?.meta.description && <p className="bp__desc">{blueprint.meta.description}</p>}
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

          {resolved && raidPaths && (
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

                  <div className="raid-panel__choice" role="radiogroup" aria-label="Путь">
                    <label className="bp__toggle">
                      <input type="radio" name="raid-path" checked={pathChoice === 'cheapest'} onChange={() => { setPathChoice('cheapest'); setRaidPlay(0); }} />
                      Самый дешёвый{raidPaths.cheapest ? <> · <b>{formatNum(raidPaths.cheapest.sulfur)}</b> серы</> : null}
                    </label>
                    {raidPaths.authored && (
                      <label className="bp__toggle">
                        <input type="radio" name="raid-path" checked={pathChoice === 'authored'} onChange={() => { setPathChoice('authored'); setRaidPlay(0); }} />
                        Из чертежа · <b>{formatNum(raidPaths.authored.sulfur)}</b> серы
                      </label>
                    )}
                  </div>

                  {raidPaths.cheapest && raidPaths.authored && raidPaths.cheapest.sulfur < raidPaths.authored.sulfur && (
                    <p className="raid-panel__note">
                      Есть путь дешевле авторского на {formatNum(raidPaths.authored.sulfur - raidPaths.cheapest.sulfur)} серы.
                    </p>
                  )}
                  {raidPaths.cheapest && raidPaths.authored && raidPaths.cheapest.sulfur === raidPaths.authored.sulfur
                    && raidPaths.cheapest.ids.join() !== raidPaths.authored.ids.join() && (
                    <p className="raid-panel__note">
                      Путь через стены стоит столько же, сколько через двери: аирлок не удорожает рейд.
                    </p>
                  )}

                  {activePath && (
                    activePath.steps.length === 0 ? (
                      <p className="raid-panel__note">Внутрь можно попасть без взрывчатки: есть свободный проход.</p>
                    ) : (
                      <table className="raid-panel__table">
                        <thead>
                          <tr><th>№</th><th>Что ломаем</th><th>Чем</th><th>Сера</th></tr>
                        </thead>
                        <tbody>
                          {activePath.steps.map((st, i) => (
                            <tr key={st.id}>
                              <td className="raid-panel__n">{i + 1}</td>
                              <td>
                                {KIND_LABELS[st.kind] ?? st.kind}
                                {st.grade ? <span className="bp__counts-grade"> · {GRADE_LABELS[st.grade] ?? st.grade}</span> : null}
                              </td>
                              <td>{st.breakdown.length ? st.breakdown.map(b => `${EXPLOSIVE_SHORT_LABELS[b.explosive]} ×${b.count}`).join(' + ') : 'инструмент'}</td>
                              <td className="bp__counts-n">{formatNum(st.sulfur)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr><td colSpan={3}>Итого</td><td className="bp__counts-n">{formatNum(activePath.sulfur)}</td></tr>
                        </tfoot>
                      </table>
                    )
                  )}

                  {activePath && activePath.steps.length > 0 && (
                    <div className="raid-panel__actions">
                      <button type="button" className="bp__upload-btn" onClick={() => setRaidPlay(n => n + 1)}>Воспроизвести</button>
                      <button type="button" className="raid-tier__btn" onClick={() => setRaidPlay(0)} disabled={raidPlay === 0}>Сбросить</button>
                    </div>
                  )}
                  <p className="raid-panel__hint">Путь ищется по одному уровню; мягкая сторона стен и рейд через крышу не учитываются.</p>
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
