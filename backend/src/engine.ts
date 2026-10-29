import { abilities, artOfUnit, experienceBonuses, getCharacter, getUnit, targetFlagText, techEffects, unitInList } from './data.js';
import { translateAttribute } from './i18n.js';
import { MAX_RANK, autoRank, effectiveLevel, isFreeLevel, pointsAtRank, pointsFor } from './rankRules.js';
import { unitRank } from './types.js';

/**
 * Efectos que escalan con el rango de la unidad, p. ej. Vessel de Archaón:
 * "Units gain +3% weapon and missile strength per rank achieved". Devuelve el % por rango.
 */
function perRankPct(effect: ParsedEffect): number | undefined {
  // Los datos del juego ya traen estos bufos desglosados (una entrada por rango, con rankMin): esos se suman aparte
  if (effect.rankMin !== undefined) return undefined;
  if (!/scaling_experience_benefits/.test(effect.key)) return undefined;
  if (effect.value !== undefined) return effect.value;
  const m = /([\d.]+)\s*%/.exec(`${effect.textEn ?? ''} ${effect.text ?? ''}`);
  return m ? parseFloat(m[1]) : undefined;
}
import type {
  AbilityInfo, BuildSelection, CharacterStats, CharacterTree, ComputeRequest, ComputedCard, Contribution,
  ParsedEffect, SkillNode, StatKey, StatLine, UnitData,
} from './types.js';

export const ALL_STATS: StatKey[] = [
  'ma', 'md', 'armour', 'charge', 'ld', 'dmg', 'ap', 'hp', 'speed', 'bvl', 'bvi',
  'resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'missileDmg', 'ammo', 'reload', 'range', 'barrier', 'shield',
];

const RES_STATS = new Set<StatKey>(['resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard']);

// Stat interno de las habilidades de batalla -> stat de la tarjeta
const ABILITY_STAT_MAP: Record<string, StatKey> = {
  stat_melee_attack: 'ma',
  stat_melee_defence: 'md',
  stat_armour: 'armour',
  stat_morale: 'ld',
  stat_charge_bonus: 'charge',
  stat_melee_damage_base: 'dmg',
  stat_melee_damage_ap: 'ap',
  scalar_speed: 'speed',
  stat_resistance_physical: 'resPhysical',
  stat_resistance_missile: 'resMissile',
  stat_resistance_all: 'resWard',
  stat_weakness_flame: 'resFlame',
  stat_missile_block_chance: 'shield',
  scalar_missile_damage_base: 'missileDmg',
  stat_bonus_vs_large: 'bvl',
  scalar_missile_range: 'range',
};

/**
 * Veteranía base de la unidad (unit_experience_bonuses del juego): lo que suma cada stat al subir de rango.
 * Lectura usada: sin crecimiento (growth_rate y growth_scalar en 0), "value" por cada rango → value × rango.
 * Esa lectura todavía no está comprobada contra la carta del juego. Las filas con crecimiento no se suman
 * (no sé su fórmula) y se avisa en la tarjeta. Sin datos extraídos no se suma nada.
 */
function veterancy(rank: number): { add: { stat: StatKey; value: number; conditional: string }[]; skipped: string[] } {
  const add: { stat: StatKey; value: number; conditional: string }[] = [];
  const skipped: string[] = [];
  if (rank <= 0) return { add, skipped };
  for (const r of experienceBonuses()) {
    const stat = ABILITY_STAT_MAP[r.stat];
    if (!stat) { skipped.push(`${r.stat} (stat que la tarjeta no muestra)`); continue; }
    if (r.growth_rate || r.growth_scalar) { skipped.push(`${r.stat} (crece con growth_rate ${r.growth_rate} / growth_scalar ${r.growth_scalar}: fórmula sin confirmar)`); continue; }
    if (!r.value) continue;
    add.push({ stat, value: r.value * rank, conditional: `${r.value} × rango ${rank}` });
  }
  return { add, skipped };
}

// ---------- Builds ----------

export interface ResolvedBuild {
  tree: CharacterTree;
  selection: BuildSelection;
  /** nodo -> nivel efectivo (incluye nodos de fondo y puntos al crear) */
  levels: Map<string, number>;
  activeNodes: { node: SkillNode; level: number }[];
  mountNode?: SkillNode;
  pointsUsed: number;
  minRank: number;
  rank: number;
  warnings: string[];
}

export function nodeAvailable(node: SkillNode, levels: Map<string, number> | Record<string, number>): boolean {
  const get = (k: string) => (levels instanceof Map ? levels.get(k) : levels[k]) ?? 0;
  if (node.parentsRequired.some((p) => get(p) < 1)) return false;
  // Requisito del juego: N puntos gastados en total entre esas habilidades padre; con N = 0 no pide nada
  if (node.parentSubset.length && node.parentSubsetCount > 0) {
    const points = node.parentSubset.reduce((s, p) => s + get(p), 0);
    if (points < node.parentSubsetCount) return false;
  }
  return true;
}

export function resolveBuild(sel: BuildSelection): ResolvedBuild | null {
  const tree = getCharacter(sel.character);
  if (!tree) return null;
  const all = [...tree.rows.flat(), ...tree.background];
  const levels = new Map<string, number>();
  const warnings: string[] = [];
  let pointsUsed = 0;
  let minRank = 1;
  // Rango automático: sube solo con lo comprado (como el planner original); sel.rank es el mínimo
  const rankNeeded = autoRank(tree.rows.flat(), sel.levels, sel.rank ?? 1);
  const rank = Math.min(MAX_RANK, rankNeeded);
  if (rankNeeded > MAX_RANK) warnings.push(`El build no cabe: necesitaría rango ${rankNeeded} (máximo ${MAX_RANK})`);

  const innate = sel.innate === undefined ? tree.defaultInnate : sel.innate;
  for (const node of all) {
    if (node.background) {
      // Rasgos de fondo: ocultos siempre; del pool de innatos solo el elegido. No gastan puntos.
      if (node.autoActive || node.key === innate) levels.set(node.key, node.levels.length);
      continue;
    }
    const bought = Math.min(sel.levels[node.key] ?? 0, node.levels.length);
    const lvl = effectiveLevel(node, bought, rank);
    if (lvl > 0) levels.set(node.key, lvl);
    pointsUsed += pointsFor(node, lvl, rank);
    for (let i = 0; i < lvl; i++) {
      if (isFreeLevel(node, i, rank)) continue;
      const r = node.levels[i].requiredRank;
      if (r && r > minRank) minRank = r;
      if (r && r > rank) warnings.push(`"${node.name}" nivel ${i + 1} requiere rango ${r} (el personaje está en rango ${rank})`);
    }
  }
  minRank = Math.max(minRank, pointsUsed);


  const activeNodes: { node: SkillNode; level: number }[] = [];
  for (const node of all) {
    const lvl = levels.get(node.key) ?? 0;
    if (lvl <= 0) continue;
    if (!node.background && !nodeAvailable(node, levels)) warnings.push(`"${node.name}" no cumple sus requisitos en el árbol`);
    activeNodes.push({ node, level: lvl });
  }

  // Bloqueos oficiales del juego
  const levelBySkill = new Map<string, number>();
  for (const n of all) levelBySkill.set(n.skillKey, Math.max(levelBySkill.get(n.skillKey) ?? 0, levels.get(n.key) ?? 0));
  for (const [nodeKey, ls] of Object.entries(tree.locks ?? {})) {
    if (!(levels.get(nodeKey) ?? 0)) continue;
    const node = all.find((n) => n.key === nodeKey);
    for (const l of ls) {
      if ((levelBySkill.get(l.skill) ?? 0) >= l.level) {
        const by = all.find((n) => n.skillKey === l.skill)?.name ?? l.skill;
        warnings.push(`"${node?.name}" está bloqueada por "${by}" (no se pueden tener juntas)`);
      }
    }
  }
  // Grupos excluyentes manuales (data/exclusivas.json)
  for (const g of tree.exclusiveGroups.filter((x) => x.name !== 'Excluyentes del juego')) {
    const bought = g.nodes.filter((k) => (levels.get(k) ?? 0) > 0);
    if (bought.length > g.max) {
      const names = bought.map((k) => all.find((n) => n.key === k)?.name ?? k);
      warnings.push(`${g.name}: solo se puede elegir ${g.max} (tienes ${names.join(', ')})`);
    }
  }

  let mountNode: SkillNode | undefined;
  if (sel.mount) {
    mountNode = all.find((n) => n.key === sel.mount && n.isMount);
    if (mountNode && !(levels.get(mountNode.key) ?? 0)) {
      warnings.push(`La montura "${mountNode.name}" no está comprada; se usa a pie`);
      mountNode = undefined;
    }
  }
  if (minRank > 50) warnings.push(`El build necesita rango ${minRank}; el máximo normal es 50`);
  for (const it of tree.items ?? []) {
    if ((sel.items ?? []).includes(it.key) && it.rank && it.rank > rank) warnings.push(`"${it.name}" se consigue con su misión en rango ${it.rank}`);
  }

  return { tree, selection: sel, levels, activeNodes, mountNode, pointsUsed, minRank, rank, warnings };
}

/**
 * Objetos que lleva puestos. Con los dones de Daniel: lo elegido en cada ranura y, en las ranuras donde no eligió
 * nada (ni "vacío"), la pieza de su forma base; una pieza que bloquea ranuras (brazos con guadaña) las deja vacías.
 */
export function wornItems(b: { tree: CharacterTree; selection: BuildSelection; activeNodes?: { node: SkillNode; level: number }[] }): Set<string> {
  const sel = new Set(b.selection.items ?? []);
  // Hechizos de Kairos: solo cuentan los de espacios abiertos por una habilidad comprada (uno por espacio)
  if (b.tree.spellSlots?.length) {
    const active = new Set((b.activeNodes ?? []).flatMap(({ node, level }) => node.levels[level - 1]?.effects.map((e) => e.key) ?? []));
    for (const s of b.tree.spellSlots) {
      const picked = s.options.filter((o) => sel.has(o.key));
      picked.forEach((o, i) => { if (!active.has(s.unlockEffect) || i > 0) sel.delete(o.key); });
    }
  }
  const ar = b.tree.armory;
  if (!ar) return sel;
  const byKey = new Map(ar.items.map((i) => [i.key, i]));
  const chosen = [...sel].map((k) => byKey.get(k)).filter((i): i is NonNullable<typeof i> => !!i);
  const usedSlots = new Set(chosen.map((i) => i.slot));
  const blocked = new Set(chosen.flatMap((i) => i.blocksSlots));
  for (const d of ar.defaults) {
    const it = byKey.get(d);
    if (!it || usedSlots.has(it.slot) || blocked.has(it.slot) || sel.has(`empty:${it.slot}`)) continue;
    sel.add(d);
  }
  for (const k of [...sel]) {
    const it = byKey.get(k);
    if (it && blocked.has(it.slot) && !chosen.includes(it)) sel.delete(k);
  }
  return sel;
}

/** Efectos del nivel comprado (en el juego cada nivel ya trae el total, no se suman). */
/**
 * Lo que las habilidades compradas le cambian a un hechizo o habilidad, por su nombre entre comillas:
 * "Tiempo de espera: -30% para "Plaga de óxido"", "Coste en Vientos de la Magia: -1 para "…"", "Hechizo potenciado: "… mejorada"".
 */
function abilityMods(a: AbilityInfo, effects: { effect: ParsedEffect; skill: string }[]): Pick<AbilityState, 'final' | 'overcast' | 'mods'> {
  const over = a.overcast ? abilities[a.overcast] : undefined;
  let mana = 0, overMana = 0, cdPct = 0, durPct = 0, rangePct = 0, uses = 0, unlocked = false;
  const mods: string[] = [];
  for (const { effect, skill } of effects) {
    const t = effect.text;
    if (!t || effect.kind === 'battle' || effect.kind === 'attribute') continue;
    // "Hechizo: X" solo lo habilita (no cambia sus valores); "Hechizo potenciado: X" sí cuenta
    if (effect.kind === 'ability' && !/potenciad|bendición/i.test(t)) continue;
    // Los textos no siempre usan las mismas mayúsculas que el nombre ("Plaga de óxido" / "Plaga de Óxido")
    const names = [...t.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
    const forBase = names.includes(a.name.toLowerCase());
    const forOver = !!over && names.includes(over.name.toLowerCase());
    if (!forBase && !forOver) continue;
    const label = /^([^:]+):/.exec(t)?.[1] ?? '';
    const num = /:\s*([+-]?\d+(?:[.,]\d+)?)/.exec(t);
    const v = num ? parseFloat(num[1].replace(',', '.')) : 0;
    if (/potenciad|bendición/i.test(label)) unlocked = true;
    else if (/^Tiempo de espera/.test(label) && forBase) cdPct += v;
    else if (/^Coste en Vientos/.test(label)) { if (forBase) mana += v; else overMana += v; }
    else if (/^Duración del efecto/.test(label) && forBase) durPct += v;
    else if (/^Alcance al objetivo/.test(label) && forBase) rangePct += v;
    else if (/usos/i.test(label) && forBase) uses += v;
    mods.push(`${t} — ${skill}`);
  }
  if (!mods.length) return {};
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const final: NonNullable<AbilityState['final']> = {};
  if (a.mana !== undefined) final.mana = Math.max(0, a.mana + mana);
  if (a.cooldown) final.cooldown = r1(a.cooldown * (1 + cdPct / 100));
  if (a.duration > 0) final.duration = r1(a.duration * (1 + durPct / 100));
  if (a.range) final.range = r1(a.range * (1 + rangePct / 100));
  if (uses) final.uses = uses;
  return {
    final, mods,
    overcast: over ? { name: over.name, unlocked, mana: over.mana, finalMana: over.mana !== undefined ? Math.max(0, over.mana + overMana) : undefined } : undefined,
  };
}

function effectsOf(b: ResolvedBuild): { effect: ParsedEffect; skill: string }[] {
  const out: { effect: ParsedEffect; skill: string }[] = [];
  for (const { node, level } of b.activeNodes) {
    // Las monturas solo cuentan si es la que lleva puesta
    if (node.isMount && node !== b.mountNode) continue;
    const lv = node.levels[level - 1];
    for (const e of lv.effects) out.push({ effect: e, skill: skillLabel(node) });
  }
  // Objetos equipados (y su conjunto si lleva todas las piezas)
  const worn = wornItems(b);
  for (const it of b.tree.items ?? []) if (worn.has(it.key)) for (const e of it.effects) out.push({ effect: e, skill: it.name });
  for (const st of b.tree.itemSets ?? []) if (st.items.every((k) => worn.has(k))) for (const e of st.effects) out.push({ effect: e, skill: `Conjunto: ${st.name}` });
  return out;
}

/** Nombre a mostrar como fuente (las habilidades ocultas del juego son "iniciales") */
function skillLabel(node: SkillNode): string {
  return /\[HIDDEN\]/i.test(node.name) || node.name === node.skillKey ? 'Inicial' : node.name;
}

function abilitiesOf(b: ResolvedBuild): { ability: AbilityInfo; skill: string }[] {
  const seen = new Set<string>();
  const out: { ability: AbilityInfo; skill: string }[] = [];
  const add = (key: string, skill: string) => {
    if (seen.has(key)) return;
    const a = abilities[key];
    if (!a) return;
    seen.add(key);
    out.push({ ability: a, skill });
  };
  for (const { node, level } of b.activeNodes) {
    if (node.isMount && node !== b.mountNode) continue;
    // "Replaces" (p. ej. Stand or Die! reemplaza a Rally!) se maneja quitando la reemplazada abajo
    for (const k of node.levels[level - 1].abilities) add(k, skillLabel(node));
  }
  // Habilidades que dan los objetos equipados
  const worn = wornItems(b);
  for (const it of b.tree.items ?? []) {
    if (!worn.has(it.key)) continue;
    for (const e of it.effects) if (e.kind === 'ability' && e.ability && e.target !== 'chars') add(e.ability, it.name);
  }
  // Habilidades de los conjuntos completos (p. ej. "Golpe mortal" mejorado del Príncipe Acorazado)
  for (const st of b.tree.itemSets ?? []) {
    if (!st.items.every((k) => worn.has(k))) continue;
    for (const e of st.effects) if (e.kind === 'ability' && e.ability && e.target !== 'chars') add(e.ability, `Conjunto: ${st.name}`);
  }
  const baseStats = b.mountNode ? b.mountNode.levels[0].mountStats : b.tree.stats;
  // Las habilidades que activan los dones de Daniel vienen "dormidas" en su unidad: solo cuentan si lleva la pieza
  const gated = new Set<string>();
  for (const it of b.tree.armory?.items ?? []) for (const e of it.effects) if (e.ability) gated.add(e.ability);
  for (const st of b.tree.armory?.sets ?? []) for (const e of st.effects) if (e.ability) gated.add(e.ability);
  for (const k of baseStats?.abilities ?? b.tree.stats?.abilities ?? []) if (!gated.has(k)) add(k, 'Innata');

  // Reemplazos: si un efecto dice Replaces: "X", quitamos la habilidad X
  const replaced = new Set<string>();
  const removedKeys = new Set<string>();
  // "Mejora la habilidad: X" da la versión mejorada (otra clave, mismo nombre): la normal deja de estar
  const upgraded = new Set<string>();
  for (const { effect } of effectsOf(b)) {
    if (effect.disable) removedKeys.add(effect.disable);
    const m = (effect.textEn ?? effect.text).match(/^Replaces: "([^"]+)"/);
    if (m) replaced.add(m[1]);
    if (effect.ability && /^(Mejora la habilidad|Upgrades)/i.test(effect.text || effect.textEn || '')) upgraded.add(effect.ability);
  }
  const kept = out.filter((x) => !removedKeys.has(x.ability.key) && !replaced.has(x.ability.nameEn ?? x.ability.name));
  // Misma habilidad repetida con otra clave (la innata y la de la habilidad, o la normal y la mejorada): una sola.
  // Los hechizos vinculados son otra habilidad aunque se llamen igual que el hechizo del saber.
  const bound = (k: string) => /_spell_bound_/.test(k);
  const best = new Map<string, (typeof out)[number]>();
  const score = (x: (typeof out)[number]) => (upgraded.has(x.ability.key) || /_upgraded/.test(x.ability.key) ? 2 : 0) + (x.skill === 'Innata' ? 0 : 1);
  for (const x of kept) {
    const id = `${x.ability.name}|${bound(x.ability.key)}`;
    const cur = best.get(id);
    if (!cur || score(x) > score(cur)) best.set(id, x);
  }
  return kept.filter((x) => best.get(`${x.ability.name}|${bound(x.ability.key)}`) === x);
}

// ---------- Tarjetas ----------

function emptyLines(base: Partial<Record<StatKey, number>>): Record<StatKey, StatLine> {
  const lines = {} as Record<StatKey, StatLine>;
  for (const s of ALL_STATS) lines[s] = { stat: s, base: base[s] ?? 0, final: base[s] ?? 0, contributions: [] };
  return lines;
}

function unitBase(u: UnitData): Partial<Record<StatKey, number>> {
  return {
    ma: u.ma, md: u.md, armour: u.armour, charge: u.charge, ld: u.leadership, dmg: u.dmg ?? 0, ap: u.ap ?? 0,
    hp: u.hpPerModel, speed: u.speed, bvl: u.bvl ?? 0, bvi: u.bvi ?? 0,
    resPhysical: u.res.physical, resMissile: u.res.missile, resMagic: u.res.magic, resFlame: u.res.flame, resWard: u.res.ward,
    missileDmg: u.missile ? u.missile.dmg + u.missile.ap : 0, ammo: u.missile?.ammo ?? 0, reload: u.missile?.reload ?? 0,
    range: u.missile?.range ?? 0, barrier: u.barrier, shield: u.shield,
  };
}

function charBase(s: CharacterStats): Partial<Record<StatKey, number>> {
  // Las stats del árbol no traen el arma a distancia: sale de la unidad del personaje (o de la montada) en las tablas de unidades
  const m = s.unit ? getUnit(s.unit)?.missile : undefined;
  return {
    missileDmg: m ? m.dmg + m.ap : 0, ammo: m?.ammo ?? 0, reload: m?.reload ?? 0, range: m?.range ?? 0,
    ma: s.melee_attack, md: s.melee_defence, armour: s.armour, charge: s.charge_bonus, ld: s.morale,
    dmg: s.damage, ap: s.ap_damage, hp: s.hit_points + s.bonus_hit_points, speed: Math.round((s.run_speed ?? 0) * 10),
    bvl: s.bonus_v_large ?? 0, bvi: s.bonus_v_infantry ?? 0,
    resPhysical: s.damage_mod_physical ?? 0, resMissile: s.damage_mod_missile ?? 0, resMagic: s.damage_mod_magic ?? 0,
    resFlame: s.damage_mod_flame ?? 0, resWard: s.damage_mod_all ?? 0, barrier: s.barrier ?? 0, shield: s.missile_block_chance ?? 0,
  };
}

/** Stats de proyectiles: no cambian nada a quien no dispara (p. ej. "Munición +20%" del ejército a la infantería cuerpo a cuerpo) */
const MISSILE_STATS = new Set<StatKey>(['missileDmg', 'ammo', 'reload', 'range']);

/** ¿El nombre de la unidad/personaje es uno de esos? Palabra por palabra, sin artículos y sin distinguir singular/plural */
export function namedMatch(names: string[], unitName: string): boolean {
  const words = (t: string) => t.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/s$/, ''));
  const have = new Set(words(unitName));
  return names.some((n) => words(n).every((w) => have.has(w)));
}
const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

function contribute(lines: Record<StatKey, StatLine>, stat: StatKey, c: Contribution, exact = false) {
  if (MISSILE_STATS.has(stat) && !lines.missileDmg.base) return;
  // "Fuerza del arma" (%) sube daño base y perforante a la vez (los datos del juego ya traen las dos por separado)
  if (stat === 'dmg' && c.how === 'pct' && !exact) {
    lines.dmg.contributions.push(c);
    lines.ap.contributions.push({ ...c });
    return;
  }
  lines[stat].contributions.push(c);
}

function finalize(lines: Record<StatKey, StatLine>) {
  for (const s of ALL_STATS) {
    const l = lines[s];
    let add = 0, pct = 0, mult = 1;
    for (const c of l.contributions) {
      if (c.how === 'add') add += c.value;
      else if (c.how === 'pct') pct += c.value;
      else mult *= c.value;
    }
    let v: number;
    if (s === 'reload') v = (l.base + add) * (1 - pct / 100) * (mult === 1 ? 1 : 1 / mult);
    else v = (l.base + add) * (1 + pct / 100) * mult;
    if (RES_STATS.has(s)) v = Math.min(90, v);
    if (s === 'ma' || s === 'md' || s === 'armour' || s === 'charge' || s === 'ld') v = Math.max(0, v);
    l.final = Math.round(v * 100) / 100;
  }
}

export interface AbilityState {
  key: string;
  /** Icono del juego (/abilities/<icon>.png) */
  icon?: string;
  /** Id para encenderla: "habilidad@personaje" (la misma habilidad puede estar en varios árboles) */
  id: string;
  /** Personaje que la tiene (id de su tarjeta) */
  ownerKey: string;
  name: string;
  nameEn?: string;
  owner: string;
  skill: string;
  mode: AbilityInfo['mode'];
  passive: boolean;
  duration: number;
  cooldown?: number;
  range?: number;
  mana?: number;
  type?: string;
  stats: string[];
  attributes: string[];
  hasBattleStats: boolean;
  active: boolean; // se está aplicando en este cálculo
  /** Stats que toca (clave del juego, cómo y cuánto): para los iconos de la interfaz */
  effects: { stat: string; how: string; v: number }[];
  spell?: boolean;
  magical?: boolean;
  flaming?: boolean;
  /** Valores con lo que le cambian las habilidades compradas (coste, espera, duración, alcance, usos extra) */
  final?: { mana?: number; cooldown?: number; duration?: number; range?: number; uses?: number };
  /** Versión potenciada del hechizo: si está desbloqueada y su coste */
  overcast?: { name: string; unlocked: boolean; mana?: number; finalMana?: number };
  /** Textos de esos cambios con la habilidad que los da */
  mods?: string[];
}

export interface SummaryLine {
  label: string; // stat o etiqueta del juego
  stat?: StatKey;
  value?: number;
  pct?: boolean;
  scope?: string; // a quién aplica ("Infantería no demoníaca", "todo el ejército"...)
  rank7?: boolean;
  sources: string[];
  text?: string; // para efectos sin número
}

export interface BuildSummary {
  self: SummaryLine[]; // al propio personaje
  army: SummaryLine[]; // a las tropas
  lord: SummaryLine[]; // de un héroe al señor que acompaña
  attributes: SummaryLine[];
  abilities: { name: string; source: string; passive: boolean; mode: string; detail: string }[];
  campaign: SummaryLine[];
  magic: SummaryLine[];
}

export interface ComputeResult {
  cards: ComputedCard[];
  abilities: AbilityState[];
  enemyDebuffs: { ability: string; owner: string; stats: { stat: StatKey; how: string; v: number }[] }[];
  builds: { character: string; name: string; pointsUsed: number; pointsAvailable: number; rank: number; minRank: number; warnings: string[]; mount?: string; summary: BuildSummary }[];
  campaign: { owner: string; skill: string; text: string }[];
  magic: { owner: string; skill: string; text: string }[];
}

export function compute(req: ComputeRequest): ComputeResult {
  const builds: ResolvedBuild[] = [];
  const lordBuild = req.lord ? resolveBuild(req.lord) : null;
  if (lordBuild) builds.push(lordBuild);
  for (const h of req.heroes ?? []) {
    const b = resolveBuild(h);
    if (b) builds.push(b);
  }
  const active = new Set(req.activeAbilities ?? []);
  const inAura = req.inAura !== false;

  // Efectos de todos los personajes
  const effects: { effect: ParsedEffect; skill: string; owner: string; build: ResolvedBuild | null }[] =
    builds.flatMap((b) => effectsOf(b).map((x) => ({ ...x, owner: b.tree.name, build: b })));
  // Tecnologías investigadas: aplican a todos los ejércitos y personajes de la facción
  for (const t of req.techs ?? []) {
    const te = techEffects(t);
    if (te) for (const effect of te.effects) effects.push({ effect, skill: te.name, owner: 'Tecnologías', build: null });
  }
  /** ¿Un efecto de tecnología "a los personajes" aplica a este señor/héroe? */
  const charMatch = (effect: ParsedEffect, b: ResolvedBuild, isLord: boolean) => {
    if (effect.target !== 'chars') return false;
    if (effect.who === 'lord' && !isLord) return false;
    if (effect.who === 'hero' && isLord) return false;
    if (effect.who === 'wizard' && !b.tree.rows.flat().some((n) => n.category === 'magic')) return false;
    const unit = (b.mountNode?.levels[0].mountStats ?? b.tree.stats)?.unit ?? b.tree.stats?.unit;
    return effect.unitList === undefined || (!!unit && unitInList(effect.unitList, unit));
  };
  /** Efecto al ejército limitado a una lista de unidades del juego que incluye a este personaje (p. ej. "Horrores Iridiscentes") */
  const armyListMatch = (effect: ParsedEffect, b: ResolvedBuild) => {
    if (effect.target !== 'army' || effect.unitList === undefined || effect.rank7) return false;
    const units = [(b.mountNode?.levels[0].mountStats ?? b.tree.stats)?.unit, b.tree.stats?.unit].filter((x): x is string => !!x);
    return units.some((u) => unitInList(effect.unitList!, u));
  };

  // Habilidades
  const abilityStates: AbilityState[] = [];
  const enemyDebuffs: ComputeResult['enemyDebuffs'] = [];
  const allyAbilities: { ability: AbilityInfo; owner: string; build: ResolvedBuild; selfOnly: boolean; cond: string }[] = [];
  // Encendidas por personaje ("habilidad@personaje"); la clave sola (ejércitos viejos) enciende la de todos
  const isActive = (key: string, b: ResolvedBuild) => active.has(`${key}@${b.tree.key}`) || active.has(key);
  for (const b of builds) {
    for (const { ability, skill } of abilitiesOf(b)) {
      const statLines = ability.stats.filter((s) => ABILITY_STAT_MAP[s.stat]);
      const hasBattleStats = statLines.length > 0 || ability.magicalAttacks || ability.flamingAttacks || ability.attributes.length > 0;
      let isOn = false;
      if (ability.mode === 'enemies') {
        isOn = isActive(ability.key, b);
        if (isOn) enemyDebuffs.push({ ability: ability.name, owner: b.tree.name, stats: statLines.map((s) => ({ stat: ABILITY_STAT_MAP[s.stat], how: s.how, v: s.v })) });
      } else if (ability.mode === 'allies' || ability.mode === 'self') {
        isOn = ability.passive ? (ability.mode === 'self' || inAura) : isActive(ability.key, b);
        if (isOn && hasBattleStats) {
          allyAbilities.push({ ability, owner: b.tree.name, build: b, selfOnly: ability.mode === 'self', cond: ability.passive ? (ability.mode === 'self' ? 'pasiva' : 'aura') : 'activa' });
        }
      }
      abilityStates.push({
        key: ability.key, id: `${ability.key}@${b.tree.key}`, ownerKey: b.tree.key, icon: ability.icon,
        name: ability.name, nameEn: ability.nameEn, owner: b.tree.name, skill, mode: ability.mode, passive: ability.passive,
        duration: ability.duration, cooldown: ability.cooldown, range: ability.range, mana: ability.mana, type: ability.type,
        stats: ability.stats.map((s) => s.d), attributes: ability.attributes, hasBattleStats, active: isOn,
        effects: ability.stats.map((s) => ({ stat: s.stat, how: s.how, v: s.v })),
        spell: ability.spell || undefined, magical: ability.magicalAttacks || undefined, flaming: ability.flamingAttacks || undefined,
        ...abilityMods(ability, effectsOf(b)),
      });
    }
  }

  const cards: ComputedCard[] = [];

  // --- Tarjetas de personajes ---
  for (const b of builds) {
    const base = b.mountNode?.levels[0].mountStats ?? b.tree.stats;
    if (!base) continue;
    const lines = emptyLines(charBase(base));
    const attributes: { name: string; from?: string }[] = (base.attributes ?? []).map((a) => ({ name: translateAttribute(a) }));
    let magical = !!base.is_magical;
    let flaming = !!base.is_flaming;
    const isLord = b === lordBuild;
    for (const { effect, skill, owner, build } of effects) {
      if ((effect.target === 'army' || effect.target === 'chars') && effect.forNames && !namedMatch(effect.forNames, b.tree.name)) continue;
      if (effect.kind === 'attribute' && effect.attribute) {
        if ((effect.target === 'self' && build === b) || (effect.target === 'army' && !effect.units && effect.unitList === undefined) || charMatch(effect, b, isLord) || armyListMatch(effect, b)) {
          attributes.push({ name: effect.attribute, from: `${skill} (${owner})` });
          if (/flam/i.test(effect.attribute)) flaming = true;
          if (/mágic/i.test(effect.attribute)) magical = true;
        }
        continue;
      }
      if (effect.kind !== 'battle' || !effect.stat || effect.value === undefined) continue;
      const applies =
        (effect.target === 'self' && build === b) ||
        (effect.target === 'lord' && isLord) ||
        (effect.target === 'army' && !effect.units && effect.unitList === undefined && !effect.rank7) ||
        charMatch(effect, b, isLord) || armyListMatch(effect, b);
      if (!applies) continue;
      contribute(lines, effect.stat, { source: skill, from: owner, value: effect.value, how: effect.pct ? 'pct' : 'add' }, effect.exact);
    }
    for (const x of allyAbilities) {
      if (x.selfOnly && x.build !== b) continue;
      if (!targetAllowed(x.ability, x.owner, { kind: isLord ? 'lord' : 'hero' }, b.warnings)) continue;
      applyAbility(lines, x.ability, x.owner, x.cond, attributes);
      if (x.ability.magicalAttacks) magical = true;
      if (x.ability.flamingAttacks) flaming = true;
    }
    finalize(lines);
    cards.push({
      id: b.tree.key, name: b.tree.name + (b.mountNode ? ` (${b.mountNode.name})` : ''), kind: isLord ? 'lord' : 'hero', count: 1,
      art: artOfUnit((b.mountNode?.levels[0].mountStats ?? b.tree.stats)?.unit) ?? artOfUnit(b.tree.stats?.unit),
      models: 1, size: base.size, interval: base.melee_attack_interval, splash: base.splash_attack_max_attacks,
      missile: base.unit ? getUnit(base.unit)?.missile : undefined,
      magicalAttacks: magical, flamingAttacks: flaming, stats: lines, attributes,
      notes: b.warnings,
    });
  }

  // Bufos "por rango" de los datos del juego: la misma habilidad/stat repetida con varios rangos mínimos (1, 2, 3…)
  const perRankId = (skill: string, owner: string, e: ParsedEffect) => `${skill}|${owner}|${e.key}|${e.stat}`;
  const rankMins = new Map<string, Set<number>>();
  for (const { effect, skill, owner } of effects) {
    if (effect.rankMin === undefined || effect.kind !== 'battle' || !effect.stat) continue;
    const id = perRankId(skill, owner, effect);
    rankMins.set(id, (rankMins.get(id) ?? new Set()).add(effect.rankMin));
  }
  const isPerRank = (skill: string, owner: string, e: ParsedEffect) => (rankMins.get(perRankId(skill, owner, e))?.size ?? 0) > 1;

  // --- Tarjetas de unidades ---
  for (const sel of req.units) {
    const u = getUnit(sel.card);
    if (!u) continue;
    const lines = emptyLines(unitBase(u));
    const attributes: { name: string; from?: string }[] = u.attrs.map((a) => ({ name: a }));
    let magical = !!u.magical;
    let flaming = !!u.flaming;
    const notes: string[] = [];
    const rank = unitRank(sel);
    // Copias por rango que sí aplican (se juntan en una sola línea al final)
    const perRankAcc = new Map<string, { stat: StatKey; c: Contribution; n: number; exact?: boolean }>();
    // Veteranía base del juego por el rango elegido
    const vet = veterancy(rank);
    for (const v of vet.add) contribute(lines, v.stat, { source: `Veteranía (rango ${rank})`, from: 'Experiencia', value: v.value, how: 'add', conditional: v.conditional });
    if (vet.skipped.length) notes.push(`Veteranía no sumada: ${vet.skipped.join('; ')}`);
    for (const { effect, skill, owner } of effects) {
      // Bufos que crecen con cada rango de la unidad (Vessel de Archaón)
      const per = perRankPct(effect);
      if (per !== undefined) {
        if (rank > 0 && !/_ror/.test(u.key + u.card)) {
          const c = { source: skill, from: owner, value: Math.round(per * rank * 100) / 100, how: 'pct' as const, conditional: `${per}% × rango ${rank}` };
          contribute(lines, 'dmg', c); // fuerza del arma: daño base y perforante
          if (u.missile) contribute(lines, 'missileDmg', { ...c });
        }
        continue;
      }
      const patch = effect.target === 'none' ? FACTIONWIDE_PATCH[effect.key] : undefined;
      if (patch) {
        const v = Number(/([+-]?[\d.]+)/.exec(effect.textEn ?? effect.text ?? '')?.[1]);
        if (patch.units.has(u.key) && Number.isFinite(v)) contribute(lines, patch.stat, { source: skill, from: owner, value: v, how: patch.pct ? 'pct' : 'add' });
        continue;
      }
      if (effect.target !== 'army') continue;
      // Las listas del planner usan la carta de la unidad; los Exaltados agregados a mano se buscan también por clave
      if (effect.units && !effect.units.includes(u.card) && !effect.units.includes(u.key) && !(u.cardArt && effect.units.includes(u.cardArt))) continue;
      if (effect.unitList !== undefined && !unitInList(effect.unitList, u.key)) continue;
      if (effect.rank7 && rank < (effect.rankMin ?? 7)) continue;
      if (effect.forNames && !namedMatch(effect.forNames, u.name) && !(u.nameEn && namedMatch(effect.forNames, u.nameEn))) continue;
      if (effect.kind === 'attribute' && effect.attribute) {
        attributes.push({ name: effect.attribute, from: `${skill} (${owner})` });
        if (/flam/i.test(effect.attribute)) flaming = true;
        if (/mágic/i.test(effect.attribute)) magical = true;
        continue;
      }
      if (effect.kind !== 'battle' || !effect.stat || effect.value === undefined) continue;
      if (isPerRank(skill, owner, effect)) {
        const k = `${effect.stat}|${skill}|${owner}|${effect.pct ? 'pct' : 'add'}|${effect.value}`;
        const acc = perRankAcc.get(k);
        if (acc) acc.n++;
        else perRankAcc.set(k, { stat: effect.stat, n: 1, exact: effect.exact, c: { source: skill, from: owner, value: effect.value, how: effect.pct ? 'pct' : 'add' } });
        continue;
      }
      contribute(lines, effect.stat, {
        source: skill, from: owner, value: effect.value, how: effect.pct ? 'pct' : 'add',
        conditional: effect.rank7 ? `rango ${effect.rankMin ?? 7}+` : undefined,
      }, effect.exact);
    }
    for (const { stat, c, n, exact } of perRankAcc.values()) {
      const unit = c.how === 'pct' ? '%' : '';
      contribute(lines, stat, { ...c, value: Math.round(c.value * n * 100) / 100, conditional: `${c.value}${unit} × rango ${n}` }, exact);
    }
    for (const x of allyAbilities) {
      if (x.selfOnly) continue;
      if (!targetAllowed(x.ability, x.owner, { kind: 'unit', unit: u }, notes)) continue;
      applyAbility(lines, x.ability, x.owner, x.cond, attributes);
      if (x.ability.magicalAttacks) magical = true;
      if (x.ability.flamingAttacks) flaming = true;
    }
    finalize(lines);
    if (!u.dmg) notes.push('Sin arma melee en los datos');
    cards.push({
      id: u.card, name: u.name, art: u.art, kind: 'unit', count: sel.count, rank, rank7: rank >= 7, caste: u.casteEs ?? u.caste, cost: u.cost,
      models: u.models, size: u.size, interval: u.interval, splash: u.splash, splashSize: u.splashSize, magicalAttacks: magical, flamingAttacks: flaming,
      missile: u.missile, stats: lines, attributes, notes,
    });
  }

  // Quitar atributos repetidos (p. ej. "Immune to Psychology" propio + del aura)
  for (const c of cards) {
    const seen = new Set<string>();
    c.attributes = c.attributes.filter((a) => {
      const k = a.name.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const campaign: ComputeResult['campaign'] = [];
  const magic: ComputeResult['magic'] = [];
  for (const { effect, skill, owner } of effects) {
    if (!effect.text) continue;
    if (effect.kind === 'campaign') campaign.push({ owner, skill, text: effect.text });
    else if (effect.kind === 'magic') magic.push({ owner, skill, text: effect.text });
  }

  return {
    cards,
    abilities: abilityStates,
    enemyDebuffs,
    builds: builds.map((b) => ({
      character: b.tree.key, name: b.tree.name, pointsUsed: b.pointsUsed, pointsAvailable: pointsAtRank(b.rank), rank: b.rank, minRank: b.minRank, warnings: b.warnings, mount: b.mountNode?.name,
      summary: summarize(b),
    })),
    campaign,
    magic,
  };
}

// ---------- Resumen acumulado de un build ----------

/** Extrae a quién aplica un efecto: "Melee attack: +8 for all non-Daemonic Infantry units (Lord's army)" -> "non-Daemonic Infantry" */
function scopeOf(text: string): string {
  const m = text.match(/^[^:]+:\s*[+-]?[\d.]+%?\s*(.*?)\s*(\((Lord's army|Hero's army|own army|all units in army|accompanying Lord)\))?\s*$/);
  let s = (m?.[1] ?? '').replace(/\(Rank 7 and above\)/i, '').trim();
  s = s.replace(/^for (all )?/i, '').replace(/ units?$/i, '').trim();
  return SCOPE_ES[s.replace(/,? and /g, ' and ')] ?? (s && s !== 'units' ? s.replace(/,? and /g, ' y ') : 'todo el ejército');
}

// Alcances genéricos en español (los que nombran unidades concretas se quedan con el nombre del juego)
const SCOPE_ES: Record<string, string> = {
  'non-Daemonic Infantry': 'Infantería no demoníaca',
  'Daemonic melee': 'Demonios de melee',
  'non-Daemonic Cavalry and Chariot': 'Caballería y carros no demoníacos',
  'non-Daemonic Missile Cavalry and Artillery': 'Caballería de proyectiles y artillería no demoníacas',
  'Daemonic Missile and Flying': 'Demonios de proyectiles y voladores',
  'non-Daemonic war beasts, monstrous and monster': 'Bestias, monstruosos y monstruos no demoníacos',
  'non-Daemonic war beasts, monstrous, and monster': 'Bestias, monstruosos y monstruos no demoníacos',
  'Infantry': 'Infantería',
  'Cavalry, Chariot and Flying': 'Caballería, carros y voladores',
  'Missile': 'Unidades de proyectiles',
  'Daemonic Flying': 'Demonios voladores',
  'Daemonic Missile': 'Demonios de proyectiles',
  'war beasts, monstrous and monster': 'Bestias, monstruosos y monstruos',
  'war beasts, monstrous, and monster': 'Bestias, monstruosos y monstruos',
  'non-Daemonic': 'Unidades no demoníacas',
  'flying': 'Voladores',
  'Cavalry and Chariot': 'Caballería y carros',
  'Daemonic': 'Demonios',
  'when fighting at sea': 'Al pelear en el mar',
  'when attacking at sea': 'Al atacar en el mar',
  'embedded Heroes': 'Héroes en el ejército',
  'when fighting against Undead factions': 'Contra facciones no muertas',
  'when fighting against Slaanesh': 'Contra Slaanesh',
};

function campaignLabel(text: string): { label: string; value?: number; pct?: boolean; scope?: string } {
  const m = text.match(/^([^:]+):\s*([+-]?\d+(?:\.\d+)?)(%?)\s*(.*)$/);
  if (!m) return { label: text };
  return { label: m[1].trim(), value: parseFloat(m[2]), pct: m[3] === '%', scope: m[4].replace(/[()]/g, '').trim() || undefined };
}

function addLine(list: SummaryLine[], line: SummaryLine) {
  const same = list.find(
    (l) => l.label === line.label && l.pct === line.pct && l.scope === line.scope && l.rank7 === line.rank7 && l.value !== undefined && line.value !== undefined,
  );
  if (same) {
    same.value = Math.round(((same.value ?? 0) + (line.value ?? 0)) * 100) / 100;
    for (const s of line.sources) if (!same.sources.includes(s)) same.sources.push(s);
  } else list.push({ ...line, sources: [...line.sources] });
}

const LABEL_ES: Partial<Record<StatKey, string>> = {
  ma: 'Ataque cuerpo a cuerpo', md: 'Defensa cuerpo a cuerpo', armour: 'Armadura', charge: 'Bonificación de carga', ld: 'Liderazgo',
  dmg: 'Fuerza de arma', ap: 'Daño perforante', hp: 'Salud', speed: 'Velocidad', bvl: 'Bonificación contra grandes',
  bvi: 'Bonificación contra infantería', resPhysical: 'Resistencia física', resMissile: 'Resistencia a proyectiles', resMagic: 'Resistencia a hechizos',
  resFlame: 'Resistencia al fuego', resWard: 'Salvación especial', missileDmg: 'Fuerza de proyectiles', ammo: 'Munición',
  reload: 'Recarga más rápida', range: 'Alcance', barrier: 'Barrera', shield: 'Bloqueo de proyectiles',
};

function summarize(b: ResolvedBuild): BuildSummary {
  const sum: BuildSummary = { self: [], army: [], lord: [], attributes: [], abilities: [], campaign: [], magic: [] };
  let lastKey = '';
  let seen = new Set<string>();
  for (const { effect, skill } of effectsOf(b)) {
    // Datos del juego: un efecto puede venir en varias partes (fuerza del arma = base + perforante,
    // o la misma stat para otro grupo de unidades, p. ej. los Regimientos de Renombre). El resumen muestra una.
    if (effect.key !== lastKey || effect.text) { lastKey = effect.key; seen = new Set(); }
    const sig = `${effect.stat ?? effect.attribute}|${effect.value}`;
    if (effect.exact && !effect.text && (seen.has(sig) || (effect.stat === 'ap' && effect.pct))) continue;
    seen.add(sig);
    if (!effect.text && !(effect.exact && (effect.kind === 'battle' || effect.kind === 'attribute'))) continue;
    if (effect.kind === 'battle' && effect.stat && effect.value !== undefined) {
      const line: SummaryLine = {
        label: LABEL_ES[effect.stat] ?? effect.stat, stat: effect.stat, value: effect.value, pct: effect.pct,
        rank7: effect.rank7, sources: [skill],
      };
      if (effect.target === 'army') addLine(sum.army, { ...line, scope: effect.exact ? effect.scope ?? 'todo el ejército' : scopeOf(effect.textEn ?? effect.text) });
      else if (effect.target === 'lord') addLine(sum.lord, line);
      else addLine(sum.self, line);
    } else if (effect.kind === 'attribute' && effect.attribute) {
      sum.attributes.push({ label: effect.attribute, scope: effect.target === 'army' ? (effect.forNames?.join(', ') ?? (effect.exact ? effect.scope ?? 'tropas' : scopeOf(effect.textEn ?? effect.text))) : 'propio', sources: [skill] });
    } else if (effect.kind === 'campaign') {
      const c = campaignLabel(effect.text);
      addLine(sum.campaign, { ...c, sources: [skill], text: c.value === undefined ? effect.text : undefined });
    } else if (effect.kind === 'magic') {
      const c = campaignLabel(effect.text);
      addLine(sum.magic, { ...c, sources: [skill], text: c.value === undefined ? effect.text : undefined });
    }
  }
  for (const { ability, skill } of abilitiesOf(b)) {
    if (ability.mode === 'none') continue;
    const detail = [
      ability.duration > 0 ? `${ability.duration} s` : '',
      ability.cooldown ? `recarga ${ability.cooldown} s` : '',
      ability.range ? `${ability.range} m` : '',
      [...ability.stats.map((s) => s.d), ...ability.attributes].join(', '),
    ].filter(Boolean).join(' · ');
    sum.abilities.push({ name: ability.name, source: skill, passive: ability.passive, mode: ability.mode, detail });
  }
  return sum;
}

/**
 * Provisional hasta re-extraer: efectos "a todos los ejércitos de la facción" que la extracción vieja dejó como campaña
 * (sin stat ni unidades). El valor sale del texto del juego; las unidades las confirmó el usuario en partida.
 * Solo actúa mientras el efecto siga sin objetivo; con la extracción nueva manda el dato del juego.
 */
const ULRIC_UNITS = new Set([
  'wh3_dlc29_emp_inf_warriors_of_ulric', 'wh3_dlc29_emp_inf_wolf_kin',
  'wh3_dlc29_emp_inf_teutogen_guard', 'wh3_dlc29_emp_inf_teutogen_guard_ror',
  'wh3_dlc29_emp_cav_knights_of_the_white_wolf', 'wh3_dlc29_emp_cav_knights_of_the_white_wolf_ror',
  'wh3_dlc29_emp_inf_hunting_hounds_ror', 'wh2_dlc13_emp_inf_swordsmen_ror_0', 'wh2_dlc13_emp_inf_huntsmen_ror_0',
]);
const FACTIONWIDE_PATCH: Record<string, { stat: StatKey; pct: boolean; units: Set<string> }> = {
  wh3_dlc29_effect_force_stat_melee_attack_ulric_units: { stat: 'ma', pct: false, units: ULRIC_UNITS },
  wh3_dlc29_effect_force_stat_weapon_strength_ulric_units: { stat: 'dmg', pct: true, units: ULRIC_UNITS },
};

type AbilityTarget = { kind: 'lord' | 'hero' | 'unit'; unit?: UnitData };
/**
 * Restricciones de objetivo del juego (special_ability_to_invalid_target_flags): la habilidad NO afecta a quien cumple el flag
 * (p. ej. la pasiva Guardián, que solo protege a señores y héroes). Solo se aplican las que están aquí; las que falten se
 * avisan en la tarjeta y la habilidad se aplica igual. true = el objetivo cumple el flag.
 */
const TARGET_FLAGS: Record<string, (t: AbilityTarget) => boolean> = {
  // "La unidad no es un Señor ni un héroe": solo afecta a señores y héroes (Guardián, Guardiana de la Zarina...)
  unit_is_not_commander_class: (t) => t.kind === 'unit',
  // "La unidad es un Señor o un héroe": solo afecta a las tropas
  unit_is_commander_class: (t) => t.kind !== 'unit',
};

function targetAllowed(a: AbilityInfo, owner: string, t: AbilityTarget, notes: string[]): boolean {
  for (const flag of a.invalidTargets ?? []) {
    const rule = TARGET_FLAGS[flag];
    if (rule) {
      if (rule(t)) return false;
      continue;
    }
    const note = `"${a.name}" (${owner}): el juego limita a quién afecta (${targetFlagText[flag] || flag}); esa regla aún no está en el planner y se aplica igual`;
    if (!notes.includes(note)) notes.push(note);
  }
  return true;
}

function applyAbility(
  lines: Record<StatKey, StatLine>, a: AbilityInfo, owner: string, cond: string, attributes: { name: string; from?: string }[],
) {
  for (const s of a.stats) {
    const stat = ABILITY_STAT_MAP[s.stat];
    if (!stat) continue;
    let value = s.v;
    // "Debilidad al fuego -20" = resistencia al fuego -20
    if (s.stat === 'stat_weakness_flame') value = s.v;
    contribute(lines, stat, { source: a.name, from: owner, value, how: s.how === 'mult' ? 'mult' : 'add', conditional: cond });
  }
  for (const at of a.attributes) attributes.push({ name: at, from: `${a.name} (${owner})` });
  if (a.flamingAttacks) attributes.push({ name: 'Ataques flamígeros', from: `${a.name} (${owner})` });
  if (a.magicalAttacks) attributes.push({ name: 'Ataques mágicos', from: `${a.name} (${owner})` });
}
