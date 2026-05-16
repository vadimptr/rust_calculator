import React from 'react';
import { BuildingBlock } from '../types';
import { CATEGORY_LABELS } from '../data/blocks';
import ResourceRow from './ResourceRow';
import type { ResourceKey } from './ResourceRow';

interface BlockCardProps {
  block: BuildingBlock;
  quantity: number;
  onQuantityChange: (id: string, value: number) => void;
}

const RESOURCE_ORDER: ResourceKey[] = ['straw', 'wood', 'stone', 'metal', 'hqm'];

const BlockCard: React.FC<BlockCardProps> = ({ block, quantity, onQuantityChange }) => {
  const isActive = quantity > 0;

  const handleDecrement = () => {
    if (quantity > 0) onQuantityChange(block.id, quantity - 1);
  };

  const handleIncrement = () => {
    if (quantity < 99) onQuantityChange(block.id, quantity + 1);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    if (isNaN(raw)) {
      onQuantityChange(block.id, 0);
    } else {
      onQuantityChange(block.id, Math.min(99, Math.max(0, raw)));
    }
  };

  const hasBuildResources = RESOURCE_ORDER.some(r => block.buildCost[r] > 0);
  const hasUpkeepResources = RESOURCE_ORDER.some(r => block.upkeepCost[r] > 0);

  return (
    <div className={`block-card${isActive ? ' block-card--active' : ''}`}>
      <div className="block-card__header">
        <span className="block-card__name">{block.name}</span>
        <span className={`block-card__badge block-card__badge--${block.category}`}>
          {CATEGORY_LABELS[block.category]}
        </span>
      </div>

      <div className="block-card__costs">
        {hasBuildResources && (
          <div className="block-card__cost-section">
            <div className="block-card__cost-label">Постройка</div>
            <div className="block-card__resources">
              {RESOURCE_ORDER.map(r =>
                block.buildCost[r] > 0 ? (
                  <ResourceRow key={r} resource={r} value={block.buildCost[r]} size="sm" />
                ) : null
              )}
            </div>
          </div>
        )}
        {hasUpkeepResources && (
          <div className="block-card__cost-section">
            <div className="block-card__cost-label">Содержание/день</div>
            <div className="block-card__resources">
              {RESOURCE_ORDER.map(r =>
                block.upkeepCost[r] > 0 ? (
                  <ResourceRow key={r} resource={r} value={block.upkeepCost[r]} size="sm" />
                ) : null
              )}
            </div>
          </div>
        )}
      </div>

      <div className="block-card__qty">
        <button
          className="qty-btn qty-btn--minus"
          onClick={handleDecrement}
          disabled={quantity === 0}
          aria-label="Уменьшить количество"
        >
          −
        </button>
        <input
          className="qty-input"
          type="number"
          min={0}
          max={99}
          value={quantity}
          onChange={handleInput}
          aria-label={`Количество: ${block.name}`}
        />
        <button
          className="qty-btn qty-btn--plus"
          onClick={handleIncrement}
          disabled={quantity === 99}
          aria-label="Увеличить количество"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default BlockCard;
