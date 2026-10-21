import { useMemo, useState } from 'react';
import type { ArmyUnitSelection, UnitData } from '../types';

interface Props {
  units: UnitData[];
  army: ArmyUnitSelection[];
  usedSlots: number;
  onChange: (army: ArmyUnitSelection[]) => void;
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

export function ArmyPanel({ units, army, usedSlots, onChange }: Props) {
  const [q, setQ] = useState('');
  const [showRoR, setShowRoR] = useState(false);
  const byCard = useMemo(() => new Map(units.map((u) => [u.card, u])), [units]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return units
      .filter((u) => showRoR || !/_ror/.test(u.key + u.card)) // Regimientos de Renombre
      .filter((u) => !qq || u.name.toLowerCase().includes(qq))
      .sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || a.cost - b.cost);
  }, [units, q, showRoR]);

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
  const toggleR7 = (card: string) => onChange(army.map((a) => (a.card === card ? { ...a, rank7: !a.rank7 } : a)));

  const cost = army.reduce((s, a) => s + (byCard.get(a.card)?.cost ?? 0) * a.count, 0);

  return (
    <div className="army">
      <div className="army-head">
        <h3>Ejército</h3>
        <span className={usedSlots > 20 ? 'bad' : ''}>{usedSlots} / 20</span>
        <span className="muted">Coste unidades (MP): {cost.toLocaleString('es-MX')}</span>
      </div>

      <ul className="army-list">
        {army.map((a) => {
          const u = byCard.get(a.card);
          return (
            <li key={a.card}>
              <span className="army-name">{u?.name ?? a.card}</span>
              <span className="counter">
                <button onClick={() => setCount(a.card, a.count - 1)}>−</button>
                <b>{a.count}</b>
                <button onClick={() => add(a.card)} disabled={usedSlots >= 20}>+</button>
              </span>
              <label className="r7" title="Activa los bufos que piden rango 7 o más">
                <input type="checkbox" checked={!!a.rank7} onChange={() => toggleR7(a.card)} /> R7+
              </label>
            </li>
          );
        })}
        {!army.length && <li className="muted">Agrega unidades desde la lista de abajo.</li>}
      </ul>

      <div className="roster-tools">
        <input placeholder="Buscar unidad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label><input type="checkbox" checked={showRoR} onChange={(e) => setShowRoR(e.target.checked)} /> Regimientos de Renombre</label>
      </div>
      <div className="roster">
        {grouped.map(([g, list]) => (
          <div key={g}>
            <div className="roster-group">{GROUP_ES[g] ?? g}</div>
            {list.map((u) => (
              <button key={u.card} className="roster-item" onClick={() => add(u.card)} disabled={usedSlots >= 20}>
                <span>{u.name}</span>
                <span className="muted">{u.cost}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
