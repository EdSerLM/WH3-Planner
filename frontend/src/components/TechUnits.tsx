import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ArmyState, CharacterSummary, ComputedCard, StatKey, TechNode, UnitData } from '../types';
import { UnitBadgeStrip } from './ArmySetup';
import { UnitBuffSummary } from './UnitBuffSummary';

interface Props {
  nodes: TechNode[];
  have: Set<string>;
  units: UnitData[];
  characters: CharacterSummary[];
  labels: Record<StatKey, string>;
  /** Investiga esas tecnologías (y sus requisitos) */
  onResearch: (techs: string[]) => void;
}

/** "lord:<clave>" / "hero:<clave>" para personajes; la carta para unidades */
const charId = (c: CharacterSummary) => `${c.type}:${c.key}`;

/**
 * Tecnologías por señor, héroe y unidad: qué tecnologías del árbol cambian su tarjeta,
 * lo que ya le suman las investigadas y, al elegir uno, se investigan todas las suyas.
 */
export function TechUnits({ nodes, have, units, characters, labels, onResearch }: Props) {
  const [data, setData] = useState<{ hits: Record<string, string[]>; art: Record<string, string> }>({ hits: {}, art: {} });
  const [selected, setSelected] = useState<string | null>(null);
  const [card, setCard] = useState<ComputedCard | null>(null);
  const techs = useMemo(() => [...new Set(nodes.map((n) => n.tech))], [nodes]);
  const nameOf = useMemo(() => new Map(nodes.map((n) => [n.tech, n.name])), [nodes]);
  const affect = data.hits;

  useEffect(() => {
    if (!techs.length || (!units.length && !characters.length)) { setData({ hits: {}, art: {} }); return; }
    api.techUnits(techs, units.map((u) => u.card), characters.map((c) => ({ key: c.key, type: c.type })))
      .then(setData)
      .catch(() => setData({ hits: {}, art: {} }));
  }, [techs, units, characters]);

  // Tarjeta del elegido solo con las tecnologías investigadas (unidades en rango 0; personajes sin habilidades compradas)
  const researched = useMemo(() => [...have], [have]);
  useEffect(() => {
    if (!selected) { setCard(null); return; }
    const [kind, key] = selected.includes(':') ? selected.split(':') : ['unit', selected];
    const build = { character: key, levels: {} };
    const army: ArmyState = {
      lord: kind === 'lord' ? build : null,
      heroes: kind === 'hero' ? [build] : [],
      units: kind === 'unit' ? [{ card: key, count: 1, rank: 0 }] : [],
      activeAbilities: [], inAura: true, techs: researched,
    };
    const t = setTimeout(() => {
      api.compute(army)
        .then((r) => setCard(r.cards.find((c) => c.kind === kind && c.id === key) ?? null))
        .catch(() => setCard(null));
    }, 120);
    return () => clearTimeout(t);
  }, [selected, researched]);

  const list = units.filter((u) => affect[u.card]?.length);
  const chars = characters
    .filter((c) => affect[charId(c)]?.length)
    .sort((a, b) => Number(b.type === 'lord') - Number(a.type === 'lord') || Number(b.legendary) - Number(a.legendary) || a.name.localeCompare(b.name, 'es'))
    .map((c) => ({ id: charId(c), name: c.name, kind: c.type, art: data.art[charId(c)] }));
  const counts = Object.fromEntries(
    [...list.map((u) => u.card), ...chars.map((c) => c.id)].map((id) => [id, { have: affect[id].filter((t) => have.has(t)).length, total: affect[id].length }]),
  );
  const sel = selected ? affect[selected] ?? [] : [];

  if (!list.length && !chars.length) return null;
  return (
    <div className="tech-units">
      <h3>
        Tecnologías por personaje y unidad{' '}
        <span className="muted small">({chars.length} personajes y {list.length} unidades reciben bufos del árbol)</span>
      </h3>
      <p className="muted small">
        ✓ investigadas / total que le cambian la tarjeta. Clic en uno: investiga todas las suyas (con sus requisitos) y muestra lo que le suman.
        Solo cuenta stats y atributos de batalla; los efectos de campaña (coste, mantenimiento…) no.
        {units.length > list.length ? ` ${units.length - list.length} unidades no reciben nada de este árbol.` : ''}
      </p>
      <UnitBadgeStrip
        units={list}
        chars={chars}
        badge={(id) => ({ text: `✓ ${counts[id].have}/${counts[id].total}`, full: counts[id].have === counts[id].total })}
        tip={(id) => `${counts[id].have} de ${counts[id].total} tecnologías que le afectan investigadas.\nClic: investigar todas las suyas`}
        selected={selected}
        onPick={(id) => {
          setSelected(id);
          onResearch(affect[id] ?? []);
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
          <p className="muted small">
            La tarjeta lleva solo las tecnologías: las unidades en rango 0 (los bufos de "rango 7+" no se suman aquí) y los personajes sin habilidades compradas.
          </p>
        </div>
      )}
    </div>
  );
}
