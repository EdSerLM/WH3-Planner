import type { AbilityState } from '../types';

interface Props {
  abilities: AbilityState[];
  active: string[];
  inAura: boolean;
  onToggle: (key: string) => void;
  onAura: (v: boolean) => void;
}

const MODE_ES = { allies: 'aliados', self: 'propia', enemies: 'enemigos', none: '' } as const;

export function AbilitiesPanel({ abilities, active, inAura, onToggle, onAura }: Props) {
  const useful = abilities.filter((a) => a.hasBattleStats && a.mode !== 'none');
  const toggles = useful.filter((a) => !a.passive);
  const passives = useful.filter((a) => a.passive);
  return (
    <div className="abilities">
      <h3>Habilidades y hechizos</h3>
      <label className="aura">
        <input type="checkbox" checked={inAura} onChange={(e) => onAura(e.target.checked)} /> Las unidades están dentro de las auras (35 m)
      </label>
      {toggles.length === 0 && <p className="muted">Compra hechizos o habilidades activas en los árboles para poder encenderlas aquí.</p>}
      <ul>
        {toggles.map((a) => (
          <li key={a.owner + a.key} className={active.includes(a.key) ? 'on' : ''}>
            <label>
              <input type="checkbox" checked={active.includes(a.key)} onChange={() => onToggle(a.key)} />
              <b>{a.name}</b> <span className="muted">· {a.owner} · {MODE_ES[a.mode]}{a.duration > 0 ? ` · ${a.duration} s` : ''}{a.cooldown ? ` · recarga ${a.cooldown} s` : ''}</span>
            </label>
            <div className="small muted">{[...a.stats, ...a.attributes].join(', ')}</div>
          </li>
        ))}
      </ul>
      {passives.length > 0 && (
        <>
          <h4>Pasivas (siempre activas{passives.some((p) => p.mode === 'allies') ? '; las de aura dependen de la casilla de arriba' : ''})</h4>
          <ul>
            {passives.map((a) => (
              <li key={a.owner + a.key} className={a.active ? 'on' : ''}>
                <b>{a.name}</b> <span className="muted">· {a.owner} · {MODE_ES[a.mode]}{a.range ? ` · ${a.range} m` : ''}</span>
                <div className="small muted">{[...a.stats, ...a.attributes].join(', ')}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
