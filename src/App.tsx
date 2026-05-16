import { useState, useMemo } from 'react';
import { blocks } from './data/blocks';
import { Quantities, Resources, BuildingBlock } from './types';
import BlockTable from './components/BlockTable';
import Presets from './components/Presets';
import Summary from './components/Summary';

import './App.css';

const EMPTY_RESOURCES: Resources = { straw: 0, wood: 0, stone: 0, metal: 0, hqm: 0 };

function addResources(a: Resources, b: Resources): Resources {
  return {
    straw: a.straw + b.straw,
    wood:  a.wood  + b.wood,
    stone: a.stone + b.stone,
    metal: a.metal + b.metal,
    hqm:   a.hqm   + b.hqm,
  };
}

function scaleResources(r: Resources, factor: number): Resources {
  return {
    straw: r.straw * factor,
    wood:  r.wood  * factor,
    stone: r.stone * factor,
    metal: r.metal * factor,
    hqm:   r.hqm   * factor,
  };
}

const initialQuantities: Quantities = Object.fromEntries(
  blocks.map(b => [b.id, 0])
);

const CATEGORY_ORDER: BuildingBlock['category'][] = [
  'foundation', 'floor', 'wall', 'opening', 'window', 'stairs', 'roof',
];

function App() {
  const [quantities, setQuantities] = useState<Quantities>(initialQuantities);

  const setQuantity = (id: string, value: number) => {
    setQuantities(prev => ({ ...prev, [id]: value }));
  };

  const resetAll = () => {
    setQuantities(initialQuantities);
  };

  const applyPreset = (preset: Record<string, number>) => {
    setQuantities({ ...initialQuantities, ...preset });
  };

  const { totalBuild, totalUpkeep, hasAny } = useMemo(() => {
    let build = { ...EMPTY_RESOURCES };
    let upkeep = { ...EMPTY_RESOURCES };
    let anyNonZero = false;

    for (const block of blocks) {
      const qty = quantities[block.id] ?? 0;
      if (qty > 0) {
        anyNonZero = true;
        build  = addResources(build,  scaleResources(block.buildCost,  qty));
        upkeep = addResources(upkeep, scaleResources(block.upkeepCost, qty));
      }
    }

    return { totalBuild: build, totalUpkeep: upkeep, hasAny: anyNonZero };
  }, [quantities]);

  const groupedBlocks = useMemo(() => {
    const map = new Map<BuildingBlock['category'], BuildingBlock[]>();
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, blocks.filter(b => b.category === cat));
    }
    return map;
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__title">
            <span className="app-header__rust">RUST</span>
            {' '}Калькулятор постройки
          </h1>
          <p className="app-header__subtitle">
            Расчёт стоимости постройки и содержания базы
          </p>
        </div>
      </header>

      <div className="app-layout">
        <main className="app-main">
          <Presets onApply={applyPreset} />
          <BlockTable
            groupedBlocks={groupedBlocks}
            categoryOrder={CATEGORY_ORDER}
            quantities={quantities}
            onQuantityChange={setQuantity}
          />


        </main>

        <aside className="app-sidebar">
          <div className="app-sidebar__sticky">
            <Summary
              totalBuild={totalBuild}
              totalUpkeep={totalUpkeep}
              hasAny={hasAny}
              onReset={resetAll}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
