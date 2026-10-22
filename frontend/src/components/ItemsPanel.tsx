import { useLayoutEffect, useRef, useState } from 'react';
import type { BuildSelection, CharacterTree, ItemInfo } from '../types';
import { rankOf, setRank } from '../treeLogic';

const CAT_ES: Record<string, string> = {
  weapon: 'Arma', armour: 'Armadura', talisman: 'Talismán', enchanted_item: 'Objeto hechizado', arcane_item: 'Objeto arcano',
  general: 'Seguidor', banner: 'Estandarte', follower: 'Seguidor',
};
const CAT_ICON: Record<string, string> = { weapon: '🗡', armour: '🛡', talisman: '✧', enchanted_item: '✦', arcane_item: '✺', general: '☺', banner: '⚑' };
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
  const items = tree.items ?? [];
  if (!items.length) return null;
  const worn = new Set(selection.items ?? []);
  const rank = rankOf(selection);

  const apply = (next: string[]) => {
    // La misión del objeto se desbloquea en un rango: el rango sube hasta ahí
    const need = Math.max(1, ...items.filter((i) => next.includes(i.key)).map((i) => i.rank ?? 1));
    const sel = { ...selection, items: next };
    onChange(need > rank ? setRank(sel, tree, need) : sel);
  };
  const toggle = (k: string) => apply(worn.has(k) ? [...worn].filter((x) => x !== k) : [...worn, k]);
  const sets = (tree.itemSets ?? []).filter((s) => s.items.every((k) => worn.has(k)));

  return (
    <div className="items">
      <div className="items-head">
        <b>Objetos del legendario</b>
        <button className="ghost" onClick={() => apply(items.map((i) => i.key))}>Equipar todos</button>
        <button className="ghost" onClick={() => apply([])} disabled={!worn.size}>Quitar</button>
        {sets.map((s) => <span key={s.key} className="set-ok">✓ Conjunto: {s.name}</span>)}
      </div>
      <div className="item-chips">
        {items.map((it) => (
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
              <span className="muted small"> · {CAT_ES[it.category] ?? it.category}{it.rank ? ` · rango ${it.rank}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
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
