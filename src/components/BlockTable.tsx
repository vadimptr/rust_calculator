import React from 'react';
import { BuildingBlock } from '../types';
import { CATEGORY_LABELS } from '../data/blocks';
import { formatNum } from './ResourceRow';

interface BlockTableProps {
  groupedBlocks: Map<BuildingBlock['category'], BuildingBlock[]>;
  categoryOrder: BuildingBlock['category'][];
  quantities: Record<string, number>;
  onQuantityChange: (id: string, value: number) => void;
}

type ResourceKey = 'straw' | 'wood' | 'stone' | 'metal' | 'hqm';

const RESOURCES: { key: ResourceKey; img: string; label: string; color: string }[] = [
  { key: 'straw', img: '/icons/wood.png',            label: 'Солома',  color: 'var(--straw)'  },
  { key: 'wood',  img: '/icons/wood.png',            label: 'Дерево',  color: 'var(--wood)'   },
  { key: 'stone', img: '/icons/stones.png',          label: 'Камень',  color: 'var(--stone)'  },
  { key: 'metal', img: '/icons/metal.refined.png',   label: 'Металл',  color: 'var(--metal)'  },
  { key: 'hqm',   img: '/icons/metal.fragments.png', label: 'МВК',     color: 'var(--hqm)'    },
];

const COL_COUNT = 1 + RESOURCES.length * 2 + 1; // name + build*5 + upkeep*5 + qty

const BlockTable: React.FC<BlockTableProps> = ({ groupedBlocks, categoryOrder, quantities, onQuantityChange }) => {
  const handleDecrement = (id: string, qty: number) => {
    if (qty > 0) onQuantityChange(id, qty - 1);
  };
  const handleIncrement = (id: string, qty: number) => {
    if (qty < 99) onQuantityChange(id, qty + 1);
  };
  const handleInput = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    onQuantityChange(id, isNaN(raw) ? 0 : Math.min(99, Math.max(0, raw)));
  };

  return (
    <div className="block-table-wrapper">
      <table className="block-table">
        <thead>
          <tr>
            <th className="block-table__th block-table__th--name" rowSpan={2}>Блок</th>
            <th className="block-table__th block-table__th--group" colSpan={5}>Постройка</th>
            <th className="block-table__th block-table__th--group block-table__th--upkeep" colSpan={5}>
              Содержание / день
            </th>
            <th className="block-table__th block-table__th--qty" rowSpan={2}>Кол-во</th>
          </tr>
          <tr>
            {RESOURCES.map(r => (
              <th key={`build-${r.key}`} className="block-table__th block-table__th--res">
                <img className="block-table__res-icon" src={r.img} alt={r.label} />
                <span className="block-table__res-label" style={{ color: r.color }}>{r.label}</span>
              </th>
            ))}
            {RESOURCES.map((r, i) => (
              <th key={`upkeep-${r.key}`} className={`block-table__th block-table__th--res block-table__th--upkeep-res${i === 0 ? ' block-table__th--sep' : ''}`}>
                <img className="block-table__res-icon" src={r.img} alt={r.label} />
                <span className="block-table__res-label" style={{ color: r.color }}>{r.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categoryOrder.map(cat => {
            const catBlocks = groupedBlocks.get(cat) ?? [];
            if (catBlocks.length === 0) return null;
            return (
              <React.Fragment key={cat}>
                <tr className="block-table__category-row">
                  <td colSpan={COL_COUNT} className="block-table__category-cell">
                    {CATEGORY_LABELS[cat]}
                  </td>
                </tr>
                {catBlocks.map(block => {
                  const qty = quantities[block.id] ?? 0;
                  const isActive = qty > 0;
                  return (
                    <tr key={block.id} className={`block-table__row${isActive ? ' block-table__row--active' : ''}`}>
                      <td className="block-table__td block-table__td--name">{block.name}</td>

                      {RESOURCES.map(r => (
                        <td key={`build-${r.key}`} className="block-table__td block-table__td--num">
                          {block.buildCost[r.key] > 0
                            ? <span style={{ color: r.color }}>{formatNum(block.buildCost[r.key])}</span>
                            : <span className="block-table__td--zero">—</span>
                          }
                        </td>
                      ))}

                      {RESOURCES.map((r, i) => (
                        <td key={`upkeep-${r.key}`} className={`block-table__td block-table__td--num block-table__td--upkeep${i === 0 ? ' block-table__td--sep' : ''}`}>
                          {block.upkeepCost[r.key] > 0
                            ? <span style={{ color: r.color }}>{formatNum(block.upkeepCost[r.key])}</span>
                            : <span className="block-table__td--zero">—</span>
                          }
                        </td>
                      ))}

                      <td className="block-table__td block-table__td--qty">
                        <div className="qty-row">
                          <button
                            className="qty-btn qty-btn--minus"
                            onClick={() => handleDecrement(block.id, qty)}
                            disabled={qty === 0}
                            aria-label="Уменьшить"
                          >−</button>
                          <input
                            className={`qty-input${qty > 0 ? ' qty-input--active' : ''}`}
                            type="number"
                            min={0}
                            max={99}
                            value={qty}
                            onChange={e => handleInput(block.id, e)}
                            aria-label={`Количество: ${block.name}`}
                          />
                          <button
                            className="qty-btn qty-btn--plus"
                            onClick={() => handleIncrement(block.id, qty)}
                            disabled={qty === 99}
                            aria-label="Увеличить"
                          >+</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BlockTable;
