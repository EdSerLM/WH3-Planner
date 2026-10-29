import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ArmyState, CharacterSummary, ComputedCard, StatKey, UnitData } from '../types';
import { UnitBadgeStrip } from './ArmySetup';
import { UnitBuffSummary } from './UnitBuffSummary';

interface Props {
  /** Nodos del árbol o del grafo (Pirámide Negra): clave de tecnología y nombre */
  nodes: { tech: string; name: string }[];
  have: Set<string>;
  units: UnitData[];
  characters: CharacterSummary[];
  labels: Record<StatKey, string>;
  /** Investiga esas tecnologías (y sus requisitos) */
  onResearch: (techs: string[]) => void;
  /** Señor y héroes del ejército ("lord:<clave>" / "hero:<clave>"): se ponen primero y se marcan sus tecnologías */
  armyChars?: string[];
  /** Por tecnología, a cuántos de tus personajes les sirve (para resaltarlas en el árbol) */
  onMatch?: (m: Record<string, string[]>) => void;
}

/** "lord:<clave>" / "hero:<clave>" para personajes; la carta para unidades */
const charId = (c: CharacterSummary) => `${c.type}:${c.key}`;

/**
 * Tecnologías por señor, héroe y unidad: qué tecnologías del árbol cambian su tarjeta,
 * lo que ya le suman las investigadas y, al elegir uno, se investigan todas las suyas.
 */
export function TechUnits({ nodes, have, units, characters, labels, onResearch, armyChars = [], onMatch }: Props) {
  const [data, setData] = useState<{ hits: Record<string, string[]>; art: Record<string, string> }>({ hits: {}, art: {} });
  const [selected, setSelected] = useState<string | null>(null);
  const [card, setCard] = useState<ComputedCard | null>(null);
  // Por contenido: la Pirámide arma la lista de nodos en cada dibujo y no queremos pedirla otra vez
  const techKey = [...new Set(nodes.map((n) => n.tech))].join('|');
  const techs = useMemo(() => (techKey ? techKey.split('|') : []), [techKey]);
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

  // Tu señor y héroes: qué tecnologías del árbol les cambian la tarjeta
  const nameById = new Map(characters.map((c) => [charId(c), c.name]));
  const mine = [...new Set(armyChars)].filter((id) => nameById.has(id));
  const armyKey = mine.join('|');
  const match = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const id of armyKey ? armyKey.split('|') : []) for (const t of affect[id] ?? []) (m[t] ??= []).push(nameById.get(id) ?? id);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affect, armyKey]);
  useEffect(() => { onMatch?.(match); }, [match]); // eslint-disable-line react-hooks/exhaustive-deps
  const matchTechs = Object.keys(match);
  const missingMine = matchTechs.filter((t) => !have.has(t));

  const list = units.filter((u) => affect[u.card]?.length);
  const chars = characters
    .filter((c) => affect[charId(c)]?.length)
    .sort((a, b) => Number(mine.includes(charId(b))) - Number(mine.includes(charId(a))) || Number(b.type === 'lord') - Number(a.type === 'lord') || Number(b.legendary) - Number(a.legendary) || a.name.localeCompare(b.name, 'es'))
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
      {mine.length > 0 && (
        <div className="tech-army">
          <b>★ Tu señor y héroes:</b>{' '}
          {mine.map((id) => {
            const all = affect[id] ?? [];
            const got = all.filter((t) => have.has(t)).length;
            return (
              <span key={id} className={'tech-army-char' + (all.length && got === all.length ? ' ok' : '')} title={all.map((t) => (have.has(t) ? '✓ ' : '○ ') + (nameOf.get(t) ?? t)).join('\n') || 'Ninguna tecnología de este árbol le cambia la tarjeta'}>
                {nameById.get(id)} {all.length ? `✓ ${got}/${all.length}` : '—'}
              </span>
            );
          })}
          {matchTechs.length > 0 ? (
            <button className="ghost small" disabled={!missingMine.length} onClick={() => onResearch(matchTechs)}
              title="Investiga todas las tecnologías que les cambian la tarjeta a tu señor y héroes (con sus requisitos)">
              {missingMine.length ? `Investigar las ${missingMine.length} que les faltan` : 'Ya tienen todas'}
            </button>
          ) : (
            <span className="muted small"> ninguna tecnología de este árbol les cambia la tarjeta</span>
          )}
          {matchTechs.length > 0 && <span className="muted small"> · ★ en el árbol = les sirve (número = a cuántos)</span>}
        </div>
      )}
      <UnitBadgeStrip
        units={list}
        chars={chars}
        badge={(id) => ({ text: `${mine.includes(id) ? '★ ' : ''}✓ ${counts[id].have}/${counts[id].total}`, full: counts[id].have === counts[id].total })}
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
