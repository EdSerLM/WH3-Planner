import { useLayoutEffect, useRef, useState } from 'react';
import type { BuildSelection, CharacterTree, ItemInfo } from '../types';
import { rankOf, setRank } from '../treeLogic';

const CAT_ES: Record<string, string> = {
  weapon: 'Arma', armour: 'Armadura', talisman: 'Talismán', enchanted_item: 'Objeto hechizado', arcane_item: 'Objeto arcano',
  general: 'Seguidor', banner: 'Estandarte', follower: 'Seguidor',
};
const CAT_ICON: Record<string, string> = { weapon: '🗡', armour: '🛡', talisman: '✧', enchanted_item: '✦', arcane_item: '✺', general: '☺', banner: '⚑' };
const ONE_PER_SLOT = new Set(['weapon', 'armour', 'talisman', 'enchanted_item', 'arcane_item']);
const KIND: Record<string, string> = { battle: 'Batalla', attribute: 'Atributo', ability: 'Habilidad', magic: 'Magia', campaign: 'Campaña', mount: 'Montura', other: 'Otro' };
const TARGET: Record<string, string> = { self: 'propio', army: 'ejército', lord: 'al señor', chars: 'personajes', none: '' };

interface Props {
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
}

/** Objetos propios del legendario: se equipan con un clic y sus bufos entran en la tarjeta. */
export function ItemsPanel({ tree, selection, onChange }: Props) {
  const [hover, setHover] = useState<{ item: ItemInfo; rect: DOMRect } | null>(null);
  // Los dones de Daniel (armería) tienen su propio panel
  const items = (tree.items ?? []).filter((i) => i.category !== 'armory' && i.category !== 'spell_slot' && i.category !== 'char_initiative');
  if (!items.length) return null;
  const armoryKeys = new Set([...(tree.armory?.items ?? []).map((i) => i.key), ...(tree.spellSlots ?? []).flatMap((s) => s.options.map((o) => o.key)), ...(tree.initiativeSets ?? []).flatMap((s) => s.items.map((i) => i.key))]);
  const keepArmory = (selection.items ?? []).filter((k) => armoryKeys.has(k) || k.startsWith('empty:'));
  const worn = new Set(selection.items ?? []);
  const rank = rankOf(selection);

  const apply = (next: string[]) => {
    // La misión del objeto se desbloquea en un rango: el rango sube hasta ahí
    const need = Math.max(1, ...items.filter((i) => next.includes(i.key)).map((i) => i.rank ?? 1));
    const sel = { ...selection, items: [...keepArmory, ...next.filter((k) => !armoryKeys.has(k))] };
    onChange(need > rank ? setRank(sel, tree, need) : sel);
  };
  // Como en el juego, una sola arma, armadura, talismán, objeto hechizado y objeto arcano: equipar otro de la misma ranura
  // quita el anterior
  const catOf = (k: string) => items.find((i) => i.key === k)?.category ?? '';
  const toggle = (k: string) => {
    if (worn.has(k)) return apply([...worn].filter((x) => x !== k));
    const c = catOf(k);
    apply([...[...worn].filter((x) => !ONE_PER_SLOT.has(c) || catOf(x) !== c), k]);
  };
  const sets = (tree.itemSets ?? []).filter((s) => !s.items.some((k) => armoryKeys.has(k)) && s.items.every((k) => worn.has(k)));
  // Suyos: los de su misión y los que solo él puede llevar; el resto se consigue en campaña (forja, botín, crafteo...)
  const own = items.filter((i) => i.rank || i.questBattle || (i.owners ?? 1) <= 1);
  const others = items.filter((i) => !own.includes(i));
  // "Equipar los suyos": uno por ranura, primero el de misión
  const equipOwn = () => {
    const pick = new Map<string, string>();
    const extra: string[] = [];
    for (const i of [...own].sort((a, b) => Number(!(a.rank || a.questBattle)) - Number(!(b.rank || b.questBattle)))) {
      if (!ONE_PER_SLOT.has(i.category)) extra.push(i.key);
      else if (!pick.has(i.category)) pick.set(i.category, i.key);
    }
    apply([...pick.values(), ...extra]);
  };
  const chip = (it: ItemInfo) => (
    <button
      key={it.key}
      className={'item-chip' + (worn.has(it.key) ? ' on' : '')}
      onClick={() => toggle(it.key)}
      onMouseEnter={(e) => setHover({ item: it, rect: e.currentTarget.getBoundingClientRect() })}
      onMouseLeave={() => setHover(null)}
    >
      <span className="item-icon">{CAT_ICON[it.category] ?? '•'}</span>
      <span>
        {it.name}
        <span className="muted small"> · {CAT_ES[it.category] ?? it.category}{it.rank ? ` · rango ${it.rank}` : ''}{(it.owners ?? 1) > 1 ? ` · lo pueden llevar ${it.owners}` : ''}</span>
      </span>
    </button>
  );

  return (
    <div className="items">
      <div className="items-head">
        <b>Objetos del legendario</b>
        <button className="ghost" onClick={equipOwn} title="Los de su misión y los que solo él puede llevar, uno por ranura">Equipar los suyos</button>
        <button className="ghost" onClick={() => apply([])} disabled={!worn.size}>Quitar</button>
        {sets.map((s) => <span key={s.key} className="set-ok">✓ Conjunto: {s.name}</span>)}
      </div>
      <div className="small muted">Uno por ranura (arma, armadura, talismán, hechizado, arcano): elegir otro cambia el anterior.</div>
      <div className="item-chips">{own.map(chip)}</div>
      {others.length > 0 && (
        <>
          <div className="small muted items-sub">Otros que puede llevar (se consiguen en campaña y los comparten varios personajes):</div>
          <div className="item-chips">{others.map(chip)}</div>
        </>
      )}
      {hover && <ItemTip item={hover.item} rect={hover.rect} tree={tree} />}
    </div>
  );
}

function ItemTip({ item, rect, tree }: { item: ItemInfo; rect: DOMRect; tree: CharacterTree }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = rect.left;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    let top = rect.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 8);
    setPos({ left, top });
  }, [rect, item]);
  const sets = (tree.itemSets ?? []).filter((s) => s.items.includes(item.key));
  return (
    <div className="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <h4>{item.name} <span className="muted small">({CAT_ES[item.category] ?? item.category})</span></h4>
      {item.description && <div className="tt-desc">{item.description}</div>}
      {item.rank ? <div className="small">{item.questBattle ? 'Batalla de misión' : 'Misión'} al llegar a rango {item.rank}</div> : null}
      <ul>
        {item.effects.filter((e) => e.text).map((e, i) => {
          const ab = e.ability ? tree.abilityInfo[e.ability] : undefined;
          return (
            <li key={i}>
              <span className={'tag ' + e.kind}>{KIND[e.kind]}{e.kind === 'battle' && e.target !== 'none' ? ` · ${TARGET[e.target]}` : ''}</span> {e.text}
              {ab?.stats.length ? <div className="muted small">{ab.stats.map((s) => s.d).join(', ')}</div> : null}
            </li>
          );
        })}
      </ul>
      {sets.map((s) => (
        <div key={s.key} className="small">
          <b>Conjunto {s.name}</b> (con {s.items.length} piezas): {s.effects.filter((e) => e.text).map((e) => e.text).join(' · ') || 'sin efectos de batalla'}
        </div>
      ))}
    </div>
  );
}
