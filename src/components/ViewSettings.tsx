import React, { useEffect, useRef, useState } from 'react';
import type { CameraMode } from './Viewer3D';

interface Toggle {
  label: string;
  hint: string;
  on: boolean;
  set: (v: boolean) => void;
  muted?: string;
}

interface Props {
  camera: CameraMode;
  setCamera: (m: CameraMode) => void;
  fov: number;
  fovRange: { min: number; max: number; default: number };
  setFov: (v: number) => void;
  toggles: Toggle[];
}

const ViewSettings: React.FC<Props> = ({ camera, setCamera, fov, fovRange, setFov, toggles }) => {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setPinned(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.code === 'Escape') setPinned(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [pinned]);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    setHover(true);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(false), 250);
  };
  const open = hover || pinned;

  return (
    <div className="view-settings" ref={root} onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" className={`bp__icon-btn view-settings__btn${open ? ' bp__icon-btn--active' : ''}`} onClick={() => setPinned(v => !v)} aria-expanded={open} aria-haspopup="true" aria-label="Настройки сцены">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div className="view-settings__menu" role="menu">
          <div className="view-settings__title">Камера</div>
          <div className="view-settings__seg" role="group" aria-label="Камера">
            {([['fly', 'Полёт', 'Клик по сцене — захват мыши, WASD — лететь, Esc — отпустить'], ['orbit', 'Орбита', 'Вращать перетаскиванием, колесо — приближать']] as [CameraMode, string, string][]).map(([id, label, hint]) => (
              <button key={id} type="button" className={camera === id ? 'view-settings__seg--on' : ''} onClick={() => setCamera(id)} aria-pressed={camera === id} title={hint}>{label}</button>
            ))}
          </div>
          <label className="view-settings__fov" title={`Угол обзора по вертикали, как graphics.fov в игре; двойной клик — ${fovRange.default}°`}>
            <span>Обзор</span>
            <input type="range" min={fovRange.min} max={fovRange.max} step={1} value={fov} onChange={e => setFov(Number(e.target.value))} onDoubleClick={() => setFov(fovRange.default)} aria-label="Угол обзора" />
            <output>{fov}°</output>
          </label>
          <div className="view-settings__title">Показывать</div>
          {toggles.map(t => (
            <label key={t.label} className="view-settings__row">
              <input type="checkbox" checked={t.on} onChange={e => t.set(e.target.checked)} />
              <span>
                {t.label}
                {t.muted && <em> · {t.muted}</em>}
                <small>{t.hint}</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewSettings;
