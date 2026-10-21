import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ArmyState, ComputedCard, DpsRow, UnitData } from '../types';

interface Props {
  army: ArmyState;
  cards: ComputedCard[];
  units: UnitData[];
}

const DEFAULT_TARGETS = ['wh_main_chs_warriors', 'wh_main_chs_chosen', 'wh_main_chs_marauder', 'wh_main_chs_spawn', 'wh_main_chs_chaos_knights'];

export function DpsPanel({ army, cards, units }: Props) {
  const [attacker, setAttacker] = useState<string>('');
  const [targets, setTargets] = useState<string[]>(DEFAULT_TARGETS.filter((t) => units.some((u) => u.card === t)));
  const [rows, setRows] = useState<DpsRow[]>([]);
  const [info, setInfo] = useState<{ disclaimer: string; debuffs: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState('');

  useEffect(() => {
    if (!cards.find((c) => c.id === attacker) && cards.length) setAttacker(cards[0].id);
  }, [cards, attacker]);

  useEffect(() => {
    if (!attacker || !targets.length) {
      setRows([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .dps(army, attacker, targets)
        .then((r) => {
          setRows(r.rows);
          setInfo({ disclaimer: r.disclaimer, debuffs: r.debuffs });
          setErr(null);
        })
        .catch((e) => setErr(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [army, attacker, targets]);

  const options = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);

  return (
    <div className="dps">
      <h3>Daño cuerpo a cuerpo (DPS)</h3>
      <div className="dps-tools">
        <label>
          Atacante:{' '}
          <select value={attacker} onChange={(e) => setAttacker(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Agregar objetivo:{' '}
          <select
            value={pick}
            onChange={(e) => {
              const v = e.target.value;
              if (v && !targets.includes(v)) setTargets([...targets, v]);
              setPick('');
            }}
          >
            <option value="">— elegir —</option>
            {options.map((u) => (
              <option key={u.card} value={u.card}>{u.name}</option>
            ))}
          </select>
        </label>
      </div>
      {err && <div className="warn">{err}</div>}
      <table className="dps-table">
        <thead>
          <tr>
            <th>Objetivo</th>
            <th>Acierto</th>
            <th>Daño/golpe</th>
            <th>Res.</th>
            <th>DPS</th>
            <th>Tiempo para matar</th>
            <th>DPS/1000 MP</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.target}>
              <td>{r.targetName}</td>
              <td className="num">{r.hitChance}%</td>
              <td className="num">{r.dmgPerHit}</td>
              <td className="num">{r.resistanceUsed}%</td>
              <td className="num"><b>{r.dps}</b></td>
              <td className="num">{Number.isFinite(r.timeToKill) ? `${r.timeToKill} s` : '—'}</td>
              <td className="num">{r.efficiency ?? '—'}</td>
              <td><button className="ghost" onClick={() => setTargets(targets.filter((t) => t !== r.target))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {info?.debuffs.length ? <p className="small">Debufos activos sobre el enemigo: {info.debuffs.join(', ')}</p> : null}
      <p className="small muted">{info?.disclaimer}</p>
      <p className="small muted">Los objetivos son unidades del roster de Guerreros del Caos (sin bufos). Para enemigos de otras facciones hay que agregar sus datos.</p>
    </div>
  );
}
