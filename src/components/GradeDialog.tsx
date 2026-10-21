import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BUILD_PLAN, GRADES, regradeTargets } from '../blueprint/editor.ts';
import type { Regrade } from '../blueprint/editor.ts';
import type { Blueprint, ElementKind, Grade } from '../blueprint/types.ts';

interface Props {
  open: boolean;
  blueprint: Blueprint | null;
  kindLabels: Record<string, string>;
  gradeLabels: Record<Grade, string>;
  onApply: (r: Regrade) => void;
  onClose: () => void;
}

const GradeDialog: React.FC<Props> = ({ open, blueprint, kindLabels, gradeLabels, onApply, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const counts = useMemo(() => {
    const m = new Map<ElementKind, number>();
    for (const e of blueprint?.elements ?? []) m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    return m;
  }, [blueprint]);
  const groups = useMemo(() => BUILD_PLAN.map(g => ({ group: g.group, kinds: g.kinds.filter(k => counts.has(k)) })).filter(g => g.kinds.length), [counts]);
  const [kinds, setKinds] = useState<Set<ElementKind>>(new Set());
  const [from, setFrom] = useState<Grade | 'any'>('any');
  const [to, setTo] = useState<Grade>('stone');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setKinds(new Set(counts.keys()));
      setFrom('any');
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [open]);

  const request: Regrade = { kinds: [...kinds], from, to };
  const targets = blueprint ? regradeTargets(blueprint, request).length : 0;
  const all = kinds.size === counts.size;
  const toggle = (k: ElementKind) => setKinds(cur => { const next = new Set(cur); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  const toggleGroup = (ks: ElementKind[]) => setKinds(cur => {
    const next = new Set(cur);
    const on = ks.every(k => next.has(k));
    for (const k of ks) { if (on) next.delete(k); else next.add(k); }
    return next;
  });

  return (
    <dialog ref={ref} className="grade-dialog" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }} aria-labelledby="grade-dialog-title">
      <form method="dialog" className="grade-dialog__body" onSubmit={e => { e.preventDefault(); if (targets) onApply(request); }}>
        <h2 id="grade-dialog-title" className="grade-dialog__title">Сменить материал блоков</h2>

        <section className="grade-dialog__section">
          <div className="grade-dialog__head">
            <span className="bp__section-title">Типы блоков</span>
            <button type="button" className="grade-dialog__link" onClick={() => setKinds(all ? new Set() : new Set(counts.keys()))}>{all ? 'Снять все' : 'Выбрать все'}</button>
          </div>
          {groups.length === 0 && <p className="grade-dialog__empty">В схеме пока нет блоков</p>}
          <div className="grade-dialog__groups">
            {groups.map(g => (
              <fieldset key={g.group} className="grade-dialog__group">
                <legend>
                  <label className="grade-dialog__check grade-dialog__check--group">
                    <input type="checkbox" checked={g.kinds.every(k => kinds.has(k))} ref={el => { if (el) el.indeterminate = g.kinds.some(k => kinds.has(k)) && !g.kinds.every(k => kinds.has(k)); }} onChange={() => toggleGroup(g.kinds)} />
                    {g.group}
                  </label>
                </legend>
                {g.kinds.map(k => (
                  <label key={k} className="grade-dialog__check">
                    <input type="checkbox" checked={kinds.has(k)} onChange={() => toggle(k)} />
                    <span>{kindLabels[k] ?? k}</span>
                    <span className="grade-dialog__count">×{counts.get(k)}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>

        <section className="grade-dialog__section">
          <span className="bp__section-title">Из материала</span>
          <div className="grade-dialog__grades" role="radiogroup" aria-label="Из материала">
            {(['any', ...GRADES] as (Grade | 'any')[]).map(g => (
              <button key={g} type="button" role="radio" aria-checked={from === g} className={`raid-tier__btn raid-tier__btn--sm${from === g ? ' raid-tier__btn--active' : ''}`} onClick={() => setFrom(g)}>
                {g === 'any' ? 'Любой' : gradeLabels[g]}
              </button>
            ))}
          </div>
        </section>

        <section className="grade-dialog__section">
          <span className="bp__section-title">В материал</span>
          <div className="grade-dialog__grades" role="radiogroup" aria-label="В материал">
            {GRADES.map(g => (
              <button key={g} type="button" role="radio" aria-checked={to === g} className={`raid-tier__btn raid-tier__btn--sm${to === g ? ' raid-tier__btn--active' : ''}`} onClick={() => setTo(g)}>
                {gradeLabels[g]}
              </button>
            ))}
          </div>
        </section>

        <p className="grade-dialog__summary">{targets ? `Изменится блоков: ${targets}` : 'Под выбор не попал ни один блок'}</p>
        <div className="grade-dialog__actions">
          <button type="button" className="raid-tier__btn" onClick={onClose}>Отмена</button>
          <button type="submit" className="bp__upload-btn" disabled={!targets}>Изменить</button>
        </div>
      </form>
    </dialog>
  );
};

export default GradeDialog;
