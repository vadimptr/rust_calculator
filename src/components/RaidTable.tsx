import React from 'react';
import type { ExplosiveCost, RaidRow, Tier } from '../types';
import { TIER_LABELS, TIER_ORDER, EXPLOSIVE_SHORT_LABELS } from '../data/raidData';
import { formatNum } from './ResourceRow';

interface RaidTableProps {
  rows: RaidRow[];
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  hasAny: boolean;
}

interface RaidColumn {
  key: string;
  label: string;
  value: (r: ExplosiveCost) => number;
}

const RAID_COLUMNS: RaidColumn[] = [
  { key: 'sulfur',         label: 'Сера',          value: r => r.sulfur ?? 0 },
  { key: 'charcoal',       label: 'Порох / уголь', value: r => r.charcoal ?? 0 },
  { key: 'metalFragments', label: 'Металл',        value: r => r.metalFragments ?? 0 },
  { key: 'cloth',          label: 'Ткань',         value: r => r.cloth ?? 0 },
  { key: 'pipes',          label: 'Трубы',         value: r => r.pipes ?? 0 },
  { key: 'rope',           label: 'Верёвка',       value: r => r.rope ?? 0 },
  { key: 'techTrash',      label: 'Tech Trash',    value: r => r.techTrash ?? 0 },
  { key: 'other',          label: 'Прочие',        value: r => (r.lowGradeFuel ?? 0) + (r.explosives ?? 0) },
];

function renderBreakdown(row: RaidRow): string {
  if (!row.supported || row.breakdown.length === 0) return '—';
  return row.breakdown
    .map(b => `${EXPLOSIVE_SHORT_LABELS[b.explosive]} ×${b.count}`)
    .join(' + ');
}

const RaidTable: React.FC<RaidTableProps> = ({ rows, tier, onTierChange, hasAny }) => {
  return (
    <section className="raid-section">
      <div className="raid-section__head">
        <h2 className="raid-section__title">Стоимость рейда</h2>
        <div className="raid-tier" role="group" aria-label="Тир постройки">
          {TIER_ORDER.map(t => (
            <button
              key={t}
              type="button"
              className={`raid-tier__btn${t === tier ? ' raid-tier__btn--active' : ''}`}
              onClick={() => onTierChange(t)}
              aria-pressed={t === tier}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {!hasAny ? (
        <div className="raid-section__placeholder">
          Добавьте блоки для расчёта рейда
        </div>
      ) : (
        <div className="raid-table-wrapper">
          <table className="raid-table">
            <thead>
              <tr>
                <th className="raid-table__th raid-table__th--name">Чем рейдим</th>
                <th className="raid-table__th raid-table__th--count">Кол-во взрывчатки</th>
                {RAID_COLUMNS.map(col => (
                  <th key={col.key} className="raid-table__th">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isOptimal = row.method === 'optimal';
                return (
                  <tr
                    key={row.method}
                    className={`raid-table__row${isOptimal ? ' raid-table__row--optimal' : ''}`}
                  >
                    <td className="raid-table__td raid-table__td--name">{row.label}</td>
                    <td className="raid-table__td raid-table__td--count">
                      {renderBreakdown(row)}
                    </td>
                    {RAID_COLUMNS.map(col => {
                      const v = row.supported ? col.value(row.resources) : 0;
                      return (
                        <td key={col.key} className="raid-table__td raid-table__td--num">
                          {row.supported && v > 0
                            ? formatNum(v)
                            : <span className="raid-table__td--zero">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default RaidTable;
