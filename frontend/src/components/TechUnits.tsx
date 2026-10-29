import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ComputedCard, StatKey, TechNode, UnitData } from '../types';
import { TechUnitStrip } from './ArmySetup';
import { UnitBuffSummary } from './UnitBuffSummary';

interface Props {
  nodes: TechNode[];
  have: Set<string>;
  units: UnitData[];
  labels: Record<StatKey, string>;
  /** Investiga esas tecnologías (y sus requisitos) */
  onResearch: (techs: string[]) => void;
}

/**
 * Tecnologías por unidad: qué tecnologías del árbol cambian la tarjeta de cada unidad,
 * lo que ya le suman las investigadas y, al elegir una, se investigan todas las suyas.
 */
export function TechUnits({ nodes, have, units, labels, onResearch }: Props) {
  const [affect, setAffect] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [card, setCard] = useState<ComputedCard | null>(null);
  const techs = useMemo(() => [...new Set(nodes.map((n) => n.tech))], [nodes]);
  const nameOf = useMemo(() => new Map(nodes.map((n) => [n.tech, n.name])), [nodes]);

  useEffect(() => {
    if (!techs.length || !units.length) { setAffect({}); return; }
    api.techUnits(techs, units.map((u) => u.card)).then(setAffect).catch(() => setAffect({}));
  }, [techs, units]);

  // Tarjeta de la unidad elegida solo con las tecnologías investigadas (rango 0, sin señor ni héroes)
  const researched = useMemo(() => [...have], [have]);
  useEffect(() => {
    if (!selected) { setCard(null); return; }
    const t = setTimeout(() => {
      api.compute({ lord: null, heroes: [], units: [{ card: selected, count: 1, rank: 0 }], activeAbilities: [], inAura: true, techs: researched })
        .then((r) => setCard(r.cards.find((c) => c.kind === 'unit') ?? null))
        .catch(() => setCard(null));
    }, 120);
    return () => clearTimeout(t);
  }, [selected, researched]);

  const list = units.filter((u) => affect[u.card]?.length);
  const counts = Object.fromEntries(list.map((u) => [u.card, { have: affect[u.card].filter((t) => have.has(t)).length, total: affect[u.card].length }]));
  const sel = selected ? affect[selected] ?? [] : [];

  if (!list.length) return null;
  return (
    <div className="tech-units">
      <h3>Tecnologías por unidad <span className="muted small">({list.length} unidades reciben bufos del árbol)</span></h3>
      <p className="muted small">
        ✓ investigadas / total que le cambian la tarjeta. Clic en una unidad: investiga todas las suyas (con sus requisitos) y muestra lo que le suman.
        Solo cuenta stats y atributos de batalla; los efectos de campaña (coste, mantenimiento…) no.
        {units.length > list.length ? ` ${units.length - list.length} unidades no reciben nada de este árbol.` : ''}
      </p>
      <TechUnitStrip
        units={list}
        counts={counts}
        selected={selected}
        onPick={(c) => {
          setSelected(c);
          onResearch(affect[c] ?? []);
        }}
      />
      {selected && (
        <div className="tech-unit-detail">
          <ul className="tech-unit-list small">
            {sel.map((t) => (
              <li key={t} className={have.has(t) ? 'ok' : 'muted'}>{have.has(t) ? '✓' : '○'} {nameOf.get(t) ?? t}</li>
            ))}
          </ul>
          {card && <UnitBuffSummary card={card} labels={labels} onClose={() => setSelected(null)} />}
          <p className="muted small">La tarjeta está en rango 0 y solo con tecnologías: los bufos de "rango 7+" no se suman aquí aunque la tecnología esté investigada.</p>
        </div>
      )}
    </div>
  );
}
