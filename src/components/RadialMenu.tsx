/**
 * Радиальное меню стройки: кольцо сегментов с крупными картинками, выбранный сегмент подсвечен,
 * его подпись — мелко у картинки и в центре.
 */
import React from 'react';

export interface RadialMenuItem { id: string; label: string; short?: string }

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = (o = 0.25) => ({ fill: 'currentColor', fillOpacity: o });

const DOOR_FILL: Record<string, string> = { wooden: '#c79a64', 'sheet-metal': '#b0643a', armored: '#6f757d', garage: '#b0643a' };

/** Пиктограммы 24×24 для конструкций, объектов и действий киянки. */
function Pict({ id }: { id: string }) {
  switch (id) {
    case 'square-foundation': return <g {...S}><path d="M3 10l9-4 9 4-9 4z" {...F()} /><path d="M3 10v4l9 4 9-4v-4M12 14v4" /></g>;
    case 'triangle-foundation': return <g {...S}><path d="M4 11l14-4-4 8z" {...F()} /><path d="M4 11v3l10 4v-3M18 7v3l-4 8" /></g>;
    case 'foundation-steps': return <g {...S}><path d="M3 20h18V8h-5v4h-5v4H6v4" {...F()} /></g>;
    case 'ramp': return <g {...S}><path d="M3 19h18V9z" {...F()} /></g>;
    case 'wall': return <g {...S}><rect x="4" y="4" width="16" height="16" {...F()} /><path d="M4 9h16M4 14h16M10 4v5M15 9v5M10 14v6" opacity="0.6" /></g>;
    case 'half-wall': return <g {...S}><rect x="4" y="12" width="16" height="8" {...F()} /><path d="M4 16h16M10 12v4M15 16v4" opacity="0.6" /><path d="M4 4v8M20 4v8" opacity="0.3" /></g>;
    case 'low-wall': return <g {...S}><rect x="4" y="15" width="16" height="5" {...F()} /><path d="M4 4v11M20 4v11" opacity="0.3" /></g>;
    case 'doorway': return <g {...S}><path d="M4 20V4h16v16h-5V9H9v11z" {...F()} /></g>;
    case 'window-frame': return <g {...S}><path d="M4 4h16v16H4z" {...F()} /><rect x="7.5" y="8" width="9" height="6" fill="#161412" /></g>;
    case 'wall-frame': return <g {...S}><path d="M4 20V4h16v16h-2V6H6v14z" {...F()} /></g>;
    case 'square-floor': return <g {...S}><path d="M3 12l9-5 9 5-9 5z" {...F()} /></g>;
    case 'triangle-floor': return <g {...S}><path d="M3 14l16-5-5 9z" {...F()} /></g>;
    case 'floor-frame': return <g {...S}><path d="M3 12l9-5 9 5-9 5z" {...F()} /><path d="M8 12l4-2.2 4 2.2-4 2.2z" fill="#161412" /></g>;
    case 'triangle-floor-frame': return <g {...S}><path d="M3 14l16-5-5 9z" {...F()} /><path d="M9 13.5l5-1.5-1.5 2.8z" fill="#161412" /></g>;
    case 'stairs-l-shape': return <g {...S}><path d="M4 20h7v-4h3v-4h3V8h3V4" /><path d="M4 20V14h3" opacity="0.6" /></g>;
    case 'u-shaped-stairs': return <g {...S}><path d="M3 20h5v-4h3v-4" /><path d="M21 4h-5v4h-3v4" /><path d="M11 12h2" /></g>;
    case 'spiral-stairs': return <g {...S}><circle cx="12" cy="12" r="1.5" {...F(0.6)} /><path d="M12 12c0-4 6-4 6 0s-5 7-9 4-2-10 3-11" /></g>;
    case 'roof': return <g {...S}><path d="M3 19l12-12h4L7 19z" {...F()} /><path d="M3 19h4" /></g>;
    case 'roof-triangle': return <g {...S}><path d="M4 18l8-12 8 12z" {...F()} /><path d="M12 6v12" opacity="0.5" /></g>;
    case 'tool-cupboard': return <g {...S}><rect x="6" y="3" width="12" height="18" rx="1" {...F()} /><path d="M6 12h12M10 7.5h4M10 16h4" /></g>;
    case 'drop-box': return <g {...S}><rect x="5" y="9" width="14" height="9" fill="#2f6fd6" fillOpacity="0.6" /><path d="M12 3v8M9 8l3 3 3-3" /></g>;
    case 'strengthened-glass-window': return <g {...S}><rect x="4" y="6" width="16" height="12" fill="#9fd3e6" fillOpacity="0.35" /><path d="M8 15l5-6M12 16l4-5" opacity="0.7" /></g>;
    case 'reinforced-glass-window': return <g {...S}><rect x="4" y="6" width="16" height="12" fill="#7fb6cc" fillOpacity="0.5" /><path d="M4 12h16M12 6v12" /></g>;
    case 'metal-window-bars': return <g {...S}><rect x="4" y="6" width="16" height="12" /><path d="M8 6v12M12 6v12M16 6v12" /></g>;
    case 'twig': return <g {...S}><path d="M5 19L18 6M9 15l-3-5M13 11l5 2M15 9l-1-5" /></g>;
    case 'remove': return <g {...S} stroke="#ff7a6b" strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></g>;
    default: {
      const m = /^(wooden|sheet-metal|armored)-(double-)?door$|^garage-door$/.exec(id);
      if (m) {
        const fill = id === 'garage-door' ? DOOR_FILL.garage : DOOR_FILL[m[1]];
        if (id === 'garage-door') return <g {...S}><rect x="4" y="4" width="16" height="16" fill={fill} fillOpacity="0.8" /><path d="M4 8h16M4 12h16M4 16h16" opacity="0.7" /></g>;
        if (m[2]) return <g {...S}><rect x="4" y="3" width="8" height="18" fill={fill} fillOpacity="0.8" /><rect x="12" y="3" width="8" height="18" fill={fill} fillOpacity="0.8" /><circle cx="10.5" cy="12" r="0.8" fill="currentColor" /><circle cx="13.5" cy="12" r="0.8" fill="currentColor" /></g>;
        return <g {...S}><rect x="7" y="3" width="10" height="18" fill={fill} fillOpacity="0.8" /><circle cx="14.5" cy="12" r="0.9" fill="currentColor" /></g>;
      }
      return <g {...S}><rect x="5" y="5" width="14" height="14" /></g>;
    }
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
        const img = GRADE_IMG[it.id];
        return (
          <div key={it.id} className={`radial__icon${i === sel ? ' radial__icon--sel' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${Math.sin(a) * mid}px, ${-Math.cos(a) * mid}px)` }}>
            {img
              ? <img src={img} alt="" width={icon} height={icon} />
              : <svg width={icon} height={icon} viewBox="0 0 24 24"><Pict id={it.id} /></svg>}
            {i === sel && <span className="radial__caption">{it.short ?? it.label}</span>}
          </div>
        );
      })}
      <div className="radial__center">{sel >= 0 ? items[sel].label : title}</div>
    </div>
  );
};

export default RadialMenu;
