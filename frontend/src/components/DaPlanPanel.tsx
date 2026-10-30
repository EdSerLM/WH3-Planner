import { useMemo, useState } from 'react';
import type { ArmyUnitSelection, BuildSelection, CharacterTree, InitiativeSet, UnitData } from '../types';

/**
 * Da Plan (Gorbad Garra'ierro): tácticas del ejército en piezas por nivel, como en el juego.
 * Cada táctica pide unidades de ciertos conjuntos. Al elegirla se agregan al ejército las que falten;
 * si no caben (20 espacios) o falta un personaje, no se puede elegir.
 */

export interface DaPlanArmy {
  units: ArmyUnitSelection[];
  /** Unidades del roster que puede reclutar la facción de campaña */
  roster: UnitData[];
  /** Espacios ocupados (señor + héroes + unidades) */
  used: number;
  /** Unidades de los personajes del ejército (señor y héroes): cuentan para los conjuntos de personajes */
  charUnits: string[];
  onUnits: (u: ArmyUnitSelection[]) => void;
}

interface Props {
  tree: CharacterTree;
  set: InitiativeSet;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
  army?: DaPlanArmy;
}

type Item = InitiativeSet['items'][number];
const TIER = ['', 'Nivel I', 'Nivel II', 'Nivel III'];
const MAX = 20;
const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };
// Regimientos de renombre (una sola unidad por ejército): se evitan al agregar unidades
const isRor = (u: UnitData) => u.cap === 1 || /_ror/.test(u.key);

export function DaPlanPanel({ set, selection, onChange, army }: Props) {
  const items = selection.items ?? [];
  const usets = set.unitSets ?? {};
  const roster = new Map((army?.roster ?? []).map((u) => [u.key, u]));
  const byCard = new Map((army?.roster ?? []).map((u) => [u.card, u.key]));
  const keyOf = (card: string) => byCard.get(card) ?? card;

  const haveIn = (units: ArmyUnitSelection[], s: string) => {
    const keys = new Set(usets[s]?.units ?? []);
    return units.reduce((n, u) => n + (keys.has(keyOf(u.card)) ? u.count : 0), 0) + (army?.charUnits ?? []).filter((k) => keys.has(k)).length;
  };

  /** Qué hay que agregar para cumplir la táctica: nuevas unidades del ejército o el motivo por el que no se puede */
  const plan = (it: Item): { units: ArmyUnitSelection[]; added: string[]; error?: string } => {
    if (!army) return { units: [], added: [] };
    let units = army.units.map((u) => ({ ...u }));
    const added: string[] = [];
    for (const r of it.need ?? []) {
      const us = usets[r.s];
      while (haveIn(units, r.s) < r.n) {
        // Primero lo que ya está en el ejército; si no, la unidad más barata del roster (sin regimientos de renombre)
        const inArmy = units.find((u) => us?.units.includes(keyOf(u.card)) && !isRor(roster.get(keyOf(u.card)) ?? ({} as UnitData)));
        const pick = inArmy?.card ?? (us?.units ?? [])
          .map((k) => roster.get(k)).filter((u): u is UnitData => !!u && !isRor(u))
          .sort((a, b) => a.cost - b.cost)[0]?.card;
        if (!pick) return { units, added, error: `Necesita ${r.n} × ${us?.n ?? r.s}: no se pueden reclutar como unidad (agrégalos como señor o héroe)` };
        if (army.used + added.length >= MAX) return { units, added, error: `El ejército está lleno: faltan ${r.n - haveIn(units, r.s)} × ${us?.n ?? r.s} y no hay espacio` };
        const ex = units.find((u) => u.card === pick);
        units = ex ? units.map((u) => (u.card === pick ? { ...u, count: u.count + 1 } : u)) : [...units, { card: pick, count: 1 }];
        added.push(pick);
      }
    }
    return { units, added };
  };

  const toggle = (it: Item) => {
    if (items.includes(it.key)) { onChange({ ...selection, items: items.filter((k) => k !== it.key) }); return; }
    const p = plan(it);
    if (p.error) return;
    if (army && p.added.length) army.onUnits(p.units);
    onChange({ ...selection, items: [...items, it.key] });
  };

  // Filtro: tácticas que benefician a una unidad (sus efectos la nombran) o que la piden; y búsqueda por texto
  const [unitF, setUnitF] = useState('');
  const [q, setQ] = useState('');
  const benefits = useMemo(() => new Map(set.items.map((it) => [it.key, new Set(it.benefits ?? [])])), [set.items]);
  const nameOf = (k: string) => roster.get(keyOf(k))?.name ?? roster.get(k)?.name;
  const unitOptions = useMemo(() => {
    const all = new Set<string>();
    for (const s of benefits.values()) for (const k of s) if (roster.has(k)) all.add(k);
    const mine = [...new Set((army?.units ?? []).map((u) => keyOf(u.card)))].filter((k) => roster.has(k));
    const byName = (a: string, b: string) => (roster.get(a)?.name ?? a).localeCompare(roster.get(b)?.name ?? b);
    return { mine: mine.sort(byName), rest: [...all].filter((k) => !mine.includes(k)).sort(byName) };
  }, [benefits, army?.units, army?.roster]);
  const helps = (it: Item, k: string) => benefits.get(it.key)?.has(k) ?? false;
  const asks = (it: Item, k: string) => (it.need ?? []).some((r) => usets[r.s]?.units.includes(k));
  const matches = (it: Item) =>
    (!unitF || helps(it, unitF) || asks(it, unitF)) &&
    (!q || [it.name, it.requirement ?? '', ...it.effects.map((e) => e.text)].join(' ').toLowerCase().includes(q.toLowerCase()));

  const tiers = [...new Set(set.items.map((i) => i.tier ?? 0))].sort();
  const active = set.items.filter((i) => items.includes(i.key));

  return (
    <div className="daplan">
      <div className="glory-title">Da Plan</div>
      <p className="muted small">
        Elige las tácticas de este ejército. Cada una pide unidades: si faltan, se agregan solas al ejército; si no caben en los {MAX} espacios
        (o pide un personaje que no está), no se puede elegir. Las ranuras de táctica dependen de las habilidades de Gorbad.
        {!army && ' Abre el señor del ejército para revisar las unidades.'}
      </p>
      <div className="daplan-filter">
        <label className="small">Unidad:{' '}
          <select value={unitF} onChange={(e) => setUnitF(e.target.value)}>
            <option value="">— todas —</option>
            {unitOptions.mine.length > 0 && (
              <optgroup label="En tu ejército">{unitOptions.mine.map((k) => <option key={k} value={k}>{roster.get(k)?.name ?? k}</option>)}</optgroup>
            )}
            <optgroup label="Otras unidades con bonos">{unitOptions.rest.map((k) => <option key={k} value={k}>{roster.get(k)?.name ?? k}</option>)}</optgroup>
          </select>
        </label>
        <input className="small" placeholder="Buscar (carga, veneno, liderazgo…)" value={q} onChange={(e) => setQ(e.target.value)} />
        {(unitF || q) && <button className="ghost small" onClick={() => { setUnitF(''); setQ(''); }}>Quitar filtro</button>}
        {active.length > 0 && <span className="small up">Activas: {active.map((a) => a.name).join(', ')}</span>}
      </div>
      {tiers.map((t) => {
        const list = set.items.filter((i) => (i.tier ?? 0) === t && (matches(i) || items.includes(i.key)));
        return list.length === 0 ? null : (
        <section key={t} className="daplan-tier">
          <h4>{TIER[t] ?? `Nivel ${t}`}</h4>
          <div className="daplan-grid">
            {list.map((it) => {
              const on = items.includes(it.key);
              const p = on ? undefined : plan(it);
              const ok = (it.need ?? []).every((r) => haveIn(army?.units ?? [], r.s) >= r.n);
              const cls = 'daplan-card' + (on ? ' on' : '') + (p?.error ? ' blocked' : '') + (on && !ok ? ' warn' : '');
              const flavor = it.requirement?.split(' · ').slice(1).join(' · ');
              return (
                <button
                  key={it.key} className={cls} onClick={() => toggle(it)} disabled={!!p?.error}
                  title={[it.name, flavor, ...it.effects.map((e) => e.text).filter(Boolean), p?.error ? `⛔ ${p.error}` : '',
                    p && p.added.length ? `Agrega al ejército: ${p.added.map((k) => roster.get(keyOf(k))?.name ?? k).join(', ')}` : ''].filter(Boolean).join('\n')}
                >
                  <div className="daplan-img">
                    {it.img && <img src={`/daplan/${it.img}.png`} alt="" onError={(e) => { hide(e); (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'block'); }} />}
                    <span className="daplan-emoji" style={it.img ? { display: 'none' } : undefined}>📜</span>
                  </div>
                  <b className="daplan-name">{it.name}</b>
                  <div className="daplan-req">
                    {(it.need ?? []).map((r) => {
                      const us = usets[r.s];
                      const have = haveIn(army?.units ?? [], r.s);
                      return (
                        <span key={r.s} className={'daplan-chip' + (have >= r.n ? ' ok' : '')}
                          title={`${us?.n ?? r.s}: ${(us?.units ?? []).map((k) => roster.get(k)?.name).filter(Boolean).join(', ') || 'personajes'}`}>
                          {us?.icon && <img src={`/daplan/${us.icon}.png`} alt="" onError={hide} />}
                          {Math.min(have, r.n)}/{r.n} {us?.n ?? r.s}
                        </span>
                      );
                    })}
                  </div>
                  <ul className="daplan-eff">
                    {it.effects.map((e) => e.text).filter(Boolean).slice(0, 4).map((t, j) => <li key={j}>{t}</li>)}
                  </ul>
                  {unitF && (helps(it, unitF) || asks(it, unitF)) && (
                    <span className="daplan-for">{helps(it, unitF) ? `★ Bonifica a ${nameOf(unitF)}` : `Cuenta para el requisito`}</span>
                  )}
                  {p?.error ? <span className="daplan-why">⛔ {p.error.split(':')[0]}</span>
                    : p && p.added.length ? <span className="daplan-add">+{p.added.length} unidad{p.added.length === 1 ? '' : 'es'}</span>
                    : on && !ok ? <span className="daplan-why">⚠ Faltan unidades</span> : null}
                </button>
              );
            })}
          </div>
        </section>
        );
      })}
      {active.length > 0 && (
        <div className="glory-effects">
          {active.map((it) => (
            <div key={it.key}>
              <b>📜 {it.name}</b>{it.duration ? <span className="muted small"> · dura {it.duration} turnos{it.cooldown ? `, recarga ${it.cooldown}` : ''}</span> : null}
              <ul className="aslot-eff">{it.effects.map((e) => e.text).filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
