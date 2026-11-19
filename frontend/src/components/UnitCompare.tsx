import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { fmtStat } from '../statFormat';
import type { ArmyState, ComputedCard, StatKey, UnitData } from '../types';

/**
 * Comparador de unidades: columnas con unidades de tu ejército (con sus bufos, rango y habilidades activas) y de
 * cualquier facción (con o sin los bufos permanentes de tu señor, héroes y tecnologías). Resalta la mejor de cada fila.
 */

type Pick = { src: 'army'; id: string } | { src: 'any'; card: string };
const KEY = 'wh3-planner:compare';
const pickId = (p: Pick) => (p.src === 'army' ? `army:${p.id}` : `any:${p.card}`);

interface Row { label: string; get: (c: ComputedCard) => number | undefined; fmt?: (v: number) => string; better?: 'high' | 'low'; stat?: StatKey }
const st = (k: StatKey) => (c: ComputedCard) => c.stats[k]?.final;
const ROWS: { group: string; rows: Row[] }[] = [
  { group: 'General', rows: [
    { label: 'Coste', get: (c) => c.cost, better: 'low' },
    { label: 'Modelos', get: (c) => c.models },
    { label: 'Vida por modelo', get: st('hp'), stat: 'hp', better: 'high' },
    { label: 'Vida total', get: (c) => (c.stats.hp ? c.stats.hp.final * c.models : undefined), better: 'high' },
    { label: 'Armadura', get: st('armour'), stat: 'armour', better: 'high' },
    { label: 'Liderazgo', get: st('ld'), stat: 'ld', better: 'high' },
    { label: 'Velocidad', get: st('speed'), stat: 'speed', better: 'high' },
  ] },
  { group: 'Cuerpo a cuerpo', rows: [
    { label: 'Ataque c. a c.', get: st('ma'), stat: 'ma', better: 'high' },
    { label: 'Defensa c. a c.', get: st('md'), stat: 'md', better: 'high' },
    { label: 'Bonif. de carga', get: st('charge'), stat: 'charge', better: 'high' },
    { label: 'Daño base', get: st('dmg'), stat: 'dmg', better: 'high' },
    { label: 'Daño perforante', get: st('ap'), stat: 'ap', better: 'high' },
    { label: 'Daño por golpe (base + perf.)', get: (c) => (c.stats.dmg?.final ?? 0) + (c.stats.ap?.final ?? 0), better: 'high' },
    { label: 'Bonif. contra grandes', get: st('bvl'), stat: 'bvl', better: 'high' },
    { label: 'Bonif. contra infantería', get: st('bvi'), stat: 'bvi', better: 'high' },
    { label: 'Intervalo de ataque (s)', get: (c) => c.interval || undefined, better: 'low', fmt: (v) => v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) },
  ] },
  { group: 'Distancia', rows: [
    { label: 'Daño de proyectil', get: st('missileDmg'), stat: 'missileDmg', better: 'high' },
    { label: 'Perforante del proyectil', get: (c) => c.missile?.ap, better: 'high' },
    { label: 'Alcance', get: st('range'), stat: 'range', better: 'high' },
    { label: 'Munición', get: st('ammo'), stat: 'ammo', better: 'high' },
    { label: 'Recarga (s)', get: st('reload'), stat: 'reload', better: 'low', fmt: (v) => v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) },
  ] },
  { group: 'Resistencias (%)', rows: [
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

  const cardOf = (p: Pick) => (p.src === 'army' ? cards.find((c) => `${c.kind}:${c.id}` === p.id) : anyCards[p.card]);
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
            {cards.length ? cards.map((c) => {
              const p: Pick = { src: 'army', id: `${c.kind}:${c.id}` };
              const on = picks.some((x) => pickId(x) === pickId(p));
              return <button key={pickId(p)} className={'cmp-chip' + (on ? ' on' : '')} onClick={() => (on ? del(p) : add(p))}>{c.name}{c.kind === 'unit' && c.count > 1 ? ` ×${c.count}` : ''}</button>;
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
                <th></th>
                {cols.map(({ p, c }) => (
                  <th key={pickId(p)}>
                    <div className="cmp-head">
                      {c?.art && <img src={`/units/${c.art}.png`} alt="" loading="lazy" />}
                      <span>{c?.name ?? '…'}</span>
                      <small className="muted">{p.src === 'army' ? 'tu ejército' : buffs ? `rango ${rank} · tus bufos` : `rango ${rank} · base`}</small>
                      <button className="ghost small" onClick={() => del(p)} title="Quitar">✕</button>
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
                  <tr key={g.group} className="cmp-group"><td colSpan={cols.length + 1}>{g.group}</td></tr>,
                  ...rows.map((r) => {
                    const vals = cols.map(({ c }) => (c ? r.get(c) : undefined));
                    const nums = vals.filter((v): v is number => v != null && v !== 0);
                    const best = nums.length > 1 && r.better ? (r.better === 'high' ? Math.max(...nums) : Math.min(...nums)) : undefined;
                    const worst = nums.length > 1 && r.better ? (r.better === 'high' ? Math.min(...nums) : Math.max(...nums)) : undefined;
                    return (
                      <tr key={g.group + r.label}>
                        <td className="muted">{r.label}</td>
                        {cols.map(({ p, c }, i) => {
                          const v = vals[i];
                          const line = r.stat && c ? c.stats[r.stat] : undefined;
                          const diff = line && line.final !== line.base ? line.final - line.base : 0;
                          const cls = v != null && best !== undefined && best !== worst ? (v === best ? 'cmp-best' : v === worst ? 'cmp-worst' : '') : '';
                          return (
                            <td key={pickId(p)} className={cls} title={line && diff ? `Base ${fmtStat(line.base, r.stat)}` : undefined}>
                              {v == null || v === 0 ? '—' : r.fmt ? r.fmt(v) : fmtStat(v, r.stat)}
                              {diff ? <small className={diff > 0 ? 'up' : 'down'}> ({diff > 0 ? '+' : ''}{fmtStat(diff, r.stat)})</small> : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }),
                ];
              })}
              <tr className="cmp-group"><td colSpan={cols.length + 1}>Atributos</td></tr>
              <tr>
                <td></td>
                {cols.map(({ p, c }) => <td key={pickId(p)} className="small">{c?.attributes.map((a) => a.name).join(', ') || '—'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        En dorado la mejor de cada fila; en gris la peor. Entre paréntesis lo que suman los bufos sobre el valor base. Las de tu ejército usan su rango y
        las habilidades que tengas encendidas; las demás, el rango elegido arriba. No cuenta carga real, habilidades propias de la unidad ni contra quién pelea:
        para eso está la pestaña DPS.
      </p>
    </section>
  );
}
