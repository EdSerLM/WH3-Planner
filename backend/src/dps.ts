import { getTarget } from './data.js';
import type { ComputedCard, DpsTarget, StatKey, UnitData } from './types.js';

/**
 * Cálculo melee como lo hace el juego (constantes de _kv_rules en db.pack; ver claude/formulas-dano-wh3.md):
 *  Acierto = 35 + Ataque + bonus vs tipo − Defensa (×0.6 por el flanco, ×0.3 por la espalda), entre 8% y 90%.
 *  El bonus vs grandes/infantería también se suma al daño, repartido como el arma entre base y perforante.
 *  Armadura: reduce solo el daño base con una tirada entre 50% y 100% de su valor (tope 100%); se usa la media,
 *            así que la armadura de más de 100 sigue contando hasta 200.
 *  Resistencias: se suman (salvación + física + fuego si es flamígero), tope 90%. Los ataques mágicos
 *            ignoran la física; la resistencia a hechizos no aplica a ataques normales.
 *  Daño por golpe sin superar la vida por modelo. DPS = Modelos × Acierto × Daño por golpe ÷ Intervalo.
 *  Tiempo para matar = Vida total ÷ DPS.  Eficiencia = DPS por cada 1000 de coste.
 */

/** Dirección del ataque: de frente, por el flanco o por la espalda (multiplica la defensa del objetivo) */
export type AttackDir = 'front' | 'flank' | 'rear';
export const DIR_MD: Record<AttackDir, number> = { front: 1, flank: 0.6, rear: 0.3 };

/** Reducción media de la armadura (0..1): tirada uniforme entre A/2 y A, cada punto = 1%, tope 100% */
export function armourReduction(a: number): number {
  if (a <= 0) return 0;
  const lo = a / 2;
  if (a <= 100) return (0.75 * a) / 100;
  if (lo >= 100) return 1;
  return (((100 - lo) * (lo + 100)) / 2 + (a - 100) * 100) / (a - lo) / 100;
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
  /** Números usados en el cálculo (para explicar la fila) */
  detail: {
    ma: number; bonus: number; md: number; mdBase: number; dir: AttackDir; armour: number; armourRed: number;
    dmg: number; ap: number; bonusBase: number; bonusAp: number; models: number; interval: number; hpTotal: number;
    res: { ward: number; physical: number; flame: number; magicalIgnoresPhysical: boolean };
    /** Daño en área: modelos que alcanza cada golpe (1 = golpe concentrado) y por qué */
    splash: { n: number; max: number; size?: string; why?: string };
  };
}

const SMALL = new Set(['small', 'very_small', '']);
const SIZES = ['very_small', 'small', 'medium', 'large', 'very_large'];

/**
 * Modelos que alcanza cada golpe con daño en área (melee_weapons del juego): hasta splash_attack_max_attacks, solo
 * contra objetivos de tamaño splash_attack_target_size o menor, y nunca contra objetivos de alta prioridad
 * (main_units.is_high_threat), que reciben el golpe concentrado. No pasa de los modelos que tiene el objetivo.
 */
function splashTargets(att: ComputedCard, t: DpsTarget): { n: number; why?: string } {
  const max = att.splash ?? 1;
  if (max <= 1) return { n: 1 };
  if (!att.splashSize) return { n: 1, why: 'faltan datos del tamaño: re-extraer' };
  if (t.highThreat) return { n: 1, why: 'objetivo de alta prioridad: golpe concentrado' };
  const ts = SIZES.indexOf(t.size ?? ''), ss = SIZES.indexOf(att.splashSize);
  if (ts < 0 || ss < 0) return { n: 1, why: 'tamaño desconocido' };
  if (ts > ss) return { n: 1, why: `objetivo más grande que ${att.splashSize}` };
  return { n: Math.max(1, Math.min(max, t.models)) };
}

export function unitAsTarget(u: UnitData): DpsTarget {
  return {
    id: u.card, name: u.name, models: u.models, hpPerModel: u.hpPerModel, md: u.md, armour: u.armour,
    // En el juego "grande" es todo lo que no es pequeño (caballería, carros, monstruos...); la bonificación contra
    // infantería se aplica a lo pequeño
    isLarge: !SMALL.has(u.size), isInfantry: SMALL.has(u.size), cost: u.cost,
    res: { physical: u.res.physical, magic: u.res.magic, flame: u.res.flame, ward: u.res.ward },
    size: u.size, highThreat: u.highThreat,
  };
}

export function applyDebuffs(t: DpsTarget, debuffs: { stats: { stat: StatKey; how: string; v: number }[] }[]): DpsTarget {
  const out = { ...t, res: { ...t.res } };
  for (const d of debuffs) {
    for (const s of d.stats) {
      const mult = s.how === 'mult';
      const apply = (v: number) => (mult ? v * s.v : v + s.v);
      if (s.stat === 'md') out.md = Math.max(0, apply(out.md));
      else if (s.stat === 'armour') out.armour = Math.max(0, apply(out.armour));
      else if (s.stat === 'resFlame') out.res.flame = apply(out.res.flame);
      else if (s.stat === 'resPhysical') out.res.physical = apply(out.res.physical);
      else if (s.stat === 'resWard') out.res.ward = apply(out.res.ward);
    }
  }
  return out;
}

export function meleeDps(att: ComputedCard, t: DpsTarget, dir: AttackDir = 'front'): DpsRow {
  const s = (k: StatKey) => att.stats[k]?.final ?? 0;
  const bonus = (t.isLarge ? s('bvl') : 0) + (t.isInfantry ? s('bvi') : 0);
  const md = t.md * DIR_MD[dir];
  const hit = Math.min(90, Math.max(8, 35 + s('ma') + bonus - md)) / 100;
  // El bonus vs tipo se reparte entre daño base y perforante con la proporción del arma
  const dmg = s('dmg'), ap = s('ap');
  const apRatio = dmg + ap > 0 ? ap / (dmg + ap) : 0;
  const bonusBase = bonus * (1 - apRatio), bonusAp = bonus * apRatio;
  const armourRed = armourReduction(t.armour);
  let perHit = (dmg + bonusBase) * (1 - armourRed) + ap + bonusAp;
  // Resistencias: se suman, tope 90% (la debilidad al fuego puede hacerlas negativas)
  const physical = att.magicalAttacks ? 0 : t.res.physical;
  const flame = att.flamingAttacks ? t.res.flame : 0;
  const res = Math.max(-100, Math.min(90, t.res.ward + physical + flame));
  perHit = perHit * (1 - res / 100);
  // Sin daño en área el golpe no pasa de la vida de un modelo. Con daño en área el daño del golpe se reparte entre
  // varios modelos: no se pierde en uno solo, pero tampoco se multiplica (los datos no dicen si se copia a cada uno)
  const splash = splashTargets(att, t);
  perHit = Math.min(perHit, t.hpPerModel * splash.n);
  const interval = att.interval || 4;
  const dps = (att.models * hit * perHit) / interval;
  const totalHp = t.models * t.hpPerModel;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    target: t.id,
    targetName: t.name,
    hitChance: Math.round(hit * 1000) / 10,
    dmgPerHit: Math.round(perHit * 10) / 10,
    resistanceUsed: res,
    dps: Math.round(dps * 10) / 10,
    timeToKill: dps > 0 ? Math.round((totalHp / dps) * 10) / 10 : Infinity,
    efficiency: att.cost ? Math.round((dps / att.cost) * 1000 * 10) / 10 : null,
    detail: {
      ma: s('ma'), bonus, md: r1(md), mdBase: t.md, dir, armour: t.armour, armourRed: r1(armourRed * 100),
      dmg: r1(dmg), ap: r1(ap), bonusBase: r1(bonusBase), bonusAp: r1(bonusAp), models: att.models, interval, hpTotal: totalHp,
      res: { ward: t.res.ward, physical: t.res.physical, flame, magicalIgnoresPhysical: !!att.magicalAttacks && t.res.physical !== 0 },
      splash: { n: splash.n, max: att.splash ?? 1, size: att.splashSize, why: splash.why },
    },
  };
}

/** Unidad enemiga como atacante (stats base del juego, con tus debufos de ataque si los hay) */
export function unitAsAttacker(u: UnitData, debuffs: { stats: { stat: StatKey; how: string; v: number }[] }[] = []): ComputedCard {
  const vals: Partial<Record<StatKey, number>> = { ma: u.ma, dmg: u.dmg, ap: u.ap, bvl: u.bvl ?? 0, bvi: u.bvi ?? 0 };
  for (const d of debuffs) for (const s of d.stats) {
    if (vals[s.stat] === undefined) continue;
    vals[s.stat] = Math.max(0, s.how === 'mult' ? vals[s.stat]! * s.v : vals[s.stat]! + s.v);
  }
  const stats = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, { stat: k, base: v, final: v, contributions: [] }]));
  return {
    id: u.card, name: u.name, kind: 'unit', count: 1, cost: u.cost, models: u.models, size: u.size, interval: u.interval,
    splash: u.splash, splashSize: u.splashSize, magicalAttacks: !!u.magical, flamingAttacks: !!u.flaming, stats, attributes: [], notes: [],
  } as unknown as ComputedCard;
}

/** Tu tarjeta (con bufos) como objetivo del enemigo */
export function cardAsTarget(c: ComputedCard): DpsTarget {
  const f = (k: StatKey) => c.stats[k]?.final ?? 0;
  const large = !SMALL.has(c.size ?? '');
  return {
    id: c.id, name: c.name, models: c.models, hpPerModel: f('hp'), md: f('md'), armour: f('armour'),
    isLarge: large, isInfantry: !large, cost: c.cost,
    res: { physical: f('resPhysical'), magic: f('resMagic'), flame: f('resFlame'), ward: f('resWard') },
    size: c.size,
  };
}

/**
 * Quién gana el duelo: compara cuánto tardas en matarlos contra cuánto tardan ellos en matarte.
 * ratio = su tiempo / tu tiempo (>1 = ganas).
 */
export function duel(mine: DpsRow, theirs: DpsRow) {
  const a = mine.timeToKill, b = theirs.timeToKill;
  const ratio = !Number.isFinite(a) && !Number.isFinite(b) ? 1 : !Number.isFinite(a) ? 0 : !Number.isFinite(b) ? 99 : b / a;
  const verdict: 'win' | 'lose' | 'even' = ratio >= 1.2 ? 'win' : ratio <= 1 / 1.2 ? 'lose' : 'even';
  // El cálculo hace pelear a todos los modelos a la vez; con 3 veces más modelos o más (umbral de la app, no del juego),
  // la unidad numerosa sale sobreestimada porque en la batalla solo pelean los que están en contacto
  const mineM = mine.detail.models, theirM = theirs.detail.models;
  const crowd = theirM >= mineM * 3 ? 'enemy' : mineM >= theirM * 3 ? 'mine' : undefined;
  return {
    verdict, ratio: Math.round(ratio * 100) / 100, crowd, models: { mine: mineM, theirs: theirM },
    enemy: { hitChance: theirs.hitChance, dmgPerHit: theirs.dmgPerHit, resistanceUsed: theirs.resistanceUsed, dps: theirs.dps, timeToKill: theirs.timeToKill, detail: theirs.detail },
  };
}

export function targetsFromCards(cards: string[]): DpsTarget[] {
  return cards.map((c) => getTarget(c)).filter((u): u is UnitData => !!u).map(unitAsTarget);
}

export const DPS_DISCLAIMER =
  'Daño en área (datos del juego): el golpe se reparte entre varios modelos en vez de perderse en uno; si el juego ' +
  'copia el daño completo a cada modelo, aún se queda corto. No cuenta: carga, colisiones, que no todos los modelos ' +
  'peleen a la vez (⚠ en duelos con 3× más modelos o más) ni liderazgo/huida. Usa la tirada media de armadura.';
