/**
 * Rutas de la API sin depender de Express: las usa el servidor (index.ts) y también la web estática del celular
 * (frontend en modo estático: el mismo código corre en el navegador, sin servidor).
 */
import { abilities, DEFAULT_FACTION, getCharacter, getGraph, getTechTree, listGraphs, techSummary, listTechTrees, getUnit, listCampaign, listCharacterFactions, listCharacters, listRoster, listSubcultures, listTargets, sources, targetInfo, getTarget, bulletsInfo, groupIcons, unitAbilityInfo } from './data.js';
import { compute } from './engine.js';
import { type AttackDir, type AttackMode, applyDebuffs, attackDps, cardAsTarget, DPS_DISCLAIMER, DPS_RANGED_DISCLAIMER, duel, targetsFromCards, unitAsAttacker } from './dps.js';
import { deleteBuild, getBuild, listBuilds, upsertBuild } from './builds.js';
import { STAT_LABELS_ES } from './effects.js';
import type { ComputeRequest, ComputedCard } from './types.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Q = Record<string, string | undefined>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;

function character(key: string) {
  const c = getCharacter(key);
  if (!c) throw new HttpError(404, 'Personaje no encontrado');
  // Adjuntar la info de las habilidades/hechizos que aparecen en el árbol
  const keys = new Set<string>();
  for (const n of [...c.rows.flat(), ...c.background]) {
    for (const l of n.levels) {
      l.abilities.forEach((k) => keys.add(k));
      for (const e of l.effects) if (e.ability) keys.add(e.ability);
    }
  }
  for (const it of c.items ?? []) for (const e of it.effects) if (e.ability) keys.add(e.ability);
  const abilityInfo = Object.fromEntries([...keys].filter((k) => abilities[k]).map((k) => [k, abilities[k]]));
  return { ...c, abilityInfo };
}

// Qué tecnologías cambian la tarjeta de cada unidad, señor o héroe (stats o atributos), con el mismo motor que las tarjetas.
// Se prueba cada tecnología sola; las unidades en rango 9 para que cuenten también las de "rango 7+".
// Claves: la carta de la unidad, o "lord:<clave>" / "hero:<clave>" para los personajes (sin habilidades compradas).
function techUnits(body: Body) {
  const techs: string[] = Array.isArray(body?.techs) ? body.techs.map(String) : [];
  const cards: string[] = Array.isArray(body?.units) ? body.units.map(String) : [];
  const chars: { key: string; type: string }[] = Array.isArray(body?.chars) ? body.chars.filter((c: { key?: unknown }) => typeof c?.key === 'string') : [];
  const hits: Record<string, string[]> = {};
  const art: Record<string, string> = {};
  const units = cards.map((card) => ({ card, count: 1, rank: 9 }));
  const heroes = chars.filter((c) => c.type === 'hero').map((c) => ({ character: c.key, levels: {} }));
  const lords = chars.filter((c) => c.type === 'lord').map((c) => ({ character: c.key, levels: {} }));
  const touched = (c: ComputedCard) =>
    Object.values(c.stats).some((l) => l.contributions.some((x) => x.from === 'Tecnologías')) || c.attributes.some((a) => a.from?.endsWith('(Tecnologías)'));
  const run = (t: string, lord: (typeof lords)[number] | null, withRest: boolean) => {
    const r = compute({ lord, heroes: withRest ? heroes : [], units: withRest ? units : [], techs: [t], activeAbilities: [], inAura: true } as ComputeRequest);
    for (const c of r.cards) {
      const k = c.kind === 'unit' ? c.id : `${c.kind}:${c.id}`;
      if (c.kind !== 'unit' && c.art) art[k] = c.art;
      if (touched(c)) (hits[k] ??= []).push(t);
    }
  };
  for (const t of new Set(techs)) {
    run(t, null, true);
    for (const l of lords) run(t, l, false); // un señor por cálculo: los bufos "solo señores" dependen de eso
  }
  return { hits, art };
}

// Habilidades del árbol de un personaje que podrían cambiar la tarjeta de cada unidad (todas compradas al máximo,
// sin contar excluyentes ni monturas). Solo lo permanente: las auras y habilidades de batalla no cuentan.
function potential(body: Body) {
  const key = String(body?.character ?? '');
  const tree = getCharacter(key);
  if (!tree) throw new HttpError(404, 'Personaje no encontrado');
  const cards: string[] = Array.isArray(body?.units) ? body.units.map(String) : [];
  const levels = Object.fromEntries(tree.rows.flat().filter((n) => !n.isMount).map((n) => [n.key, n.levels.length]));
  const build = { character: key, levels, rank: 50 };
  const isLord = body?.kind !== 'hero';
  const suffix = ` (${tree.name})`;
  const skillsAt = (rank: number) => {
    const r = compute({ lord: isLord ? build : null, heroes: isLord ? [] : [build], units: cards.map((card) => ({ card, count: 1, rank })), techs: [], activeAbilities: [], inAura: true } as ComputeRequest);
    const inBattle = new Set(r.abilities.filter((a) => a.owner === tree.name).map((a) => a.name));
    const m = new Map<string, Set<string>>();
    for (const c of r.cards) {
      if (c.kind !== 'unit') continue;
      const s = new Set<string>();
      for (const l of Object.values(c.stats)) for (const x of l.contributions) if (x.from === tree.name && !inBattle.has(x.source)) s.add(x.source);
      for (const a of c.attributes) if (a.from?.endsWith(suffix) && !inBattle.has(a.from.slice(0, -suffix.length))) s.add(a.from.slice(0, -suffix.length));
      m.set(c.id, s);
    }
    return m;
  };
  // Rango 1 (los que crecen por rango ya cuentan) y rango 9: lo que solo aparece en el 9 es de "rango 7+" (o el mínimo que pida)
  const low = skillsAt(1), high = skillsAt(9);
  const out: Record<string, { now: string[]; r7: string[] }> = {};
  for (const [card, s] of high) {
    const base = low.get(card) ?? new Set<string>();
    const now = [...base], r7 = [...s].filter((x) => !base.has(x));
    if (now.length || r7.length) out[card] = { now, r7 };
  }
  return out;
}

function dpsRows(att: ComputedCard, targets: string[] | undefined, d: AttackDir, debuffs: ReturnType<typeof compute>['enemyDebuffs'], m: AttackMode = 'melee') {
  return targetsFromCards(targets ?? [])
    .map((t) => applyDebuffs(t, debuffs))
    .map((t) => {
      const mine = attackDps(m, att, t, d);
      // Al revés: el enemigo (stats base, con tus debufos) contra tu unidad (con sus bufos), del mismo modo
      const u = getTarget(t.id);
      const back = u ? duel(mine, attackDps(m, unitAsAttacker(u, debuffs), cardAsTarget(att))) : undefined;
      return { ...mine, duel: back };
    });
}

const dirOf = (dir: unknown): AttackDir => (dir === 'flank' || dir === 'rear' ? dir : 'front');
const modeOf = (mode: unknown): AttackMode => (mode === 'ranged' ? 'ranged' : 'melee');

/** Resuelve una petición: GET/POST/DELETE con ruta (/api/...), parámetros de la URL y cuerpo JSON */
export function handle(method: string, path: string, q: Q, body: Body): unknown {
  const m = method.toUpperCase();
  const seg = path.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = seg;
  if (m === 'GET') {
    if (a === 'health') return { ok: true, sources };
    if (a === 'meta') return { sources, statLabels: STAT_LABELS_ES, dpsDisclaimer: DPS_DISCLAIMER, groupIcons };
    if (a === 'character-factions') return { default: DEFAULT_FACTION, factions: listCharacterFactions() };
    if (a === 'characters' && !b) return listCharacters(q.faction || undefined);
    if (a === 'characters' && b) return character(b);
    if (a === 'techs' && !b) return listTechTrees(q.faction ?? DEFAULT_FACTION);
    if (a === 'techs' && b) {
      const t = getTechTree(b, q.variant || undefined);
      if (!t) throw new HttpError(404, 'Árbol de tecnologías no encontrado');
      return t;
    }
    if (a === 'graphs' && !b) return listGraphs(q.faction ?? DEFAULT_FACTION);
    if (a === 'graphs' && b) {
      const g = getGraph(b);
      if (!g) throw new HttpError(404, 'Grafo no encontrado');
      return g;
    }
    if (a === 'units' && !b) {
      const qq = (q.q ?? '').toLowerCase();
      const list = listRoster(q.faction || undefined).filter((u) => !qq || u.name.toLowerCase().includes(qq) || u.card.includes(qq));
      return list.map((u) => ({ ...u, bp: bulletsInfo(u.bullets) }));
    }
    if (a === 'units' && b) {
      const u = getUnit(b);
      if (!u) throw new HttpError(404, 'Unidad no encontrada');
      return u;
    }
    if (a === 'campaign') return listCampaign(q.faction ?? DEFAULT_FACTION);
    if (a === 'unit-abilities') return unitAbilityInfo(q.unit ?? '', (q.names ?? '').split('|').map((s) => s.trim()).filter(Boolean));
    if (a === 'factions') return listSubcultures();
    if (a === 'targets') return listTargets(q.faction ?? '').map((u) => ({ key: u.key, name: u.name, caste: u.casteEs ?? u.caste, group: u.group, cost: u.cost, models: u.models, tier: u.tier }));
    if (a === 'builds' && !b) return listBuilds();
    if (a === 'builds' && b) {
      const x = getBuild(b);
      if (!x) throw new HttpError(404, 'Build no encontrado');
      return x;
    }
  }
  if (m === 'POST') {
    if (a === 'tech-summary') return techSummary(Array.isArray(body?.techs) ? body.techs.map(String) : []);
    if (a === 'techs' && b === 'units') return techUnits(body);
    if (a === 'characters' && b === 'potential') return potential(body);
    if (a === 'compute') {
      try { return compute({ ...(body as ComputeRequest), units: body?.units ?? [] }); } catch (e) { throw new HttpError(400, (e as Error).message); }
    }
    if (a === 'dps' && !b) {
      const { army, attacker, targets, dir, mode } = body as { army: ComputeRequest; attacker: string; targets: string[]; dir?: AttackDir; mode?: AttackMode };
      const mm = modeOf(mode);
      const result = compute({ ...army, units: army.units ?? [] });
      const att = result.cards.find((x) => x.id === attacker);
      if (!att) throw new HttpError(404, 'Atacante no está en el ejército');
      const rows = dpsRows(att, targets, dirOf(dir), result.enemyDebuffs, mm).map((r) => ({ ...r, info: targetInfo(r.target) }));
      return { attacker: att.name, rows, disclaimer: mm === 'ranged' ? DPS_RANGED_DISCLAIMER : DPS_DISCLAIMER, debuffs: result.enemyDebuffs.map((x) => x.ability) };
    }
    if (a === 'dps' && b === 'matchups') {
      const { army, targets, dir, mode } = body as { army: ComputeRequest; targets: string[]; dir?: AttackDir; mode?: AttackMode };
      const result = compute({ ...army, units: army.units ?? [] });
      const cards = Object.fromEntries(
        result.cards.map((x) => [x.id, Object.fromEntries(dpsRows(x, targets, dirOf(dir), result.enemyDebuffs, modeOf(mode)).flatMap((r) => (r.duel ? [[r.target, r.duel.verdict]] : [])))]),
      );
      return { cards };
    }
    if (a === 'builds') {
      const { id, name, notes, army } = body ?? {};
      if (!name || !army) throw new HttpError(400, 'Faltan name y army');
      return upsertBuild({ id, name, notes, army });
    }
  }
  if (m === 'DELETE' && a === 'builds' && b) return { deleted: deleteBuild(b) };
  void c;
  throw new HttpError(404, `Ruta no encontrada: ${m} ${path}`);
}
