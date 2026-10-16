import React from 'react';
import { presets } from '../data/presets';
import { blocks } from '../data/blocks';
import type { Quantities } from '../types';

interface PresetsProps {
  quantities: Quantities;
  onApply: (quantities: Record<string, number>) => void;
}

/** Пресет активен, если текущие количества в точности совпадают с ним. */
function matches(quantities: Quantities, preset: Record<string, number>): boolean {
  return blocks.every(b => (quantities[b.id] ?? 0) === (preset[b.id] ?? 0));
}

const Presets: React.FC<PresetsProps> = ({ quantities, onApply }) => {
  return (
    <div className="presets">
      <div className="bp__presets" role="group" aria-label="Готовые наборы блоков">
        {presets.map(p => {
          const active = matches(quantities, p.quantities);
          return (
            <button
              key={p.id}
              type="button"
              className={`raid-tier__btn${active ? ' raid-tier__btn--active' : ''}`}
              onClick={() => onApply(p.quantities)}
              aria-pressed={active}
              title={p.label}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Presets;
