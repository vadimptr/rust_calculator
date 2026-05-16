import React from 'react';
import { Resources } from '../types';
import { UPKEEP_DAYS } from '../data/blocks';
import { formatNum } from './ResourceRow';
import type { ResourceKey } from './ResourceRow';

interface UpkeepTableProps {
  totalUpkeep: Resources;
  hasAny: boolean;
}

const RESOURCE_ORDER: ResourceKey[] = ['straw', 'wood', 'stone', 'metal', 'hqm'];

const RESOURCE_ICONS: Record<ResourceKey, string> = {
  straw: '🌾',
  wood:  '🪵',
  stone: '🪨',
  metal: '⚙️',
  hqm:   '💎',
};

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  straw: 'Солома',
  wood:  'Дерево',
  stone: 'Камень',
  metal: 'Металл',
  hqm:   'МВК',
};

const HIGHLIGHT_DAY = 10;

const UpkeepTable: React.FC<UpkeepTableProps> = ({ totalUpkeep, hasAny }) => {
  if (!hasAny) return null;

  const activeResources = RESOURCE_ORDER.filter(r => totalUpkeep[r] > 0);

  if (activeResources.length === 0) return null;

  return (
    <section className="upkeep-table-section">
      <h2 className="upkeep-table-section__title">Содержание по дням</h2>
      <div className="upkeep-table-wrapper">
        <table className="upkeep-table">
          <thead>
            <tr>
              <th className="upkeep-table__th upkeep-table__th--days">Дни</th>
              {activeResources.map(r => (
                <th key={r} className="upkeep-table__th" style={{ color: `var(--color-${r})` }}>
                  <span className="upkeep-table__th-icon">{RESOURCE_ICONS[r]}</span>
                  <span className="upkeep-table__th-label">{RESOURCE_LABELS[r]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UPKEEP_DAYS.map(day => {
              const isHighlight = day === HIGHLIGHT_DAY;
              return (
                <tr
                  key={day}
                  className={`upkeep-table__row${isHighlight ? ' upkeep-table__row--highlight' : ''}`}
                >
                  <td className="upkeep-table__td upkeep-table__td--days">
                    {day}
                    {isHighlight && <span className="upkeep-table__tag">ref</span>}
                  </td>
                  {activeResources.map(r => (
                    <td key={r} className="upkeep-table__td" style={{ color: `var(--color-${r})` }}>
                      {formatNum(totalUpkeep[r] * day)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UpkeepTable;
