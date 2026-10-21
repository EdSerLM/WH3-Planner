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
  target: 'self' | 'army' | 'lord' | 'none';
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
  type: 'lord' | 'hero';
  legendary: boolean;
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
  abilityInfo: Record<string, AbilityInfo>;
}

export interface UnitData {
  key: string;
  card: string;
  name: string;
  caste: string;
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
  rank?: number;
}

export interface ArmyUnitSelection {
  card: string;
  count: number;
  rank7?: boolean;
}

export interface ArmyState {
  lord: BuildSelection | null;
  heroes: BuildSelection[];
  units: ArmyUnitSelection[];
  activeAbilities: string[];
  inAura: boolean;
}

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
  sources: { skills: string; units: string; faction: string };
  statLabels: Record<StatKey, string>;
  dpsDisclaimer: string;
}

export interface SavedBuild {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  army: ArmyState;
}
