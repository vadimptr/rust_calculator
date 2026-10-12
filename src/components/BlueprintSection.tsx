import React, { useMemo, useRef, useState } from 'react';
import Viewer3D from './Viewer3D';
import { BLUEPRINT_PRESETS } from '../blueprint/presets.ts';
import { loadBlueprint, parseBlueprint } from '../blueprint/validate.ts';
import type { LoadResult } from '../blueprint/validate.ts';
import { KINDS } from '../blueprint/catalog.ts';

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
          <Viewer3D resolved={resolved} />
          <div className="bp__hint">ЛКМ — вращать · колесо — приближать · ПКМ — сдвигать</div>
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
