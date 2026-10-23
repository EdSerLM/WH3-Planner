// Tipos que devuelve el backend (subconjunto de backend/src/types.ts)

export type StatKey =
  | 'ma' | 'md' | 'armour' | 'charge' | 'ld' | 'dmg' | 'ap' | 'hp' | 'speed'
  | 'bvl' | 'bvi' | 'resPhysical' | 'resMissile' | 'resMagic' | 'resFlame' | 'resWard'
  | 'missileDmg' | 'ammo' | 'reload' | 'range' | 'barrier' | 'shield';

export interface ParsedEffect {
  key: string;
  text: string;
  textEn?: string;
  kind: 'battle' | 'campaign' | 'magic' | 'ability' | 'mount' | 'attribute' | 'other';
  target: 'self' | 'army' | 'lord' | 'chars' | 'none';
  who?: 'lord' | 'hero' | 'wizard';
  ability?: string;
  rankMin?: number;
  stat?: StatKey;
  value?: number;
  pct?: boolean;
  rank7?: boolean;
  units?: string[];
  attribute?: string;
}

export interface SkillLevel {
  effects: ParsedEffect[];
  abilities: string[];
  requiredRank?: number;
  autoRank?: number;
  mountStats?: unknown;
}

export interface SkillNode {
  key: string;
  skillKey: string;
  name: string;
  nameEn?: string;
  description?: string;
  col: number;
  row: number;
  pointsOnCreation: number;
  background: boolean;
  visible: boolean;
  parentsRequired: string[];
  parentSubset: string[];
  parentSubsetCount: number;
  levels: SkillLevel[];
  isMount: boolean;
  autoActive?: boolean;
  icon?: string;
  category?: 'mount' | 'magic' | 'actions' | 'army' | 'combat' | 'campaign';
}

export interface CharacterSummary {
  key: string;
  name: string;
  nameEn?: string;
  type: 'lord' | 'hero';
  legendary: boolean;
  faction?: string;
}

export interface AbilityInfo {
  key: string;
  name: string;
  type?: string;
  duration: number;
  range?: number;
  cooldown?: number;
  mana?: number;
  mode: 'self' | 'allies' | 'enemies' | 'none';
  passive: boolean;
  stats: { stat: string; how: string; v: number; d: string }[];
  attributes: string[];
}

export interface CharacterTree extends CharacterSummary {
  rows: SkillNode[][];
  rowLabels: string[];
  background: SkillNode[];
  defaultInnate: string | null;
  exclusiveGroups: { name: string; max: number; nodes: string[] }[];
  locks?: Record<string, { skill: string; level: number }[]>;
  abilityInfo: Record<string, AbilityInfo>;
  items?: ItemInfo[];
  itemSets?: { key: string; name: string; items: string[]; effects: ParsedEffect[] }[];
}

export interface ItemInfo {
  key: string;
  name: string;
  description?: string;
  category: string;
  rank?: number;
  questBattle?: boolean;
  effects: ParsedEffect[];
  ability?: string;
}

export interface UnitData {
  key: string;
  card: string;
  /** Carta original del juego (ejércitos viejos guardados con cartas de twwstats) */
  cardArt?: string;
  name: string;
  caste: string;
  casteEs?: string;
  group: string;
  tier: number;
  cost: number;
  models: number;
  size: string;
  campaignOnly: boolean;
}

export interface BuildSelection {
  character: string;
  levels: Record<string, number>;
  mount?: string | null;
  innate?: string | null;
  rank?: number; // rango mínimo elegido en la barra
  rankEff?: number; // rango efectivo (calculado: sube solo con las compras)
  rankOver?: number; // si el build no cabe en 50
  items?: string[]; // objetos equipados (claves)
}

export interface ArmyUnitSelection {
  card: string;
  count: number;
  /** Rango de veteranía (0-9). Si falta, rank7 = 7 (ejércitos guardados antes del selector). */
  rank?: number;
  rank7?: boolean;
}

/** Rango efectivo de una unidad seleccionada (0-9) */
export function unitRank(a: ArmyUnitSelection): number {
  return Math.max(0, Math.min(9, a.rank ?? (a.rank7 ? 7 : 0)));
}

export interface ArmyState {
  lord: BuildSelection | null;
  heroes: BuildSelection[];
  units: ArmyUnitSelection[];
  activeAbilities: string[];
  inAura: boolean;
  /** Facción (subcultura) del ejército */
  faction?: string;
  /** Facción de campaña (Guerreros del Caos: indivisa o dedicada a un dios); limita el roster */
  campaign?: string;
  /** Tecnologías investigadas (claves de tecnología) y el árbol elegido */
  techs?: string[];
  techTree?: string;
  techVariant?: string;
}

export interface TechNode {
  key: string; tech: string; name: string; description?: string; icon?: string; col: number; row: number;
  cost?: number; parents: string[]; parentsNeeded: number; requires: string[]; battle: boolean; effects: ParsedEffect[];
}
export interface TechTreeData { key: string; name: string; variant?: string; variants: { fk: string; name: string }[]; nodes: TechNode[]; minRow: number }
export interface TechTreeSummary { key: string; name: string; variants: { fk: string; name: string }[] }

export interface Contribution {
  source: string;
  from: string;
  value: number;
  how: 'add' | 'pct' | 'mult';
  conditional?: string;
}

export interface StatLine {
  stat: StatKey;
  base: number;
  final: number;
  contributions: Contribution[];
}

export interface ComputedCard {
  id: string;
  name: string;
  kind: 'unit' | 'lord' | 'hero';
  count: number;
  rank?: number;
  rank7?: boolean;
  caste?: string;
  cost?: number;
  models: number;
  size?: string;
  interval: number;
  splash?: number;
  magicalAttacks: boolean;
  flamingAttacks: boolean;
  stats: Record<StatKey, StatLine>;
  attributes: { name: string; from?: string }[];
  notes: string[];
}

export interface AbilityState {
  key: string;
  name: string;
  owner: string;
  skill: string;
  mode: 'self' | 'allies' | 'enemies' | 'none';
  passive: boolean;
  duration: number;
  cooldown?: number;
  range?: number;
  mana?: number;
  type?: string;
  stats: string[];
  attributes: string[];
  hasBattleStats: boolean;
  active: boolean;
}

export interface SummaryLine {
  label: string;
  stat?: StatKey;
  value?: number;
  pct?: boolean;
  scope?: string;
  rank7?: boolean;
  sources: string[];
  text?: string;
}

export interface BuildSummary {
  self: SummaryLine[];
  army: SummaryLine[];
  lord: SummaryLine[];
  attributes: SummaryLine[];
  abilities: { name: string; source: string; passive: boolean; mode: string; detail: string }[];
  campaign: SummaryLine[];
  magic: SummaryLine[];
}

export interface ComputeResult {
  cards: ComputedCard[];
  abilities: AbilityState[];
  enemyDebuffs: { ability: string; owner: string }[];
  builds: { character: string; name: string; pointsUsed: number; pointsAvailable: number; rank: number; minRank: number; warnings: string[]; mount?: string; summary: BuildSummary }[];
  campaign: { owner: string; skill: string; text: string }[];
  magic: { owner: string; skill: string; text: string }[];
}

export interface DpsRow {
  target: string;
  targetName: string;
  hitChance: number;
  dmgPerHit: number;
  resistanceUsed: number;
  dps: number;
  timeToKill: number;
  efficiency: number | null;
}

export interface Meta {
  sources: { skills: string; units: string; faction: string; gameTrees?: number; allUnits?: number; missingGameData?: boolean };
  statLabels: Record<StatKey, string>;
  dpsDisclaimer: string;
}

/** Facción de campaña jugable (datos del juego) */
export interface CampaignFaction {
  key: string;
  name: string;
  /** Ids de los señores legendarios que la lideran */
  leaders: string[];
  /** Unidades que puede reclutar */
  units: string[];
  /** Unidades que consigue mejorando otras (Mejoras de Banda): unidad -> rango requerido */
  upgrades: Record<string, number>;
}

export interface SavedBuild {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  army: ArmyState;
}
