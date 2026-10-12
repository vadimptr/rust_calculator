import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { blocks } from './data/blocks';
import { Quantities, Resources, BuildingBlock, Tier, RaidSelection } from './types';
import { DEFAULT_TIER } from './data/raidData';
import { calculateRaidCost } from './logic/raidCalculator';
import BlockTable from './components/BlockTable';
import Presets from './components/Presets';
import Summary from './components/Summary';
import RaidTable from './components/RaidTable';

const BlueprintSection = lazy(() => import('./components/BlueprintSection'));

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

type Section = 'build' | 'view';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'build', label: 'Строительство' },
  { id: 'view', label: '3D-просмотр' },
];

function sectionFromHash(): Section {
  const h = window.location.hash.replace('#', '');
  return SECTIONS.some(s => s.id === h) ? (h as Section) : 'build';
}

function App() {
  const [quantities, setQuantities] = useState<Quantities>(initialQuantities);
  const [raidTier, setRaidTier] = useState<Tier>(DEFAULT_TIER);
  const [section, setSection] = useState<Section>(sectionFromHash);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectSection = (s: Section) => {
    setSection(s);
    window.history.replaceState(null, '', s === 'build' ? window.location.pathname : `#${s}`);
  };

  const setQuantity = (id: string, value: number) => {
    setQuantities(prev => ({ ...prev, [id]: value }));
  };

  const resetAll = () => {
    setQuantities(initialQuantities);
    setRaidTier(DEFAULT_TIER);
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

  const raidRows = useMemo(() => {
    const selections: RaidSelection[] = blocks
      .filter(b => (quantities[b.id] ?? 0) > 0)
      .map(b => ({ tier: raidTier, quantity: quantities[b.id] }));
    return calculateRaidCost(selections);
  }, [quantities, raidTier]);

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
            Расчёт стоимости постройки, содержания и рейда базы
          </p>
          <nav className="tabs" aria-label="Разделы">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`tabs__btn${s.id === section ? ' tabs__btn--active' : ''}`}
                onClick={() => selectSection(s.id)}
                aria-pressed={s.id === section}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {section === 'view' ? (
        <div className="app-layout app-layout--wide">
          <main className="app-main">
            <Suspense fallback={<div className="bp__loading">Загрузка 3D…</div>}>
              <BlueprintSection />
            </Suspense>
          </main>
        </div>
      ) : (
        <div className="app-layout">
          <main className="app-main">
            <Presets onApply={applyPreset} />
            <BlockTable
              groupedBlocks={groupedBlocks}
              categoryOrder={CATEGORY_ORDER}
              quantities={quantities}
              onQuantityChange={setQuantity}
            />
            <RaidTable
              rows={raidRows}
              tier={raidTier}
              onTierChange={setRaidTier}
              hasAny={hasAny}
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
      )}
    </div>
  );
}

export default App;
