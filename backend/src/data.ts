import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEffect } from './effects.js';
import { lockedToOtherFaction, type RosterTables } from './rosterRules.js';
import {
  ABILITY_TYPES, CASTES, loadOfficialLoc, officialAbilityName, officialSkillDesc, officialSkillName, officialUnitName,
  officialCount, officialCharacterName, translateAbilityStat, translateAttribute, translateEffect,
} from './i18n.js';
import type {
  AbilityInfo, CharacterStats, CharacterSummary, ItemInfo, CharacterTree, ExclusiveGroup, ParsedEffect, RawAbility, RawNode, SkillNode, SkillsFile, StatKey, UnitData, UnitsFile,
} from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', 'data');

// Arte de las cartas de unidad copiado del juego por npm run extraer (frontend/public/units/<carta>.png)
const ART_DIR = join(DATA_DIR, '..', '..', 'frontend', 'public', 'units');
const artCards = new Set(existsSync(ART_DIR) ? readdirSync(ART_DIR).filter((f) => /\.png$/i.test(f)).map((f) => f.slice(0, -4).toLowerCase()) : []);
/** Nombre del archivo de la carta (sin .png) si existe */
export const artOf = (card?: string) => (card && card.toLowerCase() !== 'placeholder' && artCards.has(card.toLowerCase()) ? card.toLowerCase() : undefined);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}

// Todo sale de los datos de tu instalación (npm run extraer). Los archivos viejos del planner/twwstats
// (wh3_chs_skills.json, wh3_chs_units.json) ya no se usan; si siguen ahí solo sirven cuando faltan los datos del juego.
const EMPTY_SKILLS: SkillsFile = { source: 'sin datos', faction: '', extracted: '', characters: [], skills: {}, abilities: {}, unitLists: [] };
const skillsFile: SkillsFile = existsSync(join(DATA_DIR, 'raw', 'wh3_chs_skills.json')) && !existsSync(join(DATA_DIR, 'raw', 'wh3_all_skills.json'))
  ? readJson<SkillsFile>('raw/wh3_chs_skills.json')
  : EMPTY_SKILLS;

// Árboles de TODAS las facciones sacados de tu instalación (npm run extraer). Si no existen, se usa el planner (solo Caos).
interface GameNode { k: string; s: string; t: number; i: number; poc?: number; rnp?: number; pr?: string[]; psr?: string[]; sc?: string; ck?: string; fk?: string; bg?: boolean; auto?: boolean }
interface GameEffect { k: string; d: string; s: { kind: string; target: string; who?: string; stat?: string; value?: number; pct?: boolean; u?: number; rank?: number; attribute?: string; ability?: string; disable?: string; action?: boolean } }
interface GameSkill { sk: string; n: string; nEn?: string; d?: string; img?: string; bgSkill?: boolean; lv: { e: GameEffect[]; ab?: string[]; ur?: number; ar?: number }[] }
interface GameCharacter {
  key: string; subtype: string; name: string; nameEn: string; unit: string; type: 'lord' | 'hero'; legendary: boolean;
  subcultures: string[]; home: string; nodes: GameNode[]; bg: GameNode[]; stats: CharacterStats | null; mounts?: Record<string, CharacterStats>;
  items?: { k: string; rank?: number; quest?: boolean }[];
  /** Dones del Príncipe Demonio (Daniel): piezas por ranura */
  armory?: {
    slots: { k: string; n: string; o: number; m?: boolean }[];
    items: { k: string; s: string; n: string; d?: string; g: string; st?: string; c?: string[]; bs?: string[]; e: GameEffect[] }[];
    sets: { k: string; n: string; d?: string; items: string[]; e: GameEffect[] }[];
    def: string[];
    black: Record<string, string[]>;
  } | null;
  /** Espacios de hechizo elegibles (Kairos): cada uno se abre con una habilidad del árbol */
  spellSlots?: { k: string; n: string; r: string; o: number; by: string; ef: string; opts: { k: string; lore: string; lk: string; n: string; e: GameEffect[] }[] }[] | null;
  /** Iniciativas del personaje (Senda a la Gloria, Ofrenda a las Fauces, Libros de Nagash...) */
  initiatives?: { k: string; cat: string; n: string; max?: number; items: { k: string; n: string; req?: string; locked?: boolean; e: GameEffect[] }[] }[] | null;
}
interface GameSkillsFile {
  source: string; format: number; subcultures: { key: string; name: string }[]; characters: GameCharacter[];
  skills: Record<string, GameSkill>; abilities: Record<string, RawAbility>; unitLists: string[][]; locks: { skill: string; node: string; level: number }[];
  techTrees?: GameTechTree[]; techs?: Record<string, GameTech>;
  ancillaries?: Record<string, { n: string; d?: string; cat: string; e: GameEffect[] }>;
  itemSets?: { key: string; n: string; items: string[]; e: GameEffect[] }[];
  graphs?: GameGraph[];
  targetFlags?: Record<string, string>;
}
interface GameTechTree {
  key: string; name: string; subcultures: string[];
  nodes: { k: string; tech: string; t: number; i: number; rp?: number; pr?: string[]; need?: number; fk?: string }[];
  variants: { fk: string; name: string; sc?: string }[];
}
interface GameTech { n: string; d?: string; img?: string; e: GameEffect[]; req?: string[] }
const gameFile: GameSkillsFile | null = existsSync(join(DATA_DIR, 'raw', 'wh3_all_skills.json'))
  ? readJson<GameSkillsFile>('raw/wh3_all_skills.json')
  : null;
/** Listas de unidades (claves) de los efectos del juego */
const unitListSets: Set<string>[] = (gameFile?.unitLists ?? []).map((l) => new Set(l));
export function unitInList(list: number, unitKey: string): boolean {
  const set = unitListSets[list];
  if (!set) return false;
  if (set.has(unitKey)) return true;
  const twin = listTwin(unitKey);
  return !!twin && set.has(twin);
}
/**
 * Unidades que no están en ninguna lista porque el extractor solo armaba las listas con las de batalla personalizada
 * (variantes de campaña como "Malditos de Nurgle" de los Guerreros del Caos o los carros de Tamurkhan):
 * se usa su gemela con el mismo nombre y casta que sí está en las listas. Con una extracción nueva ya no hace falta.
 */
let twins: Map<string, string> | null = null;
function listTwin(unitKey: string): string | undefined {
  if (!twins) {
    twins = new Map();
    const listed = new Set(unitListSets.flatMap((s) => [...s]));
    const units = allUnitsFile?.units ?? [];
    const byName = new Map<string, string[]>();
    for (const u of units) if (listed.has(u.key)) byName.set(`${u.name}|${u.casteKey ?? u.caste}`, [...(byName.get(`${u.name}|${u.casteKey ?? u.caste}`) ?? []), u.key]);
    for (const u of units) {
      if (listed.has(u.key)) continue;
      const t = byName.get(`${u.name}|${u.casteKey ?? u.caste}`);
      if (t?.length) twins.set(u.key, t[0]);
    }
  }
  return twins.get(unitKey);
}
/** Facción por defecto (la del planner original) */
export const DEFAULT_FACTION = 'wh_main_sc_chs_chaos';
// Textos oficiales en español (si existen en data/loc-es)
loadOfficialLoc(DATA_DIR);
const unitsFile: UnitsFile = skillsFile !== EMPTY_SKILLS && existsSync(join(DATA_DIR, 'raw', 'wh3_chs_units.json'))
  ? readJson<UnitsFile>('raw/wh3_chs_units.json')
  : { source: 'sin datos', faction: '', extracted: '', units: [] };

/** Nombres en español opcionales: { "clave o unit card": "Nombre en español" }. */
const namesEs: Record<string, string> = existsSync(join(DATA_DIR, 'nombres-es.json'))
  ? readJson<Record<string, string>>('nombres-es.json')
  : {};

export function nameEs(key: string, fallback: string): string {
  return namesEs[key] ?? fallback;
}

/** Nombres de personajes genéricos en español (los legendarios conservan su nombre propio). */
const CHAR_PATTERNS: [RegExp, string][] = [
  [/^Chaos Sorcerer Lord/, 'Señor Hechicero del Caos'],
  [/^Chaos Sorcerer/, 'Hechicero del Caos'],
  [/^Chaos Lord/, 'Señor del Caos'],
  [/^Daemon Prince/, 'Príncipe Demonio'],
  [/^Exalted Hero/, 'Héroe Exaltado'],
];
const LORES_ES: Record<string, string> = { Death: 'Muerte', Fire: 'Fuego', Metal: 'Metal', Shadows: 'Sombras', Nurgle: 'Nurgle', Tzeentch: 'Tzeentch', Slaanesh: 'Slaanesh' };
function characterNameEs(name: string): string {
  for (const [re, es] of CHAR_PATTERNS) {
    if (re.test(name)) {
      return name
        .replace(re, es)
        .replace(/ of (Khorne|Nurgle|Slaanesh|Tzeentch)/, ' de $1')
        .replace(/\((\w+)\)/, (_m, l) => `(${LORES_ES[l] ?? l})`);
    }
  }
  return name;
}

// Personajes genéricos (no legendarios) según su nombre en el planner
const GENERIC = /^(Chaos Lord|Chaos Sorcerer|Daemon Prince|Exalted Hero|Bloodspeaker|Plagueridden)/;

// ---------- Habilidades activas / pasivas ----------
function toAbility(a: RawAbility): AbilityInfo {
  const phase = a.phases[0];
  const allies = a.phases.some((p) => p.tf);
  const enemies = a.phases.some((p) => p.te);
  const self = a.phases.some((p) => p.ts);
  const duration = phase ? phase.dur : a.active ?? 0;
  // Pasivas negativas sobre uno mismo (p. ej. "Wounds": solo se activa al quedar herido) no se aplican
  const negativeSelf = !allies && !enemies && a.phases.length > 0 && a.phases.every((p) => p.type === 'negative');
  return {
    key: a.key,
    name: officialAbilityName(a.key) ?? a.name,
    nameEn: a.name,
    type: a.type ? ABILITY_TYPES[a.type.trim()] ?? a.type : undefined,
    duration,
    range: a.range,
    cooldown: a.cd,
    mana: a.mana,
    overcast: a.over,
    icon: a.img ? a.img.toLowerCase() : undefined,
    mode: negativeSelf ? 'none' : allies ? 'allies' : enemies ? 'enemies' : self ? 'self' : 'none',
    passive: duration === -1,
    spell: a.spell ?? (a.mana ?? 0) > 0,
    magicalAttacks: a.phases.some((p) => p.mag),
    flamingAttacks: a.phases.some((p) => p.fire),
    stats: a.phases.flatMap((p) => p.stats.map((st) => ({ ...st, d: translateAbilityStat(st.d) }))),
    attributes: a.phases.flatMap((p) => p.attr.map((x) => translateAttribute(x))).filter(Boolean),
    invalidTargets: a.inv?.length ? a.inv : undefined,
  };
}

/** Texto del juego de cada restricción de objetivo (vacío si la extracción es anterior) */
export const targetFlagText: Record<string, string> = gameFile?.targetFlags ?? {};

export const abilities: Record<string, AbilityInfo> = Object.fromEntries(
  Object.entries(
    gameFile?.abilities ?? skillsFile.abilities,
  ).map(([k, a]) => [k, toAbility(a)]),
);

// ---------- Árboles ----------
function toNode(n: RawNode, file: SkillsFile = skillsFile): SkillNode {
  const raw = file.skills[n.s];
  const levels = raw.lv.map((l) => {
    const cards = l.u !== undefined ? file.unitLists[l.u] : undefined;
    return {
      effects: l.e.map((e) => {
        const pe = parseEffect(e.k, e.d, cards);
        return {
          ...pe,
          textEn: pe.text,
          text: translateEffect(e.k, e.d),
          attribute: pe.attribute ? translateAttribute(pe.attribute) : undefined,
        };
      }),
      abilities: l.ab ?? [],
      requiredRank: l.ur,
      autoRank: l.ar,
      mountStats: l.ms,
    };
  });
  return {
    key: n.k,
    skillKey: n.s,
    name: officialSkillName(n.s.split('#')[0]) ?? raw.n,
    nameEn: raw.n,
    description: officialSkillDesc(n.s.split('#')[0]) ?? raw.d,
    col: n.t,
    row: n.i,
    pointsOnCreation: n.poc ?? 0,
    background: !!n.bg,
    visible: n.vis !== false,
    parentsRequired: n.pr ?? [],
    parentSubset: n.psr ?? [],
    parentSubsetCount: n.rnp ?? 0,
    levels,
    isMount: levels.some((l) => l.mountStats || l.effects.some((e) => e.kind === 'mount')),
    icon: raw.img ? raw.img.split('/').pop() : undefined,
  };
}

/** "Armadura: +12 a todas las unidades de infantería no demoníacas (Ejército del Señor)" -> "Infantería no demoníaca..." */
function scopeFromText(text: string): string | undefined {
  const m = text.match(/^[^:]+:\s*[+-]?[\d.,]+%?\s*(.*?)\s*(\([^)]*\))?\s*$/);
  if (!m) return undefined;
  let s = m[1].replace(/^(a|para|de)\s+(todas\s+)?(las\s+)?unidades\s+(de\s+)?/i, '').replace(/^(a|para)\s+/i, '').trim();
  if (!s) return undefined;
  return s[0].toUpperCase() + s.slice(1);
}

/** Atributos "a todo el ejército" en los datos que solo son para unidades concretas (el juego las filtra por la clave del efecto) */
const NAMED_UNITS: Record<string, string[]> = {
  wh3_dlc24_effect_force_stat_enable_slow_death_attacks_ostankya_spiders: ['Araña'],
  wh3_dlc24_effect_force_stat_enable_demoralize_attacks_ostankya_spiders: ['Cosas del Bosque'],
};

/**
 * "Los ataques mágicos a las unidades de Guardia del Fénix" -> atributo "Ataques mágicos" solo para "Guardia del Fénix".
 * Sin esto el atributo (y los ataques mágicos/flamígeros) le llegaban a todo el ejército.
 */
function limitToNamedUnits(p: ParsedEffect, key: string, text: string): ParsedEffect {
  if (p.target !== 'army' || p.unitList !== undefined || p.kind !== 'attribute' || !p.attribute) return p;
  // "Silencio (héroes en el ejército del Señor)": solo los héroes
  if (/\(héroes en el ejército/i.test(text)) return { ...p, target: 'chars', who: 'hero' };
  if (NAMED_UNITS[key]) return { ...p, forNames: NAMED_UNITS[key] };
  const m = /^(.*?)\s+(?:para|a)\s+(?:las unidades de|los|las)\s+(?!todas\b)(.+)$/i.exec(p.attribute);
  if (!m) return p;
  const attr = m[1].replace(/^(los|las)\s+/i, '');
  const names = m[2].split(/,\s*|\s+y\s+/).map((n) => n.trim()).filter(Boolean);
  return { ...p, attribute: attr[0].toUpperCase() + attr.slice(1), forNames: names };
}

/** Personajes concretos que nombran algunos efectos al final: "Ataque cuerpo a cuerpo: +5 (Nagash)" (nodos de la Pirámide Negra) */
const CHAR_SCOPES = ['Nagash'];
/** Stat por su nombre en español (los efectos con alcance a un personaje vienen del juego como campaña, sin stat) */
const STAT_BY_LABEL: Record<string, StatKey> = {
  'Ataque cuerpo a cuerpo': 'ma', 'Defensa cuerpo a cuerpo': 'md', Armadura: 'armour', 'Bonificación de carga': 'charge',
  Velocidad: 'speed', 'Fuerza del arma': 'dmg', Liderazgo: 'ld', 'Puntos de golpe': 'hp',
  'Salvación especial': 'resWard', 'Resistencia a los hechizos': 'resMagic', 'Resistencia física': 'resPhysical',
  'Resistencia a los proyectiles': 'resMissile', 'Resistencia al fuego': 'resFlame', 'Puntos de golpe de barrera': 'barrier',
};
const RES_STATS = new Set<StatKey>(['resWard', 'resMagic', 'resPhysical', 'resMissile', 'resFlame']);

/**
 * "Ataque cuerpo a cuerpo: +5 (Nagash)" / "Atributo: X (Nagash)": el juego lo da como efecto de campaña sin stat,
 * pero es un bufo de batalla para ese personaje. Lo pasamos a batalla, solo para personajes con ese nombre.
 */
function characterScoped(p: ParsedEffect, text: string): ParsedEffect {
  if (p.kind !== 'campaign' || p.target !== 'none' || !text) return p;
  const who = CHAR_SCOPES.find((n) => text.trimEnd().endsWith(`(${n})`));
  if (!who) return p;
  const body = text.trimEnd().slice(0, -`(${who})`.length).trim();
  const attr = /^Atributo:\s*(.+)$/.exec(body);
  if (attr) return { ...p, kind: 'attribute', target: 'chars', attribute: attr[1], forNames: [who] };
  const m = /^([^:]+):\s*([+-]?\d+(?:[.,]\d+)?)(%?)$/.exec(body);
  const stat = m ? STAT_BY_LABEL[m[1].trim()] : undefined;
  if (!m || !stat) return p;
  const value = parseFloat(m[2].replace(',', '.'));
  return { ...p, kind: 'battle', target: 'chars', stat, value, pct: !!m[3] && !RES_STATS.has(stat), exact: false, forNames: [who] };
}

function gameEffect(e: GameEffect, first: boolean, keyText: string): ParsedEffect {
  const x = e.s as GameEffect['s'] & { who?: 'lord' | 'hero' | 'wizard' };
  return limitToNamedUnits(characterScoped({
    who: x.who,
    key: e.k,
    text: first ? e.d : '',
    kind: (x.kind as ParsedEffect['kind']) ?? 'other',
    target: (x.target as ParsedEffect['target']) ?? 'none',
    stat: x.stat as ParsedEffect['stat'],
    value: x.value,
    pct: x.pct,
    rank7: x.rank ? true : undefined,
    rankMin: x.rank,
    unitList: x.u,
    attribute: x.attribute ? translateAttribute(x.attribute) : undefined,
    ability: x.ability,
    disable: x.disable,
    action: x.action,
    exact: true,
    scope: x.target === 'army' ? scopeFromText(keyText) : undefined,
  }, keyText), e.k, keyText);
}

function gameEffects(list: GameEffect[]): ParsedEffect[] {
  let prev = '';
  let keyText = '';
  return list.map((e) => {
    const first = e.k !== prev || !!e.d;
    if (first) keyText = e.d;
    prev = e.k;
    return gameEffect(e, first, keyText);
  });
}

function gameNode(n: GameNode, c: GameCharacter, present: Set<string>): SkillNode {
  const raw = gameFile!.skills[n.s];
  const levels = raw.lv.map((l, i) => {
    const effects = gameEffects(l.e);
    return {
      effects,
      abilities: l.ab ?? [],
      requiredRank: l.ur,
      autoRank: l.ar,
      mountStats: i === 0 ? c.mounts?.[n.s] : undefined,
    };
  });
  return {
    key: n.k,
    skillKey: n.s,
    name: nameEs(n.s, raw.n),
    nameEn: raw.nEn ?? raw.n,
    description: raw.d,
    col: n.t,
    row: n.i,
    pointsOnCreation: n.poc ?? 0,
    background: !!n.bg,
    visible: !n.bg,
    parentsRequired: (n.pr ?? []).filter((p) => present.has(p)),
    parentSubset: (n.psr ?? []).filter((p) => present.has(p)),
    parentSubsetCount: n.rnp ?? 0,
    levels,
    isMount: levels.some((l) => l.mountStats || l.effects.some((e) => e.kind === 'mount')),
    icon: raw.img ? raw.img.split('/').pop() : undefined,
    // En el juego muchos hechizos del árbol (Nurgle, Tzeentch, Slaanesh...) traen la imagen del Saber de las Fauces;
    // el icono correcto es el de la habilidad de batalla que da el nodo (frontend/public/abilities)
    abilityIcon: levels.flatMap((l) => l.abilities).map((k) => abilities[k]).find((a) => a?.spell && a.icon)?.icon,
    autoActive: n.bg ? !!n.auto : undefined,
  };
}

// Grupos de habilidades excluyentes (data/exclusivas.json)
interface ExclusiveFile { grupos: { nombre: string; max?: number; skills: string[] }[] }
const exclusiveDefs: ExclusiveFile['grupos'] = existsSync(join(DATA_DIR, 'exclusivas.json'))
  ? readJson<ExclusiveFile>('exclusivas.json').grupos ?? []
  : [];

// Bloqueos oficiales del juego (db.pack: character_skill_nodes_skill_locks):
// el nodo queda bloqueado si el personaje tiene la habilidad "skill" al nivel "level" o más.
interface LockRow { skill: string; node: string; level: number }
const lockRows: LockRow[] = gameFile ? gameFile.locks : existsSync(join(DATA_DIR, 'raw', 'wh3_skill_locks.json'))
  ? readJson<{ locks: LockRow[] }>('raw/wh3_skill_locks.json').locks
  : [];
const locksByNode = new Map<string, { skill: string; level: number }[]>();
for (const l of lockRows) locksByNode.set(l.node, [...(locksByNode.get(l.node) ?? []), { skill: l.skill, level: l.level }]);

function locksFor(nodes: SkillNode[]): Record<string, { skill: string; level: number }[]> {
  const out: Record<string, { skill: string; level: number }[]> = {};
  const skillsHere = new Set(nodes.map((n) => n.skillKey));
  for (const n of nodes) {
    const l = (locksByNode.get(n.key) ?? []).filter((x) => skillsHere.has(x.skill));
    if (l.length) out[n.key] = l;
  }
  return out;
}

/** Grupos "elige 1" deducidos de los bloqueos mutuos (para etiquetas y textos de ayuda). */
function groupsFromLocks(nodes: SkillNode[], locks: Record<string, { skill: string; level: number }[]>): ExclusiveGroup[] {
  const bySkill = new Map(nodes.map((n) => [n.skillKey, n.key]));
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const members = new Set<string>();
  for (const [node, ls] of Object.entries(locks)) {
    for (const l of ls) {
      const other = bySkill.get(l.skill);
      if (!other || other === node) continue;
      union(node, other);
      members.add(node);
      members.add(other);
    }
  }
  const comps = new Map<string, string[]>();
  for (const m of members) comps.set(find(m), [...(comps.get(find(m)) ?? []), m]);
  return [...comps.values()].filter((g) => g.length >= 2).map((g) => ({ name: 'Excluyentes del juego', max: 1, nodes: g }));
}

function exclusiveGroupsFor(nodes: SkillNode[]): ExclusiveGroup[] {
  const out: ExclusiveGroup[] = [];
  for (const g of exclusiveDefs) {
    const present = nodes.filter((n) => g.skills.includes(n.skillKey)).map((n) => n.key);
    if (present.length >= 2) out.push({ name: g.nombre, max: g.max ?? 1, nodes: present });
  }
  return out;
}

// ---------- Nombre de cada fila del árbol ----------
type NodeCat = 'mount' | 'magic' | 'actions' | 'army' | 'combat' | 'campaign';

function nodeCategory(n: SkillNode): NodeCat {
  if (n.isMount) return 'mount';
  const effects = n.levels.flatMap((l) => l.effects);
  const abil = n.levels.flatMap((l) => l.abilities).map((k) => abilities[k]).filter(Boolean);
  const spell = effects.some((e) => (e.textEn && /^(Spell|Overcast spell|Bound spell)/i.test(e.textEn)) || (e.ability && abilities[e.ability]?.spell));
  if (spell || (effects.length && effects.every((e) => e.kind === 'magic' || e.kind === 'ability') && effects.some((e) => e.kind === 'magic'))) return 'magic';
  if (effects.some((e) => e.action || (e.textEn && / action\b/i.test(e.textEn)))) return 'actions';
  const army = effects.filter((e) => (e.kind === 'battle' || e.kind === 'attribute') && e.target === 'army').length + abil.filter((a) => a.mode === 'allies').length;
  const self = effects.filter((e) => (e.kind === 'battle' || e.kind === 'attribute') && e.target === 'self').length + abil.filter((a) => a.mode === 'self' || a.mode === 'enemies').length;
  const camp = effects.filter((e) => e.kind === 'campaign').length;
  if (army > 0 && army >= self && army >= camp) return 'army';
  if (self > 0 && self >= camp) return 'combat';
  return 'campaign';
}

const ROW_LABELS: Record<NodeCat, string> = {
  mount: 'Monturas y básicas',
  magic: 'Magia',
  actions: 'Acciones de héroe',
  army: 'Bufos al ejército',
  combat: 'Combate personal',
  campaign: 'Campaña',
};

// Habilidades genéricas de combate personal (Deadly Blade, Hard to Hit, Wound-Maker...)
const GENERIC_COMBAT = /_self_|deadly_blade|hard_to_hit|thick_skinned|wound-?maker|blade_master|devastating_charge|scarred_veteran/;

function rowLabel(row: SkillNode[], index: number, groups: ExclusiveGroup[]): string {
  const visible = row.filter((n) => n.visible);
  if (!visible.length) return '';
  // La primera fila del juego: monturas y habilidades de inicio
  if (index === 0) return visible.some((n) => n.isMount) ? ROW_LABELS.mount : 'Básicas del personaje';
  if (groups.some((g) => visible.filter((n) => g.nodes.includes(n.key)).length >= 2)) return 'Especialidad (elige 1)';
  const counts = new Map<NodeCat, number>();
  for (const n of visible) counts.set(nodeCategory(n), (counts.get(nodeCategory(n)) ?? 0) + 1);
  const [best, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominant = count / visible.length >= 0.5;
  if (dominant && (best === 'magic' || best === 'actions' || best === 'army')) return ROW_LABELS[best];
  const genericCombat = visible.filter((n) => GENERIC_COMBAT.test(n.skillKey)).length >= 2;
  if (dominant && best === 'combat' && genericCombat) return ROW_LABELS.combat;
  // La segunda fila del juego es la de habilidades propias del personaje
  if (index === 1) return 'Únicas del personaje';
  if (dominant && best === 'combat') return visible.some((n) => GENERIC_COMBAT.test(n.skillKey)) ? ROW_LABELS.combat : 'Únicas del personaje';
  if (dominant && best === 'campaign') return ROW_LABELS.campaign;
  return 'Únicas del personaje';
}

// En cuántos personajes aparece cada rasgo innato (los únicos suelen ser del legendario)
const innateCount = new Map<string, number>();
if (gameFile) {
  for (const c of gameFile.characters) for (const n of c.bg) if (!n.auto) innateCount.set(n.s, (innateCount.get(n.s) ?? 0) + 1);
} else {
  for (const c of skillsFile.characters) for (const n of c.bg) if (n) innateCount.set(n.s, (innateCount.get(n.s) ?? 0) + 1);
}

function assemble(
  base: { key: string; name: string; nameEn?: string; type: 'lord' | 'hero'; legendary: boolean; faction?: string },
  rows: SkillNode[][], background: SkillNode[], stats: CharacterStats | null,
): CharacterTree {
  const innates = background.filter((b) => !b.autoActive);
  // Rasgo por defecto: si solo hay uno, ese; si es legendario, el que lleva su nombre o es único de él
  let defaultInnate: string | null = innates.length === 1 ? innates[0].key : null;
  if (!defaultInnate && base.legendary) {
    const own = innates.find((b) => (innateCount.get(b.skillKey) ?? 0) === 1 && !/_(khorne|nurgle|all)_\d+$|_all_/.test(b.skillKey));
    defaultInnate = own?.key ?? null;
  }
  for (const n of rows.flat()) n.category = nodeCategory(n);
  const locks = locksFor(rows.flat());
  const exclusiveGroups = [...groupsFromLocks(rows.flat(), locks), ...exclusiveGroupsFor(rows.flat())];
  return {
    ...base,
    locks,
    rows,
    rowLabels: rows.map((r, i) => rowLabel(r, i, exclusiveGroups)),
    background,
    defaultInnate,
    exclusiveGroups,
    stats,
  };
}

const trees = new Map<string, CharacterTree>();
const summaries: CharacterSummary[] = [];
/**
 * El señor legendario de cada facción de campaña siempre sale en su facción, aunque su árbol diga otra subcultura:
 * Neferata (La Hermandad de Lahmias) y Mannfred (El cónclave de Drakenhof) tienen el árbol solo de las Legiones No Muertas,
 * pero el juego los pone como líderes de facciones de los Condes Vampiro. Se hace al primer uso (las unidades se cargan después).
 */
let leadersAdded = false;
function addCampaignLeaders() {
  if (leadersAdded || !gameFile) return;
  leadersAdded = true;
  const bySubtype = new Map<string, GameCharacter[]>();
  for (const c of gameFile.characters) bySubtype.set(c.subtype, [...(bySubtype.get(c.subtype) ?? []), c]);
  for (const row of allUnitsFile?.campaign ?? []) {
    for (const leader of row.leaders) {
      for (const c of bySubtype.get(leader) ?? []) if (!c.subcultures.includes(row.subculture)) c.subcultures.push(row.subculture);
    }
  }
}
const gameChars = new Map((gameFile?.characters ?? []).map((c) => [c.key, c]));

if (!gameFile) {
  const files: { file: SkillsFile; faction: string }[] = [
    { file: skillsFile, faction: DEFAULT_FACTION },
  ];
  for (const { file, faction } of files) {
    for (const c of file.characters as (SkillsFile['characters'][number] & { legendary?: boolean })[]) {
      const legendary = c.legendary ?? !GENERIC.test(c.name);
      const node = (n: RawNode) => toNode(n, file);
      // Algunos nodos de fondo del planner vienen sin niveles (p. ej. escalado de Astragoth): no aportan nada
      const background = c.bg.filter((n): n is RawNode => !!n && (file.skills[n.s]?.lv.length ?? 0) > 0).map(node);
      for (const b of background) b.autoActive = /\[HIDDEN\]/i.test(b.name);
      const rows = c.rows.map((r) => r.filter((n): n is RawNode => !!n).map(node));
      const tree = assemble(
        { key: c.key, name: nameEs(c.key, officialCharacterName(c.key) ?? characterNameEs(c.name)), nameEn: c.name, type: c.type, legendary, faction },
        rows, background, c.stats,
      );
      trees.set(c.key, tree);
      summaries.push({ key: c.key, name: tree.name, nameEn: c.name, type: c.type, legendary, faction });
    }
  }
}

/**
 * Cuántos personajes distintos pueden llevar cada objeto (por unidad: Bloab señor y Bloab héroe son uno). Los de misión son de uno solo; los que salen de
 * ancillaries_included_agent_subtypes son los que el juego deja equipar a esos subtipos, pero se consiguen en campaña
 * (p. ej. la forja de Ikit o los objetos de Nurgle que comparten 8 personajes).
 */
let ownersCache: Map<string, number> | null = null;
function itemOwners(): Map<string, number> {
  if (ownersCache) return ownersCache;
  const subs = new Map<string, Set<string>>();
  for (const c of gameFile?.characters ?? []) for (const i of c.items ?? []) {
    if (!subs.has(i.k)) subs.set(i.k, new Set());
    subs.get(i.k)!.add(c.unit || c.subtype);
  }
  ownersCache = new Map([...subs].map(([k, s]) => [k, s.size]));
  return ownersCache;
}

/** Id del personaje en una facción: la clave sola si es su facción propia, o "clave@facción". */
function charId(c: GameCharacter, faction: string): string {
  return faction === c.home ? c.key : `${c.key}@${faction}`;
}

function buildGameTree(c: GameCharacter, faction: string): CharacterTree {
  // Nodos que aplican en esa facción y en la campaña de Imperios Inmortales
  const keep = (n: GameNode) => (!n.sc || n.sc === faction) && (!n.ck || n.ck === 'wh3_main_combi');
  // La versión propia de la facción ocupa el lugar de la genérica (misma fila y columna): si no, salen las dos
  // (p. ej. "Los Muertos Incansables" doble en la fila de campaña de las Legiones No Muertas)
  const own = new Set(c.nodes.filter((n) => keep(n) && n.sc).map((n) => `${n.i}|${n.t}`));
  const nodes = c.nodes.filter((n) => keep(n) && (n.sc || !own.has(`${n.i}|${n.t}`)));
  const present = new Set(nodes.map((n) => n.k));
  const byRow = new Map<number, GameNode[]>();
  for (const n of nodes) byRow.set(n.i, [...(byRow.get(n.i) ?? []), n]);
  const rows = [...byRow.keys()].sort((a, b) => a - b).map((i) => byRow.get(i)!.sort((a, b) => a.t - b.t).map((n) => gameNode(n, c, present)));
  const background = c.bg.filter(keep).map((n) => gameNode(n, c, present));
  const tree = assemble(
    { key: charId(c, faction), name: factionNames(faction).get(c.key) ?? c.name, nameEn: c.nameEn, type: c.type, legendary: c.legendary, faction },
    rows, background, c.stats,
  );
  if (c.items?.length) {
    tree.items = c.items
      .filter((i) => gameFile!.ancillaries?.[i.k])
      .map((i): ItemInfo => {
        const a = gameFile!.ancillaries![i.k];
        return {
          key: i.k, name: a.n, description: a.d, category: a.cat, rank: i.rank, questBattle: i.quest, effects: gameEffects(a.e),
          owners: itemOwners().get(i.k) ?? 1,
        };
      });
    const mine = new Set(tree.items.map((i) => i.key));
    tree.itemSets = (gameFile!.itemSets ?? [])
      .filter((st) => st.items.every((k) => mine.has(k)))
      .map((st) => ({ key: st.key, name: st.n, items: st.items, effects: gameEffects(st.e) }));
  }
  if (c.spellSlots?.length) {
    // Hechizos de Kairos: en cada espacio (común/poco común/raro) eliges el saber; se aplican como objetos equipados
    const skillName = (sk: string) => gameFile!.skills[sk]?.n ?? sk;
    tree.spellSlots = c.spellSlots.map((s) => ({
      key: s.k, name: s.n, rarity: s.r, unlockSkill: s.by, unlockSkillName: skillName(s.by), unlockEffect: s.ef,
      options: s.opts.map((o) => ({ key: o.k, lore: o.lore, loreKey: o.lk, name: o.n, effects: gameEffects(o.e) })),
    }));
    tree.items = [
      ...(tree.items ?? []),
      ...tree.spellSlots.flatMap((s) => s.options.map((o): ItemInfo => ({ key: o.key, name: `${o.name} (${o.lore})`, category: 'spell_slot', effects: o.effects }))),
    ];
  }
  if (c.initiatives?.length) {
    // Iniciativas del personaje: los dones se eligen (hasta "max"); las devociones/ascensos solo se informan
    tree.initiativeSets = c.initiatives.map((s) => ({
      key: s.k, category: s.cat, name: s.n, max: s.max ?? 0, selectable: s.cat !== 'PATH_TO_GLORY_MARK',
      items: s.items.map((i) => ({ key: i.k, name: i.n, requirement: i.req, locked: !!i.locked, effects: gameEffects(i.e) })),
    }));
    tree.items = [
      ...(tree.items ?? []),
      ...tree.initiativeSets.filter((s) => s.selectable).flatMap((s) => s.items.map((i): ItemInfo => ({ key: i.key, name: i.name, category: 'char_initiative', effects: i.effects }))),
    ];
  }
  if (c.armory) {
    // Dones (piezas) de Daniel: se aplican como objetos equipados; los conjuntos completos dan su bonificación
    const ar = c.armory;
    const items = ar.items.map((i) => ({
      key: i.k, slot: i.s, name: i.n, description: i.d, god: i.g, style: i.st, cats: i.c ?? [], blocksSlots: i.bs ?? [],
      effects: gameEffects(i.e),
    }));
    const sets = ar.sets.map((st) => ({ key: st.k, name: st.n, description: st.d, items: st.items, effects: gameEffects(st.e) }));
    tree.armory = { slots: ar.slots.map((s) => ({ key: s.k, name: s.n, order: s.o, mandatory: !!s.m })), items, sets, defaults: ar.def, blacklist: ar.black };
    tree.items = [...(tree.items ?? []), ...items.map((i): ItemInfo => ({ key: i.key, name: i.name, description: i.description, category: 'armory', effects: i.effects }))];
    tree.itemSets = [...(tree.itemSets ?? []), ...sets.map((st) => ({ key: st.key, name: st.name, items: st.items, effects: st.effects }))];
  }
  return tree;
}

/** Facciones con árboles (las 25 del juego si extrajiste tus datos; si no, solo Guerreros del Caos). */
export function listCharacterFactions(): { key: string; name: string; flag?: string }[] {
  if (!gameFile) {
    return skillsFile.characters.length ? [{ key: DEFAULT_FACTION, name: 'Guerreros del Caos' }] : [];
  }
  // Bandera de una facción representativa (copiada del juego por npm run extraer)
  const flags = new Map((allUnitsFile?.subcultures ?? []).map((s) => [s.key, s.flag]));
  return [...gameFile.subcultures].map((s) => ({ ...s, flag: flags.get(s.key) })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Nombres únicos dentro de una facción: si dos árboles se llaman igual (dinastías de Reyes Funerarios,
 * Slann de horda...), se agrega lo que distingue a su clave ("Rey Funerario · Alkhazzar II").
 */
const namesByFaction = new Map<string, Map<string, string>>();
function factionNames(f: string): Map<string, string> {
  addCampaignLeaders();
  if (namesByFaction.has(f)) return namesByFaction.get(f)!;
  const chars = gameFile!.characters.filter((c) => c.subcultures.includes(f));
  const groups = new Map<string, GameCharacter[]>();
  for (const c of chars) {
    const n = nameEs(c.key, c.name);
    groups.set(n, [...(groups.get(n) ?? []), c]);
  }
  const IGNORE = new Set(['wh', 'wh2', 'wh3', 'main', 'skill', 'node', 'set', 'dlc', 'cha', 'lord', 'hero', 'legendary', '0', '1']);
  const out = new Map<string, string>();
  for (const [name, list] of groups) {
    if (list.length === 1) { out.set(list[0].key, name); continue; }
    const toks = list.map((c) => c.key.split(/[_]+/).filter((t) => !IGNORE.has(t) && !/^(dlc|pro|twa|cp)\d+$/.test(t)));
    list.forEach((c, i) => {
      const mine = toks[i].filter((t) => toks.some((o, j) => j !== i && !o.includes(t)));
      const extra = mine.map((t) => (t === 'horde' ? 'horda' : t)).join(' ').replace(/\b\w/g, (m) => m.toUpperCase());
      out.set(c.key, extra ? `${name} · ${extra}` : name);
    });
  }
  namesByFaction.set(f, out);
  return out;
}

export function listCharacters(faction?: string): CharacterSummary[] {
  addCampaignLeaders();
  if (!gameFile) return summaries.filter((s) => s.faction === (faction || DEFAULT_FACTION));
  const f = faction || DEFAULT_FACTION;
  const names = factionNames(f);
  return gameFile.characters
    .filter((c) => c.subcultures.includes(f))
    .map((c) => ({ key: charId(c, f), name: names.get(c.key) ?? c.name, nameEn: c.nameEn, type: c.type, legendary: c.legendary, faction: f }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function getCharacter(key: string): CharacterTree | undefined {
  addCampaignLeaders();
  if (!gameFile) return trees.get(key);
  const cached = trees.get(key);
  if (cached) return cached;
  const [base, faction] = key.split('@');
  const c = gameChars.get(base);
  if (!c) return undefined;
  const f = faction && c.subcultures.includes(faction) ? faction : c.home;
  const tree = buildGameTree(c, f);
  trees.set(key, tree);
  return tree;
}

// ---------- Tecnologías (datos del juego) ----------
export interface TechNode {
  key: string; tech: string; name: string; description?: string; icon?: string; col: number; row: number;
  cost?: number; parents: string[]; parentsNeeded: number; requires: string[]; battle: boolean; effects: ParsedEffect[];
}
export interface TechTree { key: string; name: string; variant?: string; variants: { fk: string; name: string }[]; nodes: TechNode[]; minRow: number }

const techCache = new Map<string, ParsedEffect[]>();
export function techEffects(tech: string): { name: string; effects: ParsedEffect[] } | null {
  const t = gameFile?.techs?.[tech];
  if (!t) return null;
  if (!techCache.has(tech)) techCache.set(tech, gameEffects(t.e));
  return { name: t.n, effects: techCache.get(tech)! };
}

/** Árboles de tecnología de una facción (la genérica y los de facciones concretas, como Azazel o Be'lakor). */
export function listTechTrees(faction: string): { key: string; name: string; variants: { fk: string; name: string }[] }[] {
  return (gameFile?.techTrees ?? [])
    .filter((t) => t.subcultures.includes(faction))
    .map((t) => ({ key: t.key, name: t.name, variants: t.variants.filter((v) => !v.sc || v.sc === faction).map(({ fk, name }) => ({ fk, name })) }));
}

// ---------- Resumen acumulado de tecnologías / nodos investigados ----------
export interface TechSummaryLine { text: string; kind: string; count: number }
/**
 * Junta los efectos repetidos de lo investigado: "Armadura: +2 a infantería" ×3 -> "Armadura: +6 a infantería".
 * Agrupa por el texto con el primer número quitado y suma ese número.
 */
export function techSummary(techs: string[]): { battle: TechSummaryLine[]; magic: TechSummaryLine[]; campaign: TechSummaryLine[]; count: number } {
  const groups = new Map<string, { kind: string; tpl: string; sum: number; pct: boolean; count: number; hasNum: boolean; decimals: number }>();
  let count = 0;
  for (const t of techs) {
    const te = techEffects(t);
    if (!te) continue;
    count++;
    for (const e of te.effects) {
      if (!e.text) continue;
      const kind = e.kind === 'battle' || e.kind === 'attribute' ? 'battle' : e.kind === 'magic' ? 'magic' : 'campaign';
      const m = /([+-]?)(\d+(?:[.,]\d+)?)(\s*%)?/.exec(e.text);
      const tpl = m ? e.text.slice(0, m.index) + '{n}' + e.text.slice(m.index + m[0].length) : e.text;
      const k = `${kind}|${tpl}`;
      const g = groups.get(k) ?? { kind, tpl, sum: 0, pct: !!m?.[3], count: 0, hasNum: !!m, decimals: 0 };
      if (m) {
        const v = parseFloat(m[2].replace(',', '.')) * (m[1] === '-' ? -1 : 1);
        g.sum += v;
        g.decimals = Math.max(g.decimals, (m[2].split(/[.,]/)[1] ?? '').length);
      }
      g.count++;
      groups.set(k, g);
    }
  }
  const out = { battle: [] as TechSummaryLine[], magic: [] as TechSummaryLine[], campaign: [] as TechSummaryLine[], count };
  for (const g of groups.values()) {
    if (g.hasNum && Math.abs(g.sum) < 1e-9) continue; // se cancelan (p. ej. +1 y -1 de Autoridad)
    const n = g.sum.toFixed(g.decimals).replace(/\.0+$/, '');
    const text = g.hasNum ? g.tpl.replace('{n}', `${g.sum > 0 ? '+' : ''}${n}${g.pct ? '%' : ''}`) : g.tpl;
    (out as unknown as Record<string, TechSummaryLine[]>)[g.kind].push({ text, kind: g.kind, count: g.count });
  }
  for (const list of [out.battle, out.magic, out.campaign]) list.sort((a, b) => a.text.localeCompare(b.text, 'es'));
  return out;
}

// ---------- Grafos de iniciativas (Pirámide Negra de las Legiones No Muertas) ----------
interface GameGraph {
  key: string; name: string; subcultures: string[]; origin: string; originActive: boolean;
  nodes: { k: string; tech: string; x: number; y: number; type?: string; cl?: string; pr?: string[]; th?: number }[];
  clusters: Record<string, { n: string; d?: string; sc?: string; order?: number }>;
}
export interface GraphNode {
  key: string; tech: string; name: string; description?: string; icon?: string; x: number; y: number; type?: string;
  cluster?: string; parents: string[]; threshold?: number; cost: number; battle: boolean; effects: ParsedEffect[];
}
export interface GraphData { key: string; name: string; origin: string; originActive: boolean; nodes: GraphNode[]; clusters: GameGraph['clusters'] }

/** Grafos de una facción (los nodos se investigan como tecnologías: van en army.techs con la clave de la iniciativa). */
export function listGraphs(faction: string): { key: string; name: string }[] {
  return (gameFile?.graphs ?? []).filter((g) => g.subcultures.includes(faction)).map((g) => ({ key: g.key, name: g.name }));
}

export function getGraph(key: string): GraphData | undefined {
  const g = gameFile?.graphs?.find((x) => x.key === key);
  if (!g) return undefined;
  const nodes = g.nodes.map((n): GraphNode => {
    const def = gameFile!.techs![n.tech] as GameTech & { cost?: number };
    const effects = techEffects(n.tech)?.effects ?? [];
    return {
      key: n.k, tech: n.tech, name: def?.n ?? n.tech, description: def?.d, icon: def?.img, x: n.x, y: n.y, type: n.type,
      cluster: n.cl, parents: n.pr ?? [], threshold: n.th, cost: def?.cost ?? 1,
      battle: effects.some((e) => e.kind === 'battle' || e.kind === 'attribute'), effects,
    };
  });
  return { key: g.key, name: g.name, origin: g.origin, originActive: g.originActive, nodes, clusters: g.clusters };
}

export function getTechTree(key: string, variant?: string): TechTree | undefined {
  const t = gameFile?.techTrees?.find((x) => x.key === key);
  if (!t) return undefined;
  // Variante de facción: sus nodos propios reemplazan a los genéricos que ocupan la misma casilla
  const own = t.nodes.filter((n) => variant && n.fk === variant);
  const taken = new Set(own.map((n) => `${n.t}|${n.i}`));
  const nodes = [...t.nodes.filter((n) => !n.fk && !taken.has(`${n.t}|${n.i}`)), ...own];
  const present = new Set(nodes.map((n) => n.k));
  const techToNode = new Map(nodes.map((n) => [n.tech, n.k]));
  const out: TechNode[] = nodes.map((n) => {
    const def = gameFile!.techs![n.tech];
    const effects = techEffects(n.tech)!.effects;
    const parents = (n.pr ?? []).filter((p) => present.has(p));
    return {
      key: n.k, tech: n.tech, name: def.n, description: def.d, icon: def.img, col: n.t, row: n.i, cost: n.rp,
      parents, parentsNeeded: n.need || parents.length,
      requires: (def.req ?? []).map((r) => techToNode.get(r)).filter((x): x is string => !!x),
      battle: effects.some((e) => e.kind === 'battle' || e.kind === 'attribute'),
      effects,
    };
  });
  return {
    key: t.key, name: t.name, variant, variants: t.variants.map(({ fk, name }) => ({ fk, name })),
    nodes: out, minRow: Math.min(...out.map((n) => n.row)),
  };
}

// ---------- Unidades ----------
// Roster viejo del Caos (twwstats): solo si no hay datos del juego y el archivo sigue ahí
const units = new Map<string, UnitData>();
const prepUnit = (u: UnitData): UnitData => ({
  ...u,
  nameEn: u.name,
  name: officialUnitName(u.key) ?? nameEs(u.card, u.name),
  casteEs: CASTES[u.caste] ?? u.caste,
  attrs: u.attrs.map(translateAttribute),
});
for (const u of unitsFile.units) units.set(u.card, prepUnit(u));
const chaosUnits = [...units.values()];

/** Roster del Caos del modo sin datos del juego */
export function listUnits(): UnitData[] {
  return chaosUnits;
}

export function getUnit(card: string): UnitData | undefined {
  // Por clave de unidad; las cartas viejas (ejércitos guardados con datos de twwstats) también se reconocen
  return units.get(card) ?? allByKey.get(card) ?? allByCard.get(card);
}

// ---------- Unidades de TODAS las facciones (se generan con npm run extraer) ----------
/** Facción de campaña jugable: quién la lidera, qué recluta y qué consigue con mejoras (unidad -> rango requerido) */
interface CampaignRow { key: string; name: string; subculture: string; leaders: string[]; units: string[]; upgrades?: Record<string, number>; buildings?: Record<string, string[]> }
interface AllUnitsFile {
  source: string; subcultures: { key: string; name: string; flag?: string }[];
  units: (UnitData & { subcultures: string[]; casteKey?: string; uiGroup?: string; campOnly?: boolean })[];
  campaign?: CampaignRow[];
  /** Puntos fuertes/débiles: nombre, ayuda, estado (positive/negative/very_...) y orden */
  bulletDefs?: Record<string, { n: string; t?: string; s: string; o: number }>;
  /** Grupo de la interfaz (infantry, commander...) -> icono oficial de categoría */
  groupIcons?: Record<string, string>;
  /** Tablas de veteranía del juego, tal cual (npm run extraer); falta en extracciones viejas */
  experience?: { unit_experience_bonuses?: ExperienceBonus[] } & Record<string, Record<string, unknown>[] | undefined>;
}
const allUnitsFile: AllUnitsFile | null = existsSync(join(DATA_DIR, 'raw', 'wh3_all_units.json'))
  ? readJson<AllUnitsFile>('raw/wh3_all_units.json')
  : null;

/** Fila de unit_experience_bonuses: cuánto sube una stat con la veteranía */
export interface ExperienceBonus { stat: string; value: number; growth_rate: number; growth_scalar: number }

/** Bonificaciones de veteranía del juego; vacío si los datos son de antes de extraerlas. */
export function experienceBonuses(): ExperienceBonus[] {
  return allUnitsFile?.experience?.unit_experience_bonuses ?? [];
}

// Grupo del panel de ejército: el del juego (ui_unit_groupings) o, si no viene, según el tipo de unidad
const GROUP_BY_UI: Record<string, string> = {
  infantry: 'Infantry', missile_infantry: 'Missile Infantry', cavalry_chariots: 'Cavalry & Chariots',
  missile_cavalry_chariots: 'Missile Cavalry & Chariots', monster_beasts: 'Monsters & Beasts',
  missile_monster_beasts: 'Missile Monsters & Beasts', artillery_war_machines: 'Artillery & War Machines',
  flying_war_machine: 'Artillery & War Machines',
  commander: 'Lords', heroes_agents: 'Heroes',
};
/** Icono oficial de cada grupo del roster (Infantry, Lords...), de ui_unit_groupings; vacío en extracciones viejas */
export const groupIcons: Record<string, string> = {};
for (const [ui, icon] of Object.entries(allUnitsFile?.groupIcons ?? {})) if (GROUP_BY_UI[ui] && !groupIcons[GROUP_BY_UI[ui]]) groupIcons[GROUP_BY_UI[ui]] = icon;
const GROUP_BY_CASTE: Record<string, string> = {
  melee_infantry: 'Infantry', monstrous_infantry: 'Infantry', missile_infantry: 'Missile Infantry',
  melee_cavalry: 'Cavalry & Chariots', monstrous_cavalry: 'Cavalry & Chariots', chariot: 'Cavalry & Chariots',
  missile_cavalry: 'Missile Cavalry & Chariots', monster: 'Monsters & Beasts', war_beast: 'Monsters & Beasts',
  warmachine: 'Artillery & War Machines', generic: 'Infantry', lord: 'Lords', hero: 'Heroes',
};

/** Unidad del juego en el formato del roster (id = clave de unidad; la carta queda en cardArt). */
function asRosterUnit(u: AllUnitsFile['units'][number]): UnitData & { subcultures: string[] } {
  return {
    ...u,
    card: u.key,
    cardArt: u.card,
    // "art" lo pone npm run extraer cuando la carta propia no existe (retrato del personaje o carta de la unidad base)
    art: artOf((u as { art?: string }).art) ?? artOf(u.card),
    nameEn: u.name,
    casteEs: u.caste,
    caste: u.casteKey ?? u.caste,
    category: u.casteKey ?? '',
    group: GROUP_BY_UI[u.uiGroup ?? ''] ?? GROUP_BY_CASTE[u.casteKey ?? ''] ?? 'Infantry',
    tier: u.tier ?? 0, campaignOnly: !!u.campOnly, mounts: u.mounts ?? 0, entity: '', barrier: 0,
    attrs: u.attrs.map(translateAttribute),
  };
}
const allByKey = new Map((allUnitsFile?.units ?? []).map((u) => [u.key, asRosterUnit(u)]));
const allByCard = new Map<string, UnitData>();
for (const u of allUnitsFile?.units ?? []) if (!allByCard.has(u.card)) allByCard.set(u.card, allByKey.get(u.key)!);

export function listSubcultures() {
  return allUnitsFile?.subcultures ?? [];
}

/** Arte de la carta de la unidad de un personaje (por su clave de unidad) */
export function artOfUnit(unitKey?: string): string | undefined {
  return unitKey ? allByKey.get(unitKey)?.art : undefined;
}

export function listTargets(subculture: string): UnitData[] {
  if (!allUnitsFile) return subculture === DEFAULT_FACTION ? chaosUnits : [];
  return [...allByKey.values()].filter((u) => u.subcultures.includes(subculture));
}

/** Roster para armar el ejército: todas las unidades que la facción tiene en el juego (sin señores ni héroes). */
export function listRoster(faction?: string): UnitData[] {
  if (!allUnitsFile) return listUnits();
  return listTargets(faction || DEFAULT_FACTION).filter((u) => u.caste !== 'lord' && u.caste !== 'hero');
}

/**
 * Facciones de campaña jugables de una subcultura (datos del juego): sus señores legendarios (ids de personaje),
 * las unidades que puede reclutar, las que consigue con mejoras de unidad (Mejoras de Banda del Caos) y las que solo
 * consigue con un edificio porque la reserva de su subcultura se la da a otra facción (unidad -> edificios).
 */
export function listCampaign(subculture: string): { key: string; name: string; flag?: string; leaders: string[]; units: string[]; upgrades: Record<string, number>; buildings: Record<string, string[]> }[] {
  return (allUnitsFile?.campaign ?? [])
    .filter((c) => c.subculture === subculture)
    .map((c) => {
      const { units, buildings } = c.buildings ? { units: c.units, buildings: c.buildings } : lockedFromDiag(c);
      return {
        key: c.key,
        name: c.name,
        flag: c.key,
        leaders: (gameFile?.characters ?? []).filter((ch) => c.leaders.includes(ch.subtype) && ch.subcultures.includes(subculture)).map((ch) => charId(ch, subculture)),
        units: units.filter((k) => allByKey.has(k)),
        upgrades: c.upgrades ?? {},
        buildings,
      };
    });
}

// Extracciones sin "buildings" en la campaña: la misma regla con el volcado diag_roster_<subcultura>.json, si está.
// Ahí no viene el nombre del edificio en español, así que se muestra su clave hasta re-extraer.
const diagRoster = new Map<string, (RosterTables & { factions: { key: string }[] }) | null>();
function lockedFromDiag(c: CampaignRow): { units: string[]; buildings: Record<string, string[]> } {
  if (!diagRoster.has(c.subculture)) {
    const f = join(DATA_DIR, 'raw', `diag_roster_${c.subculture}.json`);
    diagRoster.set(c.subculture, existsSync(f) ? readJson(`raw/diag_roster_${c.subculture}.json`) : null);
  }
  const d = diagRoster.get(c.subculture);
  if (!d) return { units: c.units, buildings: {} };
  const locked = lockedToOtherFaction(d, c.key, c.subculture, new Set(d.factions.map((f) => f.key)), c.units);
  const buildings = Object.fromEntries([...locked].filter(([, b]) => b.length));
  return { units: c.units.filter((u) => !locked.has(u) || locked.get(u)!.length), buildings };
}

/** Busca un objetivo por clave de unidad (todas las facciones) o por carta. */
export function getTarget(id: string): UnitData | undefined {
  return units.get(id) ?? allByKey.get(id) ?? allByCard.get(id);
}

/** Quita las marcas de imagen/color del juego ([[img:...]][[/img]], [[col:...]]) de un texto */
function cleanGameText(t?: string): string | undefined {
  if (!t) return t;
  return t.replace(/\[\[img:[^\]]*\]\]\[\[\/img\]\]/g, '').replace(/\[\[\/?[a-z]+(:[^\]]*)?\]\]/gi, '').replace(/\s+/g, ' ').trim();
}

/** Ficha de un objetivo para la tabla de DPS: tipo, stats defensivos, descripción y puntos fuertes/débiles del juego */
export function targetInfo(id: string) {
  const u = getTarget(id);
  if (!u) return undefined;
  return {
    group: u.group,
    caste: u.casteEs ?? u.caste,
    size: u.size,
    large: !['small', 'very_small', ''].includes(u.size ?? ''),
    cost: u.cost,
    tier: u.tier,
    models: u.models,
    hpPerModel: u.hpPerModel,
    md: u.md,
    armour: u.armour,
    ld: u.leadership,
    speed: u.speed,
    res: u.res,
    desc: cleanGameText(u.desc),
    attrs: u.attrs ?? [],
    bullets: bulletsInfo(u.bullets),
    icon: (u as UnitData & { icon?: string }).icon,
    catIcon: (u as UnitData & { catIcon?: string }).catIcon,
    art: u.art ?? artOf(u.cardArt ?? u.card),
  };
}

/** Puntos fuertes/débiles de la carta (claves del juego -> nombre, ayuda y si es bueno) */
export function bulletsInfo(keys?: string[]) {
  const defs = allUnitsFile?.bulletDefs ?? {};
  return (keys ?? []).filter((k) => defs[k]).map((k) => ({ name: defs[k].n, tip: cleanGameText(defs[k].t), good: !defs[k].s.includes('negative') }));
}

export const sources = {
  gameTrees: gameFile ? gameFile.characters.length : 0,
  allUnits: allUnitsFile ? allUnitsFile.units.length : 0,
  officialLoc: officialCount(),
  skills: gameFile ? `${gameFile.source}: ${gameFile.characters.length} señores y héroes` : `${skillsFile.source} (extraído ${skillsFile.extracted})`,
  units: allUnitsFile ? `${allUnitsFile.source}: ${allUnitsFile.units.length} unidades` : `${unitsFile.source} (extraído ${unitsFile.extracted})`,
  faction: skillsFile.faction,
  /** Falta correr npm run extraer (o copiar los datos del juego a esta computadora) */
  missingGameData: !gameFile || !allUnitsFile,
};
