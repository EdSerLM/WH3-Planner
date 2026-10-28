import { useEffect, useMemo, useState } from 'react';
import { unitRank, type ArmyUnitSelection, type CampaignFaction, type UnitData } from '../types';
import type { RosterBuffs } from '../App';
import { campaignUnits } from '../campaign';
import { groupInfo } from '../unitGroups';
import { GroupIcon } from '../gameIcons';

const RANKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  units: UnitData[];
  army: ArmyUnitSelection[];
  usedSlots: number;
  /** Qué unidades reciben bufos del señor, héroes y tecnologías */
  buffs?: RosterBuffs;
  /** Facción de campaña (datos del juego): oculta las unidades que no puede tener */
  campaign?: CampaignFaction;
  onChange: (army: ArmyUnitSelection[]) => void;
}


/** Icono: ▲ dorado si recibe bufos con rango 0; "R+" si gana más al subir de rango (rango 7+ o "por rango") */
export function BuffMark({ b }: { b?: RosterBuffs[string] }) {
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

/** Etiquetas de unidades especiales (datos del juego): Renombre, solo campaña, exclusivas, límite, mejora */
export function SpecialTags({ u, upgradeRank, building }: { u: UnitData; upgradeRank?: number; building?: string[] }) {
  const ror = /_ror/.test(u.key + u.card);
  const excl = u.excl ?? [];
  return (
    <>
      {ror && <span className="sp-tag ror" title="Regimiento de Renombre: versión única y mejorada de una unidad, con rasgos propios. En campaña solo puedes tener 1.">🏅 Renombre</span>}
      {upgradeRank !== undefined && (
        <span className="exalted-tag" title={`En campaña se consigue mejorando otra unidad (Mejoras de Banda) desde rango ${upgradeRank}`}>Mejora R{upgradeRank}</span>
      )}
      {building && (
        <span className="sp-tag bld" title={`Su reserva de reclutamiento es de otra facción; esta facción solo la recluta con: ${building.join(', ')}`}>
          🏛️ Solo con edificio
        </span>
      )}
      {u.campaignOnly && !ror && (
        <span className="sp-tag camp" title="Solo existe en campaña (no aparece en batallas personalizadas): mecánicas de facción, eventos, rituales, recompensas...">🗺️ Solo campaña</span>
      )}
      {excl.length > 0 && (
        <span className="sp-tag excl" title={`Solo la pueden tener: ${excl.join(', ')}`}>
          🔒 {excl.length <= 2 ? excl.join(', ') : `${excl.length} facciones`}
        </span>
      )}
      {!ror && u.cap !== undefined && u.cap > 0 && (
        <span className="sp-tag cap" title={`Límite en campaña: máximo ${u.cap} de esta unidad`}>Máx. {u.cap}</span>
      )}
    </>
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
  const campName = campaign?.name;
  const allowed = useMemo(() => campaignUnits(campaign), [campaign]);
  const unitAllowed = (u: UnitData) => !allowed || allowed.has(u.card);
  const [q, setQ] = useState('');
  const [showRoR, setShowRoR] = useState(false);
  const [onlyBuffed, setOnlyBuffed] = useState(false);
  // El roster se abre en una ventana encima (así no ocupa la columna ni tiene su propia barra de desplazamiento)
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);
  const anyBuffs = Object.keys(buffs).length > 0;
  const byCard = useMemo(() => new Map(units.map((u) => [u.card, u])), [units]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return units
      .filter((u) => showRoR || !/_ror/.test(u.key + u.card)) // Regimientos de Renombre
      .filter((u) => unitAllowed(u))
      .filter((u) => !qq || u.name.toLowerCase().includes(qq))
      .filter((u) => !onlyBuffed || !!buffs[u.card])
      .sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || a.cost - b.cost);
  }, [units, q, showRoR, onlyBuffed, buffs, allowed]);

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
                {u && <span className="grp-icon"><GroupIcon g={u.group} /></span>}
                {u?.name ?? a.card} <BuffMark b={buffs[a.card]} />
                {u && <SpecialTags u={u} upgradeRank={campaign?.upgrades[u.card]} building={campaign?.buildings?.[u.card]} />}
                {u && !unitAllowed(u) && (
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

      <button className="add-units" onClick={() => setPicking(true)} disabled={usedSlots >= 20}>
        ＋ Agregar unidades {usedSlots >= 20 ? '(ejército lleno)' : ''}
      </button>
      {campName && <div className="small muted">Roster de campaña: {campName}</div>}

      {picking && (
        <div className="roster-modal" onClick={() => setPicking(false)}>
          <div className="roster-box" onClick={(e) => e.stopPropagation()}>
            <div className="roster-box-head">
              <h3>Agregar unidades</h3>
              <span className={usedSlots > 20 ? 'bad' : ''}>{usedSlots} / 20</span>
              <input autoFocus placeholder="Buscar unidad…" value={q} onChange={(e) => setQ(e.target.value)} />
              <label><input type="checkbox" checked={showRoR} onChange={(e) => setShowRoR(e.target.checked)} /> Regimientos de Renombre</label>
              <label title="Muestra solo las unidades que reciben bufos de tu señor, héroes o tecnologías">
                <input type="checkbox" checked={onlyBuffed} disabled={!anyBuffs} onChange={(e) => setOnlyBuffed(e.target.checked)} /> Solo con bufos
              </label>
              <button className="ghost" onClick={() => setPicking(false)} title="Cerrar (Esc)">✕ Listo</button>
            </div>
            <div className="small muted roster-legend">
              {campName ? `Roster de campaña: ${campName} · ` : ''}
              🏅 Renombre · 🗺️ solo campaña · 🔒 exclusiva de algunas facciones · Máx. N = límite en campaña
              {anyBuffs && <> · <span className="bm-now">▲n</span> recibe bufos · <span className="bm-r7">R+</span> más bufos al subir de rango</>}
              {' '}· pasa el ratón para ver detalles · clic para agregar (puedes agregar varias)
            </div>
            <div className="roster">
              {grouped.map(([g, list]) => (
                <div key={g} className="roster-col">
                  <div className="roster-group"><span className="grp-icon"><GroupIcon g={g} /></span> {GROUP_ES[g] ?? groupInfo(g).es} <span className="muted small">({list.length})</span></div>
                  {list.map((u) => {
                    const n = army.find((a) => a.card === u.card)?.count ?? 0;
                    return (
                      <button key={u.card} className={'roster-item' + (n ? ' in-army' : '')} onClick={() => add(u.card)} disabled={usedSlots >= 20}>
                        <span>
                          {n > 0 && <b className="in-count">×{n}</b>} {u.name} <BuffMark b={buffs[u.card]} />
                          <SpecialTags u={u} upgradeRank={campaign?.upgrades[u.card]} building={campaign?.buildings?.[u.card]} />
                        </span>
                        <span className="muted">{u.cost}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {!grouped.length && <p className="muted">Ninguna unidad coincide.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
