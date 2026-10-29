import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { RosterBuffs } from '../App';
import type { BuildSelection, CharacterTree, ComputedCard, StatKey, UnitData } from '../types';
import { buyNodes } from '../treeLogic';
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
  /** Habilidades de batalla de este personaje (auras, pasivas, activables): no cuentan aquí */
  abilityNames: string[];
  /** Clave del personaje y si va de señor o héroe (para pedir todo lo que su árbol podría dar) */
  character: string;
  kind: 'lord' | 'hero';
  /** Árbol y build del personaje, para comprar desde aquí las habilidades que le faltan a una unidad */
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
}

/** Color de cada fila del árbol (por su nombre): campaña, únicas, bufos al ejército… */
function rowClass(label: string): string {
  if (/campaña/i.test(label)) return 'row-campaign';
  if (/únicas/i.test(label)) return 'row-unique';
  if (/ejército/i.test(label)) return 'row-army';
  if (/magia/i.test(label)) return 'row-magic';
  if (/combate/i.test(label)) return 'row-combat';
  if (/especialidad|acciones/i.test(label)) return 'row-special';
  return 'row-basic';
}

/** Debajo del árbol: las unidades del roster que reciben bufos de este señor o héroe con lo que lleva comprado. */
export function CharUnits({ owner, units, rosterCards, buffs, labels, abilityNames, character, kind, tree, selection, onChange }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  // Por unidad: habilidades del árbol que podrían cambiarle la tarjeta (todas compradas)
  const [potential, setPotential] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!units.length) { setPotential({}); return; }
    api.charPotential(character, kind, units.map((u) => u.card)).then(setPotential).catch(() => setPotential({}));
  }, [character, kind, units]);
  const suffix = ` (${owner})`;
  // Solo lo que dan las habilidades del árbol todo el tiempo: las auras y habilidades de batalla dependen de la batalla
  const inBattle = useMemo(() => new Set(abilityNames), [abilityNames]);
  // Por unidad: habilidades de este personaje que le cambian la tarjeta ahora, y las que solo cuentan en rango 7+
  const skills = useMemo(() => {
    const out: Record<string, { now: string[]; r7: string[] }> = {};
    for (const u of units) {
      const c = rosterCards[u.card];
      const now = new Set<string>();
      if (c) {
        for (const line of Object.values(c.stats)) for (const x of line.contributions) if (x.from === owner && !inBattle.has(x.source)) now.add(x.source);
        for (const a of c.attributes) if (a.from?.endsWith(suffix) && !inBattle.has(a.from.slice(0, -suffix.length))) now.add(a.from.slice(0, -suffix.length));
      }
      const r7 = (buffs[u.card]?.r7 ?? [])
        .map((l) => l.slice(0, l.indexOf(': ')))
        .filter((s) => s.endsWith(suffix))
        .map((s) => s.slice(0, -suffix.length))
        .filter((s) => !now.has(s) && !inBattle.has(s));
      if (now.size || r7.length) out[u.card] = { now: [...now], r7: [...new Set(r7)] };
    }
    return out;
  }, [units, rosterCards, buffs, owner, suffix, inBattle]);

  const list = units.filter((u) => skills[u.card]);
  const none = { now: [] as string[], r7: [] as string[] };
  // Compradas (ahora o en rango 7+) y las que faltan de todas las que podrían afectarle
  const info = (id: string) => {
    const s = skills[id] ?? none;
    const have = [...s.now, ...s.r7];
    const missing = (potential[id] ?? []).filter((x) => !have.includes(x));
    return { ...s, have, missing, total: have.length + missing.length };
  };
  // Fila del árbol de cada habilidad (por su nombre), para pintarla con su color
  const rowOf = useMemo(() => {
    const m = new Map<string, string>();
    tree.rows.forEach((r, i) => r.forEach((n) => { if (!m.has(n.name)) m.set(n.name, tree.rowLabels?.[i] ?? ''); }));
    // Rasgos innatos y ocultos (p. ej. "Recipiente" de Archaón): no están en las filas
    for (const n of tree.background) if (!m.has(n.name)) m.set(n.name, 'Innata');
    return m;
  }, [tree]);
  const skillLi = (s: string, mark: string, extra = '', cls = '') => {
    const row = rowOf.get(s);
    return (
      <li key={s + extra} className={cls + (row !== undefined ? ' ' + rowClass(row) : ' row-other')} title={row ? `Fila: ${row}` : 'Objeto, conjunto o montura'}>
        {mark} {s}{extra}{row ? <span className="row-tag">{row}</span> : null}
      </li>
    );
  };
  const card = selected ? rosterCards[selected] : undefined;
  const sel = selected ? info(selected) : undefined;
  const reachable = units.filter((u) => info(u.card).total > 0).length;

  return (
    <div className="tech-units">
      <h3>
        Unidades que reciben bufos de {owner}{' '}
        <span className="muted small">({list.length} de {units.length}; {reachable} podrían recibir algo de su árbol)</span>
      </h3>
      {units.length > 0 && (
        <>
          <p className="muted small">
            ✦ compradas / posibles = habilidades de {owner} que le cambian la tarjeta y cuántas de su árbol podrían hacerlo (R7 = solo con la unidad en rango 7 o más).
            En gris: todavía no recibe nada. Clic en una unidad para ver cuáles son y todo lo que recibe. Solo cuenta lo que dan las habilidades del árbol
            todo el tiempo; las auras, habilidades de batalla, monturas y excluyentes que no elegiste no.
          </p>
          <UnitBadgeStrip
            units={units}
            dim={(id) => !skills[id]}
            badge={(id) => {
              const s = info(id);
              if (!s.total) return { text: '—' };
              return { text: `✦ ${s.have.length}/${s.total}${s.r7.length ? ` (${s.r7.length} R7)` : ''}`, full: s.have.length === s.total };
            }}
            tip={(id) => {
              const s = info(id);
              if (!s.total) return `Ninguna habilidad del árbol de ${owner} le cambia la tarjeta`;
              const row = (x: string) => (rowOf.get(x) ? ` · ${rowOf.get(x)}` : '');
              return [...s.now.map((x) => `✦ ${x}${row(x)}`), ...s.r7.map((x) => `✦ ${x} (rango 7+)${row(x)}`), ...s.missing.map((x) => `○ ${x} (sin comprar)${row(x)}`)].join('\n');
            }}
            selected={selected}
            onPick={(id) => setSelected(selected === id ? null : id)}
          />
        </>
      )}
      {sel && (
        <div className="tech-unit-detail">
          <ul className="tech-unit-list small">
            {sel.now.map((s) => skillLi(s, '✦', '', 'ok'))}
            {sel.r7.map((s) => skillLi(s, '✦', ' (rango 7+)', 'ok'))}
            {sel.missing.map((s) => skillLi(s, '○', '', 'off'))}
            {!sel.total && <li className="muted">Ninguna habilidad del árbol de {owner} le cambia la tarjeta.</li>}
          </ul>
          {sel.missing.length > 0 && (() => {
            // Las habilidades por su nombre en el árbol (las de monturas y objetos no se compran aquí)
            const keys = tree.rows.flat().filter((n) => n.visible && !n.isMount && sel.missing.includes(n.name)).map((n) => n.key);
            const res = keys.length ? buyNodes(selection, tree, keys) : null;
            return (
              <p className="small">
                <button className="ghost" disabled={!res}
                  onClick={() => res && onChange(res.sel)}
                  title="Compra en el árbol las habilidades que le faltan a esta unidad (al máximo) y las previas que pidan">
                  Comprar las {keys.length} que le faltan
                </button>
                {res && res.missing > 0 && <span className="muted"> · {res.missing} no caben o están bloqueadas por una excluyente</span>}
              </p>
            );
          })()}
          {card && <UnitBuffSummary card={card} labels={labels} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
