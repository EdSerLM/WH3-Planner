import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { AbilityImg } from '../gameIcons';
import type { LoreInfo, RawAbility, RawAbilityPhase, SpellDamage } from '../types';

/**
 * Visor de hechizos: cada saber con sus hechizos, la versión normal al lado de la sobrecargada y lo que cambia
 * resaltado (coste, recarga, daño, área y bufos o debufos).
 */

const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('es-MX');
const sec = (v?: number) => (v && v > 0 ? `${fmt(v)} s` : undefined);

function damageRows(d: SpellDamage | null | undefined, pre = ''): [string, string][] {
  if (!d) return [];
  const out: [string, string][] = [];
  const hit = (x: { dmg?: number; ap?: number }) => `${fmt(x.dmg ?? 0)} + ${fmt(x.ap ?? 0)} perforante`;
  if (d.kind === 'vortex') {
    out.push([`${pre}Daño del vórtice (por entidad y golpe)`, hit(d)]);
    out.push([`${pre}Radio`, d.r0 ? `${fmt(d.r0)} → ${fmt(d.r ?? 0)} m` : `${fmt(d.r ?? 0)} m`]);
    if (d.dur) out.push([`${pre}Duración del vórtice`, `${fmt(d.dur)} s`]);
    if (d.n) out.push([`${pre}Vórtices`, `${d.n}`]);
    if (d.spd) out.push([`${pre}Velocidad`, `${fmt(d.spd)}`]);
    if (d.allies) out.push([`${pre}Daña aliados`, 'sí']);
    if (d.next) out.push(...damageRows(d.next, `${pre}Después: `));
    return out;
  }
  out.push([`${pre}${d.kind === 'bombardment' ? 'Daño de cada impacto' : 'Daño del proyectil'}`, hit(d)]);
  if (d.n) out.push([`${pre}${d.kind === 'bombardment' ? 'Impactos' : 'Proyectiles'}`, `${d.n}`]);
  if (d.spread) out.push([`${pre}Dispersión`, `${fmt(d.spread)} m`]);
  if (d.vInf) out.push([`${pre}Bonif. vs. infantería`, `+${fmt(d.vInf)}`]);
  if (d.vLarge) out.push([`${pre}Bonif. vs. grandes`, `+${fmt(d.vLarge)}`]);
  if (d.ex) out.push([`${pre}Explosión`, `${hit(d.ex)}${d.ex.r ? ` · radio ${fmt(d.ex.r)} m` : ''}`]);
  if (d.vortex) out.push(...damageRows(d.vortex, `${pre}Deja un vórtice: `));
  return out;
}

const who = (p: RawAbilityPhase) => [p.ts && 'sí mismo', p.tf && 'aliados', p.te && 'enemigos'].filter(Boolean).join(', ');

function effectLines(a: RawAbility): string[] {
  const out: string[] = [];
  a.phases.forEach((p, i) => {
    const head = a.phases.length > 1 ? `Fase ${i + 1}${p.dur > 0 ? ` (${fmt(p.dur)} s)` : ''}: ` : '';
    const tgt = who(p) ? ` [${who(p)}]` : '';
    for (const s of p.stats) out.push(`${head}${s.d}${tgt}`);
    for (const at of p.attr) out.push(`${head}${at}${tgt}`);
    if (p.dot) out.push(`${head}Daño ${fmt(p.dot)} por segundo a cada entidad${p.dotMax ? ` (máx. ${p.dotMax})` : ''}${tgt}`);
    if (p.heal) out.push(`${head}Cura ${fmt(p.heal)}% de la vida por segundo${p.res ? ' y revive modelos' : ''}${tgt}`);
    if (p.mag) out.push(`${head}Ataques mágicos${tgt}`);
    if (p.fire) out.push(`${head}Ataques flamígeros${tgt}`);
    if (p.imb) out.push(`${head}Sus golpes aplican «${p.imb.n}»${p.imb.dur ? ` (${fmt(p.imb.dur)} s)` : ''}: ${p.imb.stats.map((s) => s.d).join(', ')}`);
  });
  return out;
}

function baseRows(a: RawAbility): [string, string][] {
  const rows: [string, string | undefined][] = [
    ['Maná', a.mana ? fmt(a.mana) : undefined],
    ['Recarga', sec(a.cd)],
    ['Alcance', a.reach ? `${fmt(a.reach)} m` : undefined],
    ['Duración', a.active && a.active > 0 ? `${fmt(a.active)} s` : undefined],
    ['Área', a.range ? `${fmt(a.range)} m` : undefined],
    ['Objetivo', [a.ts && 'sí mismo', a.tf && 'aliados', a.te && 'enemigos', a.tg && 'suelo'].filter(Boolean).join(', ') || undefined],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

function SpellCard({ normal, over }: { normal: RawAbility; over?: RawAbility }) {
  const rows = useMemo(() => {
    const n = new Map([...baseRows(normal), ...damageRows(normal.dmg)]);
    const o = new Map(over ? [...baseRows(over), ...damageRows(over.dmg)] : []);
    const labels = [...new Set([...n.keys(), ...o.keys()])];
    return labels.map((l) => ({ l, n: n.get(l), o: o.get(l) }));
  }, [normal, over]);
  const en = effectLines(normal), eo = over ? effectLines(over) : [];
  const changed = over && (rows.some((r) => r.n !== r.o) || en.join('|') !== eo.join('|'));
  return (
    <article className="sv-card">
      <div className="sv-ch">
        <AbilityImg icon={normal.img} size={40} title={normal.name} />
        <div>
          <b>{normal.name}</b>
          <span className="muted small">{normal.type}{over ? (changed ? '' : ' · sobrecargar no cambia nada') : ' · no se puede sobrecargar'}</span>
        </div>
      </div>
      <table className="sv-table">
        <thead><tr><th></th><th>Normal</th>{over && <th>Sobrecargado</th>}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.l}>
              <td className="muted">{r.l}</td>
              <td>{r.n ?? '—'}</td>
              {over && <td className={r.n !== r.o ? 'sv-diff' : ''}>{r.o ?? '—'}</td>}
            </tr>
          ))}
          {(en.length > 0 || eo.length > 0) && (
            <tr className="sv-eff">
              <td className="muted">Efectos</td>
              <td><ul>{en.map((x, i) => <li key={i} className={over && !eo.includes(x) ? 'sv-gone' : ''}>{x}</li>)}</ul></td>
              {over && <td><ul>{eo.map((x, i) => <li key={i} className={!en.includes(x) ? 'sv-diff' : ''}>{x}</li>)}</ul></td>}
            </tr>
          )}
        </tbody>
      </table>
    </article>
  );
}

const PICK_KEY = 'wh3-planner:lore';

export function SpellViewer() {
  const [lores, setLores] = useState<LoreInfo[] | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<string>(() => { try { return localStorage.getItem(PICK_KEY) ?? ''; } catch { return ''; } });
  const [q, setQ] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  useEffect(() => { api.lores().then(setLores).catch((e) => setErr(String(e))); }, []);
  const pick = (k: string) => { setSel(k); try { localStorage.setItem(PICK_KEY, k); } catch { /* sin almacenamiento */ } };
  if (err) return <p className="muted">No pude cargar los saberes: {err}</p>;
  if (!lores) return <p className="muted">Cargando saberes…</p>;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q.trim());
  const match = (l: LoreInfo) => !t || norm(l.name).includes(t) || l.spells.some((s) => norm(s.normal.name).includes(t));
  const shown = lores.filter(match);
  const cur = lores.find((l) => l.key === sel) ?? shown[0] ?? lores[0];
  const spells = cur.spells.filter((s) => (!t || norm(cur.name).includes(t) || norm(s.normal.name).includes(t)) && (!onlyChanged || s.over));
  const group = (main: boolean, title: string) => {
    const l = shown.filter((x) => x.main === main);
    return l.length ? (
      <>
        <div className="sv-group">{title}</div>
        {l.map((x) => (
          <button key={x.key} className={'sv-lore' + (x.key === cur.key ? ' on' : '')} onClick={() => pick(x.key)}
            style={x.color ? { borderLeftColor: `rgb(${x.color.join(',')})` } : undefined}>
            <AbilityImg icon={x.img ?? x.spells[0]?.normal.img} size={26} />
            <span>{x.name}</span>
            <small className="muted">{x.spells.length}</small>
          </button>
        ))}
      </>
    ) : null;
  };
  return (
    <section className="spell-viewer">
      <aside className="sv-list">
        <input className="sv-search" placeholder="Buscar saber o hechizo…" value={q} onChange={(e) => setQ(e.target.value)} />
        {group(true, 'Saberes')}
        {group(false, 'Saberes de personajes')}
      </aside>
      <div className="sv-main">
        <div className="sv-head">
          <AbilityImg icon={cur.img ?? cur.spells[0]?.normal.img} size={34} />
          <h2>{cur.name}</h2>
          <label className="small muted"><input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> solo los que se pueden sobrecargar</label>
        </div>
        <p className="muted small">
          Datos del juego. En la columna «Sobrecargado» va en dorado lo que cambia; en «Normal» se tachan los efectos que la sobrecarga
          sustituye. El daño del vórtice es por entidad en cada golpe que da mientras dura; el de proyectiles y explosiones, por impacto.
          No incluye bonos de habilidades del lord, objetos ni tecnologías.
        </p>
        <div className="sv-grid">
          {spells.map((s) => <SpellCard key={s.normal.key} normal={s.normal} over={s.over} />)}
        </div>
      </div>
    </section>
  );
}
