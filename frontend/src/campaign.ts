// Facciones de campaña de los Guerreros del Caos y qué unidades pueden tener.
// Fuente: wiki (Warbands, páginas de cada señor). Provisional hasta leer las tablas del juego.
import type { UnitData } from './types';

export type God = 'kho' | 'nur' | 'sla' | 'tze';

export interface CampaignFaction {
  key: string;
  name: string;
  /** Dios al que está dedicada; sin dios = indivisa (acceso a todas las marcas) */
  god?: God;
  /** Señores legendarios que la dirigen (para elegirla sola) */
  lords: string[];
}

export const CHAOS_CAMPAIGN: CampaignFaction[] = [
  { key: 'indivisa', name: 'Indivisa (todas las marcas)', lords: ['archaon', 'kholek', 'sigvald', 'be_lakor'] },
  { key: 'gorequeen', name: 'Legion of the Gorequeen (Khorne)', god: 'kho', lords: ['valkia'] },
  { key: 'fecundites', name: 'The Fecundites (Nurgle)', god: 'nur', lords: ['festus'] },
  { key: 'triplets', name: 'Host of the Triplets (Nurgle)', god: 'nur', lords: ['glottkin'] },
  { key: 'ecstatic', name: 'The Ecstatic Legions (Slaanesh)', god: 'sla', lords: ['azazel'] },
  { key: 'misrule', name: 'Puppets of Misrule (Tzeentch)', god: 'tze', lords: ['vilitch'] },
];

export const CHAOS_SUBCULTURE = 'wh_main_sc_chs_chaos';

/** Facción de campaña que dirige un señor legendario (undefined para genéricos: se respeta la elegida). */
export function campaignForLord(characterKey: string): string | undefined {
  const k = characterKey.toLowerCase();
  return CHAOS_CAMPAIGN.find((f) => f.lords.some((l) => k.includes(l)))?.key;
}

const GOD_RE: Record<God, RegExp> = {
  kho: /(_mkho|_kho_)/,
  nur: /(_mnur|_nur_)/,
  sla: /(_msla|_sla_)/,
  tze: /(_mtze|_tze_)/,
};

/** Dios de la unidad por su clave (marcadas y demonios); undefined = indivisa */
export function unitGod(u: Pick<UnitData, 'key'>): God | undefined {
  return (Object.keys(GOD_RE) as God[]).find((g) => GOD_RE[g].test(u.key));
}

// Unidades que solo tiene una facción (wiki: Skullreapers y Wrathmongers solo Legion of the Gorequeen)
const EXCLUSIVE: { re: RegExp; faction: string }[] = [
  { re: /skullreapers|wrathmongers/, faction: 'gorequeen' },
];

/** ¿Puede tener esta unidad la facción de campaña? (null = sin restricción) */
export function unitAllowed(u: Pick<UnitData, 'key'>, campaign: string | undefined): boolean {
  if (!campaign) return true;
  const f = CHAOS_CAMPAIGN.find((x) => x.key === campaign);
  if (!f) return true;
  const ex = EXCLUSIVE.find((e) => e.re.test(u.key));
  if (ex && ex.faction !== f.key) return false;
  const g = unitGod(u);
  return !f.god || !g || g === f.god;
}
