import type React from 'react';
import { useState } from 'react';
import type { AbilityState } from '../types';
import { AbilityIcons } from './AbilityIcons';
import { AbilityImg, GameIcon } from '../gameIcons';

interface Props {
  abilities: AbilityState[];
  inAura: boolean;
  /** Cambia cuánto lleva cargada una pasiva (0-100 %) */
  onScale?: (id: string, pct: number) => void;
  /** Personaje que se está editando (id de su tarjeta): por defecto solo se ven sus habilidades */
  ownerId?: string;
  ownerName?: string;
  /** Encender / apagar una activable */
  onToggle?: (a: AbilityState) => void;
  /** Personajes del ejército (señor y héroes) para agrupar en "Todo el ejército" */
  characters?: { id: string; name: string }[];
}

/** Valor base → final (si las habilidades lo cambian) */
function BaseFinal({ label, base, final, unit = '' }: { label: React.ReactNode; base?: number; final?: number; unit?: string }) {
  if (base === undefined || base <= 0) return null;
  const changed = final !== undefined && final !== base;
  return (
    <span className="spell-val">
      {label} {changed ? <><s className="muted">{base}{unit}</s> <b className={final! < base ? 'ok' : ''}>{final}{unit}</b></> : <b>{base}{unit}</b>}
    </span>
  );
}

/** Pasivas del señor y los héroes (siempre activas; las de aura dependen de "En auras" junto al ejército). */
export function AbilitiesPanel({ abilities: allAbilities, inAura, onScale, ownerId, ownerName, onToggle, characters }: Props) {
  const [everyone, setEveryone] = useState(false);
  const mineOnly = !!ownerId && !everyone;
  const scope = ownerId && (
    <div className="seg small ab-scope" role="group" aria-label="Qué habilidades ver">
      <button className={mineOnly ? 'on' : ''} onClick={() => setEveryone(false)}>Solo {ownerName ?? 'este personaje'}</button>
      <button className={!mineOnly ? 'on' : ''} onClick={() => setEveryone(true)}>Todo el ejército</button>
    </div>
  );
  if (mineOnly || !characters?.length) {
    const abilities = mineOnly ? allAbilities.filter((a) => a.ownerKey === ownerId) : allAbilities;
    return <div className="abilities">{scope}<CharAbilities abilities={abilities} inAura={inAura} onScale={onScale} onToggle={onToggle} /></div>;
  }
  // Todo el ejército: un bloque por personaje (señor primero), cada uno con sus activables, pasivas y hechizos
  return (
    <div className="abilities">
      {scope}
      {characters.map((c) => {
        const mine = allAbilities.filter((a) => a.ownerKey === c.id);
        return (
          <section key={c.id} className={'ab-char' + (c.id === ownerId ? ' cur' : '')}>
            <h3 className="ab-char-name">{c.name}</h3>
            <CharAbilities abilities={mine} inAura={inAura} onScale={onScale} onToggle={onToggle} compact />
          </section>
        );
      })}
    </div>
  );
}

/** Activables, pasivas y hechizos de un personaje */
function CharAbilities({ abilities, inAura, onScale, onToggle, compact }: { abilities: AbilityState[]; inAura: boolean; onScale?: Props['onScale']; onToggle?: Props['onToggle']; compact?: boolean }) {
  const mineOnly = true;
  const passives = abilities.filter((a) => a.hasBattleStats && a.mode !== 'none' && a.passive);
  // Hechizos (con coste de maná): cómo quedan con lo comprado en el árbol
  const spells = abilities.filter((a) => (a.mana ?? 0) > 0 || a.spell);
  // Activables del personaje que afectan a otros (las que solo le afectan a él van en su tarjeta)
  // Sin efectos de stats: las de daño directo (p. ej. "Reloj de la Muerte" de Elspeth) solo se listan, no se suman
  const actives = mineOnly ? abilities.filter((a) => !a.passive && !((a.mana ?? 0) > 0 || a.spell) && (a.hasBattleStats ? (a.mode === 'allies' || a.mode === 'enemies') : (a.mode === 'enemies' || /daño/i.test(a.type ?? '')))) : [];
  return (
    <>
      {compact && !actives.length && !passives.length && !spells.length && <p className="muted small">Sin activables, pasivas ni hechizos que afecten la batalla.</p>}
      {actives.length > 0 && (
        <>
          <h3>Activables</h3>
          <ul>
            {actives.map((a) => (
              <li key={a.id} className={a.active ? 'on' : ''}>
                {onToggle && a.hasBattleStats && <input type="checkbox" checked={!!a.active} onChange={() => onToggle(a)} title="Encender para sumar su efecto" />}{' '}
                <AbilityImg icon={a.icon} title={a.name} /> <b>{a.name}</b> <AbilityIcons a={a} />
                <span className="muted small"> · {a.type ? `${a.type} · ` : ''}{a.mode === 'enemies' ? 'a enemigos' : 'a aliados'}{a.duration > 0 ? ` · ${a.duration} s` : ''}{a.cooldown ? ` · recarga ${a.final?.cooldown ?? a.cooldown} s` : ''}</span>
                <div className="small muted">{a.hasBattleStats ? [...a.stats, ...a.attributes].join(', ') : 'Hace daño: no cambia stats, así que no se suma a las tarjetas'}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {(!compact || passives.length > 0) && <h3>Pasivas</h3>}
      {!compact && passives.length === 0 && <p className="muted small">Sin pasivas de combate.</p>}
      <ul>
        {passives.map((a) => (
          <li key={a.owner + a.key} className={a.active ? 'on' : ''} title={a.active ? undefined : 'Aura sin aplicar: activa "En auras" junto al ejército'}>
            <AbilityImg icon={a.icon} title={a.name} /> <b>{a.name}</b> <AbilityIcons a={a} />
            <span className="muted small">{mineOnly ? '' : ` · ${a.owner}`}{a.range ? ` · ${a.range} m` : ''}{a.mode === 'allies' && !inAura ? ' · fuera del aura' : ''}</span>
            <div className="small muted">{[...a.stats, ...a.attributes].join(', ')}</div>
            {onScale && (
              <label className="small scale-row" title="Para pasivas que crecen en batalla (p. ej. El Gemelo Deforme de Vilitch sube mientras lucha o lanza hechizos): cuánto lleva cargada. 100 % = el valor completo del juego.">
                Cargada{' '}
                <input type="range" min={0} max={100} step={10} value={a.scale ?? 100} onChange={(e) => onScale(a.id, Number(e.target.value))} />
                {' '}<b>{a.scale ?? 100}%</b>
              </label>
            )}
          </li>
        ))}
      </ul>
      {spells.length > 0 && (
        <>
          <h3>Hechizos</h3>
          {!compact && <p className="muted small">Coste, espera y duración con lo que llevas en el árbol (tachado = valor base del juego). Pasa el ratón para ver qué habilidad cambia cada cosa.</p>}
          <ul className="spells">
            {spells.map((a) => (
              <li key={a.id} title={a.mods?.length ? a.mods.join('\n') : 'Sin cambios del árbol'}>
                <AbilityImg icon={a.icon} title={a.name} /> <b>{a.name}</b>
                <span className="muted small">{mineOnly ? '' : ` · ${a.owner}`}{a.type ? ` · ${a.type}` : ''}</span>
                <div className="small">
                  <BaseFinal label={<><GameIcon path="skills/character_magic" emoji="🔮" size={14} /> Maná</>} base={a.mana} final={a.final?.mana} />
                  <BaseFinal label={<><GameIcon path="skills/character_cooldown" emoji="⏳" size={14} /> Espera</>} base={a.cooldown} final={a.final?.cooldown} unit=" s" />
                  {a.duration > 0 && <BaseFinal label={<><GameIcon path="skills/campaign_turns" emoji="⌛" size={14} /> Dura</>} base={a.duration} final={a.final?.duration} unit=" s" />}
                  <BaseFinal label={<><GameIcon path="stats/icon_stat_range" emoji="📏" size={14} /> Alcance</>} base={a.range} final={a.final?.range} unit=" m" />
                  {a.final?.uses ? <span className="spell-val">Usos <b className="ok">+{a.final.uses}</b></span> : null}
                </div>
                {(a.stats.length > 0 || a.attributes.length > 0) && <div className="small muted">{[...a.stats, ...a.attributes].join(', ')}</div>}
                {a.overcast && (
                  <div className="small">
                    <span className={a.overcast.unlocked ? 'ok' : 'muted'}>{a.overcast.unlocked ? '✦ Potenciado' : '🔒 Potenciado sin desbloquear'}: {a.overcast.name}</span>
                    {a.overcast.mana !== undefined && <> · <BaseFinal label={<GameIcon path="skills/character_magic" emoji="🔮" size={14} />} base={a.overcast.mana} final={a.overcast.finalMana} /></>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
