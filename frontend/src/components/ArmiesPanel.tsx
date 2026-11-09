import { useEffect, useMemo, useState } from 'react';
import type { CharacterSummary, UnitData } from '../types';
import { GameIcon } from '../gameIcons';

/**
 * Varios ejércitos de la misma facción: se guardan con nombre, se cargan para editarlos y se suma su mantenimiento.
 * Líneas de suministro (script del juego, wh_campaign_setup.lua): cada ejército desde el segundo pone un efecto
 * de +X% de mantenimiento a TODOS los ejércitos de la facción (X: 1 fácil/normal, 2 difícil, 4 muy difícil/legendaria).
 */
interface ArmyLike {
  lord?: { character: string } | null;
  heroes?: { character: string }[];
  units: { card: string; count: number }[];
}
interface Saved { id: string; name: string; army: ArmyLike }

interface Props {
  faction: string;
  army: ArmyLike;
  characters: CharacterSummary[];
  units: UnitData[];
  /** Cargar un ejército guardado como el actual */
  onLoad: (a: ArmyLike) => void;
}

const DIFF: { k: string; n: string; pct: number }[] = [
  { k: 'normal', n: 'Fácil / Normal', pct: 1 },
  { k: 'hard', n: 'Difícil', pct: 2 },
  { k: 'vhard', n: 'Muy difícil / Legendaria', pct: 4 },
];

const keyOf = (f: string) => `wh3-planner:armies:${f}`;
const load = (f: string): Saved[] => { try { const v = JSON.parse(localStorage.getItem(keyOf(f)) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const fmt = (n: number) => Math.round(n).toLocaleString('es-MX');

export function ArmiesPanel({ faction, army, characters, units, onLoad }: Props) {
  const [saved, setSaved] = useState<Saved[]>(() => load(faction));
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [diff, setDiff] = useState<string>(() => { try { return localStorage.getItem('wh3-planner:armies-diff') ?? 'normal'; } catch { return 'normal'; } });
  useEffect(() => { setSaved(load(faction)); setActive(null); }, [faction]);
  useEffect(() => { try { localStorage.setItem(keyOf(faction), JSON.stringify(saved)); } catch { /* sin almacenamiento */ } }, [saved, faction]);
  useEffect(() => { try { localStorage.setItem('wh3-planner:armies-diff', diff); } catch { /* sin almacenamiento */ } }, [diff]);

  const byCard = useMemo(() => new Map(units.map((u) => [u.card, u])), [units]);
  const byChar = useMemo(() => new Map(characters.map((c) => [c.key, c])), [characters]);
  const costOf = (a: ArmyLike) => {
    let upkeep = 0, rc = 0, n = 0, missing = 0;
    for (const ch of [a.lord, ...(a.heroes ?? [])]) {
      if (!ch) continue;
      const c = byChar.get(ch.character);
      if (c?.upkeep === undefined) { missing++; continue; }
      upkeep += c.upkeep; rc += c.rc ?? 0;
    }
    for (const s of a.units) {
      const u = byCard.get(s.card);
      n += s.count;
      if (u?.upkeep === undefined) { missing++; continue; }
      upkeep += u.upkeep * s.count; rc += (u.rc ?? u.cost) * s.count;
    }
    return { upkeep, rc, n, missing };
  };
  const pct = DIFF.find((d) => d.k === diff)?.pct ?? 1;
  const rows = saved.map((s) => ({ ...s, ...costOf(s.army) }));
  const supply = Math.max(0, rows.length - 1) * pct; // % que se suma a cada ejército
  const totalBase = rows.reduce((t, r) => t + r.upkeep, 0);
  const total = totalBase * (1 + supply / 100);
  const cur = costOf(army);
  const lordName = (a: ArmyLike) => (a.lord ? byChar.get(a.lord.character)?.name ?? '—' : 'Sin señor');

  const save = () => {
    const id = `${Date.now()}`;
    const n = name.trim() || `${lordName(army)} ${saved.length + 1}`;
    setSaved([...saved, { id, name: n, army: JSON.parse(JSON.stringify(army)) }]);
    setActive(id); setName('');
  };
  const update = (id: string) => setSaved(saved.map((s) => (s.id === id ? { ...s, army: JSON.parse(JSON.stringify(army)) } : s)));
  const rename = (id: string, n: string) => setSaved(saved.map((s) => (s.id === id ? { ...s, name: n } : s)));

  return (
    <details className="armies-panel" open={saved.length > 0}>
      <summary>
        <GameIcon path="skills/campaign_army" emoji="⚑" size={16} /> Mis ejércitos ({saved.length})
        {rows.length > 0 && <span className="muted small"> · mantenimiento total <b className="gold">{fmt(total)}</b> por turno</span>}
      </summary>
      <div className="ap-tools small">
        <input value={name} placeholder={`Nombre (p. ej. ${lordName(army)})`} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <button onClick={save}>Guardar el ejército actual</button>
        <span className="muted">Actual: {cur.n} unidades · reclutar {fmt(cur.rc)} · mantenimiento {fmt(cur.upkeep)}</span>
        <label className="ap-diff">Dificultad
          <select value={diff} onChange={(e) => setDiff(e.target.value)}>
            {DIFF.map((d) => <option key={d.k} value={d.k}>{d.n} (+{d.pct}% por ejército extra)</option>)}
          </select>
        </label>
      </div>
      {rows.length > 0 && (
        <table className="ap-table small">
          <thead>
            <tr><th>Ejército</th><th>Señor</th><th className="num">Unid.</th><th className="num">Reclutar</th><th className="num">Mant. base</th><th className="num">Con suministro</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === active ? 'on' : ''}>
                <td><input className="ap-name" value={r.name} onChange={(e) => rename(r.id, e.target.value)} /></td>
                <td>{lordName(r.army)}</td>
                <td className="num">{r.n}</td>
                <td className="num">{fmt(r.rc)}</td>
                <td className="num">{fmt(r.upkeep)}{r.missing ? <span className="muted" title="Sin dato de mantenimiento en el juego"> *</span> : null}</td>
                <td className="num">{fmt(r.upkeep * (1 + supply / 100))}</td>
                <td className="ap-act">
                  <button className="ghost" title="Editar este ejército (reemplaza el actual)" onClick={() => { onLoad(JSON.parse(JSON.stringify(r.army))); setActive(r.id); }}>Cargar</button>
                  {r.id === active && <button className="ghost" title="Guardar los cambios del ejército actual aquí" onClick={() => update(r.id)}>Actualizar</button>}
                  <button className="ghost danger" title="Borrar" onClick={() => { setSaved(saved.filter((s) => s.id !== r.id)); if (active === r.id) setActive(null); }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><b>Total ({rows.length} ejércitos)</b></td>
              <td className="num">{fmt(rows.reduce((t, r) => t + r.rc, 0))}</td>
              <td className="num">{fmt(totalBase)}</td>
              <td className="num"><b className="gold">{fmt(total)}</b></td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
      <p className="muted small">
        Líneas de suministro: cada ejército a partir del segundo sube {pct}% el mantenimiento de <b>todos</b> tus ejércitos
        {rows.length > 1 ? ` (ahora +${supply}%)` : ''}. No cuenta tecnologías, edificios, rasgos ni habilidades que bajan el mantenimiento,
        las monturas de los personajes ni las guarniciones.
      </p>
    </details>
  );
}
