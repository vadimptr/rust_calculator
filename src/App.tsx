import { lazy, Suspense } from 'react';

const BlueprintSection = lazy(() => import('./components/BlueprintSection'));

import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__title">
            <span className="app-header__rust">RUST</span>
            {' '}Калькулятор постройки
          </h1>
          <p className="app-header__subtitle">
            Стройка как в игре, стоимость, содержание и рейд базы
          </p>
        </div>
      </header>
      <div className="app-layout app-layout--wide">
        <main className="app-main">
          <Suspense fallback={<div className="bp__loading">Загрузка 3D…</div>}>
            <BlueprintSection />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;
