// ---------- Datos crudos (tal como vienen de los JSON extraídos) ----------

export interface RawAbilityPhase {
  dur: number;
  tf?: boolean; // afecta aliados
  te?: boolean; // afecta enemigos
  ts?: boolean; // afecta a sí mismo
  type?: string;
  mag?: boolean; // vuelve mágicos los ataques
  fire?: boolean; // vuelve flamígeros los ataques
  stats: { stat: string; how: 'add' | 'mult' | string; v: number; d: string }[];
  attr: string[];
}

export interface RawAbility {
  key: string;
  name: string;
  spell?: boolean;
  type?: string;
  over?: string;
  active?: number;
  range?: number;
  mana?: number;
  cd?: number;
  tf?: boolean;
  te?: boolean;
  ts?: boolean;
  tg?: boolean;
  hidden?: boolean;
  phases: RawAbilityPhase[];
}

export interface RawLevel {
  e: { k: string; d: string }[];
  ab?: string[];
  u?: number; // índice en unitLists
  ar?: number; // se desbloquea sola en este rango
  ur?: number; // requiere este rango
  ms?: CharacterStats; // stats con montura
}

export interface RawSkill {
  sk: string;
  n: string;
  d?: string;
  img?: string;
  lv: RawLevel[];
}

export interface RawNode {
  k: string; // clave del nodo
  s: string; // clave de la habilidad (en skills)
  t: number; // columna (tier)
  i: number; // fila (indent)
  poc?: number; // puntos al crear
  rnp?: number; // nº de padres requeridos (de parent_subset_required)
  vis?: boolean;
  bg?: boolean;
  pr?: string[] | null; // padres obligatorios
  psr?: string[] | null; // subconjunto de padres
  ra?: boolean | null;
  bx?: boolean | null;
}

export interface CharacterStats {
  run_speed?: number;
  size?: string;
  hit_points: number;
  bonus_hit_points: number;
  armour: number;
  missile_block_chance?: number;
  morale: number;
  damage_mod_flame?: number;
  damage_mod_magic?: number;
  damage_mod_physical?: number;
  damage_mod_missile?: number;
  damage_mod_all?: number;
  melee_attack: number;
  melee_defence: number;
  charge_bonus: number;
  bonus_v_large?: number;
  bonus_v_infantry?: number;
  damage: number;
  ap_damage: number;
  splash_attack_max_attacks?: number;
  melee_attack_interval: number;
  is_flaming?: boolean;
  is_magical?: boolean;
  barrier?: number;
  attributes?: string[];
  abilities?: string[];
  unit?: string;
}

export interface RawCharacter {
  name: string;
  key: string;
  type: 'lord' | 'hero';
  rows: (RawNode | null)[][];
  bg: (RawNode | null)[];
  stats: CharacterStats | null;
}

export interface SkillsFile {
  source: string;
  faction: string;
  extracted: string;
  characters: RawCharacter[];
  skills: Record<string, RawSkill>;
  abilities: Record<string, RawAbility>;
  unitLists: string[][];
}

export interface UnitData {
  key: string;
  card: string;
  name: string;
  nameEn?: string;
  casteEs?: string;
  caste: string;
  category: string;
  group: string;
  tier: number;
  cost: number;
  campaignOnly: boolean;
  models: number;
  mounts: number;
  size: string;
  entity: string;
  hpPerModel: number;
  barrier: number;
  speed: number;
  leadership: number;
  ma: number;
  md: number;
  charge: number;
  armour: number;
  shield: number;
  dmg: number;
  ap: number;
  bvl: number;
  bvi: number;
  interval: number;
  splash: number;
  splashSize?: string;
  magical?: boolean;
  flaming?: boolean;
  missile?: { dmg: number; ap: number; range: number; reload: number; shots: number; ammo: number; bvl: number; bvi: number };
  res: { physical: number; missile: number; magic: number; flame: number; ward: number };
  attrs: string[];
}

export interface UnitsFile {
  source: string;
  faction: string;
  extracted: string;
  units: UnitData[];
}

// ---------- Modelo normalizado ----------

export type StatKey =
  | 'ma' | 'md' | 'armour' | 'charge' | 'ld' | 'dmg' | 'ap' | 'hp' | 'speed'
  | 'bvl' | 'bvi' | 'resPhysical' | 'resMissile' | 'resMagic' | 'resFlame' | 'resWard'
  | 'missileDmg' | 'ammo' | 'reload' | 'range' | 'barrier' | 'shield';

export type EffectKind = 'battle' | 'campaign' | 'magic' | 'ability' | 'mount' | 'attribute' | 'other';
export type EffectTarget = 'self' | 'army' | 'lord' | 'chars' | 'none';

export interface ParsedEffect {
  key: string;
  text: string; // texto en español (oficial si hay loc, si no glosario)
  textEn?: string; // texto original del juego (inglés)
  kind: EffectKind;
  target: EffectTarget;
  stat?: StatKey;
  value?: number;
  pct?: boolean; // el valor es porcentaje (multiplica)
  rank7?: boolean; // solo rango 7+
  units?: string[]; // tarjetas (unit card) a las que aplica; vacío = todo el ejército
  attribute?: string;
  forNames?: string[]; // atributo limitado a unidades con estos nombres (p. ej. "Forsaken")
  /** Datos del juego (db.pack): índice de la lista de unidades (claves de unidad) a las que aplica */
  unitList?: number;
  /** El valor ya viene separado por stat (no duplicar "fuerza del arma" en perforante) */
  exact?: boolean;
  /** A quién aplica, en texto ("infantería no demoníaca") */
  scope?: string;
  /** Rango mínimo de la unidad para que aplique */
  rankMin?: number;
  ability?: string;
  /** Tecnologías "a los personajes": solo señores, solo héroes o solo hechiceros */
  who?: 'lord' | 'hero' | 'wizard';
  /** Habilidad que este efecto quita (p. ej. Stand or Die! reemplaza a Rally!) */
  disable?: string;
  action?: boolean;
}

export interface SkillLevel {
  effects: ParsedEffect[];
  abilities: string[];
  requiredRank?: number;
  autoRank?: number;
  mountStats?: CharacterStats;
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
  /** Nombre del icono del juego (ui/campaign ui/skills/<icon>.png) */
  icon?: string;
  /** Tipo de habilidad, para el icono de respaldo */
  category?: 'mount' | 'magic' | 'actions' | 'army' | 'combat' | 'campaign';
  /** Habilidad de fondo oculta que siempre está activa (hechizo inicial, acciones de héroe...) */
  autoActive?: boolean;
}

export interface ExclusiveGroup {
  name: string;
  max: number;
  nodes: string[];
}

export interface CharacterSummary {
  key: string;
  name: string;
  nameEn?: string;
  type: 'lord' | 'hero';
  legendary: boolean;
  /** Facción (subcultura) con la que se arma el árbol */
  faction?: string;
}

export interface CharacterTree extends CharacterSummary {
  rows: SkillNode[][];
  /** Nombre de cada fila (Combate personal, Magia, Bufos al ejército, Campaña...) */
  rowLabels: string[];
  /** Rasgos innatos posibles (el juego asigna uno; los legendarios tienen uno fijo) + ocultos */
  background: SkillNode[];
  defaultInnate: string | null;
  /** Grupos excluyentes presentes en este árbol (claves de nodo) */
  exclusiveGroups: ExclusiveGroup[];
  /** Bloqueos oficiales: nodo -> [habilidad que lo bloquea, nivel] */
  locks: Record<string, { skill: string; level: number }[]>;
  stats: CharacterStats | null;
  /** Objetos propios del legendario (de su misión o exclusivos) */
  items?: ItemInfo[];
  /** Conjuntos de esos objetos: bonificación extra con todas las piezas */
  itemSets?: { key: string; name: string; items: string[]; effects: ParsedEffect[] }[];
}

export interface ItemInfo {
  key: string;
  name: string;
  description?: string;
  category: string;
  /** Rango en el que se desbloquea su misión */
  rank?: number;
  questBattle?: boolean;
  effects: ParsedEffect[];
}

export interface AbilityInfo {
  key: string;
  name: string;
  nameEn?: string;
  type?: string;
  duration: number; // -1 = pasiva permanente
  range?: number;
  cooldown?: number;
  mana?: number;
  overcast?: string;
  mode: 'self' | 'allies' | 'enemies' | 'none';
  passive: boolean;
  spell?: boolean;
  magicalAttacks: boolean;
  flamingAttacks: boolean;
  stats: { stat: string; how: string; v: number; d: string }[];
  attributes: string[];
}

// ---------- Peticiones de cálculo ----------

export interface BuildSelection {
  character: string; // clave del personaje (skill node set)
  levels: Record<string, number>; // nodo -> nivel comprado
  mount?: string | null; // nodo de montura elegido
  innate?: string | null; // nodo del rasgo innato elegido (undefined = el de por defecto)
  rank?: number; // rango del personaje (1-50); por defecto 50
  items?: string[]; // objetos equipados (claves de ancillary)
}

export interface ArmyUnitSelection {
  card: string; // unit card
  count: number;
  rank7?: boolean;
}

export interface ComputeRequest {
  lord?: BuildSelection | null;
  heroes?: BuildSelection[];
  units: ArmyUnitSelection[];
  activeAbilities?: string[]; // habilidades activas encendidas (afectan a aliados / a sí mismo)
  techs?: string[]; // tecnologías investigadas (claves de tecnología)
  inAura?: boolean; // las unidades están dentro de las auras (35 m)
}

export interface Contribution {
  source: string; // nombre de la habilidad
  from: string; // personaje
  value: number;
  how: 'add' | 'pct' | 'mult';
  conditional?: string; // 'rango 7+', 'activa', 'aura'
}

export interface StatLine {
  stat: StatKey;
  base: number;
  final: number;
  contributions: Contribution[];
}

export interface ComputedCard {
  id: string; // card o clave de personaje
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

export interface DpsTarget {
  id: string;
  name: string;
  models: number;
  hpPerModel: number;
  md: number;
  armour: number;
  isLarge: boolean;
  isInfantry: boolean;
  cost?: number;
  res: { physical: number; magic: number; flame: number; ward: number };
}
