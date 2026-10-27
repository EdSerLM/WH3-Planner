import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ArmyState, ComputedCard, DpsRow, UnitData } from '../types';
import { GROUP_ORDER, groupIndex, groupInfo } from '../unitGroups';
import { UnitIcon } from './UnitIcon';
import { Tier } from './ArmySetup';
import { GroupIcon, StatImg } from '../gameIcons';

interface Props {
  army: ArmyState;
  cards: ComputedCard[];
  units: UnitData[];
  ownName: string;
}

interface Target { key: string; name: string; caste: string; group?: string; cost?: number; models?: number; tier?: number }
interface Faction { key: string; name: string }

type SortKey = 'name' | 'group' | 'tier' | 'hit' | 'dmg' | 'res' | 'dps' | 'ttk' | 'eff' | 'cost' | 'back' | 'duel';
interface SortState { key: SortKey; dir: 1 | -1 }
type GroupBy = '' | 'type' | 'tier';
type Verdict = 'win' | 'even' | 'lose';
/** Regimiento de Renombre: el juego los marca con "_ror" en la clave de la unidad (igual que el roster) */
const isRor = (key: string) => /_ror/.test(key);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

const OWN = '__propia__';
const DEFAULT_TARGETS = ['wh_main_chs_warriors', 'wh_main_chs_chosen', 'wh_main_chs_marauder', 'wh_main_chs_spawn'];
const STORE = 'wh3-planner:dps-targets';
const STORE_VIEW = 'wh3-planner:dps-view';

// Columnas: qué es cada una y cómo se calcula (se ve al pasar el ratón por el encabezado)
const COLS: { key: SortKey; label: string; tip: string; firstDir: 1 | -1 }[] = [
  { key: 'hit', label: 'Acierto', firstDir: -1, tip: 'Probabilidad de acertar cada golpe.\n35 + Ataque melee + bonus contra grandes o infantería − Defensa melee del objetivo (×0.6 por el flanco, ×0.3 por la espalda), entre 8% y 90%.' },
  { key: 'dmg', label: 'Daño/golpe', firstDir: -1, tip: 'Daño de cada golpe que acierta.\nEl bonus contra tipo se suma al daño (repartido entre base y perforante). La armadura quita en promedio 0.75 × Armadura % del daño base (sigue contando arriba de 100, hasta 200). Luego se restan las resistencias y no pasa de la vida de un modelo.' },
  { key: 'res', label: 'Res.', firstDir: 1, tip: 'Resistencia total del objetivo: se suman salvación + física (no cuenta si tus ataques son mágicos) + fuego (si son flamígeros), tope 90%.\nNegativa = debilidad (recibe más daño).' },
  { key: 'dps', label: 'DPS', firstDir: -1, tip: 'Daño por segundo de toda la unidad.\nModelos × Acierto × Daño por golpe ÷ Intervalo de ataque.' },
  { key: 'ttk', label: 'Tiempo para matar', firstDir: 1, tip: 'Segundos para acabar con toda la unidad enemiga.\nVida total del objetivo ÷ DPS.' },
  { key: 'back', label: 'Te matan en', firstDir: 1, tip: 'Al revés: segundos que tarda el enemigo (stats base, con tus debufos) en matar a tu unidad (con sus bufos), con la misma fórmula.' },
  { key: 'duel', label: 'Resultado', firstDir: -1, tip: 'Quién gana el duelo cuerpo a cuerpo, uno contra uno.\nCompara cuánto tardas en matarlos contra cuánto tardan ellos en matarte:\n✅ Ganas: los matas al menos 20% más rápido\n⚖️ Parejo: menos de 20% de diferencia\n❌ Pierdes: te matan al menos 20% más rápido\nNo cuenta carga, liderazgo ni huida.' },
  { key: 'eff', label: 'DPS/1000 MP', firstDir: -1, tip: 'Eficiencia: DPS por cada 1000 de coste de tu unidad. Sirve para comparar unidades caras y baratas.' },
];

function loadJson<T extends object>(key: string, fallback: T): T {
  try {
    const r = localStorage.getItem(key);
    return r ? { ...fallback, ...JSON.parse(r) } : fallback;
  } catch {
    return fallback;
  }
}
function loadTargets(): string[] | null {
  try {
    const r = localStorage.getItem(STORE);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

function sortValue(r: DpsRow, k: SortKey): number | string {
  switch (k) {
    case 'name': return r.targetName;
    case 'group': return groupIndex(r.info?.group);
    case 'tier': return r.info?.tier ?? 0;
    case 'hit': return r.hitChance;
    case 'dmg': return r.dmgPerHit;
    case 'res': return r.resistanceUsed;
    case 'dps': return r.dps;
    case 'ttk': return Number.isFinite(r.timeToKill) ? r.timeToKill : 1e9;
    case 'eff': return r.efficiency ?? -1;
    case 'cost': return r.info?.cost ?? 0;
    case 'back': return r.duel && Number.isFinite(r.duel.enemy.timeToKill) ? r.duel.enemy.timeToKill : 1e9;
    case 'duel': return r.duel?.ratio ?? 0;
  }
}

type ResKey = 'ward' | 'physical' | 'missile' | 'magic' | 'flame';
const RES_ES: [ResKey, string][] = [
  ['ward', 'Salvación'], ['physical', 'Física'], ['missile', 'Proyectiles'], ['magic', 'Mágica'], ['flame', 'Fuego'],
];
const RES_ICON: Record<ResKey, string> = { ward: 'resWard', physical: 'resPhysical', missile: 'resMissile', magic: 'resMagic', flame: 'resFlame' };

export function DpsPanel({ army, cards, units, ownName }: Props) {
  const [attacker, setAttacker] = useState<string>('');
  const [targets, setTargets] = useState<string[]>(() => loadTargets() ?? DEFAULT_TARGETS);
  const [rows, setRows] = useState<DpsRow[]>([]);
  const [info, setInfo] = useState<{ disclaimer: string; debuffs: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [faction, setFaction] = useState<string>(OWN);
  const [factionUnits, setFactionUnits] = useState<Target[]>([]);
  const [groupFilter, setGroupFilter] = useState('');
  // grouped (booleano) es de versiones anteriores: equivale a agrupar por tipo
  // noRor: sin Regimientos de Renombre; verdict: solo los duelos con ese resultado
  const [view, setView] = useState<{ sort: SortState; grouped: boolean; groupBy?: GroupBy; noRor?: boolean; verdict?: Verdict | '' }>(() =>
    loadJson(STORE_VIEW, { sort: { key: 'ttk', dir: 1 } as SortState, grouped: false }),
  );
  const groupBy: GroupBy = view.groupBy ?? (view.grouped ? 'type' : '');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dir, setDir] = useState<'front' | 'flank' | 'rear'>('front');
  // Las filas son de este atacante y dirección; si no coinciden con lo elegido, se está recalculando
  const [rowsFor, setRowsFor] = useState('');

  useEffect(() => {
    api.factions().then(setFactions).catch(() => setFactions([]));
  }, []);

  useEffect(() => {
    if (faction === OWN) {
      setFactionUnits(units.map((u) => ({ key: u.card, name: u.name, caste: u.casteEs ?? u.caste, group: u.group, cost: u.cost, models: u.models })));
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
    try {
      localStorage.setItem(STORE_VIEW, JSON.stringify(view));
    } catch {
      /* sin almacenamiento */
    }
  }, [view]);

  useEffect(() => {
    if (!cards.find((c) => c.id === attacker) && cards.length) setAttacker(cards[0].id);
  }, [cards, attacker]);

  useEffect(() => {
    if (!attacker || !targets.length) {
      setRows([]);
      return;
    }
    // Una respuesta que llega tarde (de otro atacante o de un cambio anterior) se descarta
    let stale = false;
    const t = setTimeout(() => {
      api
        .dps(army, attacker, targets, dir)
        .then((r) => {
          if (stale) return;
          // Objetivos guardados con claves viejas y nuevas de la misma unidad: el backend los resuelve a la misma
          // (r.target) y salían filas repetidas, que dejaban filas viejas en la tabla. Una fila por unidad.
          const seen = new Set<string>();
          const uniq = r.rows.filter((x) => !seen.has(x.target) && !!seen.add(x.target));
          setRows(uniq);
          // Si el backend resolvió todos (misma cantidad y orden), se guardan con la clave actual y sin repetir
          if (r.rows.length === targets.length && r.rows.some((x, i) => x.target !== targets[i])) setTargets(uniq.map((x) => x.target));
          setRowsFor(`${attacker}|${dir}`);
          setInfo({ disclaimer: r.disclaimer, debuffs: r.debuffs });
          setErr(null);
        })
        .catch((e) => { if (!stale) setErr(e.message); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [army, attacker, targets, dir]);
  const recalculating = !!rows.length && rowsFor !== `${attacker}|${dir}`;

  const groups = useMemo(
    () => [...new Set(factionUnits.map((u) => u.group ?? ''))].sort((a, b) => groupIndex(a) - groupIndex(b)),
    [factionUnits],
  );
  const options = useMemo(
    () => factionUnits
      .filter((u) => !groupFilter || (u.group ?? '') === groupFilter)
      .filter((u) => !view.noRor || !isRor(u.key))
      .sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.name.localeCompare(b.name, 'es')),
    [factionUnits, groupFilter, view.noRor],
  );
  const isCharacter = (o: Target) => o.group === 'Lords' || o.group === 'Heroes' || /Señor|Héroe/.test(o.caste);
  const add = (key: string) => key && !targets.includes(key) && setTargets([...targets, key]);
  const addAll = () => setTargets([...new Set([...targets, ...options.filter((o) => !isCharacter(o)).map((o) => o.key)])].slice(0, 60));

  // Filas visibles: sin Regimientos de Renombre si se pide, y solo el resultado elegido
  const shown = useMemo(
    () => rows.filter((r) => (!view.noRor || !isRor(r.target)) && (!view.verdict || r.duel?.verdict === view.verdict)),
    [rows, view.noRor, view.verdict],
  );
  const sorted = useMemo(() => {
    const { key, dir } = view.sort;
    return [...shown].sort((a, b) => {
      const va = sortValue(a, key), vb = sortValue(b, key);
      const c = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : va - (vb as number);
      return c * dir || a.targetName.localeCompare(b.targetName, 'es');
    });
  }, [shown, view.sort]);

  const sections = useMemo(() => {
    if (!groupBy) return [{ group: '', rows: sorted }];
    const keyOf = (r: DpsRow) => (groupBy === 'tier' ? String(r.info?.tier ?? 0) : r.info?.group ?? '');
    const m = new Map<string, DpsRow[]>();
    for (const r of sorted) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r]);
    const order = (k: string) => (groupBy === 'tier' ? -Number(k) : groupIndex(k)); // nivel: de élite (V) a básicas (I)
    return [...m.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([group, rows]) => ({ group, rows }));
  }, [sorted, groupBy]);
  const sectionTitle = (g: string) =>
    groupBy === 'tier'
      ? <><Tier t={Number(g) || undefined} /> <b>{Number(g) ? `Nivel ${ROMAN[Number(g)] ?? g}` : 'Sin nivel'}</b></>
      : <><span className="grp-icon"><GroupIcon g={g} /></span> <b>{groupInfo(g).es}</b></>;

  const maxDps = Math.max(1, ...shown.map((r) => r.dps));
  const finite = shown.filter((r) => Number.isFinite(r.timeToKill)).map((r) => r.timeToKill);
  const count = (v: Verdict) => rows.filter((r) => (!view.noRor || !isRor(r.target)) && r.duel?.verdict === v).length;
  const fastest = finite.length > 1 ? Math.min(...finite) : undefined;
  const slowest = finite.length > 1 ? Math.max(...finite) : undefined;

  const sortBy = (key: SortKey, firstDir: 1 | -1) =>
    setView((v) => ({ ...v, sort: v.sort.key === key ? { key, dir: (v.sort.dir * -1) as 1 | -1 } : { key, dir: firstDir } }));
  const arrow = (key: SortKey) => (view.sort.key === key ? (view.sort.dir === 1 ? ' ▲' : ' ▼') : '');
  const toggleOpen = (k: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const attCard = cards.find((c) => c.id === attacker);

  return (
    <div className="dps">
      <h3>Daño cuerpo a cuerpo (DPS)</h3>
      {attCard && (
        <div className="dps-attacker">
          {attCard.art ? <img className="dps-art big" src={`/units/${attCard.art}.png`} alt="" /> : null}
          <div>
            <b>{attCard.name}</b>
            <div className="small muted">{attCard.caste}{attCard.models ? ` · ${attCard.models} modelos` : ''} · con tus bufos</div>
            <div className="small">
              <StatImg stat="ma" emoji="⚔️" title="Ataque cuerpo a cuerpo" /> {attCard.stats.ma.final}
              {' · '}<StatImg stat="ws" emoji="💥" title="Fuerza del arma" /> {Math.round((attCard.stats.dmg.final + attCard.stats.ap.final) * 10) / 10} ({Math.round(attCard.stats.ap.final * 10) / 10} perf.)
              {' · '}<StatImg stat="md" emoji="🛡️" title="Defensa cuerpo a cuerpo" /> {attCard.stats.md.final}
              {' · '}<StatImg stat="armour" emoji="⛓️" title="Armadura" /> {attCard.stats.armour.final}
            </div>
          </div>
          <span className="dps-vs">vs</span>
          <span className="small muted">
            {shown.length} objetivo{shown.length === 1 ? '' : 's'}{shown.length !== rows.length ? ` (de ${rows.length})` : ''}
            {recalculating && <b className="dps-recalc"> · recalculando…</b>}
          </span>
        </div>
      )}
      <div className="dps-tools">
        <label>
          Atacante:{' '}
          <select value={attacker} onChange={(e) => setAttacker(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id + c.kind} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {attCard && (
          <span className="small">
            {attCard.flamingAttacks && <span className="chip fire">Flamígero</span>}
            {attCard.magicalAttacks && <span className="chip magic">Mágico</span>}
            {attCard.stats.bvl.final > 0 && (
              <span className="chip" title="Bonificación contra grandes: se suma al ataque contra caballería, carros y monstruos">vs grandes +{attCard.stats.bvl.final}</span>
            )}
            {attCard.stats.bvi.final > 0 && (
              <span className="chip" title="Bonificación contra infantería: se suma al ataque contra objetivos pequeños">vs infantería +{attCard.stats.bvi.final}</span>
            )}
          </span>
        )}
      </div>
      <div className="dps-tools">
        <label>
          Facción enemiga:{' '}
          <select value={faction} onChange={(e) => { setFaction(e.target.value); setGroupFilter(''); }}>
            <option value={OWN}>{ownName} (mi roster)</option>
            {factions.map((f) => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
        </label>
        <label>
          Tipo:{' '}
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Todos</option>
            {groups.map((g) => (
              <option key={g} value={g}>{groupInfo(g).icon} {groupInfo(g).es}</option>
            ))}
          </select>
        </label>
        <label>
          Agregar objetivo:{' '}
          <select value="" onChange={(e) => add(e.target.value)}>
            <option value="">— elegir ({options.length}) —</option>
            {options.map((u) => (
              <option key={u.key} value={u.key} disabled={targets.includes(u.key)}>
                {groupInfo(u.group).icon} {u.name}{u.tier ? ` · ${ROMAN[u.tier] ?? u.tier}` : ''}{u.cost ? ` · ${u.cost}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="ghost" onClick={addAll} title="Agrega todas las unidades (sin señores ni héroes) de la lista filtrada, hasta 60">+ Todas las de la lista</button>
        <button className="ghost" onClick={() => setTargets([])}>Limpiar</button>
      </div>
      <div className="dps-tools">
        <label title="Desde dónde atacas: por el flanco la defensa del enemigo cuenta ×0.6 y por la espalda ×0.3 (constantes del juego). El duelo al revés siempre es de frente.">
          Atacas:{' '}
          <select value={dir} onChange={(e) => setDir(e.target.value as 'front' | 'flank' | 'rear')}>
            <option value="front">De frente</option>
            <option value="flank">Por el flanco (defensa ×0.6)</option>
            <option value="rear">Por la espalda (defensa ×0.3)</option>
          </select>
        </label>
        <label title="Separa la tabla por tipo de unidad (infantería, caballería, monstruos...) o por nivel (tier I a V)">
          Agrupar:{' '}
          <select value={groupBy} onChange={(e) => setView((v) => ({ ...v, groupBy: e.target.value as GroupBy }))}>
            <option value="">Sin agrupar</option>
            <option value="type">Por tipo</option>
            <option value="tier">Por nivel (tier)</option>
          </select>
        </label>
        <label title="Filtra la tabla por el resultado del duelo uno contra uno (columna Resultado)">
          Resultado:{' '}
          <select value={view.verdict ?? ''} onChange={(e) => setView((v) => ({ ...v, verdict: e.target.value as Verdict | '' }))}>
            <option value="">Todos</option>
            <option value="win">✅ Ganas ({count('win')})</option>
            <option value="even">⚖️ Parejo ({count('even')})</option>
            <option value="lose">❌ Pierdes ({count('lose')})</option>
          </select>
        </label>
        <label title="Oculta los Regimientos de Renombre de la tabla y de la lista para agregar objetivos">
          <input type="checkbox" checked={!!view.noRor} onChange={(e) => setView((v) => ({ ...v, noRor: e.target.checked }))} /> Sin Regimientos de Renombre
        </label>
        <button className="ghost" onClick={() => setOpen(open.size ? new Set() : new Set(shown.map((r) => r.target)))}>
          {open.size ? 'Cerrar fichas' : 'Abrir todas las fichas'}
        </button>
        <span className="small muted">Clic en un encabezado para ordenar · clic en una unidad para ver su ficha y el cálculo</span>
      </div>
      {!factions.length && (
        <p className="small warn">Para enemigos de otras facciones corre <code>npm run extraer</code> con la carpeta data del juego.</p>
      )}
      {err && <div className="warn">{err}</div>}
      {!!rows.length && !shown.length && <p className="small muted">Ningún objetivo con ese filtro.</p>}
      <table className={'dps-table' + (recalculating ? ' recalc' : '')}>
        <thead>
          <tr>
            <th className="sortable" onClick={() => sortBy('name', 1)} title="Unidad enemiga. Clic para ordenar por nombre">
              Objetivo{arrow('name')}
              <span className="th-sub" onClick={(e) => { e.stopPropagation(); sortBy('group', 1); }} title="Ordenar por tipo de unidad">tipo{arrow('group')}</span>
              <span className="th-sub" onClick={(e) => { e.stopPropagation(); sortBy('tier', -1); }} title="Ordenar por nivel (tier) del objetivo">nivel{arrow('tier')}</span>
              <span className="th-sub" onClick={(e) => { e.stopPropagation(); sortBy('cost', -1); }} title="Ordenar por coste del objetivo">coste{arrow('cost')}</span>
            </th>
            {COLS.map((c) => (
              <th key={c.key} className="sortable" title={c.tip + '\n\nClic para ordenar.'} onClick={() => sortBy(c.key, c.firstDir)}>
                {c.label}{arrow(c.key)}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => (
            <Fragment key={sec.group || 'all'}>
              {groupBy && (
                <tr className="dps-group">
                  <td colSpan={10}>
                    {sectionTitle(sec.group)}
                    <span className="muted small">
                      {' '}· {sec.rows.length} unidad{sec.rows.length === 1 ? '' : 'es'}
                      {(() => {
                        const w = sec.rows.filter((r) => r.duel?.verdict === 'win').length;
                        const l = sec.rows.filter((r) => r.duel?.verdict === 'lose').length;
                        return ` · ✅ ${w} · ⚖️ ${sec.rows.length - w - l} · ❌ ${l}`;
                      })()}
                      {(() => {
                        const t = sec.rows.filter((r) => Number.isFinite(r.timeToKill)).map((r) => r.timeToKill);
                        return t.length > 1 ? ` · de ${Math.min(...t)} s a ${Math.max(...t)} s` : '';
                      })()}
                    </span>
                  </td>
                </tr>
              )}
              {sec.rows.map((r) => {
                const gi = groupInfo(r.info?.group);
                const isOpen = open.has(r.target);
                const ttkCls = r.timeToKill === fastest ? 'best' : r.timeToKill === slowest ? 'worst' : '';
                return (
                  <Fragment key={r.target}>
                    <tr className={'dps-row' + (isOpen ? ' open' : '')}>
                      <td className="dps-name" onClick={() => toggleOpen(r.target)} title={r.info?.desc ?? 'Clic para ver la ficha'}>
                        <span className="caret">{isOpen ? '▾' : '▸'}</span>
                        {r.info?.art ? <img className="dps-art" src={`/units/${r.info.art}.png`} alt="" loading="lazy" /> : <span className="dps-art" />}
                        <span className="dps-who">
                          <span>
                            <span className="grp-icon" title={gi.es}>{r.info?.icon || r.info?.catIcon ? <UnitIcon kind={r.info.icon} cat={r.info.catIcon} size={15} /> : <GroupIcon g={r.info?.group} size={15} />}</span>
                            {' '}{r.targetName}
                          </span>
                          <span className="small muted"><Tier t={r.info?.tier} /> {r.info?.caste ?? gi.es}</span>
                        </span>
                        {r.info?.large && <span className="tag" title="Unidad grande: le afecta la bonificación contra grandes">Grande</span>}
                        {r.info?.bullets.slice(0, 4).map((b) => (
                          <span key={b.name} className={'bp-dot ' + (b.good ? 'good' : 'bad')} title={`${b.name}${b.tip ? `\n${b.tip}` : ''}`}>
                            {b.good ? '+' : '−'}
                          </span>
                        ))}
                        {r.info?.cost ? <span className="muted small"> · {r.info.cost}</span> : null}
                      </td>
                      <td className="num">{r.hitChance}%</td>
                      <td className="num">{r.dmgPerHit}</td>
                      <td className={'num ' + (r.resistanceUsed < 0 ? 'up' : r.resistanceUsed > 0 ? 'down' : '')}>{r.resistanceUsed}%</td>
                      <td className="num dps-cell">
                        <b>{r.dps}</b>
                        <span className="dps-bar"><span style={{ width: `${(r.dps / maxDps) * 100}%` }} /></span>
                      </td>
                      <td className={'num ttk ' + ttkCls}>{Number.isFinite(r.timeToKill) ? `${r.timeToKill} s` : '—'}</td>
                      <td className="num">{r.duel ? (Number.isFinite(r.duel.enemy.timeToKill) ? `${r.duel.enemy.timeToKill} s` : '—') : ''}</td>
                      <td className="num"><DuelBadge r={r} /></td>
                      <td className="num">{r.efficiency ?? '—'}</td>
                      <td><button className="ghost" title="Quitar" onClick={() => setTargets(targets.filter((t) => t !== r.target))}>×</button></td>
                    </tr>
                    {isOpen && (
                      <tr className="dps-detail">
                        <td colSpan={10}>
                          <TargetSheet r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {info?.debuffs.length ? <p className="small">Debufos activos sobre el enemigo: {info.debuffs.join(', ')}</p> : null}
      <p className="small muted dps-legend">
        {GROUP_ORDER.map((g) => (
          <span key={g}><GroupIcon g={g} size={14} /> {groupInfo(g).es}</span>
        ))}
        <span><span className="bp-dot good">+</span> punto fuerte</span>
        <span><span className="bp-dot bad">−</span> punto débil</span>
        <span><span className="ttk best">verde</span> / <span className="ttk worst">rojo</span> = más rápido / más lento de matar</span>
      </p>
      <p className="small muted">{info?.disclaimer}</p>
      <p className="small muted">Los objetivos van sin bufos (stats base del juego), solo con tus debufos activos. El resultado es un duelo uno contra uno sostenido: no cuenta la carga, el liderazgo ni la huida (una unidad puede "ganar" en daño y aun así huir), ni que al perder modelos se pega menos.</p>
    </div>
  );
}

const VERDICT = {
  win: { icon: '✅', text: 'Ganas', cls: 'win' },
  even: { icon: '⚖️', text: 'Parejo', cls: 'even' },
  lose: { icon: '❌', text: 'Pierdes', cls: 'lose' },
} as const;

function DuelBadge({ r }: { r: DpsRow }) {
  if (!r.duel) return null;
  const v = VERDICT[r.duel.verdict];
  const tt = (t: number) => (Number.isFinite(t) ? `${t} s` : 'nunca');
  const tip = `Tú los matas en ${tt(r.timeToKill)} · ellos te matan en ${tt(r.duel.enemy.timeToKill)}\n` +
    (r.duel.ratio >= 1 ? `Les ganas por ×${r.duel.ratio}` : `Te ganan por ×${Math.round((1 / Math.max(r.duel.ratio, 0.01)) * 100) / 100}`);
  const m = r.duel.models;
  const crowd = r.duel.crowd && m
    ? (r.duel.crowd === 'enemy'
      ? `Ellos tienen ${m.theirs} modelos contra tus ${m.mine}: el cálculo los hace pelear a todos a la vez, así que su daño sale sobreestimado y tu resultado es peor que en la batalla.`
      : `Tienes ${m.mine} modelos contra sus ${m.theirs}: el cálculo los hace pelear a todos a la vez, así que tu daño sale sobreestimado y tu resultado es mejor que en la batalla.`)
    : '';
  return (
    <span className={'duel ' + v.cls} title={tip + (crowd ? `\n\n⚠ ${crowd}` : '')}>
      {v.icon} {v.text}{crowd ? <span className="duel-crowd"> ⚠</span> : null}
    </span>
  );
}

/** Ficha del objetivo: descripción del juego, puntos fuertes/débiles, stats defensivos y el cálculo paso a paso */
function TargetSheet({ r }: { r: DpsRow }) {
  const i = r.info;
  const d = r.detail;
  const res = i ? RES_ES.filter(([k]) => i.res[k] !== 0) : [];
  const rawHit = d ? 35 + d.ma + d.bonus - d.md : 0;
  return (
    <div className="target-sheet">
      {i?.desc && <p className="trait-desc">{i.desc}</p>}
      {i && (
        <div className="ts-stats">
          <span><GroupIcon g={i.group} size={14} /> {i.caste}</span>
          <span title="Modelos × vida por modelo"><StatImg stat="hp" emoji="❤️" /> {i.models} × {i.hpPerModel} = <b>{i.models * i.hpPerModel}</b> vida</span>
          <span title="Defensa cuerpo a cuerpo"><StatImg stat="md" emoji="🛡️" /> Def. melee <b>{i.md}</b></span>
          <span title="Armadura: reduce el daño base entre la mitad y el total de su valor (tope 100%); por encima de 100 sigue sirviendo hasta 200"><StatImg stat="armour" emoji="⛓️" /> Armadura <b>{i.armour}</b></span>
          <span title="Liderazgo"><StatImg stat="ld" emoji="🚩" /> Liderazgo <b>{i.ld}</b></span>
          <span title="Velocidad"><StatImg stat="speed" emoji="👟" /> Velocidad <b>{i.speed}</b></span>
          {res.map(([k, n]) => (
            <span key={k} className={i.res[k] < 0 ? 'down' : 'up'} title={i.res[k] < 0 ? 'Debilidad: recibe más daño' : 'Resistencia'}>
              <StatImg stat={RES_ICON[k]} emoji="✨" /> {n} {i.res[k] > 0 ? '+' : ''}{i.res[k]}%
            </span>
          ))}
        </div>
      )}
      {i && (i.bullets.length > 0 || i.attrs.length > 0) && (
        <div className="ts-bullets">
          {i.bullets.map((b) => (
            <span key={b.name} className={'chip ' + (b.good ? 'bp-good' : 'bp-bad')} title={b.tip}>{b.good ? '▲' : '▼'} {b.name}</span>
          ))}
          {i.attrs.map((a) => (
            <span key={a} className="chip" title="Atributo de la unidad">{a}</span>
          ))}
        </div>
      )}
      {d && <CalcLines d={d} hit={r.hitChance} perHit={r.dmgPerHit} res={r.resistanceUsed} dps={r.dps} ttk={r.timeToKill} large={!!i?.large} hpPerModel={i?.hpPerModel} you={false} />}
      {r.duel?.enemy.detail && (
        <>
          <div className="ts-sub">Al revés: ellos contra tu unidad (de frente) <DuelBadge r={r} /></div>
          <CalcLines d={r.duel.enemy.detail} hit={r.duel.enemy.hitChance} perHit={r.duel.enemy.dmgPerHit} res={r.duel.enemy.resistanceUsed}
            dps={r.duel.enemy.dps} ttk={r.duel.enemy.timeToKill} large={false} you />
        </>
      )}
    </div>
  );
}

const DIR_ES = { front: 'de frente', flank: 'por el flanco (defensa ×0.6)', rear: 'por la espalda (defensa ×0.3)' } as const;
const fmt1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Cálculo paso a paso (tuyo contra ellos, o de ellos contra ti) */
function CalcLines({ d, hit, perHit, res, dps, ttk, large, hpPerModel, you }: {
  d: NonNullable<DpsRow['detail']>; hit: number; perHit: number; res: number; dps: number; ttk: number; large: boolean; hpPerModel?: number; you: boolean;
}) {
  const raw = Math.round((35 + d.ma + d.bonus - d.md) * 10) / 10;
  const def = you ? 'tu defensa' : 'defensa';
  const base = d.dmg + d.bonusBase, ap = d.ap + d.bonusAp;
  const uncapped = (base * (1 - d.armourRed / 100) + ap) * (1 - res / 100);
  const resParts = [
    d.res.ward ? `salvación ${d.res.ward}%` : '',
    d.res.physical && !d.res.magicalIgnoresPhysical ? `física ${d.res.physical}%` : '',
    d.res.flame ? `fuego ${d.res.flame}%` : '',
  ].filter(Boolean);
  return (
    <ul className="ts-calc">
      <li>
        <b>Acierto</b>: 35 + {fmt1(d.ma)} ataque{d.bonus ? ` + ${fmt1(d.bonus)} bonus contra ${large ? 'grandes' : 'infantería'}` : ''} − {fmt1(d.md)} {def}
        {d.dir && d.dir !== 'front' ? ` (${d.mdBase} ${DIR_ES[d.dir]})` : ''} = {raw}%{raw !== hit ? ` → ${hit}% (límite 8–90%)` : ''}
      </li>
      {d.bonus > 0 && (
        <li>
          <b>Bonus al daño</b>: los {fmt1(d.bonus)} se reparten como el arma: +{d.bonusBase} base y +{d.bonusAp} perforante
        </li>
      )}
      <li>
        <b>Armadura</b> {d.armour}: quita en promedio el <b>{d.armourRed}%</b> del daño base{d.armour > 100 ? ' (pasa de 100: la tirada a veces lo bloquea todo)' : ''}
      </li>
      <li>
        <b>Daño por golpe</b>: {fmt1(base)} base × (1 − {d.armourRed}%) + {fmt1(ap)} perforante
        {res ? `, ${res > 0 ? '−' : '+'}${Math.abs(res)}% (${resParts.join(' + ')}${res >= 90 ? ', tope 90%' : ''})` : ''} = <b>{perHit}</b>
        {hpPerModel && uncapped > perHit + 0.05
          ? (d.splash && d.splash.n > 1 ? ` (tope: ${d.splash.n} modelos × ${hpPerModel} de vida)` : ` (tope: vida de un modelo, ${hpPerModel})`)
          : ''}
        {d.splash && d.splash.n > 1 ? ` · daño en área: cada golpe se reparte hasta entre ${d.splash.n} modelos` : ''}
        {d.splash && d.splash.n <= 1 && d.splash.max > 1 && d.splash.why ? ` · sin daño en área (${d.splash.why})` : ''}
        {d.res.magicalIgnoresPhysical ? ' · tus ataques mágicos ignoran su resistencia física' : ''}
      </li>
      <li>
        <b>DPS</b>: {d.models} modelos × {hit}% × {perHit} ÷ {d.interval} s = <b>{dps}</b>
      </li>
      <li>
        <b>{you ? 'Te matan en' : 'Tiempo para matar'}</b>: {d.hpTotal} vida ÷ {dps} = <b>{Number.isFinite(ttk) ? `${ttk} s` : '—'}</b>
      </li>
    </ul>
  );
}
