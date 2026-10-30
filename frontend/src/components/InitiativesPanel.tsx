import type { BuildSelection, CharacterTree } from '../types';
import { GloryPanel } from './GloryPanel';

/**
 * Iniciativas del personaje (datos del juego): Regalos del Caos y devociones de la Senda a la Gloria,
 * Ofrenda a las Fauces (Ogros), Libros de Nagash... Los que se eligen suman sus efectos a la tarjeta.
 * Cada regalo muestra la condición que pide el juego para desbloquearlo.
 */

// Condiciones que pueden volverse imposibles a mitad de campaña (si ya no quedan esos enemigos)
const HARD = /Demonio|raza de|contra (los|las|un|una) [A-ZÁÉÍÓÚ]/;

interface Props {
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
  /** Facción de campaña elegida: los cargos de la corte de otras facciones no se muestran */
  campaign?: string;
}

export function InitiativesPanel({ tree, selection, onChange, campaign }: Props) {
  const all = tree.initiativeSets ?? [];
  // Cortes (Consejo de los Elfos, Congregación de los Antiguos...): solo la de la facción de campaña, si hay una elegida
  const mine = all.filter((s) => s.category === 'COURT' && s.faction === campaign);
  const sets = all.filter((s) => !s.faction || !campaign || s.faction === campaign || (s.category === 'COURT' && mine.length === 0));
  const items = selection.items ?? [];

  const toggle = (setKey: string, key: string) => {
    const set = sets.find((s) => s.key === setKey)!;
    const mine = set.items.map((i) => i.key);
    const on = items.includes(key);
    let next = on ? items.filter((k) => k !== key) : [...items, key];
    // Respeta el máximo activo del conjunto: quita el más antiguo
    if (!on && set.max > 0) {
      const active = next.filter((k) => mine.includes(k));
      if (active.length > set.max) next = next.filter((k) => k !== active[0]);
    }
    onChange({ ...selection, items: next });
  };
  const clear = (setKey: string) => {
    const mine = new Set(sets.find((s) => s.key === setKey)!.items.map((i) => i.key));
    onChange({ ...selection, items: items.filter((k) => !mine.has(k)) });
  };

  return (
    <div className="initiatives">
      {sets.some((s) => s.category === 'GLORY') && (
        <GloryPanel tree={tree} sets={sets.filter((s) => s.category === 'GLORY')} selection={selection} onChange={onChange} />
      )}
      {sets.filter((s) => s.category !== 'GLORY').map((s) => {
        const active = s.items.filter((i) => items.includes(i.key)).length;
        return (
          <div key={s.key} className="ini-set">
            <div className="armory-head">
              <h3>{s.name}</h3>
              {s.selectable ? (
                <span className="muted small">
                  {s.category === 'DA_PLAN'
                    ? 'Marca las tácticas activas del ejército. Las ranuras dependen de las habilidades de Gorbad (más ranuras al mejorar Da Plan) y cada táctica pide ciertas unidades en el ejército.'
                    : s.category === 'DANCE'
                    ? 'Elige una variación por tempo de la danza que sigue este ejército (los tempos se suman al avanzar). En el juego un ejército sigue una sola danza.'
                    : s.category === 'GLORY'
                    ? 'Elige la ofrenda más alta que alcanzaste con la gloria de este dios (incluye las anteriores). Son efectos de facción: elígelos en el señor y se aplican a su ejército.'
                    : s.category === 'PATRONAGE'
                    ? 'Elige la provincia de Ulthuan de la que este señor es patrón y su nivel de patronazgo (1-3). Solo un patronazgo por señor; sus efectos entran en la tarjeta.'
                    : s.category === 'COURT'
                    ? 'Elige el cargo que ocupa este personaje (uno por personaje; en el juego cada cargo lo tiene un solo personaje). Sus efectos entran en la tarjeta.'
                    : `${s.max > 0 ? `Activos: ${active}/${s.max}` : `Activos: ${active}`} · marca los que tienes en tu campaña; sus efectos entran en la tarjeta.`}
                </span>
              ) : (
                <span className="muted small">Informativo: cambian al personaje por otra versión (elige esa versión como señor o héroe).</span>
              )}
              {s.selectable && active > 0 && <button className="ghost" onClick={() => clear(s.key)}>Quitar todos</button>}
            </div>
            <div className="ini-items">
              {s.items.map((i) => {
                const on = items.includes(i.key);
                const court = ['COURT', 'PATRONAGE', 'GLORY', 'DA_PLAN', 'DANCE'].includes(s.category);
                const hard = !court && !!i.requirement && HARD.test(i.requirement);
                return (
                  <label key={i.key} className={'ini-item' + (on ? ' on' : '') + (s.selectable ? '' : ' info')}>
                    {s.selectable && <input type="checkbox" checked={on} onChange={() => toggle(s.key, i.key)} />}
                    <div>
                      <b>{i.name}</b>
                      {i.requirement && (
                        <div className={'small ' + (hard ? 'warn' : 'muted')} title={hard ? 'Puede ser imposible si ya no quedan esos enemigos en tu campaña' : undefined}>
                          {court ? '' : hard ? '⚠ ' : '🔓 '}{i.requirement}
                        </div>
                      )}
                      <ul className="aslot-eff">
                        {i.effects.map((e) => e.text).filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}
                      </ul>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
