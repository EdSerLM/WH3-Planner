import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { UnitData } from '../types';
import { UnitTile } from './ArmySetup';

/**
 * Junto al selector del personaje: las unidades de su roster a las que más bufan sus habilidades, cómo se juega su
 * facción (texto del juego al empezar la campaña) y su historia (texto largo de su unidad en el juego).
 */
interface Props {
  character: string;
  kind: 'lord' | 'hero';
  units: UnitData[];
  /** Historia del personaje */
  history?: string;
  /** «Cómo se juega» de la facción de campaña (solo en el señor) */
  howToPlay?: string;
  factionName?: string;
}

export function CharInfo({ character, kind, units, history, howToPlay, factionName }: Props) {
  const [potential, setPotential] = useState<Record<string, { now: string[]; r7: string[] }>>({});
  useEffect(() => {
    if (!units.length) { setPotential({}); return; }
    api.charPotential(character, kind, units.map((u) => u.card)).then(setPotential).catch(() => setPotential({}));
  }, [character, kind, units]);
  // Las que reciben más habilidades de su árbol (las que bufan a todo el ejército cuentan igual para todas)
  const top = useMemo(() => {
    const n = (c: string) => new Set([...(potential[c]?.now ?? []), ...(potential[c]?.r7 ?? [])]).size;
    const ranked = units.filter((u) => n(u.card) > 0).sort((a, b) => n(b.card) - n(a.card) || b.cost - a.cost);
    const max = ranked.length ? n(ranked[0].card) : 0;
    const min = ranked.length ? n(ranked[ranked.length - 1].card) : 0;
    return { list: ranked.slice(0, 4).map((u) => ({ u, n: n(u.card) })), flat: max === min && ranked.length > 4 };
  }, [potential, units]);

  if (!top.list.length && !history && !howToPlay) return null;
  return (
    <div className="char-info">
      {top.list.length > 0 && (
        <div className="ci-block">
          <div className="ci-title">Sus habilidades potencian más a</div>
          {top.flat ? (
            <p className="small muted">Sus habilidades bufan a todo el ejército por igual ({top.list[0].n}).</p>
          ) : (
            <div className="ci-units">
              {top.list.map(({ u, n }) => (
                <div key={u.card} className="ci-unit" title={`${n} habilidades de su árbol le cambian la tarjeta`}>
                  <UnitTile u={u} />
                  <span className="small"><b className="gold">{n}</b> hab.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {howToPlay && (
        <details className="ci-block">
          <summary className="ci-title">Cómo se juega{factionName ? `: ${factionName}` : ''}</summary>
          <p className="ci-text">{howToPlay}</p>
        </details>
      )}
      {history && (
        <details className="ci-block">
          <summary className="ci-title">Historia</summary>
          <p className="ci-text">{history}</p>
        </details>
      )}
    </div>
  );
}
