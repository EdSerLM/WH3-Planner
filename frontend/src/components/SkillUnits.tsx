import { useMemo } from 'react';
import type { BuildSelection, CharacterTree, SkillNode, UnitData } from '../types';
import { buyUp, decrement, levelOf, whyNotBuy } from '../treeLogic';
import { groupIndex, groupInfo } from '../unitGroups';
import { GroupIcon } from '../gameIcons';
import { SkillIcon } from './SkillIcon';
import { UnitTile } from './ArmySetup';

/**
 * Vista "por habilidad": cada habilidad del árbol que cambia tarjetas, con sus niveles (+/−), lo que da
 * y a qué unidades afecta. Si cubre un tipo entero (toda la infantería, toda la artillería…) o todo el ejército,
 * lo dice en vez de listar las tarjetas.
 */
interface Props {
  units: UnitData[];
  /** Por unidad: habilidades que le cambian la tarjeta (siempre / solo rango 7+), compradas o no */
  potential: Record<string, { now: string[]; r7: string[] }>;
  /** Por unidad: las que ya le cambian la tarjeta con lo comprado */
  have: (card: string) => string[];
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
  selected: string | null;
  onPick: (card: string) => void;
}

// "… a las unidades de Alimañas, Monjes de Plaga y Tríadas Eshin (Ejército del Señor)": las tarjetas ya dicen a quién
const shortText = (t: string) => t
  .replace(/\s+a (?:las|los) unidades de .*?(?=\s*\((?:rango|Ejército|ejército|todos)|$)/i, '')
  .replace(/\s*\((?:Ejército del Señor|ejército propio)\)/i, '')
  .replace(/\s*;\s*$/, '').trim();

const ALL_OF: Record<string, string> = {
  Infantry: 'Toda la infantería',
  'Missile Infantry': 'Toda la infantería de proyectiles',
  'Cavalry & Chariots': 'Toda la caballería y carros',
  'Missile Cavalry & Chariots': 'Toda la caballería de proyectiles',
  'Monsters & Beasts': 'Todos los monstruos y bestias',
  'Missile Monsters & Beasts': 'Todos los monstruos de proyectiles',
  'Artillery & War Machines': 'Toda la artillería y máquinas de guerra',
};

export function SkillUnits({ units, potential, have, tree, selection, onChange, selected, onPick }: Props) {
  // Unidades del roster por tipo (para saber si una habilidad cubre un tipo entero)
  const byGroup = useMemo(() => {
    const m = new Map<string, UnitData[]>();
    for (const u of units) m.set(u.group ?? '', [...(m.get(u.group ?? '') ?? []), u]);
    return m;
  }, [units]);
  const nodeOf = useMemo(() => {
    const m = new Map<string, SkillNode>();
    for (const n of tree.rows.flat()) if (n.visible && !n.isMount && !m.has(n.name)) m.set(n.name, n);
    return m;
  }, [tree]);
  const order = useMemo(() => { const m = new Map<string, number>(); tree.rows.flat().forEach((n, i) => { if (!m.has(n.name)) m.set(n.name, i); }); return m; }, [tree]);

  const skills = useMemo(() => {
    const m = new Map<string, { units: UnitData[]; r7: boolean }>();
    for (const u of units) {
      const p = potential[u.card];
      if (!p) continue;
      for (const [names, r7] of [[p.now, false], [p.r7, true]] as [string[], boolean][]) for (const s of names) {
        const cur = m.get(s) ?? { units: [], r7: true };
        if (!cur.units.includes(u)) cur.units.push(u);
        cur.r7 = cur.r7 && r7;
        m.set(s, cur);
      }
    }
    return [...m.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999));
  }, [units, potential, order]);

  if (!skills.length) return <p className="muted small">Ninguna habilidad de este árbol cambia las tarjetas de las unidades.</p>;

  return (
    <div className="skill-units">
      {skills.map(([name, info]) => {
        const node = nodeOf.get(name);
        const lvl = node ? levelOf(selection, node) : 0;
        const max = node?.levels.length ?? 0;
        const shown = node ? node.levels[Math.max(0, lvl - 1)] : undefined;
        const texts = (shown?.effects ?? []).filter((e) => e.text && (e.kind === 'battle' || e.kind === 'attribute')).map((e) => shortText(e.text));
        const set = new Set(info.units);
        const full: string[] = [], partial: UnitData[] = [];
        for (const [g, us] of [...byGroup.entries()].sort((a, b) => groupIndex(a[0]) - groupIndex(b[0]))) {
          const hit = us.filter((u) => set.has(u));
          if (!hit.length) continue;
          if (hit.length === us.length) full.push(g);
          else partial.push(...hit);
        }
        const all = full.length === byGroup.size;
        const bought = (u: UnitData) => have(u.card).includes(name);
        const reason = node ? whyNotBuy(node, selection, tree) : 'Objeto, montura o rasgo';
        const up = node ? buyUp(selection, tree, node) : selection;
        const canUp = !!node && lvl < max && up !== selection && (up.levels?.[node.key] ?? 0) > lvl;
        return (
          <div key={name} className={'su-row' + (lvl > 0 ? ' on' : '')}>
            <div className="su-skill">
              {node && <SkillIcon node={node} size={30} />}
              <div className="su-body">
                <div className="su-name">
                  {name}
                  {info.r7 && <span className="rank-badge" title="Solo cuenta con la unidad en rango 7 o más (o el que pida)">R7+</span>}
                </div>
                {node ? (
                  <div className="su-lvl">
                    <button type="button" className="ghost" disabled={lvl === 0} onClick={() => onChange(decrement(selection, node, tree))} title="Bajar un nivel">−</button>
                    <span className="pips">{node.levels.map((_, j) => <i key={j} className={j < lvl ? 'on' : ''} />)}</span>
                    <button type="button" className="ghost" disabled={!canUp} onClick={() => onChange(up)}
                      title={canUp ? (reason ? 'Subir un nivel (compra antes las habilidades previas que pide)' : 'Subir un nivel') : reason ?? 'Ya está al máximo'}>+</button>
                    <span className="muted small">{lvl}/{max}</span>
                  </div>
                ) : <div className="muted small">Objeto, montura o rasgo</div>}
              </div>
            </div>
            <ul className="su-eff small">
              {texts.length ? texts.map((t, i) => <li key={i}>{t}</li>) : <li className="muted">—</li>}
              {lvl === 0 && texts.length > 0 && <li className="muted">(nivel 1, sin comprar)</li>}
            </ul>
            <div className="su-who">
              {all ? (
                <span className="su-chip all"><GroupIcon g="Lords" size={14} /> Todo el ejército</span>
              ) : (
                <>
                  {full.map((g) => <span key={g} className="su-chip"><GroupIcon g={g} size={14} /> {ALL_OF[g] ?? `Todo: ${groupInfo(g).es.toLowerCase()}`}</span>)}
                  {partial.length > 0 && (
                    <div className="pick-strip su-tiles">
                      {partial.map((u) => (
                        <UnitTile key={u.card} u={u} selected={selected === u.card} dim={!bought(u)} onClick={() => onPick(u.card)}
                          title={`${u.name}\n${bought(u) ? 'Ya la recibe' : 'La recibiría al comprar esta habilidad'}`} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
