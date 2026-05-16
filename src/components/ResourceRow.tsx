import React from 'react';

type ResourceKey = 'straw' | 'wood' | 'stone' | 'metal' | 'hqm';

interface ResourceRowProps {
  resource: ResourceKey;
  value: number;
  size?: 'sm' | 'md' | 'lg';
}

const RESOURCE_CONFIG: Record<ResourceKey, { icon: string; label: string; colorVar: string }> = {
  straw: { icon: '🌾', label: 'Солома',    colorVar: 'var(--color-straw)' },
  wood:  { icon: '🪵', label: 'Дерево',    colorVar: 'var(--color-wood)'  },
  stone: { icon: '🪨', label: 'Камень',    colorVar: 'var(--color-stone)' },
  metal: { icon: '⚙️', label: 'Металл',    colorVar: 'var(--color-metal)' },
  hqm:   { icon: '💎', label: 'МВК',       colorVar: 'var(--color-hqm)'   },
};

function formatNum(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ');
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, value, size = 'md' }) => {
  if (value === 0) return null;

  const cfg = RESOURCE_CONFIG[resource];

  return (
    <span className={`resource-row resource-row--${size}`} style={{ color: cfg.colorVar }}>
      <span className="resource-row__icon">{cfg.icon}</span>
      <span className="resource-row__value">{formatNum(value)}</span>
    </span>
  );
};

export default ResourceRow;
export { RESOURCE_CONFIG, formatNum };
export type { ResourceKey };
