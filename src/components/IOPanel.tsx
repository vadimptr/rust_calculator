import React from 'react';
import { DECK } from '../blueprint/boat.ts';
import { GROW_LIGHT_RADIUS, HEATER_RADIUS, SPRINKLER_DRAIN, SPRINKLER_RADIUS } from '../blueprint/iosim.ts';
import type { IOSimulation } from '../blueprint/iosim.ts';
import type { DeployableKind } from '../blueprint/types.ts';

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const hours = (h: number) => (h >= 48 ? `${num(h / 24)} сут` : h >= 1 ? `${num(h)} ч` : `${Math.max(1, Math.round(h * 60))} мин`);

const IOPanel: React.FC<{ sim: IOSimulation }> = ({ sim }) => {
  const order = new Map<string, number>(), total = new Map<DeployableKind, number>();
  for (const d of [...sim.devices.values(), ...sim.planters]) {
    if (order.has(d.id)) continue;
    const k = (total.get(d.kind) ?? 0) + 1;
    total.set(d.kind, k);
    order.set(d.id, k);
  }
  const name = (kind: DeployableKind, id: string) => `${DECK[kind]?.label ?? kind}${(total.get(kind) ?? 0) > 1 ? ` №${order.get(id)}` : ''}`;
  const wireNo = new Map([...sim.wires.keys()].map((id, i) => [id, i + 1]));
  const off = sim.consumers.filter(c => !c.powered);
  const dry = sim.sprinklers.filter(s => !s.powered);
  const hasPower = sim.sources.length > 0 || sim.batteries.length > 0 || sim.consumers.length > 0;
  const hasWater = sim.water.length > 0 || sim.sprinklers.length > 0;
  return (
    <section className="cost">
      {hasPower && (
        <>
          <div className="bp__section-title">Электричество</div>
          <ul className="boat__checks">
            {sim.sources.map(s => (
              <li key={s.id} className={s.max > 0 ? 'boat__check--ok' : 'boat__check--bad'}>{name(s.kind, s.id)}: занято {s.used} из {s.max}</li>
            ))}
            {sim.batteries.map(b => (
              <li key={b.id} className={b.drain > b.charge ? 'boat__check--bad' : 'boat__check--ok'}>
                {name(b.kind, b.id)}: заряд +{num(b.charge)}/с, расход {num(b.drain)}/с
                {b.hours !== null && (b.drain > b.charge ? ` · полной хватит на ${hours(b.hours)}` : ` · с нуля зарядится за ${hours(b.hours)}`)}
              </li>
            ))}
            {sim.consumers.length > 0 && (
              <li className={off.length ? 'boat__check--bad' : 'boat__check--ok'}>{off.length ? '✗' : '✓'} Запитано потребителей: {sim.consumers.length - off.length} из {sim.consumers.length}</li>
            )}
            {off.map(c => (
              <li key={c.id} className="boat__check--bad">{name(c.kind, c.id)}: нужно {c.need}, приходит {c.kind === 'powered-water-purifier' ? c.inputs[1] ?? 0 : c.inputs[0] ?? 0}</li>
            ))}
          </ul>
        </>
      )}
      {hasWater && (
        <>
          <div className="bp__section-title">Вода</div>
          <ul className="boat__checks">
            {sim.water.map(w => (
              <li key={w.id} className={w.hours !== null ? 'boat__check--bad' : 'boat__check--ok'}>
                {name(w.kind, w.id)}: приток {num(w.perSec)}/с, расход {num(w.drain)}/с
                {w.hours !== null && ` · запаса ${w.capacity} хватит на ${hours(w.hours)}`}
              </li>
            ))}
            {sim.sprinklers.length > 0 && (
              <li className={dry.length ? 'boat__check--bad' : 'boat__check--ok'}>{dry.length ? '✗' : '✓'} Работает разбрызгивателей: {sim.sprinklers.length - dry.length} из {sim.sprinklers.length}</li>
            )}
            {sim.gravity.map(g => (
              <li key={g.wire} className="boat__check--bad">Шланг №{wireNo.get(g.wire)}: подъём {num(g.rise)} м без насоса, вода не пойдёт (самотёком — не выше 1 м)</li>
            ))}
          </ul>
        </>
      )}
      {sim.planters.length > 0 && (
        <>
          <div className="bp__section-title">Грядки</div>
          <ul className="boat__checks">
            {sim.planters.map(p => (
              <li key={p.id} className={p.water.length ? 'boat__check--ok' : 'boat__check--bad'}>
                {name(p.kind, p.id)}: {p.water.length ? `полив от ${p.water.length}` : 'без полива'} · {p.light.length ? 'лампа есть' : 'без лампы'} · {p.heat.length ? 'обогрев есть' : 'без обогрева'}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="cost__note">
        Расчёт по правилам игры: сплиттер делит поровну, потребитель пропускает дальше вход минус своё потребление, аккумулятор берёт до 4× своего выхода и копит 80 %.
        Выключатели и таймеры считаются включёнными, кнопки и датчики — без срабатывания, солнце в зените, ветер средний, бочки полные.
        Разбрызгиватель берёт {SPRINKLER_DRAIN} воды в секунду и поливает в {SPRINKLER_RADIUS} м, лампа светит растениям в {GROW_LIGHT_RADIUS} м, обогреватель греет в {HEATER_RADIUS} м.
      </p>
    </section>
  );
};

export default IOPanel;
