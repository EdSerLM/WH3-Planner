import { useMemo, useState } from 'react';
import type { ArmoryItem, BuildSelection, CharacterTree } from '../types';

/**
 * Dones del Príncipe Demonio (Daniel): una pieza por ranura. Datos del juego (armory_items):
 * - Su forma base (equipo inicial) ya le da stats y habilidades; cambiar una pieza las reemplaza.
 * - Las piezas de un dios no se mezclan con las de otro (las genéricas sí).
 * - Arma de dos manos ≠ escudo / arma de una mano; algunos brazos (guadañas) dejan libres las manos.
 * - Juntar todas las piezas de un conjunto da su bonificación.
 */

const GOD: Record<string, { es: string; icon: string }> = {
  generic: { es: 'Caos Absoluto', icon: '✴️' },
  khorne: { es: 'Khorne', icon: '🩸' },
  nurgle: { es: 'Nurgle', icon: '🪰' },
  slaanesh: { es: 'Slaanesh', icon: '💜' },
  tzeentch: { es: 'Tzeentch', icon: '🔷' },
};
const GODS = ['khorne', 'nurgle', 'slaanesh', 'tzeentch'];

interface Props {
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
}

/** Igual que el backend (engine.wornItems): lo elegido + la forma base donde no se eligió nada */
function wornOf(tree: CharacterTree, items: string[]): Set<string> {
  const ar = tree.armory!;
  const sel = new Set(items);
  const byKey = new Map(ar.items.map((i) => [i.key, i]));
  const chosen = [...sel].map((k) => byKey.get(k)).filter((i): i is ArmoryItem => !!i);
  const used = new Set(chosen.map((i) => i.slot));
  const blocked = new Set(chosen.flatMap((i) => i.blocksSlots));
  for (const d of ar.defaults) {
    const it = byKey.get(d);
    if (it && !used.has(it.slot) && !blocked.has(it.slot) && !sel.has(`empty:${it.slot}`)) sel.add(d);
  }
  for (const k of [...sel]) {
    const it = byKey.get(k);
    if (it && blocked.has(it.slot) && !chosen.includes(it)) sel.delete(k);
  }
  return sel;
}

export function ArmoryPanel({ tree, selection, onChange }: Props) {
  const ar = tree.armory!;
  const [godFilter, setGodFilter] = useState<string>('');
  const byKey = useMemo(() => new Map(ar.items.map((i) => [i.key, i])), [ar]);
  const slotName = useMemo(() => new Map(ar.slots.map((s) => [s.key, s.name])), [ar]);
  const raw = selection.items ?? [];
  const worn = wornOf(tree, raw);
  const wornItems = [...worn].map((k) => byKey.get(k)).filter((i): i is ArmoryItem => !!i);
  const inSlot = (slot: string) => wornItems.find((i) => i.slot === slot);
  const blockedBy = (slot: string) => wornItems.find((i) => i.blocksSlots.includes(slot));
  const godCount = GODS.map((g) => [g, wornItems.filter((i) => i.god === g).length] as const).filter(([, n]) => n > 0);
  const defaults = new Set(ar.defaults);

  /** Por qué no se puede poner esta pieza con lo que lleva en las otras ranuras */
  const conflict = (it: ArmoryItem): string | null => {
    for (const w of wornItems) {
      if (w.slot === it.slot) continue;
      if (it.blocksSlots.includes(w.slot) && w.slot) continue; // la pieza nueva vaciará esa ranura
      if (it.god !== 'generic' && w.god !== 'generic' && w.god !== it.god) return `choca con ${GOD[w.god]?.es ?? w.god} (${w.name})`;
      for (const c of w.cats) if ((ar.blacklist[c] ?? []).some((x) => it.cats.includes(x))) return `no se combina con ${w.name}`;
      for (const c of it.cats) if ((ar.blacklist[c] ?? []).some((x) => w.cats.includes(x))) return `no se combina con ${w.name}`;
    }
    return null;
  };

  const setSlot = (slot: string, key: string) => {
    const it = byKey.get(key);
    // Quita lo elegido en esa ranura (y en las que la pieza nueva deja vacías)
    const clear = new Set([slot, ...(it?.blocksSlots ?? [])]);
    let next = raw.filter((k) => {
      if (k.startsWith('empty:')) return !clear.has(k.slice(6));
      const x = byKey.get(k);
      return !x || !clear.has(x.slot);
    });
    // Si la pieza choca con otra (otro dios, arma de dos manos con escudo...), se quita la otra
    if (it) {
      next = next.filter((k) => {
        const w = byKey.get(k);
        if (!w) return true;
        const godClash = it.god !== 'generic' && w.god !== 'generic' && w.god !== it.god;
        const catClash = w.cats.some((c) => (ar.blacklist[c] ?? []).some((x) => it.cats.includes(x))) ||
          it.cats.some((c) => (ar.blacklist[c] ?? []).some((x) => w.cats.includes(x)));
        return !godClash && !catClash;
      });
    }
    next.push(key === '' ? `empty:${slot}` : key);
    onChange({ ...selection, items: next });
  };
  const resetBase = () => onChange({ ...selection, items: raw.filter((k) => !byKey.has(k) && !k.startsWith('empty:')) });
  const applySet = (items: string[]) => {
    const keep = raw.filter((k) => !byKey.has(k) && !k.startsWith('empty:'));
    const setSlots = new Set(items.map((k) => byKey.get(k)?.slot));
    const set = byKey.get(items[0]);
    // Del resto de lo que lleva, se queda lo que no choca con el conjunto
    const others = raw.filter((k) => {
      const w = byKey.get(k);
      if (!w || setSlots.has(w.slot)) return false;
      return set?.god === 'generic' || w.god === 'generic' || w.god === set?.god;
    });
    onChange({ ...selection, items: [...keep, ...others, ...items] });
  };

  const effText = (it: { effects: { text: string; kind: string }[] }) => it.effects.map((e) => e.text).filter(Boolean);

  return (
    <div className="armory">
      <div className="armory-head">
        <h3>Dones del Príncipe Demonio</h3>
        <span className="muted small">Una pieza por ranura; la forma base ya da stats y habilidades. Pasa el ratón por una pieza para ver su descripción.</span>
        <button className="ghost" onClick={resetBase}>Volver a la forma base</button>
      </div>
      <div className="armory-gods">
        <span className="muted small">Dedicación por piezas:</span>
        {godCount.length === 0 && <span className="god-chip generic">{GOD.generic.icon} Caos Absoluto</span>}
        {godCount.map(([g, n]) => (
          <span key={g} className={'god-chip ' + g}>{GOD[g].icon} {GOD[g].es}: {n} pieza{n === 1 ? '' : 's'}</span>
        ))}
        <label className="small">
          Ver piezas de:{' '}
          <select value={godFilter} onChange={(e) => setGodFilter(e.target.value)}>
            <option value="">todos</option>
            {['generic', ...GODS].map((g) => <option key={g} value={g}>{GOD[g].icon} {GOD[g].es}</option>)}
          </select>
        </label>
      </div>

      <div className="armory-slots">
        {ar.slots.map((s) => {
          const cur = inSlot(s.key);
          const blk = blockedBy(s.key);
          const opts = ar.items.filter((i) => i.slot === s.key && (!godFilter || i.god === godFilter || i.key === cur?.key));
          return (
            <div key={s.key} className={'aslot' + (cur ? ' ' + cur.god : '') + (blk ? ' blocked' : '')}>
              <div className="aslot-head">
                <b>{s.name}</b>
                {cur && defaults.has(cur.key) && <span className="tag">forma base</span>}
                {s.mandatory && <span className="muted small"> · obligatoria</span>}
              </div>
              {blk ? (
                <p className="muted small">Libre: la ocupa {blk.name} ({slotName.get(blk.slot)})</p>
              ) : (
                <>
                  <select value={cur?.key ?? ''} onChange={(e) => setSlot(s.key, e.target.value)}>
                    {!s.mandatory && <option value="">— vacío —</option>}
                    {['generic', ...GODS].map((g) => {
                      const list = opts.filter((i) => i.god === g);
                      if (!list.length) return null;
                      return (
                        <optgroup key={g} label={`${GOD[g].icon} ${GOD[g].es}`}>
                          {list.map((i) => {
                            const why = i.key === cur?.key ? null : conflict(i);
                            return (
                              <option key={i.key} value={i.key} title={why ?? effText(i).join(' · ')}>
                                {i.name}{defaults.has(i.key) ? ' (base)' : ''}{why ? ' ⚠' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </select>
                  {cur ? (
                    <ul className="aslot-eff" title={cur.description}>
                      {effText(cur).map((t, i) => <li key={i}>{t}</li>)}
                      {cur.blocksSlots.length > 0 && <li className="muted">Deja libres: {cur.blocksSlots.map((x) => slotName.get(x) ?? x).join(', ')}</li>}
                    </ul>
                  ) : (
                    <p className="muted small">Sin pieza</p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <h4>Conjuntos</h4>
      <p className="muted small">Con todas las piezas de un conjunto ganas su bonificación. "Poner conjunto" cambia esas ranuras (y quita lo que choque).</p>
      <div className="armory-sets">
        {ar.sets
          .map((st) => ({ st, have: st.items.filter((k) => worn.has(k)).length, god: byKey.get(st.items[0])?.god ?? 'generic' }))
          .filter(({ god }) => !godFilter || god === godFilter)
          .sort((a, b) => b.have / b.st.items.length - a.have / a.st.items.length)
          .map(({ st, have, god }) => {
            const done = have === st.items.length;
            return (
              <div key={st.key} className={'aset ' + god + (done ? ' done' : '')} title={st.description}>
                <div className="aset-head">
                  <b>{GOD[god]?.icon} {st.name}</b>
                  <span className={done ? 'up' : 'muted'}>{have}/{st.items.length}{done ? ' ✓' : ''}</span>
                  {!done && <button className="ghost small" onClick={() => applySet(st.items)}>Poner conjunto</button>}
                </div>
                <div className="small muted">
                  {st.items.map((k) => {
                    const it = byKey.get(k);
                    return <span key={k} className={worn.has(k) ? 'have' : ''}>{worn.has(k) ? '✓ ' : ''}{it?.name ?? k} ({slotName.get(it?.slot ?? '') ?? ''}) · </span>;
                  })}
                </div>
                <ul className="aslot-eff">
                  {effText(st).map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            );
          })}
      </div>
    </div>
  );
}
