import React from 'react';
import { presets } from '../data/presets';

interface PresetsProps {
  onApply: (quantities: Record<string, number>) => void;
}

const StructureIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* foundation */}
    <rect x="4" y="28" width="28" height="3" rx="1" fill="currentColor" opacity="0.5"/>
    {/* left wall */}
    <rect x="4" y="12" width="3" height="16" rx="1" fill="currentColor"/>
    {/* right wall */}
    <rect x="29" y="12" width="3" height="16" rx="1" fill="currentColor"/>
    {/* roof left */}
    <line x1="5" y1="13" x2="18" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    {/* roof right */}
    <line x1="31" y1="13" x2="18" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    {/* cross beam */}
    <rect x="4" y="20" width="28" height="2" rx="1" fill="currentColor" opacity="0.4"/>
  </svg>
);

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
          <StructureIcon />
          <span className="preset-btn__label">{p.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Presets;
