import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { fmtStat } from '../statFormat';
import { StatImg } from '../gameIcons';
import type { ArmyState, ComputedCard, StatKey, UnitData } from '../types';

/**
 * Comparador de unidades: columnas con unidades de tu ejército (con sus bufos, rango y habilidades activas) y de
 * cualquier facción (con o sin los bufos permanentes de tu señor, héroes y tecnologías). Resalta la mejor de cada fila.
 */

type Pick = { src: 'army'; id: string } | { src: 'any'; card: string };
const KEY = 'wh3-planner:compare';
const pickId = (p: Pick) => (p.src === 'army' ? `army:${p.id}` : `any:${p.card}`);

interface Row { label: string; get: (c: ComputedCard) => number | undefined; fmt?: (v: number) => string; better?: 'high' | 'low'; stat?: StatKey; icon?: string; emoji?: string }
const st = (k: StatKey) => (c: ComputedCard) => c.stats[k]?.final;
const ROWS: { group: string; icon: string; rows: Row[] }[] = [
  { group: 'General', icon: '📋', rows: [
    { label: 'Coste', get: (c) => c.cost, better: 'low', emoji: '💰' },
    { label: 'Modelos', get: (c) => c.models, emoji: '👥' },
    { label: 'Vida por modelo', get: st('hp'), stat: 'hp', better: 'high' },
    { label: 'Vida total', get: (c) => (c.stats.hp ? c.stats.hp.final * c.models : undefined), better: 'high', icon: 'hp' },
    { label: 'Armadura', get: st('armour'), stat: 'armour', better: 'high' },
    { label: 'Liderazgo', get: st('ld'), stat: 'ld', better: 'high' },
    { label: 'Velocidad', get: st('speed'), stat: 'speed', better: 'high' },
  ] },
  { group: 'Cuerpo a cuerpo', icon: '⚔️', rows: [
    { label: 'Ataque c. a c.', get: st('ma'), stat: 'ma', better: 'high' },
    { label: 'Defensa c. a c.', get: st('md'), stat: 'md', better: 'high' },
    { label: 'Bonif. de carga', get: st('charge'), stat: 'charge', better: 'high' },
    { label: 'Daño base', get: st('dmg'), stat: 'dmg', better: 'high' },
    { label: 'Daño perforante', get: st('ap'), stat: 'ap', better: 'high' },
    { label: 'Daño por golpe (base + perf.)', get: (c) => (c.stats.dmg?.final ?? 0) + (c.stats.ap?.final ?? 0), better: 'high', icon: 'dmg' },
    { label: 'Bonif. contra grandes', get: st('bvl'), stat: 'bvl', better: 'high' },
    { label: 'Bonif. contra infantería', get: st('bvi'), stat: 'bvi', better: 'high' },
    { label: 'Intervalo de ataque (s)', get: (c) => c.interval || undefined, better: 'low', emoji: '⏱️', fmt: (v) => v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) },
  ] },
  { group: 'Distancia', icon: '🏹', rows: [
    { label: 'Daño de proyectil', get: st('missileDmg'), stat: 'missileDmg', better: 'high' },
    { label: 'Perforante del proyectil', get: (c) => c.missile?.ap, better: 'high', icon: 'ap' },
    { label: 'Alcance', get: st('range'), stat: 'range', better: 'high' },
    { label: 'Munición', get: st('ammo'), stat: 'ammo', better: 'high' },
    { label: 'Recarga (s)', get: st('reload'), stat: 'reload', better: 'low', fmt: (v) => v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) },
  ] },
  { group: 'Resistencias (%)', icon: '🛡️', rows: [
    { label: 'Física', get: st('resPhysical'), stat: 'resPhysical', better: 'high' },
    { label: 'Proyectiles', get: st('resMissile'), stat: 'resMissile', better: 'high' },
    { label: 'Mágica', get: st('resMagic'), stat: 'resMagic', better: 'high' },
    { label: 'Fuego', get: st('resFlame'), stat: 'resFlame', better: 'high' },
    { label: 'Salvación (todo daño)', get: st('resWard'), stat: 'resWard', better: 'high' },
    { label: 'Barrera', get: st('barrier'), stat: 'barrier', better: 'high' },
  ] },
];

interface Props {
  army: ArmyState;
  /** Tarjetas ya calculadas de tu ejército (con bufos, rango y activables) */
  cards: ComputedCard[];
}

export function UnitCompare({ army, cards }: Props) {
  const [picks, setPicks] = useState<Pick[]>(() => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [all, setAll] = useState<UnitData[]>([]);
  const [q, setQ] = useState('');
  const [rank, setRank] = useState(0);
  const [buffs, setBuffs] = useState(true);
  const [anyCards, setAnyCards] = useState<Record<string, ComputedCard>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch { /* sin almacenamiento */ } }, [picks]);
  useEffect(() => { api.units('all').then(setAll).catch(() => setAll([])); }, []);

  // Unidades de cualquier facción: se calculan con tus bufos permanentes (o sin nada) y el rango elegido
  const anyList = picks.filter((p): p is { src: 'any'; card: string } => p.src === 'any').map((p) => p.card);
  const anyKey = anyList.join('|');
  useEffect(() => {
    if (!anyList.length) { setAnyCards({}); return; }
    setBusy(true);
    const base: ArmyState = buffs
      ? { ...army, activeAbilities: [], units: [] }
      : { lord: null, heroes: [], units: [], activeAbilities: [], inAura: false, faction: army.faction };
    api.compute({ ...base, units: anyList.map((card) => ({ card, count: 1, rank })) })
      .then((r) => setAnyCards(Object.fromEntries(r.cards.filter((c) => c.kind === 'unit').map((c) => [c.id, c]))))
      .catch(() => setAnyCards({}))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyKey, rank, buffs, army.lord, army.heroes, army.techs, army.faction]);

  // La misma unidad puede estar varias veces en el ejército (con otro rango o estandarte): cada una con su número
  const armyKeys = useMemo(() => {
    const seen: Record<string, number> = {};
    return cards.map((c) => { const k = `${c.kind}:${c.id}`; seen[k] = (seen[k] ?? 0) + 1; return seen[k] > 1 ? `${k}#${seen[k]}` : k; });
  }, [cards]);
  const cardOf = (p: Pick) => (p.src === 'army' ? cards[armyKeys.indexOf(p.id)] : anyCards[p.card]);
  const cols = picks.map((p) => ({ p, c: cardOf(p) }));
  const add = (p: Pick) => setPicks((l) => (l.some((x) => pickId(x) === pickId(p)) || l.length >= 6 ? l : [...l, p]));
  const del = (p: Pick) => setPicks((l) => l.filter((x) => pickId(x) !== pickId(p)));

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const results = useMemo(() => {
    const t = norm(q.trim());
    if (t.length < 2) return [];
    const seen = new Set<string>();
    return all.filter((u) => norm(u.name).includes(t) && !seen.has(u.name + u.cost) && seen.add(u.name + u.cost)).slice(0, 30);
  }, [q, all]);

  return (
    <section className="compare-page">
      <div className="cmp-pick">
        <div className="cmp-src">
          <b className="small">De tu ejército</b>
          <div className="cmp-chips">
            {cards.length ? cards.map((c, ci) => {
              const p: Pick = { src: 'army', id: armyKeys[ci] };
              const on = picks.some((x) => pickId(x) === pickId(p));
              return <button key={pickId(p)} className={'cmp-chip' + (on ? ' on' : '')} onClick={() => (on ? del(p) : add(p))}>{c.name}{c.kind === 'unit' && c.count > 1 ? ` ×${c.count}` : ''}{c.kind === 'unit' && armyKeys.filter((k) => k.split('#')[0] === armyKeys[ci].split('#')[0]).length > 1 ? ` · rango ${c.rank ?? 0}` : ''}</button>;
            }) : <span className="muted small">Arma un ejército para compararlo con sus bufos.</span>}
          </div>
        </div>
        <div className="cmp-src">
          <b className="small">Cualquier unidad</b>
          <input placeholder="Buscar unidad de cualquier facción…" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.length > 0 && (
            <div className="cmp-results">
              {results.map((u) => (
                <button key={u.card} className="cmp-chip" onClick={() => { add({ src: 'any', card: u.card }); setQ(''); }}>
                  {u.name} <span className="muted small">{u.casteEs ?? u.caste} · {u.cost}</span>
                </button>
              ))}
            </div>
          )}
          <div className="cmp-opts small">
            <label><input type="checkbox" checked={buffs} onChange={(e) => setBuffs(e.target.checked)} /> con los bufos permanentes de tu señor, héroes y tecnologías</label>
            <label>Rango <select value={rank} onChange={(e) => setRank(Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label>
            {busy && <span className="muted">calculando…</span>}
          </div>
        </div>
      </div>

      {cols.length === 0 ? (
        <p className="muted">Elige hasta 6 unidades: de tu ejército (con sus bufos, rango y habilidades activas) o de cualquier facción.</p>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th className="cmp-ref-note small muted">{cols.length > 1 ? <>Diferencias contra <b>{cols[0].c?.name ?? 'la primera'}</b> ◆</> : null}</th>
                {cols.map(({ p, c }, i) => (
                  <th key={pickId(p)} className={i === 0 && cols.length > 1 ? 'cmp-ref' : ''}>
                    <div className="cmp-head">
                      {c?.art ? <img src={`/units/${c.art}.png`} alt="" loading="lazy" /> : <span className="cmp-noart">?</span>}
                      <div className="cmp-head-txt">
                        <span className="cmp-name" title={c?.name}>{c?.name ?? '…'}</span>
                        <small className="muted">{i === 0 && cols.length > 1 ? '◆ referencia · ' : ''}{p.src === 'army' ? 'tu ejército' : buffs ? `rango ${rank} · tus bufos` : `rango ${rank} · base`}</small>
                        <span className="cmp-acts">
                          {i > 0 && <button className="cmp-x" onClick={() => setPicks((l) => [p, ...l.filter((x) => pickId(x) !== pickId(p))])} title="Usar como referencia">◆</button>}
                          <button className="cmp-x" onClick={() => del(p)} title="Quitar">✕</button>
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((g) => {
                const rows = g.rows.filter((r) => cols.some(({ c }) => c && (r.get(c) ?? 0) !== 0));
                if (!rows.length) return null;
                return [
                  <tr key={g.group} className="cmp-group"><td colSpan={cols.length + 1}>{g.icon} {g.group}</td></tr>,
                  ...rows.map((r) => {
                    const vals = cols.map(({ c }) => (c ? r.get(c) : undefined));
                    const nums = vals.filter((v): v is number => v != null && v !== 0);
                    const max = nums.length ? Math.max(...nums) : 0, min = nums.length ? Math.min(...nums) : 0;
                    const best = nums.length > 1 && r.better && max !== min ? (r.better === 'high' ? max : min) : undefined;
                    const worst = nums.length > 1 && r.better && max !== min ? (r.better === 'high' ? min : max) : undefined;
                    const ref = vals[0];
                    const show = (v: number) => (r.fmt ? r.fmt(v) : fmtStat(v, r.stat));
                    return (
                      <tr key={g.group + r.label}>
                        <td className="cmp-label"><StatImg stat={r.icon ?? r.stat ?? ''} emoji={r.emoji ?? ''} size={15} /> {r.label}</td>
                        {cols.map(({ p, c }, i) => {
                          const v = vals[i];
                          const line = r.stat && c ? c.stats[r.stat] : undefined;
                          const buff = line && line.final !== line.base ? line.final - line.base : 0;
                          if (v == null || v === 0) return <td key={pickId(p)} className="cmp-empty">—</td>;
                          const cls = v === best ? 'cmp-best' : v === worst ? 'cmp-worst' : '';
                          // Barra: lo lleno es lo bueno (en "menos es mejor" se invierte)
                          const pct = max > 0 ? (r.better === 'low' ? (min / v) * 100 : (v / max) * 100) : 0;
                          // Flecha contra la referencia (primera columna): verde si es mejor, roja si es peor
                          const d = i > 0 && ref != null && ref !== 0 ? v - ref : 0;
                          const good = r.better ? (r.better === 'high' ? d > 0 : d < 0) : undefined;
                          return (
                            <td key={pickId(p)} className={cls} title={line && buff ? `Base ${fmtStat(line.base, r.stat)} · bufos ${buff > 0 ? '+' : ''}${fmtStat(buff, r.stat)}` : undefined}>
                              <div className="cmp-cell">
                                <span className="cmp-val">{v === best && <span className="cmp-crown">★</span>}{show(v)}</span>
                                {d !== 0 && (
                                  <span className={'cmp-delta ' + (good === undefined ? '' : good ? 'good' : 'bad')}
                                    title={`${d > 0 ? 'Más' : 'Menos'} que la referencia${good === undefined ? '' : good ? ' (mejor)' : ' (peor)'}${r.better === 'low' ? ' · aquí menos es mejor' : ''}`}>
                                    {good === undefined ? '' : good ? '👍 ' : '👎 '}{d > 0 ? '+' : '−'}{show(Math.abs(d))}
                                  </span>
                                )}
                                {buff ? <span className={'cmp-buff ' + (buff > 0 ? 'up' : 'down')} title="Lo que suman tus bufos">{buff > 0 ? '+' : ''}{fmtStat(buff, r.stat)}</span> : null}
                              </div>
                              {r.better && <div className="cmp-bar"><i style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} /></div>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }),
                ];
              })}
              <tr className="cmp-group"><td colSpan={cols.length + 1}>🏷️ Atributos</td></tr>
              <tr>
                <td></td>
                {cols.map(({ p, c }) => (
                  <td key={pickId(p)} className="cmp-attrs">
                    {c?.attributes.length ? c.attributes.map((a) => <span key={a.name} className="cmp-attr">{a.name}</span>) : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        ★ = la mejor de cada fila; en gris la peor. La barra se llena según qué tan buena es (en coste, intervalo y recarga, menos es mejor).
        +/− = diferencia contra la referencia ◆: 👍 verde si es mejor, 👎 rojo si es peor (en coste, intervalo y recarga, tener más es peor). La etiqueta chica es lo que suman tus bufos. Las de tu ejército usan su rango y
        las habilidades que tengas encendidas; las demás, el rango elegido arriba. No cuenta carga real, habilidades propias de la unidad ni contra quién pelea:
        para eso está la pestaña DPS.
      </p>
    </section>
  );
}
