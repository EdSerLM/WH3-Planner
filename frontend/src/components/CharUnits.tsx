import { useMemo, useState } from 'react';
import type { RosterBuffs } from '../App';
import type { ComputedCard, StatKey, UnitData } from '../types';
import { UnitBadgeStrip } from './ArmySetup';
import { UnitBuffSummary } from './UnitBuffSummary';

interface Props {
  /** Nombre del personaje tal como sale en el desglose de las tarjetas ("from") */
  owner: string;
  units: UnitData[];
  /** Tarjetas del roster con los bufos del ejército (rango 0) */
  rosterCards: Record<string, ComputedCard>;
  /** Lo que solo se gana al subir de rango (rango 7+) */
  buffs: RosterBuffs;
  labels: Record<StatKey, string>;
}

/** Debajo del árbol: las unidades del roster que reciben bufos de este señor o héroe con lo que lleva comprado. */
export function CharUnits({ owner, units, rosterCards, buffs, labels }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const suffix = ` (${owner})`;
  // Por unidad: habilidades de este personaje que le cambian la tarjeta ahora, y las que solo cuentan en rango 7+
  const skills = useMemo(() => {
    const out: Record<string, { now: string[]; r7: string[] }> = {};
    for (const u of units) {
      const c = rosterCards[u.card];
      const now = new Set<string>();
      if (c) {
        for (const line of Object.values(c.stats)) for (const x of line.contributions) if (x.from === owner) now.add(x.source);
        for (const a of c.attributes) if (a.from?.endsWith(suffix)) now.add(a.from.slice(0, -suffix.length));
      }
      const r7 = (buffs[u.card]?.r7 ?? [])
        .map((l) => l.slice(0, l.indexOf(': ')))
        .filter((s) => s.endsWith(suffix))
        .map((s) => s.slice(0, -suffix.length))
        .filter((s) => !now.has(s));
      if (now.size || r7.length) out[u.card] = { now: [...now], r7: [...new Set(r7)] };
    }
    return out;
  }, [units, rosterCards, buffs, owner, suffix]);

  const list = units.filter((u) => skills[u.card]);
  const card = selected ? rosterCards[selected] : undefined;
  const sel = selected ? skills[selected] : undefined;

  return (
    <div className="tech-units">
      <h3>Unidades que reciben bufos de {owner} <span className="muted small">({list.length})</span></h3>
      {list.length === 0 ? (
        <p className="muted small">Ninguna unidad del roster recibe bufos de {owner} con lo que lleva comprado. Sube habilidades que afecten al ejército o a ciertas unidades.</p>
      ) : (
        <>
          <p className="muted small">
            Número = habilidades de {owner} que le cambian la tarjeta (R7 = solo con la unidad en rango 7 o más). Clic en una unidad para ver todo lo que recibe.
            Cuentan las pasivas y auras; las habilidades que hay que activar, no.
          </p>
          <UnitBadgeStrip
            units={list}
            badge={(id) => {
              const s = skills[id];
              return { text: s.now.length ? `✦ ${s.now.length}${s.r7.length ? ` +${s.r7.length} R7` : ''}` : `R7 ${s.r7.length}`, full: s.now.length > 0 };
            }}
            tip={(id) => {
              const s = skills[id];
              return [...s.now, ...s.r7.map((x) => `${x} (rango 7+)`)].join('\n');
            }}
            selected={selected}
            onPick={(id) => setSelected(selected === id ? null : id)}
          />
        </>
      )}
      {sel && card && (
        <div className="tech-unit-detail">
          <ul className="tech-unit-list small">
            {sel.now.map((s) => <li key={s} className="ok">✦ {s}</li>)}
            {sel.r7.map((s) => <li key={s} className="muted">{s} (rango 7+)</li>)}
          </ul>
          <UnitBuffSummary card={card} labels={labels} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
