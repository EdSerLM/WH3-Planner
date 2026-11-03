/**
 * Rutas de la API sin depender de Express: las usa el servidor (index.ts) y también la web estática del celular
 * (frontend en modo estático: el mismo código corre en el navegador, sin servidor).
 */
import { ABILITY_STAT_MAP } from './engine.js';
import { abilities, DEFAULT_FACTION, getCharacter, getGraph, getTechTree, listGraphs, techSummary, listTechTrees, getUnit, listCampaign, listCharacterFactions, listCharacters, listRoster, listSubcultures, listTargets, sources, targetInfo, getTarget, bulletsInfo, groupIcons, unitAbilityInfo } from './data.js';
import { compute } from './engine.js';
import { type AttackDir, type AttackMode, applyDebuffs, attackDps, cardAsTarget, DPS_DISCLAIMER, DPS_RANGED_DISCLAIMER, duel, targetsFromCards, unitAsAttacker } from './dps.js';
import { deleteBuild, getBuild, listBuilds, upsertBuild } from './builds.js';
import { STAT_LABELS_ES } from './effects.js';
import type { ComputeRequest, ComputedCard, UnitData } from './types.js';

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

const IMMUNE_CONTACT = 'Inmune a los efectos de contacto';
type Debuff = ReturnType<typeof compute>['enemyDebuffs'][number];
/** Efecto de contacto del arma (cuerpo a cuerpo) o del proyectil (a distancia) como debuff de quien recibe el golpe */
function contactDebuff(u: UnitData | undefined, m: AttackMode, owner: string): Debuff | undefined {
  const c = u?.contact?.[m === 'ranged' ? 'missile' : 'melee'];
  if (!c) return undefined;
  const stats = c.stats.filter((s: { stat: string }) => ABILITY_STAT_MAP[s.stat]).map((s: { stat: string; how: string; v: number }) => ({ stat: ABILITY_STAT_MAP[s.stat], how: s.how, v: s.v }));
  return stats.length ? { ability: c.n, owner, contact: c.n, stats } : undefined;
}
/** Quita los efectos de contacto si el que los recibe es inmune y no repite el mismo efecto (no se acumula) */
function landed(list: (Debuff | undefined)[], immune: boolean): Debuff[] {
  const seen = new Set<string>();
  return list.filter((d): d is Debuff => !!d && !(immune && d.contact)).filter((d) => !d.contact || (!seen.has(d.contact) && !!seen.add(d.contact)));
}
/** Tu tarjeta con los debuffs que le ponen (efecto de contacto del enemigo al golpearte) */
function debuffedCard(c: ComputedCard, ds: Debuff[]): ComputedCard {
  if (!ds.length) return c;
  const stats = { ...c.stats };
  for (const d of ds) for (const s of d.stats) {
    const cur = stats[s.stat];
    if (!cur) continue;
    stats[s.stat] = { ...cur, final: Math.max(0, s.how === 'mult' ? cur.final * s.v : cur.final + s.v) };
  }
  return { ...c, stats };
}

function dpsRows(att: ComputedCard, targets: string[] | undefined, d: AttackDir, debuffs: ReturnType<typeof compute>['enemyDebuffs'], m: AttackMode = 'melee') {
  const myUnit = att.kind === 'unit' ? getTarget(att.id) : undefined;
  const meImmune = !!myUnit?.attrs?.includes(IMMUNE_CONTACT) || att.attributes?.some((a) => a.name === IMMUNE_CONTACT);
  const mine0 = contactDebuff(myUnit, m, att.name);
  return targetsFromCards(targets ?? []).map((t0) => {
    const u = getTarget(t0.id);
    const immune = !!u?.attrs?.includes(IMMUNE_CONTACT);
    // Lo que le cae al enemigo: tus hechizos/habilidades y el efecto de contacto de tu arma, salvo que sea inmune
    const onThem = landed([...debuffs, mine0], immune);
    const t = applyDebuffs(t0, onThem);
    const mine = attackDps(m, att, t, d);
    // Al revés: el enemigo (stats base, con lo que le cae) contra tu unidad; su efecto de contacto te baja a ti en el duelo
    const theirs = landed([contactDebuff(u, m, u?.name ?? '')], meImmune);
    const back = u ? duel(theirs.length ? attackDps(m, debuffedCard(att, theirs), t, d) : mine, attackDps(m, unitAsAttacker(u, onThem), cardAsTarget(att))) : undefined;
    const contact = {
      mine: mine0?.contact, theirs: u?.contact?.[m === 'ranged' ? 'missile' : 'melee']?.n,
      immune: immune && onThem.length < [...debuffs, mine0].filter(Boolean).length ? true : undefined,
      meImmune: meImmune && !!u?.contact?.[m === 'ranged' ? 'missile' : 'melee'] ? true : undefined,
      onThem: onThem.filter((x) => x.contact).map((x) => x.contact!),
    };
    return { ...mine, duel: back, contact };
  });
}

// ---------- Habilidades con duración: la pelea por tramos ----------
/** always: activas toda la pelea · once: un solo uso al empezar · relaunch: se relanzan en cuanto se recargan */
type Timing = 'always' | 'once' | 'relaunch';
type Row = ReturnType<typeof dpsRows>[number];
const MAX_TIMED = 5;

/**
 * Las habilidades activas encendidas duran unos segundos: se calcula la pelea con cada combinación de habilidades
 * puestas/quitadas y se avanza en el tiempo sumando el daño del tramo (en el juego la recarga empieza al terminar el efecto).
 */
type TimedAbility = { id: string; key: string; name: string; owner: string; icon?: string; mode: string; dur: number; cd: number };
function timedList(result: ReturnType<typeof compute>): TimedAbility[] {
  return result.abilities
    .filter((a) => a.active && !a.passive && (a.final?.duration ?? a.duration) > 0)
    .slice(0, MAX_TIMED)
    .map((a) => ({ id: a.id, key: a.key, name: a.name, owner: a.owner, icon: a.icon, mode: a.mode, dur: a.final?.duration ?? a.duration, cd: Math.max(0, a.final?.cooldown ?? a.cooldown ?? 0) }));
}
/** El ejército calculado con cada combinación de habilidades con duración puestas (bit i = habilidad i puesta) */
function maskResults(army: ComputeRequest, list: TimedAbility[], result: ReturnType<typeof compute>) {
  const full = (1 << list.length) - 1;
  const out = new Map<number, ReturnType<typeof compute>>([[full, result]]);
  for (let mask = 0; mask < full; mask++) {
    const off = new Set(list.filter((_, i) => !(mask & (1 << i))).flatMap((a) => [a.id, a.key]));
    out.set(mask, compute({ ...army, units: army.units ?? [], activeAbilities: (army.activeAbilities ?? []).filter((x) => !off.has(x)) }));
  }
  return out;
}

function timedRows(army: ComputeRequest, attacker: string, targets: string[], d: AttackDir, m: AttackMode, result: ReturnType<typeof compute>, base: Row[], timing: Timing, pre?: { list: TimedAbility[]; masks: Map<number, ReturnType<typeof compute>> }) {
  const list = pre?.list ?? timedList(result);
  if (!list.length) return { rows: base.map((r) => ({ ...r, timing: undefined })), abilities: [] };
  const masks = pre?.masks ?? maskResults(army, list, result);
  // DPS de cada lado con cada combinación; la combinación completa ya es "base"
  const full = (1 << list.length) - 1;
  const perMask = new Map<number, Map<string, { mine: number; theirs: number }>>();
  const pack = (rows: Row[]) => new Map(rows.map((r) => [r.target, { mine: r.dps, theirs: r.duel?.enemy.dps ?? 0 }]));
  perMask.set(full, pack(base));
  for (const [mask, res] of masks) {
    if (mask === full) continue;
    const att = res.cards.find((x) => x.id === attacker);
    if (att) perMask.set(mask, pack(dpsRows(att, targets, d, res.enemyDebuffs, m)));
  }
  const activeAt = (t: number, i: number, how: Timing) => {
    if (how === 'always') return true;
    const { dur, cd } = list[i];
    if (how === 'once') return t < dur;
    const cycle = dur + cd;
    return cycle <= 0 ? true : t % cycle < dur;
  };
  const maskAt = (t: number, how: Timing) => list.reduce((acc, _, i) => (activeAt(t, i, how) ? acc | (1 << i) : acc), 0);
  const DT = 0.25, MAX_T = 1800;
  /** Segundos hasta quitar "hp" de vida con el DPS de cada tramo; Infinity si no alcanza */
  const sim = (hp: number, dpsOf: (mask: number) => number, how: Timing) => {
    if (!(hp > 0)) return 0;
    let dmg = 0;
    for (let t = 0; t < MAX_T; t += DT) {
      const v = dpsOf(maskAt(t, how));
      if (dmg + v * DT >= hp) return Math.round((t + (hp - dmg) / Math.max(v, 1e-9)) * 10) / 10;
      dmg += v * DT;
    }
    return Infinity;
  };
  const rows = base.map((r) => {
    const tHp = r.detail.hpTotal, myHp = r.duel?.enemy.detail?.hpTotal ?? 0;
    const ammoOut = !Number.isFinite(r.timeToKill) && r.dps > 0; // a distancia: la munición no alcanza
    const at = (mask: number) => perMask.get(mask)?.get(r.target) ?? perMask.get(full)!.get(r.target)!;
    const calc = (how: Timing) => {
      const mine = ammoOut ? Infinity : sim(tHp, (k) => at(k).mine, how);
      const theirs = r.duel ? sim(myHp, (k) => at(k).theirs, how) : Infinity;
      return { mine, theirs };
    };
    const all = { always: calc('always'), once: calc('once'), relaunch: calc('relaunch') };
    const pick = all[timing];
    // Cuánto dura la pelea (hasta que cae uno) y qué pasó con cada habilidad en ese tiempo
    const fight = Math.min(pick.mine, pick.theirs);
    const abil = list.map((a, i) => {
      const len = Number.isFinite(fight) ? fight : 600;
      let on = 0, casts = 0;
      for (let t = 0; t < len; t += DT) {
        const now = activeAt(t, i, timing), before = t > 0 && activeAt(t - DT, i, timing);
        if (now) on += DT;
        if (now && !before) casts++;
      }
      return { name: a.name, dur: a.dur, cd: a.cd, casts: timing === 'always' ? 1 : casts, on: Math.round(Math.min(on, len) * 10) / 10, recharges: len > a.dur + a.cd };
    });
    const mineRow = { ...r, timeToKill: pick.mine };
    const duelNow = r.duel ? duel(mineRow, { ...r, timeToKill: pick.theirs, detail: r.duel.enemy.detail } as unknown as Row) : undefined;
    return {
      ...r,
      timeToKill: pick.mine,
      duel: r.duel && duelNow ? { ...r.duel, ...duelNow, enemy: { ...r.duel.enemy, timeToKill: pick.theirs } } : r.duel,
      timing: { fight: Number.isFinite(fight) ? fight : null, all, abilities: abil },
    };
  });
  return { rows, abilities: list.map(({ name, owner, icon, mode, dur, cd }) => ({ name, owner, icon, mode, dur, cd })) };
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
      const timing = (body as { timing?: Timing }).timing ?? 'relaunch';
      const base = dpsRows(att, targets, dirOf(dir), result.enemyDebuffs, mm);
      const timed = timedRows(army, attacker, targets, dirOf(dir), mm, result, base, timing);
      const rows = timed.rows.map((r) => ({ ...r, info: targetInfo(r.target) }));
      return {
        attacker: att.name, rows, timing, abilities: timed.abilities,
        disclaimer: mm === 'ranged' ? DPS_RANGED_DISCLAIMER : DPS_DISCLAIMER, debuffs: result.enemyDebuffs.map((x) => x.ability),
      };
    }
    if (a === 'dps' && b === 'matchups') {
      const { army, targets, dir, mode, timing } = body as { army: ComputeRequest; targets: string[]; dir?: AttackDir; mode?: AttackMode; timing?: Timing };
      const result = compute({ ...army, units: army.units ?? [] });
      // Mismo modo de habilidades que la tabla: cada combinación se calcula una vez para todas las cartas
      const list = timedList(result);
      const pre = list.length && (timing ?? 'relaunch') !== 'always' ? { list, masks: maskResults(army, list, result) } : undefined;
      const cards = Object.fromEntries(
        result.cards.map((x) => {
          const base = dpsRows(x, targets, dirOf(dir), result.enemyDebuffs, modeOf(mode));
          const rows = pre ? timedRows(army, x.id, targets, dirOf(dir), modeOf(mode), result, base, timing ?? 'relaunch', pre).rows : base;
          return [x.id, Object.fromEntries(rows.flatMap((r) => (r.duel ? [[r.target, r.duel.verdict]] : [])))];
        }),
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
