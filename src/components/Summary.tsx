import React from 'react';
import { Resources } from '../types';
import { formatNum } from './ResourceRow';
import type { ResourceKey } from './ResourceRow';

interface SummaryProps {
  totalBuild: Resources;
  totalUpkeep: Resources;
  hasAny: boolean;
  onReset: () => void;
}

const RESOURCE_ORDER: ResourceKey[] = ['straw', 'wood', 'stone', 'metal', 'hqm'];

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  straw: 'Солома',
  wood:  'Дерево',
  stone: 'Камень',
  metal: 'Металл',
  hqm:   'МВК',
};

const RESOURCE_ICONS: Record<ResourceKey, string> = {
  straw: '/icons/wood.png',
  wood:  '/icons/wood.png',
  stone: '/icons/stones.png',
  metal: '/icons/metal.refined.png',
  hqm:   '/icons/metal.fragments.png',
};

const UPKEEP_DAYS = [1, 3, 5, 10, 15, 20, 25];

const Summary: React.FC<SummaryProps> = ({ totalBuild, totalUpkeep, hasAny, onReset }) => {
  const activeUpkeepResources = RESOURCE_ORDER.filter(r => totalUpkeep[r] > 0);

  return (
    <aside className="summary">
      <div className="summary__title">Итого</div>

      {!hasAny ? (
        <div className="summary__placeholder">
          Добавьте блоки для расчёта
        </div>
      ) : (
        <>
          <section className="summary__section">
            <div className="summary__section-title">Постройка</div>
            <div className="summary__rows">
              {RESOURCE_ORDER.map(r =>
                totalBuild[r] > 0 ? (
                  <div key={r} className="summary__row">
                    <span className="summary__row-label">
                      <img className="summary__row-icon" src={RESOURCE_ICONS[r]} alt={RESOURCE_LABELS[r]} />
                      {RESOURCE_LABELS[r]}
                    </span>
                    <span className="summary__row-value" style={{ color: `var(--color-${r})` }}>
                      {formatNum(totalBuild[r])}
                    </span>
                  </div>
                ) : null
              )}
              {RESOURCE_ORDER.every(r => totalBuild[r] === 0) && (
                <div className="summary__empty">—</div>
              )}
            </div>
          </section>

          <section className="summary__section">
            <div className="summary__section-title">Содержание</div>
            {activeUpkeepResources.length === 0 ? (
              <div className="summary__empty">—</div>
            ) : (
              <div className="summary__upkeep-table-wrap">
                <table className="summary__upkeep-table">
                  <thead>
                    <tr>
                      <th className="summary__upkeep-th summary__upkeep-th--days">Дни</th>
                      {activeUpkeepResources.map(r => (
                        <th key={r} className="summary__upkeep-th">
                          <img
                            className="summary__upkeep-icon"
                            src={RESOURCE_ICONS[r]}
                            alt={RESOURCE_LABELS[r]}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {UPKEEP_DAYS.map(day => (
                      <tr key={day} className="summary__upkeep-row">
                        <td className="summary__upkeep-td summary__upkeep-td--days">{day}</td>
                        {activeUpkeepResources.map(r => (
                          <td key={r} className="summary__upkeep-td" style={{ color: `var(--color-${r})` }}>
                            {formatNum(totalUpkeep[r] * day)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <button className="summary__reset" onClick={onReset} disabled={!hasAny}>
        Сбросить всё
      </button>
    </aside>
  );
};

export default Summary;
