import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ArmyState, ComputedCard, DpsRow, UnitData } from '../types';

interface Props {
  army: ArmyState;
  cards: ComputedCard[];
  units: UnitData[];
  ownName: string;
}

interface Target { key: string; name: string; caste: string; cost?: number; models?: number }
interface Faction { key: string; name: string }

const OWN = '__propia__';
const DEFAULT_TARGETS = ['wh_main_chs_warriors', 'wh_main_chs_chosen', 'wh_main_chs_marauder', 'wh_main_chs_spawn'];
const STORE = 'wh3-planner:dps-targets';

function loadTargets(): string[] | null {
  try {
    const r = localStorage.getItem(STORE);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

export function DpsPanel({ army, cards, units, ownName }: Props) {
  const [attacker, setAttacker] = useState<string>('');
  const [targets, setTargets] = useState<string[]>(() => loadTargets() ?? DEFAULT_TARGETS);
  const [rows, setRows] = useState<DpsRow[]>([]);
  const [info, setInfo] = useState<{ disclaimer: string; debuffs: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [faction, setFaction] = useState<string>(OWN);
  const [factionUnits, setFactionUnits] = useState<Target[]>([]);
  const [casteFilter, setCasteFilter] = useState('');

  useEffect(() => {
    api.factions().then(setFactions).catch(() => setFactions([]));
  }, []);

  useEffect(() => {
    if (faction === OWN) {
      setFactionUnits(units.map((u) => ({ key: u.card, name: u.name, caste: u.casteEs ?? u.caste, cost: u.cost, models: u.models })));
      return;
    }
    api.targets(faction).then(setFactionUnits).catch(() => setFactionUnits([]));
  }, [faction, units]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(targets));
    } catch {
      /* sin almacenamiento */
    }
  }, [targets]);

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

  const castes = useMemo(() => [...new Set(factionUnits.map((u) => u.caste))].sort(), [factionUnits]);
  const options = useMemo(
    () => factionUnits.filter((u) => !casteFilter || u.caste === casteFilter).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [factionUnits, casteFilter],
  );
  const add = (key: string) => key && !targets.includes(key) && setTargets([...targets, key]);
  const addAll = () => setTargets([...new Set([...targets, ...options.filter((o) => !/Señor|Héroe/.test(o.caste)).map((o) => o.key)])].slice(0, 60));

  return (
    <div className="dps">
      <h3>Daño cuerpo a cuerpo (DPS)</h3>
      <div className="dps-tools">
        <label>
          Atacante:{' '}
          <select value={attacker} onChange={(e) => setAttacker(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id + c.kind} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="dps-tools">
        <label>
          Facción enemiga:{' '}
          <select value={faction} onChange={(e) => { setFaction(e.target.value); setCasteFilter(''); }}>
            <option value={OWN}>{ownName} (mi roster)</option>
            {factions.map((f) => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
        </label>
        <label>
          Tipo:{' '}
          <select value={casteFilter} onChange={(e) => setCasteFilter(e.target.value)}>
            <option value="">Todos</option>
            {castes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Agregar objetivo:{' '}
          <select value="" onChange={(e) => add(e.target.value)}>
            <option value="">— elegir ({options.length}) —</option>
            {options.map((u) => (
              <option key={u.key} value={u.key}>{u.name}{u.cost ? ` · ${u.cost}` : ''}</option>
            ))}
          </select>
        </label>
        <button className="ghost" onClick={addAll} title="Agrega todas las unidades (sin señores ni héroes) de la lista filtrada, hasta 60">+ Todas las de la lista</button>
        <button className="ghost" onClick={() => setTargets([])}>Limpiar</button>
      </div>
      {!factions.length && (
        <p className="small warn">Para enemigos de otras facciones corre <code>npm run extraer</code> con la carpeta data del juego.</p>
      )}
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
          {[...rows].sort((a, b) => a.timeToKill - b.timeToKill).map((r) => (
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
      <p className="small muted">Los objetivos van sin bufos (stats base del juego). Ordenado de más rápido a más lento de matar.</p>
    </div>
  );
}
