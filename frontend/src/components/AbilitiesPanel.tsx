import type { AbilityState } from '../types';
import { AbilityIcons } from './AbilityIcons';
import { AbilityImg } from '../gameIcons';

interface Props {
  abilities: AbilityState[];
  inAura: boolean;
  /** Cambia cuánto lleva cargada una pasiva (0-100 %) */
  onScale?: (id: string, pct: number) => void;
}

/** Valor base → final (si las habilidades lo cambian) */
function BaseFinal({ label, base, final, unit = '' }: { label: string; base?: number; final?: number; unit?: string }) {
  if (base === undefined || base <= 0) return null;
  const changed = final !== undefined && final !== base;
  return (
    <span className="spell-val">
      {label} {changed ? <><s className="muted">{base}{unit}</s> <b className={final! < base ? 'ok' : ''}>{final}{unit}</b></> : <b>{base}{unit}</b>}
    </span>
  );
}

/** Pasivas del señor y los héroes (siempre activas; las de aura dependen de "En auras" junto al ejército). */
export function AbilitiesPanel({ abilities, inAura, onScale }: Props) {
  const passives = abilities.filter((a) => a.hasBattleStats && a.mode !== 'none' && a.passive);
  // Hechizos (con coste de maná): cómo quedan con lo comprado en el árbol
  const spells = abilities.filter((a) => (a.mana ?? 0) > 0 || a.spell);
  return (
    <div className="abilities">
      <h3>Pasivas</h3>
      {passives.length === 0 && <p className="muted small">Sin pasivas de combate.</p>}
      <ul>
        {passives.map((a) => (
          <li key={a.owner + a.key} className={a.active ? 'on' : ''} title={a.active ? undefined : 'Aura sin aplicar: activa "En auras" junto al ejército'}>
            <AbilityImg icon={a.icon} title={a.name} /> <b>{a.name}</b> <AbilityIcons a={a} />
            <span className="muted small"> · {a.owner}{a.range ? ` · ${a.range} m` : ''}{a.mode === 'allies' && !inAura ? ' · fuera del aura' : ''}</span>
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
          <p className="muted small">Coste, espera y duración con lo que llevas en el árbol (tachado = valor base del juego). Pasa el ratón para ver qué habilidad cambia cada cosa.</p>
          <ul className="spells">
            {spells.map((a) => (
              <li key={a.id} title={a.mods?.length ? a.mods.join('\n') : 'Sin cambios del árbol'}>
                <AbilityImg icon={a.icon} title={a.name} /> <b>{a.name}</b>
                <span className="muted small"> · {a.owner}{a.type ? ` · ${a.type}` : ''}</span>
                <div className="small">
                  <BaseFinal label="🔮 Maná" base={a.mana} final={a.final?.mana} />
                  <BaseFinal label="⏳ Espera" base={a.cooldown} final={a.final?.cooldown} unit=" s" />
                  {a.duration > 0 && <BaseFinal label="⌛ Dura" base={a.duration} final={a.final?.duration} unit=" s" />}
                  <BaseFinal label="📏 Alcance" base={a.range} final={a.final?.range} unit=" m" />
                  {a.final?.uses ? <span className="spell-val">Usos <b className="ok">+{a.final.uses}</b></span> : null}
                </div>
                {(a.stats.length > 0 || a.attributes.length > 0) && <div className="small muted">{[...a.stats, ...a.attributes].join(', ')}</div>}
                {a.overcast && (
                  <div className="small">
                    <span className={a.overcast.unlocked ? 'ok' : 'muted'}>{a.overcast.unlocked ? '✦ Potenciado' : '🔒 Potenciado sin desbloquear'}: {a.overcast.name}</span>
                    {a.overcast.mana !== undefined && <> · <BaseFinal label="🔮" base={a.overcast.mana} final={a.overcast.finalMana} /></>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
