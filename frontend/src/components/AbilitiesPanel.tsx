import type { AbilityState } from '../types';
import { AbilityIcons } from './AbilityIcons';
import { AbilityImg } from '../gameIcons';

interface Props {
  abilities: AbilityState[];
  inAura: boolean;
}

/** Pasivas del señor y los héroes (siempre activas; las de aura dependen de "En auras" junto al ejército). */
export function AbilitiesPanel({ abilities, inAura }: Props) {
  const passives = abilities.filter((a) => a.hasBattleStats && a.mode !== 'none' && a.passive);
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
          </li>
        ))}
      </ul>
    </div>
  );
}
