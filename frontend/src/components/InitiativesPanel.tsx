import type { BuildSelection, CharacterTree } from '../types';
import { GloryPanel } from './GloryPanel';
import { MechanicPanel, type MechanicArmy } from './MechanicPanel';

/**
 * Mecánicas del personaje (datos del juego): Senda a la Gloria, Consejo, Corte del Rey Fénix, Gloria demoníaca,
 * Da Plan, Danza Eterna, Forja de Daith, Capa de Cráneos, Kislev, Caldero de Grom, plagas de Nurgle...
 * Lo que se elige suma sus efectos a la tarjeta. La Gloria demoníaca tiene su propia pantalla; el resto usa el panel común.
 */

interface Props {
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
  /** Facción de campaña elegida: las mecánicas de otras facciones no se muestran */
  campaign?: string;
  /** Ejército del señor (Da Plan agrega las unidades que pide cada táctica) */
  army?: MechanicArmy;
}

export function InitiativesPanel({ tree, selection, onChange, campaign, army }: Props) {
  const all = tree.initiativeSets ?? [];
  // Cortes (Consejo de los Elfos, Congregación de los Antiguos...): solo la de la facción de campaña, si hay una elegida
  const mine = all.filter((s) => s.category === 'COURT' && s.faction === campaign);
  const sets = all.filter((s) => !s.faction || !campaign || s.faction === campaign || (s.category === 'COURT' && mine.length === 0));
  const glory = sets.filter((s) => s.category === 'GLORY');
  const rest = sets.filter((s) => s.category !== 'GLORY');
  return (
    <div className="initiatives">
      {glory.length > 0 && <GloryPanel tree={tree} sets={glory} selection={selection} onChange={onChange} />}
      {rest.length > 0 && <MechanicPanel tree={tree} sets={rest} selection={selection} onChange={onChange} army={army} />}
    </div>
  );
}
