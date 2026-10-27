import type { BuildSelection, CharacterTree, SpellSlot } from '../types';
import { AbilityImg } from '../gameIcons';

/**
 * Fragmentos de hechicería (Kairos): espacios de hechizo común, poco común y raro. Cada espacio se abre con una
 * habilidad del árbol ("El...", "Destino..", "Cumple...", "Mi...", "Voluntad...") y en cada uno eliges el saber
 * del que sale el hechizo. Datos del juego: iniciativas de personaje (initiatives / initiative_sets).
 */

const LORE_ICON: Record<string, string> = {
  tzeentch: '🔷', beast: '🐗', death: '💀', fire: '🔥', heavens: '⚡', life: '🌿', light: '☀️', metal: '⚙️', shadows: '🌑',
};
const RARITY_CLS: Record<string, string> = { common: 'r-common', uncommon: 'r-uncommon', rare: 'r-rare' };

interface Props {
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
}

export function SpellSlotsPanel({ tree, selection, onChange }: Props) {
  const slots = tree.spellSlots ?? [];
  const items = selection.items ?? [];
  const nodes = [...tree.rows.flat(), ...tree.background];
  const nodeOf = (s: SpellSlot) => nodes.find((n) => n.skillKey === s.unlockSkill);
  const isOpen = (s: SpellSlot) => {
    const n = nodeOf(s);
    return !!n && (selection.levels[n.key] ?? 0) > 0;
  };
  const pickOf = (s: SpellSlot) => s.options.find((o) => items.includes(o.key));

  const setSlot = (s: SpellSlot, key: string) => {
    const mine = new Set(s.options.map((o) => o.key));
    const next = items.filter((k) => !mine.has(k));
    if (key) next.push(key);
    onChange({ ...selection, items: next });
  };
  const allLore = (lk: string) => {
    const next = items.filter((k) => !slots.some((s) => s.options.some((o) => o.key === k)));
    for (const s of slots) {
      const o = s.options.find((x) => x.loreKey === lk);
      if (o) next.push(o.key);
    }
    onChange({ ...selection, items: next });
  };
  const lores = [...new Map(slots.flatMap((s) => s.options).map((o) => [o.loreKey, o.lore])).entries()];

  return (
    <div className="spellslots">
      <div className="armory-head">
        <h3>Fragmentos de hechicería</h3>
        <span className="muted small">
          Cada espacio se abre comprando su habilidad en el árbol; en cada uno eliges de qué saber sale el hechizo. Solo cuentan los espacios abiertos.
        </span>
      </div>
      <div className="armory-gods">
        <span className="muted small">Poner todos del saber:</span>
        {lores.map(([lk, n]) => (
          <button key={lk} className="ghost small" onClick={() => allLore(lk)}>{LORE_ICON[lk] ?? '✦'} {n}</button>
        ))}
      </div>
      <div className="armory-slots">
        {slots.map((s) => {
          const open = isOpen(s);
          const pick = pickOf(s);
          const ab = pick?.effects.find((e) => e.ability)?.ability;
          const info = ab ? tree.abilityInfo[ab] : undefined;
          return (
            <div key={s.key} className={'aslot spell ' + (RARITY_CLS[s.rarity] ?? '') + (open ? '' : ' blocked')}>
              <div className="aslot-head">
                <b>{s.name}</b>
                {open ? <span className="tag">abierto</span> : <span className="muted small">🔒 compra «{s.unlockSkillName}»</span>}
              </div>
              <select value={pick?.key ?? ''} onChange={(e) => setSlot(s, e.target.value)}>
                <option value="">— sin elegir —</option>
                {s.options.map((o) => (
                  <option key={o.key} value={o.key}>{LORE_ICON[o.loreKey] ?? '✦'} {o.lore}: {o.name}</option>
                ))}
              </select>
              {pick && info?.icon && <div className="spell-pick"><AbilityImg icon={info.icon} size={34} title={pick.name} /> <b>{pick.name}</b></div>}
              {pick && (
                <ul className="aslot-eff">
                  {info && (
                    <li>
                      {info.type ? `${info.type} · ` : ''}{info.mana ? `${info.mana} maná · ` : ''}{info.cooldown ? `recarga ${info.cooldown} s` : ''}
                      {info.duration ? ` · ${info.duration} s` : ''}{info.range ? ` · alcance ${info.range}` : ''}
                    </li>
                  )}
                  {pick.effects.map((e) => e.text).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}
                  {info?.stats.slice(0, 4).map((x, i) => <li key={'s' + i} className="muted">{x.d}</li>)}
                  {!open && <li className="warn">No cuenta hasta que compres «{s.unlockSkillName}».</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
