/**
 * Duelo de personajes: cuando un personaje o unidad de un solo modelo pelea contra otro de un solo modelo, lo que decide
 * la pelea no son sus stats base sino su árbol, sus objetos, su regeneración y sus habilidades. Aquí se arma al enemigo
 * (señor o héroe) como en tu planner: rango 50, todas sus habilidades de combate y únicas, y sus objetos propios.
 */
import { abilities, characterForUnit, getCharacter, getTarget } from './data.js';
import { compute, type ComputeResult } from './engine.js';
import type { ComputedCard } from './types.js';

export interface EnemyChar {
  name: string;
  /** Con pasivas y sin sus habilidades activas */
  passive: ComputedCard;
  /** Con sus habilidades activas de combate puestas */
  active: ComputedCard;
  /** Fracción del tiempo que tiene puestas sus activas si las relanza al recargarse (promedio de duración ÷ ciclo) */
  uptime: number;
  /** Regeneración (% de su vida por segundo) sin y con sus activas */
  regen: { passive: number; active: number };
  points: number;
  items: string[];
  mount?: string;
  actives: { name: string; dur: number; cd: number }[];
}

/** Regeneración de un personaje del cálculo: suma de sus habilidades puestas que curan (% de la vida por segundo) */
export function regenPct(result: ComputeResult, cardId: string): number {
  return result.abilities.filter((a) => a.ownerKey === cardId && a.active && (a.heal ?? 0) > 0 && (a.mode === 'self' || a.mode === 'allies'))
    .reduce((s, a) => s + (a.heal ?? 0), 0);
}

/** Vida por segundo que regenera esa carta (0 si no es un personaje) */
export function regenHp(result: ComputeResult, card: ComputedCard): number {
  if (card.kind === 'unit') return 0;
  return (regenPct(result, card.id) / 100) * (card.stats.hp?.final ?? 0);
}

const cache = new Map<string, EnemyChar | null>();
const ROWS = /Únicas|Combate|Básicas/;

export function enemyCharacter(unitKey: string): EnemyChar | null {
  if (cache.has(unitKey)) return cache.get(unitKey)!;
  const out = build(unitKey);
  cache.set(unitKey, out);
  return out;
}

function build(unitKey: string): EnemyChar | null {
  const charKey = characterForUnit(unitKey);
  const t = charKey ? getCharacter(charKey) : undefined;
  const u = getTarget(unitKey) ?? undefined;
  if (!t) return null;
  const levels: Record<string, number> = {};
  const abil = new Set<string>();
  t.rows.forEach((row, i) => {
    if (!ROWS.test(t.rowLabels[i] ?? '')) return;
    for (const n of row) {
      if (n.isMount || n.category === 'magic' || n.category === 'campaign' || n.category === 'army') continue;
      levels[n.key] = n.levels.length;
      for (const lv of n.levels) for (const a of lv.abilities) abil.add(a);
    }
  });
  // Montura: la de la variante de la unidad (misma vida que la carta)
  const hp = u?.hpPerModel ?? 0;
  const mountNode = t.rows.flat().find((n) => n.isMount && n.levels[0]?.mountStats && Math.abs(((n.levels[0].mountStats as any).hit_points ?? 0) + ((n.levels[0].mountStats as any).bonus_hit_points ?? 0) - hp) <= 1);
  // Objetos propios del personaje (no los genéricos de campaña): uno por tipo
  const own = (t.items ?? []).filter((it) => !it.generic && (it.owners ?? 99) <= 2 && !it.onlyFactions?.length);
  const byCat = new Map<string, string>();
  for (const it of own) if (!byCat.has(it.category)) byCat.set(it.category, it.key);
  const items = [...byCat.values()];
  for (const it of own.filter((x) => items.includes(x.key))) for (const e of it.effects) if ((e as { ability?: string }).ability) abil.add((e as { ability?: string }).ability!);
  // Activas de combate sobre sí mismo (sin hechizos): las que se encienden en la versión "con activas"
  const actives = [...abil].map((k) => abilities[k]).filter((a) => a && !a.passive && a.duration > 0 && !a.spell && (a.mode === 'self' || a.mode === 'allies'));
  const lord = { character: t.key, levels, rank: 50, items, mount: mountNode?.key ?? null };
  const r0 = compute({ lord, units: [], activeAbilities: [] });
  const r1 = compute({ lord, units: [], activeAbilities: actives.map((a) => a.key) });
  const c0 = r0.cards[0], c1 = r1.cards[0];
  if (!c0 || !c1) return null;
  const uptime = actives.length ? actives.reduce((s, a) => s + a.duration / (a.duration + Math.max(0, a.cooldown ?? 0)), 0) / actives.length : 0;
  return {
    name: t.name, passive: c0, active: c1, uptime,
    regen: { passive: regenPct(r0, c0.id), active: regenPct(r1, c1.id) },
    points: r0.builds[0]?.pointsUsed ?? 0,
    items: own.filter((x) => items.includes(x.key)).map((x) => x.name),
    mount: mountNode?.name,
    actives: actives.map((a) => ({ name: a.name, dur: a.duration, cd: a.cooldown ?? 0 })),
  };
}
