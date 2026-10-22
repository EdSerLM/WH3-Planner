import { useMemo, useState } from 'react';
import { unitRank, type ArmyUnitSelection, type UnitData } from '../types';
import type { RosterBuffs } from '../App';
import { CHAOS_CAMPAIGN, unitAllowed } from '../campaign';

const RANKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  units: UnitData[];
  army: ArmyUnitSelection[];
  usedSlots: number;
  /** Qué unidades reciben bufos del señor, héroes y tecnologías */
  buffs?: RosterBuffs;
  /** Facción de campaña del Caos: oculta las unidades que no puede tener */
  campaign?: string;
  onChange: (army: ArmyUnitSelection[]) => void;
}

const EXALTED = /_(kho_inf_bloodletters|nur_inf_plaguebearers|sla_inf_daemonette|tze_inf_pink_horrors)_1$/;

/** Icono: ▲ dorado si recibe bufos con rango 0; "R+" si gana más al subir de rango (rango 7+ o "por rango") */
function BuffMark({ b }: { b?: RosterBuffs[string] }) {
  if (!b) return null;
  const lines = [
    ...(b.now.length ? ['Recibe bufos de:', ...b.now.map((s) => `• ${s}`)] : []),
    ...(b.r7.length ? [b.now.length ? 'Y al subir de rango:' : 'Solo al subir de rango:', ...b.r7.map((s) => `• ${s}`)] : []),
  ];
  return (
    <span className="buff-mark" title={lines.join('\n')}>
      {b.now.length > 0 && <span className="bm-now">▲{b.now.length}</span>}
      {b.r7.length > 0 && <span className="bm-r7">R+</span>}
    </span>
  );
}

const GROUP_ORDER = [
  'Infantry', 'Missile Infantry', 'Cavalry & Chariots', 'Missile Cavalry & Chariots',
  'Monsters & Beasts', 'Missile Monsters & Beasts', 'Artillery & War Machines',
];
const GROUP_ES: Record<string, string> = {
  Infantry: 'Infantería',
  'Missile Infantry': 'Infantería de proyectiles',
  'Cavalry & Chariots': 'Caballería y carros',
  'Missile Cavalry & Chariots': 'Caballería de proyectiles y carros',
  'Monsters & Beasts': 'Monstruos y bestias',
  'Missile Monsters & Beasts': 'Monstruos de proyectiles',
  'Artillery & War Machines': 'Artillería y máquinas de guerra',
};

export function ArmyPanel({ units, army, usedSlots, buffs = {}, campaign, onChange }: Props) {
  const campName = CHAOS_CAMPAIGN.find((f) => f.key === campaign)?.name;
  const [q, setQ] = useState('');
  const [showRoR, setShowRoR] = useState(false);
  const [onlyBuffed, setOnlyBuffed] = useState(false);
  const anyBuffs = Object.keys(buffs).length > 0;
  const byCard = useMemo(() => new Map(units.map((u) => [u.card, u])), [units]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return units
      .filter((u) => showRoR || !/_ror/.test(u.key + u.card)) // Regimientos de Renombre
      .filter((u) => unitAllowed(u, campaign))
      .filter((u) => !qq || u.name.toLowerCase().includes(qq))
      .filter((u) => !onlyBuffed || !!buffs[u.card])
      .sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || a.cost - b.cost);
  }, [units, q, showRoR, onlyBuffed, buffs, campaign]);

  const grouped = useMemo(() => {
    const m = new Map<string, UnitData[]>();
    for (const u of filtered) m.set(u.group, [...(m.get(u.group) ?? []), u]);
    return [...m.entries()];
  }, [filtered]);

  const add = (card: string) => {
    if (usedSlots >= 20) return;
    const ex = army.find((a) => a.card === card);
    if (ex) onChange(army.map((a) => (a.card === card ? { ...a, count: a.count + 1 } : a)));
    else onChange([...army, { card, count: 1 }]);
  };
  const setCount = (card: string, count: number) =>
    onChange(count <= 0 ? army.filter((a) => a.card !== card) : army.map((a) => (a.card === card ? { ...a, count } : a)));
  // El rango reemplaza al viejo interruptor R7+ (se borra rank7 al elegir un rango)
  const setRank = (card: string, rank: number) =>
    onChange(army.map((a) => (a.card === card ? { card: a.card, count: a.count, rank } : a)));
  const setAllRanks = (rank: number) => onChange(army.map((a) => ({ card: a.card, count: a.count, rank })));

  const cost = army.reduce((s, a) => s + (byCard.get(a.card)?.cost ?? 0) * a.count, 0);

  return (
    <div className="army">
      <div className="army-head">
        <h3>Ejército</h3>
        <span className={usedSlots > 20 ? 'bad' : ''}>{usedSlots} / 20</span>
        <span className="muted">Coste unidades (MP): {cost.toLocaleString('es-MX')}</span>
        {army.length > 1 && (
          <label className="rank-all small" title="Pone el mismo rango a todas las unidades del ejército">
            Rango de todas:{' '}
            <select value="" onChange={(e) => e.target.value !== '' && setAllRanks(Number(e.target.value))}>
              <option value="">—</option>
              {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
      </div>

      <ul className="army-list">
        {army.map((a) => {
          const u = byCard.get(a.card);
          return (
            <li key={a.card}>
              <span className="army-name">
                {u?.name ?? a.card} <BuffMark b={buffs[a.card]} />
                {u && !unitAllowed(u, campaign) && (
                  <span className="camp-warn" title={`${campName} no puede tener esta unidad en campaña`}>⚠ no disponible</span>
                )}
              </span>
              <span className="counter">
                <button onClick={() => setCount(a.card, a.count - 1)}>−</button>
                <b>{a.count}</b>
                <button onClick={() => add(a.card)} disabled={usedSlots >= 20}>+</button>
              </span>
              <label className="r7" title="Rango de veteranía de la unidad: activa los bufos de rango 7+ y los que crecen por rango">
                Rango{' '}
                <select value={unitRank(a)} onChange={(e) => setRank(a.card, Number(e.target.value))}>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </li>
          );
        })}
        {!army.length && <li className="muted">Agrega unidades desde la lista de abajo.</li>}
      </ul>

      <div className="roster-tools">
        <input placeholder="Buscar unidad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label><input type="checkbox" checked={showRoR} onChange={(e) => setShowRoR(e.target.checked)} /> Regimientos de Renombre</label>
        <label title="Muestra solo las unidades que reciben bufos de tu señor, héroes o tecnologías">
          <input type="checkbox" checked={onlyBuffed} disabled={!anyBuffs} onChange={(e) => setOnlyBuffed(e.target.checked)} /> Solo con bufos
        </label>
      </div>
      {campName && <div className="small muted buff-legend">Roster de campaña: {campName}</div>}
      {anyBuffs && (
        <div className="small muted buff-legend">
          <span className="bm-now">▲n</span> recibe bufos (n = habilidades) · <span className="bm-r7">R+</span> más bufos al subir de rango (7+ o por rango) · pasa el ratón para ver cuáles
        </div>
      )}
      <div className="roster">
        {grouped.map(([g, list]) => (
          <div key={g}>
            <div className="roster-group">{GROUP_ES[g] ?? g}</div>
            {list.map((u) => (
              <button key={u.card} className="roster-item" onClick={() => add(u.card)} disabled={usedSlots >= 20}>
                <span>
                  {u.name} <BuffMark b={buffs[u.card]} />
                  {EXALTED.test(u.key) && <span className="exalted-tag" title="Versión Exaltada: en campaña se obtiene con las Mejoras de Banda">Banda</span>}
                </span>
                <span className="muted">{u.cost}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
