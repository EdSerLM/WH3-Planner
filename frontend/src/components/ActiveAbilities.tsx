import type { AbilityState } from '../types';
import { AbilityIcons } from './AbilityIcons';

interface Props {
  abilities: AbilityState[];
  active?: string[];
  inAura: boolean;
  onToggle: (a: AbilityState) => void;
  onAura: (v: boolean) => void;
  /** Mostrar los debufos al enemigo (solo sirven en DPS) */
  showEnemies?: boolean;
}

/** Hechizos y habilidades que se encienden y afectan a otros (las que solo afectan a quien las usa van en su tarjeta). */
export function ActiveAbilities({ abilities, inAura, onToggle, onAura, showEnemies = true }: Props) {
  const all = abilities.filter((a) => a.hasBattleStats && (a.mode === 'allies' || a.mode === 'enemies') && !a.passive);
  const toggles = showEnemies ? all : all.filter((a) => a.mode === 'allies');
  const hidden = all.filter((a) => a.mode === 'enemies');
  const hiddenOn = hidden.filter((a) => a.active).length;
  return (
    <div className="abilities active-abilities">
      <div className="ab-head">
        <h3>Activables</h3>
        <label className="aura small" title="Las pasivas de aura (35 m) del señor y los héroes se aplican solo si las unidades están cerca">
          <input type="checkbox" checked={inAura} onChange={(e) => onAura(e.target.checked)} /> En auras
        </label>
      </div>
      {!showEnemies && hidden.length > 0 && (
        <p className="muted small" title={hidden.map((a) => `${a.active ? '✔ ' : ''}${a.name}`).join('\n')}>
          🎯 {hidden.length} debufo{hidden.length === 1 ? '' : 's'} al enemigo{hiddenOn ? ` (${hiddenOn} encendido${hiddenOn === 1 ? '' : 's'})` : ''}: se encienden en la pestaña DPS.
        </p>
      )}
      {toggles.length === 0 && <p className="muted small">Compra hechizos o habilidades activas en los árboles para encenderlas aquí. Las que solo afectan a quien las usa están en su tarjeta.</p>}
      <ul>
        {toggles.map((a) => (
          <li key={a.id} className={a.active ? 'on' : ''}>
            <label title={[...a.stats, ...a.attributes].join('\n')}>
              <input type="checkbox" checked={a.active} onChange={() => onToggle(a)} />
              <b>{a.name}</b> <AbilityIcons a={a} />
              <span className="muted small ab-meta">
                {a.owner}
                {a.duration > 0 ? ` · ${a.duration} s` : ''}
                {a.cooldown && a.cooldown > 0 ? ` · recarga ${a.cooldown} s` : ''}
                {a.mana ? ` · ${a.mana} maná` : ''}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
