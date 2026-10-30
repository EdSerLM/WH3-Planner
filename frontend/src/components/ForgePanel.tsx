import type { BuildSelection, CharacterTree, InitiativeSet } from '../types';

/**
 * Forja de Daith (Heraldas de Ariel): una sección por ranura (arma, armadura, talismán, objeto encantado),
 * una fila por objeto y una pieza por nivel (I-III forjado, IV reforjado). Clic para ponerla; otro clic la quita.
 * Un objeto por ranura; sus efectos y habilidades entran en la tarjeta.
 */

const SLOT_ICON: Record<string, string> = { weapon: '⚔️', armour: '🛡️', talisman: '🔮', enchanted_item: '✨', arcane_item: '📜' };
const FAM_COLOR: Record<string, string> = { dragon: '#d0602e', dreaming: '#9b6fd6', eagle: '#5aa7d6', twilight: '#c9a74a' };
const LEVELS = ['I', 'II', 'III', 'IV'];

const famOf = (key: string) => /_(dragon|dreaming|eagle|twilight)_/.exec(key)?.[1] ?? '';
const objOf = (name: string) => name.replace(/ (I|II|III|IV)$/, '');
const lvlOf = (name: string) => LEVELS.indexOf(/ (I|II|III|IV)$/.exec(name)?.[1] ?? '');

interface Props {
  tree: CharacterTree;
  sets: InitiativeSet[];
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
}

/** Icono de la pieza: el del objeto si existe; si no, el de su habilidad; si no, el emoji de la ranura */
function PieceIcon({ itemKey, ability, fallback }: { itemKey: string; ability?: string; fallback: string }) {
  const srcs = [`/armory/${itemKey}.png`, `/armory/${itemKey.replace(/_\d$/, '')}.png`, ...(ability ? [`/abilities/${ability}.png`] : [])];
  return (
    <>
      <img
        src={srcs[0]} alt="" data-i={0}
        onError={(e) => {
          const img = e.currentTarget;
          const i = Number(img.dataset.i) + 1;
          if (i < srcs.length) { img.dataset.i = String(i); img.src = srcs[i]; }
          else { img.style.display = 'none'; (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex'); }
        }}
      />
      <span className="forge-emoji" style={{ display: 'none' }}>{fallback}</span>
    </>
  );
}

export function ForgePanel({ tree, sets, selection, onChange }: Props) {
  const items = selection.items ?? [];
  const order = ['weapon', 'armour', 'talisman', 'enchanted_item', 'arcane_item'];
  const ordered = [...sets].sort((a, b) => order.indexOf(a.key.split(':')[1]) - order.indexOf(b.key.split(':')[1]));

  const pick = (s: InitiativeSet, key: string) => {
    const mine = new Set(s.items.map((i) => i.key));
    const next = items.filter((k) => !mine.has(k));
    if (!items.includes(key)) next.push(key);
    onChange({ ...selection, items: next });
  };

  return (
    <div className="forge">
      <div className="glory-title">Forja de Daith</div>
      <p className="muted small">
        Haz clic en la pieza que tienes forjada (I-III) o reforjada (IV); otro clic la quita. Un objeto por ranura. Pasa el ratón para ver sus efectos.
      </p>
      <div className="forge-slots">
        {ordered.map((s) => {
          const slot = s.key.split(':')[1];
          const cur = s.items.find((i) => items.includes(i.key));
          const objs = [...new Set(s.items.map((i) => objOf(i.name)))];
          return (
            <section key={s.key} className="forge-slot">
              <h4>{SLOT_ICON[slot] ?? '✦'} {s.name.replace(/^Forja de Daith · /, '')}</h4>
              {objs.map((o) => {
                const list = s.items.filter((i) => objOf(i.name) === o).sort((a, b) => lvlOf(a.name) - lvlOf(b.name));
                const fam = famOf(list[0]?.key ?? '');
                return (
                  <div key={o} className="forge-row" style={{ ['--fam' as string]: FAM_COLOR[fam] ?? '#888' }}>
                    <span className="forge-obj">{o}</span>
                    <div className="forge-pieces">
                      {list.map((i) => {
                        const on = cur?.key === i.key;
                        const ab = i.effects.find((e) => e.ability)?.ability;
                        const img = ab ? (tree.abilityInfo[ab]?.icon ?? ab).toLowerCase() : undefined;
                        return (
                          <button
                            key={i.key} className={'forge-piece' + (on ? ' on' : '')} onClick={() => pick(s, i.key)}
                            title={`${i.name}${lvlOf(i.name) === 3 ? ' (reforjado)' : ''}\n${i.effects.map((e) => e.text).filter(Boolean).join('\n')}`}
                          >
                            <PieceIcon itemKey={i.key} ability={img} fallback={SLOT_ICON[slot] ?? '✦'} />
                            <span className="forge-lvl">{LEVELS[lvlOf(i.name)] ?? '?'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {cur ? (
                <div className="glory-effects">
                  <b>{cur.name}{lvlOf(cur.name) === 3 ? ' (reforjado)' : ''}</b>
                  <ul className="aslot-eff">{cur.effects.map((e) => e.text).filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}</ul>
                </div>
              ) : (
                <p className="muted small">Sin objeto</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
