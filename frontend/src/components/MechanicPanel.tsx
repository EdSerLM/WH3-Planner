import { useMemo, useState } from 'react';
import type { ArmyUnitSelection, BuildSelection, CharacterTree, InitiativeSet, UnitData } from '../types';

/**
 * Panel común de las mecánicas de campaña (Da Plan, Forja de Daith, Consejo, Corte del Rey Fénix, Danza Eterna,
 * Senda a la Gloria, Capa de Cráneos, Escuela de Artillería, Kislev, Forja Infernal, Glottkin, Caldero de Grom, plagas...).
 * - Piezas con sus efectos a la vista (sin pasar el ratón).
 * - Filtro por unidad (qué piezas la bonifican o la piden) y búsqueda por texto.
 * - En filas por objeto cuando hay niveles (I, II, III...): una pieza por fila.
 * - Requisitos de unidades (Da Plan): al elegir se agregan al ejército las que falten; si no caben, no se puede elegir.
 */

export interface MechanicArmy {
  units: ArmyUnitSelection[];
  /** Unidades que puede reclutar la facción de campaña */
  roster: UnitData[];
  /** Espacios ocupados (señor + héroes + unidades) */
  used: number;
  /** Unidades de los personajes del ejército (cuentan para requisitos de personajes) */
  charUnits: string[];
  onUnits: (u: ArmyUnitSelection[]) => void;
}

interface Props {
  tree: CharacterTree;
  sets: InitiativeSet[];
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
  army?: MechanicArmy;
}

type Item = InitiativeSet['items'][number];
const MAX_SLOTS = 20;
const ROMAN = /^(.+) (I|II|III|IV|V)$/;
const LEVELED = /^(.+?) · nivel (\d+)(?::\s*(.+))?$/;
// Condiciones que pueden volverse imposibles a mitad de campaña (si ya no quedan esos enemigos)
const HARD = /Demonio|raza de|contra (los|las|un|una) [A-ZÁÉÍÓÚ]/;
const isRor = (u: UnitData) => u.cap === 1 || /_ror/.test(u.key);

const HELP: Record<string, string> = {
  DA_PLAN: 'Cada táctica pide unidades: si faltan se agregan solas al ejército; si no caben en los 20 espacios (o pide un personaje que no está), no se puede elegir. Las ranuras dependen de las habilidades de Gorbad.',
  DANCE: 'Elige una variación por tempo de la danza que sigue este ejército (los tempos se suman al avanzar). En el juego un ejército sigue una sola danza.',
  PATRONAGE: 'Elige la provincia de Ulthuan de la que este señor es patrón y su nivel (1-3). Un patronazgo por señor.',
  COURT: 'Elige el cargo que ocupa este personaje (uno por personaje; en el juego cada cargo lo tiene un solo personaje).',
  FORGE: 'Elige el objeto forjado de cada ranura y su nivel (I-III forjado, IV reforjado). Un objeto por ranura.',
  CLOAK: 'Marca los cráneos de la capa que tienes y su nivel, y los rituales del Trono de Cráneos activos.',
  GUNNERY: 'Mejoras de la Escuela de Artillería de Nuln: elige el nivel que compraste para cada unidad. La armería de Amatista desbloquea unidades y artillería.',
  KISLEV: 'Favores de la Corte de Hielo o de la Gran Ortodoxia (según tu facción) y rituales de invierno de la Madre Patria.',
  HELLFORGE: 'Rituales de la Forja Infernal que suben el máximo de cada unidad.',
  GLOTTKIN: 'Rituales Podridos de los Glottkin: elige el nivel de mejora de cada ritual que tengas activo.',
  COOKING: 'Platos que cocina Grom (uno a la vez) e ingredientes usados; los efectos de los ingredientes son de facción.',
  PLAGUE: 'Síntomas de la plaga que infecta a tu ejército (hasta 3). La versión bendita es más fuerte.',
  PATH_TO_GLORY_BOON: 'Marca los regalos que tienes en tu campaña; cada uno muestra la condición para conseguirlo.',
};
const EMOJI: Record<string, string> = {
  DA_PLAN: '📜', FORGE: '⚒️', CLOAK: '💀', GUNNERY: '🔫', KISLEV: '❄️', HELLFORGE: '🔥', GLOTTKIN: '🌿', COOKING: '🍲', PLAGUE: '🧪',
  DANCE: '💃', PATRONAGE: '🦅', COURT: '🌳',
};

/** Fila y nivel de una pieza: del dato (group/level) o del nombre ("X · nivel 2: Y", "Coraza del Dragón III") */
function rowOf(it: Item): { group: string; level: string } | null {
  if (it.group) return { group: it.group, level: it.level ?? '' };
  const a = LEVELED.exec(it.name);
  if (a) return { group: a[1], level: a[2] };
  const b = ROMAN.exec(it.name);
  return b ? { group: b[1], level: b[2] } : null;
}
function isRows(s: InitiativeSet) {
  if (s.rows) return true;
  if (s.category === 'DA_PLAN') return false;
  const rs = s.items.map(rowOf);
  if (rs.some((r) => !r)) return false;
  const groups = new Set(rs.map((r) => r!.group));
  return groups.size >= 2 && groups.size < s.items.length;
}
function imgSources(s: InitiativeSet, it: Item): string[] {
  if (s.category === 'FORGE') return [`/armory/${it.key}.png`, `/armory/${it.key.replace(/_\d$/, '')}.png`];
  if (s.category === 'DA_PLAN') return it.img ? [`/daplan/${it.img}.png`] : [];
  return it.img ? [`/mech/${it.img}.png`] : [];
}

function PieceImg({ srcs, emoji }: { srcs: string[]; emoji: string }) {
  return (
    <span className="mech-img">
      {srcs.length > 0 && (
        <img
          src={srcs[0]} alt="" data-i={0}
          onError={(e) => {
            const img = e.currentTarget, i = Number(img.dataset.i) + 1;
            if (i < srcs.length) { img.dataset.i = String(i); img.src = srcs[i]; return; }
            img.style.display = 'none';
            (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
          }}
        />
      )}
      <span className="mech-emoji" style={srcs.length ? { display: 'none' } : undefined}>{emoji}</span>
    </span>
  );
}

export function MechanicPanel({ sets, selection, onChange, army }: Props) {
  const items = selection.items ?? [];
  const roster = useMemo(() => new Map((army?.roster ?? []).map((u) => [u.key, u])), [army?.roster]);
  const byCard = useMemo(() => new Map((army?.roster ?? []).map((u) => [u.card, u.key])), [army?.roster]);
  const keyOf = (card: string) => byCard.get(card) ?? card;
  const [unitF, setUnitF] = useState('');
  const [q, setQ] = useState('');

  // ---- requisitos de unidades (Da Plan) ----
  const usetsOf = (s: InitiativeSet) => s.unitSets ?? {};
  const haveIn = (s: InitiativeSet, units: ArmyUnitSelection[], us: string) => {
    const keys = new Set(usetsOf(s)[us]?.units ?? []);
    return units.reduce((n, u) => n + (keys.has(keyOf(u.card)) ? u.count : 0), 0) + (army?.charUnits ?? []).filter((k) => keys.has(k)).length;
  };
  const plan = (s: InitiativeSet, it: Item): { units: ArmyUnitSelection[]; added: string[]; error?: string } => {
    if (!army || !it.need?.length) return { units: army?.units ?? [], added: [] };
    let units = army.units.map((u) => ({ ...u }));
    const added: string[] = [];
    for (const r of it.need) {
      const us = usetsOf(s)[r.s];
      while (haveIn(s, units, r.s) < r.n) {
        const inArmy = units.find((u) => us?.units.includes(keyOf(u.card)) && !isRor(roster.get(keyOf(u.card)) ?? ({} as UnitData)));
        const pick = inArmy?.card ?? (us?.units ?? []).map((k) => roster.get(k)).filter((u): u is UnitData => !!u && !isRor(u)).sort((a, b) => a.cost - b.cost)[0]?.card;
        if (!pick) return { units, added, error: `Necesita ${r.n} × ${us?.n ?? r.s}: agrégalos como señor o héroe` };
        if (army.used + added.length >= MAX_SLOTS) return { units, added, error: `El ejército está lleno: faltan ${r.n - haveIn(s, units, r.s)} × ${us?.n ?? r.s}` };
        const ex = units.find((u) => u.card === pick);
        units = ex ? units.map((u) => (u.card === pick ? { ...u, count: u.count + 1 } : u)) : [...units, { card: pick, count: 1 }];
        added.push(pick);
      }
    }
    return { units, added };
  };

  const toggle = (s: InitiativeSet, it: Item) => {
    if (!s.selectable) return;
    if (items.includes(it.key)) { onChange({ ...selection, items: items.filter((k) => k !== it.key) }); return; }
    const p = plan(s, it);
    if (p.error) return;
    let next = [...items];
    // En filas: una pieza por fila
    if (isRows(s)) {
      const g = rowOf(it)?.group;
      const same = new Set(s.items.filter((x) => rowOf(x)?.group === g).map((x) => x.key));
      next = next.filter((k) => !same.has(k));
    }
    next.push(it.key);
    if (s.max > 0) {
      const mine = new Set(s.items.map((x) => x.key));
      while (next.filter((k) => mine.has(k)).length > s.max) next.splice(next.findIndex((k) => mine.has(k)), 1);
    }
    if (army && p.added.length) army.onUnits(p.units);
    onChange({ ...selection, items: next });
  };
  const clear = (s: InitiativeSet) => {
    const mine = new Set(s.items.map((x) => x.key));
    onChange({ ...selection, items: items.filter((k) => !mine.has(k)) });
  };

  // ---- filtro ----
  const nameOf = (k: string) => roster.get(k)?.name;
  const unitOptions = useMemo(() => {
    const all = new Set<string>();
    for (const s of sets) for (const it of s.items) for (const k of it.benefits ?? []) if (roster.has(k)) all.add(k);
    const mine = [...new Set((army?.units ?? []).map((u) => keyOf(u.card)))].filter((k) => all.has(k) || roster.has(k));
    const byName = (a: string, b: string) => (roster.get(a)?.name ?? a).localeCompare(roster.get(b)?.name ?? b);
    return { mine: mine.sort(byName), rest: [...all].filter((k) => !mine.includes(k)).sort(byName) };
  }, [sets, army?.units, roster]);
  const helps = (it: Item, k: string) => it.benefits?.includes(k) ?? false;
  const asks = (s: InitiativeSet, it: Item, k: string) => (it.need ?? []).some((r) => usetsOf(s)[r.s]?.units.includes(k));
  const matches = (s: InitiativeSet, it: Item) =>
    (!unitF || helps(it, unitF) || asks(s, it, unitF)) &&
    (!q || [it.name, it.requirement ?? '', ...it.effects.map((e) => e.text)].join(' ').toLowerCase().includes(q.toLowerCase()));
  const showFilter = sets.some((s) => s.items.length > 6) || unitOptions.rest.length > 0;
  const active = sets.flatMap((s) => s.items.filter((i) => items.includes(i.key)));

  const effList = (it: Item, n = 4) => it.effects.map((e) => e.text).filter(Boolean).slice(0, n);
  const tip = (s: InitiativeSet, it: Item, extra = '') =>
    [it.name, it.requirement, ...it.effects.map((e) => e.text).filter(Boolean), extra].filter(Boolean).join('\n');

  const forBadge = (s: InitiativeSet, it: Item) =>
    unitF && (helps(it, unitF) || asks(s, it, unitF)) ? (
      <span className="mech-for">{helps(it, unitF) ? `★ Bonifica a ${nameOf(unitF) ?? 'la unidad'}` : 'Cuenta para el requisito'}</span>
    ) : null;

  const card = (s: InitiativeSet, it: Item) => {
    const on = items.includes(it.key);
    const p = on ? undefined : plan(s, it);
    const usets = usetsOf(s);
    const ok = (it.need ?? []).every((r) => haveIn(s, army?.units ?? [], r.s) >= r.n);
    const hard = s.category.startsWith('PATH_TO_GLORY') && !!it.requirement && HARD.test(it.requirement);
    const reqShort = it.need?.length ? it.requirement?.split(' · ').slice(1).join(' · ') : it.requirement;
    const cls = 'mech-card' + (on ? ' on' : '') + (p?.error ? ' blocked' : '') + (on && !ok ? ' warn' : '') + (s.selectable ? '' : ' info');
    return (
      <button key={it.key} className={cls} onClick={() => toggle(s, it)} disabled={!!p?.error || !s.selectable}
        title={tip(s, it, [p?.error ? `⛔ ${p.error}` : '', p?.added.length ? `Agrega al ejército: ${p.added.map((k) => nameOf(keyOf(k)) ?? k).join(', ')}` : ''].filter(Boolean).join('\n'))}>
        {(it.img || s.category === 'FORGE' || s.category === 'DA_PLAN') && <PieceImg srcs={imgSources(s, it)} emoji={EMOJI[s.category] ?? '✦'} />}
        <b className="mech-name">{it.name}</b>
        {it.duration ? <span className="muted small">dura {it.duration} turno{it.duration === 1 ? '' : 's'}{it.cooldown ? ` · recarga ${it.cooldown}` : ''}</span> : null}
        {it.need?.length ? (
          <span className="mech-req">
            {it.need.map((r) => {
              const us = usets[r.s], have = haveIn(s, army?.units ?? [], r.s);
              return (
                <span key={r.s} className={'mech-chip' + (have >= r.n ? ' ok' : '')} title={`${us?.n ?? r.s}: ${(us?.units ?? []).map((k) => nameOf(k)).filter(Boolean).join(', ') || 'personajes'}`}>
                  {us?.icon && <img src={`/daplan/${us.icon}.png`} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                  {Math.min(have, r.n)}/{r.n} {us?.n ?? r.s}
                </span>
              );
            })}
          </span>
        ) : reqShort ? <span className={'mech-cond' + (hard ? ' warn' : '')}>{hard ? '⚠ ' : ''}{reqShort.length > 140 ? reqShort.slice(0, 140) + '…' : reqShort}</span> : null}
        <ul className="mech-eff">{effList(it).map((t, j) => <li key={j}>{t}</li>)}</ul>
        {forBadge(s, it)}
        {p?.error ? <span className="mech-why">⛔ {p.error.split(':')[0]}</span>
          : p?.added.length ? <span className="mech-add">+{p.added.length} unidad{p.added.length === 1 ? '' : 'es'}</span>
          : on && !ok ? <span className="mech-why">⚠ Faltan unidades</span> : null}
      </button>
    );
  };

  const rowsView = (s: InitiativeSet) => {
    const groups = new Map<string, Item[]>();
    for (const it of s.items) if (matches(s, it) || items.includes(it.key)) {
      const g = rowOf(it)?.group ?? it.name;
      groups.set(g, [...(groups.get(g) ?? []), it]);
    }
    return (
      <div className="mech-rows">
        {[...groups].map(([g, list]) => {
          const cur = list.find((i) => items.includes(i.key));
          return (
            <div key={g} className={'mech-row' + (cur ? ' on' : '')}>
              <div className="mech-row-head">
                <b>{g}</b>
                {unitF && list.some((i) => helps(i, unitF)) && <span className="mech-for">★</span>}
              </div>
              <div className="mech-pieces">
                {list.map((it) => {
                  const on = items.includes(it.key);
                  const lv = rowOf(it)?.level ?? '';
                  const sub = LEVELED.exec(it.name)?.[3];
                  return (
                    <button key={it.key} className={'mech-piece' + (on ? ' on' : '')} disabled={!s.selectable} onClick={() => toggle(s, it)} title={tip(s, it)}>
                      {imgSources(s, it).length > 0 && <PieceImg srcs={imgSources(s, it)} emoji={EMOJI[s.category] ?? '✦'} />}
                      <span className="mech-lvl">{lv || '✦'}</span>
                      {sub && <span className="mech-sub">{sub}</span>}
                    </button>
                  );
                })}
              </div>
              {cur && <ul className="mech-eff">{effList(cur, 6).map((t, j) => <li key={j}>{t}</li>)}</ul>}
            </div>
          );
        })}
      </div>
    );
  };

  const cardsView = (s: InitiativeSet) => {
    const list = s.items.filter((i) => matches(s, i) || items.includes(i.key));
    const tiers = [...new Set(list.map((i) => i.tier ?? 0))].sort((a, b) => a - b);
    return tiers.map((t) => (
      <section key={t} className="mech-tier">
        {t > 0 && <h4>{s.sections?.[t - 1] ?? `Nivel ${['', 'I', 'II', 'III', 'IV', 'V'][t] ?? t}`}</h4>}
        <div className="mech-grid">{list.filter((i) => (i.tier ?? 0) === t).map((it) => card(s, it))}</div>
      </section>
    ));
  };

  return (
    <div className="mech">
      {showFilter && (
        <div className="mech-filter">
          {(unitOptions.mine.length > 0 || unitOptions.rest.length > 0) && (
            <label className="small">Unidad:{' '}
              <select value={unitF} onChange={(e) => setUnitF(e.target.value)}>
                <option value="">— todas —</option>
                {unitOptions.mine.length > 0 && <optgroup label="En tu ejército">{unitOptions.mine.map((k) => <option key={k} value={k}>{nameOf(k) ?? k}</option>)}</optgroup>}
                {unitOptions.rest.length > 0 && <optgroup label="Otras unidades con bonos">{unitOptions.rest.map((k) => <option key={k} value={k}>{nameOf(k) ?? k}</option>)}</optgroup>}
              </select>
            </label>
          )}
          <input className="small" placeholder="Buscar (carga, veneno, liderazgo…)" value={q} onChange={(e) => setQ(e.target.value)} />
          {(unitF || q) && <button className="ghost small" onClick={() => { setUnitF(''); setQ(''); }}>Quitar filtro</button>}
          {active.length > 0 && <span className="small up">Activas: {active.map((a) => a.name).join(', ')}</span>}
        </div>
      )}
      {sets.map((s) => {
        const n = s.items.filter((i) => items.includes(i.key)).length;
        const visible = s.items.some((i) => matches(s, i) || items.includes(i.key));
        if (!visible) return null;
        return (
          <div key={s.key} className="mech-set">
            <div className="mech-head">
              <h3>{EMOJI[s.category] ? `${EMOJI[s.category]} ` : ''}{s.name}</h3>
              {s.selectable ? <span className="muted small">{s.max > 0 ? `Activos: ${n}/${s.max}` : n ? `Activos: ${n}` : ''}</span>
                : <span className="muted small">Informativo: cambian al personaje por otra versión (elige esa versión como señor o héroe).</span>}
              {s.selectable && n > 0 && <button className="ghost small" onClick={() => clear(s)}>Quitar</button>}
            </div>
            {HELP[s.category] && <p className="muted small mech-help">{HELP[s.category]}</p>}
            {isRows(s) ? rowsView(s) : cardsView(s)}
          </div>
        );
      })}
    </div>
  );
}
