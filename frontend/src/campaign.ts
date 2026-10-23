// Facciones de campaña: todo viene de los datos del juego (/api/campaign).
import type { CampaignFaction } from './types';

/** Facción de campaña que lidera un señor legendario (undefined para genéricos: se respeta la elegida). */
export function campaignForLord(list: CampaignFaction[], characterKey: string): string | undefined {
  return list.find((c) => c.leaders.includes(characterKey))?.key;
}

/** Unidades que puede tener la facción (reclutables + por mejora); undefined = sin filtro */
export function campaignUnits(c: CampaignFaction | undefined): Set<string> | undefined {
  return c ? new Set([...c.units, ...Object.keys(c.upgrades)]) : undefined;
}
