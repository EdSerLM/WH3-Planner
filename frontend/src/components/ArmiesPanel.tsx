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
interface Saved { id: string; name: string; army: ArmyLike; notes?: string[]; damaged?: number }
/** Partida guardada del juego convertida (frontend/public/partidas, ver backend/scripts/partidas) */
interface SaveEntry { file: string; name: string; faction: string; campaign: string; turn: number; difficulty?: string; armies: number }
interface SaveFile {
  name: string; turn: number;
  armies: { name: string; army: ArmyLike; notes?: string[]; damaged?: number }[];
  /** Objetos de la facción que no lleva nadie */
  reserve?: { k: string; n: string; cat: string; count: number; inPlanner: boolean }[];
}
const SAVES_URL = `${import.meta.env.BASE_URL}partidas/`;
const PW_KEY = 'wh3-planner:partidas-pw';

/** Archivos cifrados (backend/scripts/partidas/a_planner.cjs): PBKDF2-SHA256 + AES-256-GCM */
interface Sealed { iv: string; ct: string }
interface SealedIndex extends Sealed { v: number; iter: number; salt: string }
const b64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
async function deriveKey(pw: string, idx: SealedIndex): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(idx.salt), iterations: idx.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
async function openSealed<T>(key: CryptoKey, o: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(o.iv) }, key, b64(o.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
const CAT_RES: Record<string, string> = {
  weapon: 'Arma', armour: 'Armadura', talisman: 'Talismán', enchanted_item: 'Hechizado', arcane_item: 'Arcano', general: 'Seguidor', banner: 'Estandarte',
};

interface Props {
  faction: string;
  army: ArmyLike;
  characters: CharacterSummary[];
  units: UnitData[];
  /** Cargar un ejército guardado como el actual */
  onLoad: (a: ArmyLike) => void;
  /** Nombres de las facciones (para las partidas de otra facción) y cambiar de facción */
  factions?: { key: string; name: string }[];
  onFaction?: (f: string) => void;
}

const DIFF: { k: string; n: string; pct: number }[] = [
  { k: 'normal', n: 'Fácil / Normal', pct: 1 },
  { k: 'hard', n: 'Difícil', pct: 2 },
  { k: 'vhard', n: 'Muy difícil / Legendaria', pct: 4 },
];

const DIFF_SAVE: Record<string, string> = { EASY: 'fácil', NORMAL: 'normal', HARD: 'difícil', VERY_HARD: 'muy difícil', LEGENDARY: 'legendaria' };

const keyOf = (f: string) => `wh3-planner:armies:${f}`;
const load = (f: string): Saved[] => { try { const v = JSON.parse(localStorage.getItem(keyOf(f)) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const fmt = (n: number) => Math.round(n).toLocaleString('es-MX');

export function ArmiesPanel({ faction, army, characters, units, onLoad, factions, onFaction }: Props) {
  const [saved, setSaved] = useState<Saved[]>(() => load(faction));
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [diff, setDiff] = useState<string>(() => { try { return localStorage.getItem('wh3-planner:armies-diff') ?? 'normal'; } catch { return 'normal'; } });
  const [games, setGames] = useState<SaveEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sealed, setSealed] = useState<SealedIndex | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [pwErr, setPwErr] = useState(false);
  const [reserve, setReserve] = useState<SaveFile['reserve'] | null>(null);
  const unlock = async (pass: string, idx: SealedIndex, keep: boolean) => {
    try {
      const k = await deriveKey(pass, idx);
      const list = await openSealed<SaveEntry[]>(k, idx);
      setKey(k); setGames(list); setPwErr(false); setPw('');
      try { if (keep) localStorage.setItem(PW_KEY, pass); else sessionStorage.setItem(PW_KEY, pass); } catch { /* sin almacenamiento */ }
      return true;
    } catch { return false; }
  };
  useEffect(() => {
    fetch(`${SAVES_URL}index.json`).then((r) => (r.ok ? r.json() : null)).then(async (v) => {
      if (!v || !v.ct) return;
      setSealed(v);
      let saved: string | null = null;
      try { saved = localStorage.getItem(PW_KEY) ?? sessionStorage.getItem(PW_KEY); } catch { /* sin almacenamiento */ }
      if (saved && !(await unlock(saved, v, !!localStorage.getItem(PW_KEY)))) {
        try { localStorage.removeItem(PW_KEY); sessionStorage.removeItem(PW_KEY); } catch { /* */ }
      }
    }).catch(() => undefined);
  }, []);
  const lock = () => {
    setKey(null); setGames([]); setReserve(null);
    try { localStorage.removeItem(PW_KEY); sessionStorage.removeItem(PW_KEY); } catch { /* */ }
  };
  const tryPw = async () => { if (sealed && !(await unlock(pw, sealed, remember))) setPwErr(true); };
  useEffect(() => { setSaved(load(faction)); setActive(null); setReserve(null); }, [faction]);
  const mine = games.filter((g) => g.faction === faction);
  const others = games.filter((g) => g.faction !== faction);
  const facName = (f: string) => factions?.find((x) => x.key === f)?.name ?? f;
  /** Agrega los ejércitos de una partida (reemplaza los que ya se habían traído de esa misma partida) */
  const importGame = async (g: SaveEntry) => {
    setBusy(g.file);
    try {
      const r = await fetch(`${SAVES_URL}${g.file}`);
      if (!key) throw new Error('bloqueado');
      const data = await openSealed<SaveFile>(key, (await r.json()) as Sealed);
      setReserve(data.reserve ?? []);
      const prefix = `save:${g.file}:`;
      const add: Saved[] = data.armies.map((a, i) => ({ id: `${prefix}${i}`, name: a.name, army: a.army, notes: a.notes, damaged: a.damaged }));
      setSaved((prev) => [...prev.filter((x) => !x.id.startsWith(prefix)), ...add]);
      const d = { EASY: 'normal', NORMAL: 'normal', HARD: 'hard', VERY_HARD: 'vhard', LEGENDARY: 'vhard' }[g.difficulty ?? ''];
      if (d) setDiff(d);
    } catch { /* sin conexión */ }
    setBusy(null);
  };
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
    <details className="armies-panel" open={saved.length > 0 || mine.length > 0}>
      <summary>
        <GameIcon path="skills/campaign_army" emoji="⚑" size={16} /> Mis ejércitos ({saved.length})
        {rows.length > 0 && <span className="muted small"> · mantenimiento total <b className="gold">{fmt(total)}</b> por turno</span>}
      </summary>
      {sealed && !key && (
        <div className="ap-games small">
          <b>🔒 Tus partidas guardadas (protegidas):</b>
          <input type="password" value={pw} placeholder="Contraseña" onChange={(e) => { setPw(e.target.value); setPwErr(false); }} onKeyDown={(e) => { if (e.key === 'Enter') tryPw(); }} />
          <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Recordar en este navegador</label>
          <button onClick={tryPw} disabled={!pw}>Abrir</button>
          {pwErr && <span className="danger">Contraseña incorrecta</span>}
        </div>
      )}
      {games.length > 0 && (
        <div className="ap-games small">
          <b>Desde tus partidas guardadas:</b>
          {mine.map((g) => {
            const n = saved.filter((x) => x.id.startsWith(`save:${g.file}:`)).length;
            return (
              <span key={g.file} className="ap-game">
                {g.name} · turno {g.turn} · {g.armies} ejércitos{g.difficulty ? ` · ${DIFF_SAVE[g.difficulty] ?? g.difficulty}` : ''}
                <button onClick={() => importGame(g)} disabled={busy === g.file}>{n ? 'Volver a traer' : 'Traer ejércitos'}</button>
              </span>
            );
          })}
          {mine.length === 0 && <span className="muted"> ninguna de esta facción.</span>}
          <button className="ghost" onClick={lock} title="Olvidar la contraseña en este navegador">🔒 Bloquear</button>
          {others.length > 0 && onFaction && (
            <span className="muted"> Otras:{' '}
              {others.map((g, i) => (
                <span key={g.file}>{i > 0 && ', '}<a href="#" onClick={(e) => { e.preventDefault(); onFaction(g.faction); }} title={`Cambiar a ${facName(g.faction)}`}>{g.name}</a></span>
              ))}
            </span>
          )}
        </div>
      )}
      {reserve && reserve.length > 0 && (
        <details className="ap-reserve small">
          <summary>Objetos en reserva de la partida ({reserve.reduce((t, r) => t + r.count, 0)}): nadie los lleva puestos</summary>
          <div className="ap-res-list">
            {reserve.map((r) => (
              <span key={r.k} className={'ap-res' + (r.inPlanner ? '' : ' muted')} title={r.inPlanner ? 'Puedes equiparlo en el árbol del personaje (Objetos comunes) o, si es estandarte, en la unidad' : 'Este objeto no está en el planner'}>
                {CAT_RES[r.cat] ?? r.cat}: {r.n}{r.count > 1 ? ` ×${r.count}` : ''}
              </span>
            ))}
          </div>
        </details>
      )}
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
                <td>
                  <input className="ap-name" value={r.name} onChange={(e) => rename(r.id, e.target.value)} />
                  {(r.notes?.length || r.damaged) ? (
                    <span className="muted ap-note" title={[...(r.damaged ? [`${r.damaged} unidades con bajas en la partida (aquí van completas)`] : []), ...(r.notes ?? [])].join('\n')}> ⓘ</span>
                  ) : null}
                </td>
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
        {games.length > 0 && <> De las partidas se traen el señor, los héroes (rango, habilidades, montura, objetos y seguidores), las unidades
        con su rango y los estandartes que llevan; no se traen los rasgos, las tecnologías ni las bajas.</>}
      </p>
    </details>
  );
}
