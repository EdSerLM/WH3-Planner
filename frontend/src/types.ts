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
  /** Hechizos: icono de la habilidad de batalla (/abilities/<icon>.png); manda sobre `icon` */
  abilityIcon?: string;
  category?:'mount' | 'magic' | 'actions' | 'army' | 'combat' | 'campaign';
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
  /** Icono del juego (/abilities/<icon>.png) */
  icon?: string;
  mode: 'self' | 'allies' | 'enemies' | 'none';
  passive: boolean;
  magicalAttacks?: boolean;
  flamingAttacks?: boolean;
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
  /** Dones del Príncipe Demonio (Daniel): piezas intercambiables por ranura */
  armory?: ArmoryInfo;
  /** Espacios de hechizo elegibles (Kairos: Fragmentos de hechicería) */
  spellSlots?: SpellSlot[];
  /** Iniciativas del personaje (Senda a la Gloria, Ofrenda a las Fauces, Libros de Nagash...) */
  initiativeSets?: InitiativeSet[];
  /** Unidad del personaje (cuenta para los requisitos de Da Plan) */
  unit?: string;
  /** Acciones de héroe en su ejército que desbloquea su árbol */
  heroActions?: HeroAction[];
}

/** Acción de héroe "Ayudar al ejército" (Formación de asalto, Guardia mortífera, Afilar armas...): da efectos a su ejército */
export interface HeroAction {
  key: string; name: string; icon?: string;
  /** Efectos de habilidad que la desbloquean */
  enable: string[];
  /** Resultados: valor base y efectos (con el valor base) */
  outcomes: { key: string; base: number; effects: ParsedEffect[] }[];
  /** Habilidades que suben el valor: en el nivel lv de la habilidad sk, +v al resultado o */
  buffs?: { sk: string; lv: number; o: string; v: number }[];
}


export interface InitiativeSet {
  key: string; category: string; name: string; faction?: string; max: number; selectable: boolean;
  /** Gloria demoníaca: dios, gloria máxima y línea de umbrales (ofrendas, unidades, dones) como en la pantalla del juego */
  god?: string; top?: number;
  track?: { at: number; kind: string; key: string; n?: string; icon?: string; art?: string }[];
  items: {
    key: string; name: string; requirement?: string; locked: boolean; effects: ParsedEffect[];
    /** Da Plan: unidades que pide (conjunto y número), imagen de la táctica, nivel y turnos de duración/recarga */
    need?: { s: string; n: number }[]; img?: string; tier?: number; duration?: number; cooldown?: number;
    /** Unidades a las que bonifican sus efectos (para el filtro por unidad) */
    benefits?: string[];
    /** Piezas en filas: fila (objeto, cráneo, provincia...) y etiqueta corta del nivel */
    group?: string; level?: string;
  }[];
  /** Da Plan: conjuntos de unidades que piden las tácticas (nombre, icono y unidades que cuentan) */
  unitSets?: Record<string, { n: string; icon?: string; units: string[] }>;
  /** Mostrar en filas por objeto con un nivel por pieza; nombres de las secciones (tier 1, 2...) */
  rows?: boolean; sections?: string[];
}

export interface SpellSlot {
  key: string; name: string; rarity: string;
  unlockSkill: string; unlockSkillName: string; unlockEffect: string;
  options: { key: string; lore: string; loreKey: string; name: string; effects: ParsedEffect[] }[];
}

export interface ArmoryItem {
  key: string; slot: string; name: string; description?: string;
  /** khorne, nurgle, slaanesh, tzeentch o generic */
  god: string; style?: string; cats: string[];
  blocksSlots: string[];
  effects: ParsedEffect[];
}
export interface ArmoryInfo {
  slots: { key: string; name: string; order: number; mandatory: boolean }[];
  items: ArmoryItem[];
  sets: { key: string; name: string; description?: string; items: string[]; effects: ParsedEffect[] }[];
  defaults: string[];
  blacklist: Record<string, string[]>;
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
  /** Cuántos personajes distintos pueden llevarlo (1 = solo este) */
  owners?: number;
}

export interface UnitData {
  /** Mejoras de campaña que puede comprar la unidad (aspectos de Dríades y Árboles, mejoras de Ogros, genes...) */
  upgrades?: { key: string; name: string; category: string; categoryName: string; banned?: string[]; texts: string[] }[];
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
  /** Límite de unidades en campaña (Regimientos de Renombre = 1) */
  cap?: number;
  /** Solo estas facciones de campaña la pueden tener */
  excl?: string[];
  // Stats base del juego (vienen del roster) para la ficha
  hpPerModel?: number; leadership?: number; speed?: number; ma?: number; md?: number; charge?: number;
  armour?: number; dmg?: number; ap?: number; bvl?: number; bvi?: number;
  res?: { physical: number; missile: number; magic: number; flame: number; ward: number };
  missile?: { dmg: number; ap: number; range: number; reload: number; shots: number; ammo: number };
  attrs?: string[];
  desc?: string;
  /** Icono genérico (tipo de arma/montura) */
  icon?: string;
  /** Icono oficial de categoría (/unitcat/<catIcon>.png) */
  catIcon?: string;
  /** Arte de la carta del juego (/units/<art>.png) */
  art?: string;
  /** Puntos fuertes/débiles de la carta del juego */
  bp?: { name: string; tip?: string; good: boolean }[];
}

export interface BuildSelection {
  character: string;
  levels: Record<string, number>;
  mount?: string | null;
  innate?: string | null;
  /** Acción de héroe elegida en su ejército (clave de HeroAction) */
  heroAction?: string | null;
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
  /** Mejoras de unidad elegidas (claves de unit_purchasable_effects) */
  upgrades?: string[];
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
  /** Cuánto lleva cargada cada pasiva que crece en batalla ("habilidad@personaje" -> 0-100 %; sin valor = 100) */
  abilityScale?: Record<string, number>;
}

/** Grafo de iniciativas (Pirámide Negra): cada nodo se investiga como una tecnología (clave en `tech`) */
export interface GraphNode {
  key: string; tech: string; name: string; description?: string; icon?: string; x: number; y: number; type?: string;
  cluster?: string; parents: string[]; threshold?: number; cost: number; battle: boolean; effects: ParsedEffect[];
}
export interface GraphData {
  key: string; name: string; origin: string; originActive: boolean; nodes: GraphNode[];
  clusters: Record<string, { n: string; d?: string; sc?: string; order?: number }>;
}

export interface TechSummaryLine { text: string; kind: string; count: number }
export interface TechSummaryData { battle: TechSummaryLine[]; magic: TechSummaryLine[]; campaign: TechSummaryLine[]; count: number }

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
  /** Arte de la carta del juego (/units/<art>.png) */
  art?: string;
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
  /** Icono del juego (/abilities/<icon>.png) */
  icon?: string;
  /** Id para encenderla: "habilidad@personaje" */
  id: string;
  /** Personaje que la tiene (id de su tarjeta) */
  ownerKey: string;
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
  /** Stats que toca (clave del juego, cómo y cuánto) para los iconos */
  effects?: { stat: string; how: string; v: number }[];
  spell?: boolean;
  magical?: boolean;
  flaming?: boolean;
  active: boolean;
  /** Valores con lo que le cambian las habilidades compradas */
  final?: { mana?: number; cooldown?: number; duration?: number; range?: number; uses?: number };
  /** Versión potenciada: si está desbloqueada y su coste */
  overcast?: { name: string; unlocked: boolean; mana?: number; finalMana?: number };
  /** Textos de esos cambios con la habilidad que los da */
  mods?: string[];
  /** Cuánto lleva cargada (0-100 %) */
  scale?: number;
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
  /** Números usados en el cálculo */
  detail?: {
    ma: number; bonus: number; md: number; mdBase: number; dir: 'front' | 'flank' | 'rear'; armour: number; armourRed: number;
    dmg: number; ap: number; bonusBase: number; bonusAp: number; models: number; interval: number; hpTotal: number;
    res: { ward: number; physical: number; flame: number; magicalIgnoresPhysical: boolean };
    /** Daño en área: modelos que alcanza cada golpe (1 = concentrado), máximo del arma y por qué no se aplica */
    splash?: { n: number; max: number; size?: string; why?: string };
    /** Solo a distancia: proyectiles por disparo, recarga, bloqueo del escudo, munición y % de su vida que alcanza a quitar */
    ranged?: { shots: number; reload: number; shield: number; ammo: number; missileRes: number; ammoPct: number };
  };
  /** Ficha del objetivo (datos del juego) */
  info?: DpsTargetInfo;
  /** El duelo al revés: el enemigo pegándole a tu unidad */
  duel?: {
    verdict: 'win' | 'lose' | 'even';
    /** su tiempo para matarte ÷ tu tiempo para matarlos (>1 = ganas) */
    ratio: number;
    /** Quién tiene 3× más modelos o más (su daño sale sobreestimado: no pelean todos a la vez) */
    crowd?: 'enemy' | 'mine';
    models?: { mine: number; theirs: number };
    enemy: { hitChance: number; dmgPerHit: number; resistanceUsed: number; dps: number; timeToKill: number; detail?: DpsRow['detail'] };
  };
}

export interface DpsTargetInfo {
  group: string;
  caste: string;
  size: string;
  large: boolean;
  cost: number;
  /** Nivel de la unidad en el juego (1-5) */
  tier?: number;
  models: number;
  hpPerModel: number;
  md: number;
  armour: number;
  ld: number;
  speed: number;
  res: { physical: number; missile: number; magic: number; flame: number; ward: number };
  desc?: string;
  attrs: string[];
  bullets: { name: string; tip?: string; good: boolean }[];
  icon?: string;
  catIcon?: string;
  art?: string;
}

export interface Meta {
  sources: { skills: string; units: string; faction: string; gameTrees?: number; allUnits?: number; missingGameData?: boolean };
  statLabels: Record<StatKey, string>;
  dpsDisclaimer: string;
  /** Grupo del roster -> icono oficial de categoría (vacío hasta re-extraer) */
  groupIcons?: Record<string, string>;
}

/** Facción de campaña jugable (datos del juego) */
export interface CampaignFaction {
  key: string;
  name: string;
  /** Bandera (/flags/<flag>.png) */
  flag?: string;
  /** Ids de los señores legendarios que la lideran */
  leaders: string[];
  /** Unidades que puede reclutar */
  units: string[];
  /** Unidades que consigue mejorando otras (Mejoras de Banda): unidad -> rango requerido */
  upgrades: Record<string, number>;
  /** Unidades que solo recluta con un edificio porque su reserva es de otra facción: unidad -> edificios */
  buildings?: Record<string, string[]>;
}

export interface SavedBuild {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  army: ArmyState;
}
