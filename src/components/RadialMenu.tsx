/**
 * Радиальное меню стройки как PieMenu игры: тёмное кольцо с иконками, выбранный сегмент светлее,
 * в центре название и описание.
 */
import React from 'react';

export interface RadialMenuItem { id: string; label: string; short?: string; img?: string; desc?: string; mono?: boolean }

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Pict({ id }: { id: string }) {
  switch (id) {
    case 'twig': return <g {...S}><path d="M5 19L18 6M9 15l-3-5M13 11l5 2M15 9l-1-5" /></g>;
    case 'remove': return <g {...S} stroke="#ff7a6b" strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></g>;
    default: return <g {...S}><rect x="5" y="5" width="14" height="14" /></g>;
  }
}

/** Грейды киянки — иконки материалов из раздела строительства. */
const GRADE_IMG: Record<string, string> = { wood: '/icons/items/wood.webp', stone: '/icons/items/stones.webp', metal: '/icons/items/metal.fragments.webp', armored: '/icons/items/metal.refined.webp' };

function segmentPath(a0: number, a1: number, r0: number, r1: number): string {
  // углы от «вверх» по часовой; SVG: x = sin, y = −cos
  const p = (a: number, r: number) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(a0, r1)} A ${r1} ${r1} 0 ${large} 1 ${p(a1, r1)} L ${p(a1, r0)} A ${r0} ${r0} 0 ${large} 0 ${p(a0, r0)} Z`;
}

interface Props { x: number; y: number; items: RadialMenuItem[]; sel: number; title: string; outer: number }

/** Внешний радиус кольца для n пунктов: картинки ~44 px не налезают друг на друга. */
export function radialOuter(n: number): number {
  return Math.max(120, Math.round((n * 56) / (2 * Math.PI) + 40));
}

const RadialMenu: React.FC<Props> = ({ x, y, items, sel, title, outer }) => {
  const n = items.length;
  const inner = Math.max(52, outer - 82);
  const mid = (inner + outer) / 2;
  const step = (2 * Math.PI) / n;
  const icon = Math.min(46, Math.max(30, step * mid * 0.62));
  return (
    <div className="radial" style={{ left: x, top: y }} aria-hidden="true">
      <svg className="radial__svg" width={outer * 2 + 4} height={outer * 2 + 4} viewBox={`${-outer - 2} ${-outer - 2} ${outer * 2 + 4} ${outer * 2 + 4}`}>
        {items.map((it, i) => (
          <path key={it.id} d={segmentPath(i * step - step / 2, i * step + step / 2, inner, outer)} className={`radial__seg${i === sel ? ' radial__seg--sel' : ''}`} />
        ))}
        <circle r={inner - 4} className="radial__hub" />
      </svg>
      {items.map((it, i) => {
        const a = i * step;
        const img = it.img ?? GRADE_IMG[it.id];
        return (
          <div key={it.id} className={`radial__icon${i === sel ? ' radial__icon--sel' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${Math.sin(a) * mid}px, ${-Math.cos(a) * mid}px)` }}>
            {img
              ? <img src={img} alt="" width={icon} height={icon} className={it.mono ? 'radial__mono' : undefined} />
              : <svg width={icon} height={icon} viewBox="0 0 24 24"><Pict id={it.id} /></svg>}
            {i === sel && <span className="radial__caption">{it.short ?? it.label}</span>}
          </div>
        );
      })}
      <div className="radial__center">
        <div className="radial__title">{sel >= 0 ? items[sel].label : title}</div>
        {sel >= 0 && items[sel].desc && <div className="radial__desc">{items[sel].desc}</div>}
      </div>
    </div>
  );
};

export default RadialMenu;
