import React from 'react';
import { presets } from '../data/presets';

interface PresetsProps {
  onApply: (quantities: Record<string, number>) => void;
}

const Presets: React.FC<PresetsProps> = ({ onApply }) => {
  return (
    <div className="presets">
      {presets.map(p => (
        <button
          key={p.id}
          className="preset-btn"
          onClick={() => onApply(p.quantities)}
          title={p.label}
        >
          <span className="preset-btn__icon">{p.icon}</span>
          <span className="preset-btn__label">{p.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Presets;
