import { getTarget } from './data.js';
import type { ComputedCard, DpsTarget, StatKey, UnitData } from './types.js';

/**
 * Fórmula del proyecto (melee):
 *  Acierto = 35 + Ataque melee (+ bonus vs tipo) − Defensa melee del objetivo, entre 8% y 90%.
 *  Daño por golpe = Daño base × (1 − 0.75 × Armadura/100) + Daño perforante (armadura máx. 100),
 *                   sin superar la vida por modelo del objetivo.
 *  DPS = Modelos × Acierto × Daño por golpe ÷ Intervalo de ataque.
 *  Tiempo para matar = Vida total ÷ DPS.  Eficiencia = DPS por cada 1000 de coste.
 * Extra: se aplica la resistencia más alta que corresponda (física, fuego si es flamígero,
 * mágica si es mágico, o salvación), como hace el juego.
 */

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

export function unitAsTarget(u: UnitData): DpsTarget {
  return {
    id: u.card, name: u.name, models: u.models, hpPerModel: u.hpPerModel, md: u.md, armour: u.armour,
    isLarge: u.size === 'large' || u.size === 'very_large', isInfantry: /infantry|infanter/i.test(u.caste), cost: u.cost,
    res: { physical: u.res.physical, magic: u.res.magic, flame: u.res.flame, ward: u.res.ward },
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

export function meleeDps(att: ComputedCard, t: DpsTarget): DpsRow {
  const s = (k: StatKey) => att.stats[k].final;
  const bonus = (t.isLarge ? s('bvl') : 0) + (t.isInfantry ? s('bvi') : 0);
  const hit = Math.min(90, Math.max(8, 35 + s('ma') + bonus - t.md)) / 100;
  const armour = Math.min(100, t.armour);
  let perHit = s('dmg') * (1 - (0.75 * armour) / 100) + s('ap');
  const applicable = [t.res.physical, t.res.ward];
  if (att.flamingAttacks) applicable.push(t.res.flame);
  if (att.magicalAttacks) applicable.push(t.res.magic);
  // Si es flamígero y el objetivo tiene debilidad al fuego (resistencia negativa), esa manda
  let res = Math.min(90, Math.max(...applicable));
  if (att.flamingAttacks && t.res.flame < 0 && t.res.flame < res && Math.max(t.res.physical, t.res.ward) <= 0) res = t.res.flame;
  perHit = perHit * (1 - res / 100);
  perHit = Math.min(perHit, t.hpPerModel);
  const interval = att.interval || 4;
  const dps = (att.models * hit * perHit) / interval;
  const totalHp = t.models * t.hpPerModel;
  return {
    target: t.id,
    targetName: t.name,
    hitChance: Math.round(hit * 1000) / 10,
    dmgPerHit: Math.round(perHit * 10) / 10,
    resistanceUsed: res,
    dps: Math.round(dps * 10) / 10,
    timeToKill: dps > 0 ? Math.round((totalHp / dps) * 10) / 10 : Infinity,
    efficiency: att.cost ? Math.round((dps / att.cost) * 1000 * 10) / 10 : null,
  };
}

export function targetsFromCards(cards: string[]): DpsTarget[] {
  return cards.map((c) => getTarget(c)).filter((u): u is UnitData => !!u).map(unitAsTarget);
}

export const DPS_DISCLAIMER =
  'No cuenta: carga, splash (golpes a varios modelos), colisiones, que no todos los modelos peleen a la vez, ' +
  'liderazgo/huida ni el daño extra de la bonificación contra tipo. Subestima a monstruos y carros.';
