import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEffect } from './effects.js';
import {
  ABILITY_TYPES, CASTES, loadOfficialLoc, officialAbilityName, officialSkillDesc, officialSkillName, officialUnitName,
  officialCount, translateAbilityStat, translateAttribute, translateEffect,
} from './i18n.js';
import type {
  AbilityInfo, CharacterSummary, CharacterTree, ExclusiveGroup, RawAbility, RawNode, SkillNode, SkillsFile, UnitData, UnitsFile,
} from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', 'data');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}

const skillsFile = readJson<SkillsFile>('raw/wh3_chs_skills.json');
// Textos oficiales en español (si existen en data/loc-es)
loadOfficialLoc(DATA_DIR);
const unitsFile = readJson<UnitsFile>('raw/wh3_chs_units.json');

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
    mode: negativeSelf ? 'none' : allies ? 'allies' : enemies ? 'enemies' : self ? 'self' : 'none',
    passive: duration === -1,
    magicalAttacks: a.phases.some((p) => p.mag),
    flamingAttacks: a.phases.some((p) => p.fire),
    stats: a.phases.flatMap((p) => p.stats.map((st) => ({ ...st, d: translateAbilityStat(st.d) }))),
    attributes: a.phases.flatMap((p) => p.attr.map((x) => translateAttribute(x))).filter(Boolean),
  };
}

export const abilities: Record<string, AbilityInfo> = Object.fromEntries(
  Object.entries(skillsFile.abilities).map(([k, a]) => [k, toAbility(a)]),
);

// ---------- Árboles ----------
function toNode(n: RawNode): SkillNode {
  const raw = skillsFile.skills[n.s];
  const levels = raw.lv.map((l) => {
    const cards = l.u !== undefined ? skillsFile.unitLists[l.u] : undefined;
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

// Grupos de habilidades excluyentes (data/exclusivas.json)
interface ExclusiveFile { grupos: { nombre: string; max?: number; skills: string[] }[] }
const exclusiveDefs: ExclusiveFile['grupos'] = existsSync(join(DATA_DIR, 'exclusivas.json'))
  ? readJson<ExclusiveFile>('exclusivas.json').grupos ?? []
  : [];

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
  if (effects.some((e) => /^(Spell|Overcast spell|Bound spell)/i.test(e.text)) || (effects.length && effects.every((e) => e.kind === 'magic' || e.kind === 'ability') && effects.some((e) => e.kind === 'magic'))) return 'magic';
  if (effects.some((e) => / action\b/i.test(e.text))) return 'actions';
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
for (const c of skillsFile.characters) for (const n of c.bg) if (n) innateCount.set(n.s, (innateCount.get(n.s) ?? 0) + 1);

const trees = new Map<string, CharacterTree>();
const summaries: CharacterSummary[] = [];
for (const c of skillsFile.characters) {
  const legendary = !GENERIC.test(c.name);
  const background = c.bg.filter((n): n is RawNode => !!n).map(toNode);
  for (const b of background) b.autoActive = /\[HIDDEN\]/i.test(b.name);
  const innates = background.filter((b) => !b.autoActive);
  // Rasgo por defecto: si solo hay uno, ese; si es legendario, el que lleva su nombre o es único de él
  let defaultInnate: string | null = innates.length === 1 ? innates[0].key : null;
  if (!defaultInnate && legendary) {
    const own = innates.find((b) => (innateCount.get(b.skillKey) ?? 0) === 1 && !/_(khorne|nurgle|all)_\d+$|_all_/.test(b.skillKey));
    defaultInnate = own?.key ?? null;
  }
  const rows = c.rows.map((r) => r.filter((n): n is RawNode => !!n).map(toNode));
  for (const n of rows.flat()) n.category = nodeCategory(n);
  const exclusiveGroups = exclusiveGroupsFor(rows.flat());
  const tree: CharacterTree = {
    key: c.key,
    name: nameEs(c.key, characterNameEs(c.name)),
    type: c.type,
    legendary,
    rows,
    rowLabels: rows.map((r, i) => rowLabel(r, i, exclusiveGroups)),
    background,
    defaultInnate,
    exclusiveGroups,
    stats: c.stats,
  };
  trees.set(c.key, tree);
  summaries.push({ key: c.key, name: tree.name, type: c.type, legendary });
}

export function listCharacters(): CharacterSummary[] {
  return summaries;
}

export function getCharacter(key: string): CharacterTree | undefined {
  return trees.get(key);
}

// ---------- Unidades ----------
const units = new Map<string, UnitData>();
for (const u of unitsFile.units) {
  units.set(u.card, {
    ...u,
    nameEn: u.name,
    name: officialUnitName(u.key) ?? nameEs(u.card, u.name),
    casteEs: CASTES[u.caste] ?? u.caste,
    attrs: u.attrs.map(translateAttribute),
  });
}

export function listUnits(): UnitData[] {
  return [...units.values()];
}

export function getUnit(card: string): UnitData | undefined {
  return units.get(card);
}

export const sources = {
  officialLoc: officialCount(),
  skills: `${skillsFile.source} (extraído ${skillsFile.extracted})`,
  units: `${unitsFile.source} (extraído ${unitsFile.extracted})`,
  faction: skillsFile.faction,
};
