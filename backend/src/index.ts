import express from 'express';
import cors from 'cors';
import { abilities, DEFAULT_FACTION, getCharacter, getGraph, getTechTree, listGraphs, techSummary, listTechTrees, getUnit, listCampaign, listCharacterFactions, listCharacters, listRoster, listSubcultures, listTargets, sources, targetInfo, getTarget, bulletsInfo, groupIcons } from './data.js';
import { compute } from './engine.js';
import { type AttackDir, type AttackMode, applyDebuffs, attackDps, cardAsTarget, DPS_DISCLAIMER, DPS_RANGED_DISCLAIMER, duel, targetsFromCards, unitAsAttacker } from './dps.js';
import { deleteBuild, getBuild, listBuilds, upsertBuild } from './builds.js';
import { STAT_LABELS_ES } from './effects.js';
import type { ComputeRequest, ComputedCard } from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 3001);

app.get('/api/health', (_req, res) => res.json({ ok: true, sources }));

app.get('/api/meta', (_req, res) => res.json({ sources, statLabels: STAT_LABELS_ES, dpsDisclaimer: DPS_DISCLAIMER, groupIcons }));

// ---------- Personajes ----------
app.get('/api/character-factions', (_req, res) => res.json({ default: DEFAULT_FACTION, factions: listCharacterFactions() }));
app.get('/api/characters', (req, res) => res.json(listCharacters(String(req.query.faction ?? '') || undefined)));

app.get('/api/characters/:key', (req, res) => {
  const c = getCharacter(req.params.key);
  if (!c) return res.status(404).json({ error: 'Personaje no encontrado' });
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
  res.json({ ...c, abilityInfo });
});

// ---------- Tecnologías ----------
app.get('/api/techs', (req, res) => res.json(listTechTrees(String(req.query.faction ?? DEFAULT_FACTION))));
// Efectos acumulados de lo investigado (tecnologías y nodos de la Pirámide)
app.post('/api/tech-summary', (req, res) => res.json(techSummary(Array.isArray(req.body?.techs) ? req.body.techs.map(String) : [])));

// Qué tecnologías cambian la tarjeta de cada unidad, señor o héroe (stats o atributos), con el mismo motor que las tarjetas.
// Se prueba cada tecnología sola; las unidades en rango 9 para que cuenten también las de "rango 7+".
// Claves: la carta de la unidad, o "lord:<clave>" / "hero:<clave>" para los personajes (sin habilidades compradas).
app.post('/api/techs/units', (req, res) => {
  const techs: string[] = Array.isArray(req.body?.techs) ? req.body.techs.map(String) : [];
  const cards: string[] = Array.isArray(req.body?.units) ? req.body.units.map(String) : [];
  const chars: { key: string; type: string }[] = Array.isArray(req.body?.chars) ? req.body.chars.filter((c: { key?: unknown }) => typeof c?.key === 'string') : [];
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
  res.json({ hits, art });
});

// Habilidades del árbol de un personaje que podrían cambiar la tarjeta de cada unidad (todas compradas al máximo,
// sin contar excluyentes ni monturas). Solo lo permanente: las auras y habilidades de batalla no cuentan.
app.post('/api/characters/potential', (req, res) => {
  const key = String(req.body?.character ?? '');
  const tree = getCharacter(key);
  if (!tree) return res.status(404).json({ error: 'Personaje no encontrado' });
  const cards: string[] = Array.isArray(req.body?.units) ? req.body.units.map(String) : [];
  const levels = Object.fromEntries(tree.rows.flat().filter((n) => !n.isMount).map((n) => [n.key, n.levels.length]));
  const build = { character: key, levels, rank: 50 };
  const isLord = req.body?.kind !== 'hero';
  const suffix = ` (${tree.name})`;
  // Por unidad: nombres de las habilidades del árbol que le cambian la tarjeta con la unidad en ese rango
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
  res.json(out);
});

// Grafos de iniciativas (Pirámide Negra): se investigan como tecnologías
app.get('/api/graphs', (req, res) => res.json(listGraphs(String(req.query.faction ?? DEFAULT_FACTION))));
app.get('/api/graphs/:key', (req, res) => {
  const g = getGraph(req.params.key);
  if (!g) return res.status(404).json({ error: 'Grafo no encontrado' });
  res.json(g);
});

app.get('/api/techs/:key', (req, res) => {
  const t = getTechTree(req.params.key, String(req.query.variant ?? '') || undefined);
  if (!t) return res.status(404).json({ error: 'Árbol de tecnologías no encontrado' });
  res.json(t);
});

// ---------- Unidades ----------
app.get('/api/units', (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase();
  const list = listRoster(String(req.query.faction ?? '') || undefined).filter((u) => !q || u.name.toLowerCase().includes(q) || u.card.includes(q));
  res.json(list.map((u) => ({ ...u, bp: bulletsInfo(u.bullets) })));
});

// Facciones de campaña de una subcultura: señores, unidades que recluta y las que consigue con mejoras
app.get('/api/campaign', (req, res) => res.json(listCampaign(String(req.query.faction ?? DEFAULT_FACTION))));

app.get('/api/units/:card', (req, res) => {
  const u = getUnit(req.params.card);
  if (!u) return res.status(404).json({ error: 'Unidad no encontrada' });
  res.json(u);
});

// ---------- Objetivos de todas las facciones ----------
app.get('/api/factions', (_req, res) => res.json(listSubcultures()));
app.get('/api/targets', (req, res) => {
  const sc = String(req.query.faction ?? '');
  res.json(listTargets(sc).map((u) => ({ key: u.key, name: u.name, caste: u.casteEs ?? u.caste, group: u.group, cost: u.cost, models: u.models, tier: u.tier })));
});

// ---------- Cálculo de bufos ----------
app.post('/api/compute', (req, res) => {
  try {
    const body = req.body as ComputeRequest;
    res.json(compute({ ...body, units: body.units ?? [] }));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// ---------- DPS ----------
// body: { army: ComputeRequest, attacker: id de tarjeta, targets: [unit cards], dir, mode: 'melee' | 'ranged' }
app.post('/api/dps', (req, res) => {
  try {
    const { army, attacker, targets, dir, mode } = req.body as { army: ComputeRequest; attacker: string; targets: string[]; dir?: AttackDir; mode?: AttackMode };
    const d: AttackDir = dir === 'flank' || dir === 'rear' ? dir : 'front';
    const m: AttackMode = mode === 'ranged' ? 'ranged' : 'melee';
    const result = compute({ ...army, units: army.units ?? [] });
    const att = result.cards.find((c) => c.id === attacker);
    if (!att) return res.status(404).json({ error: 'Atacante no está en el ejército' });
    const rows = dpsRows(att, targets, d, result.enemyDebuffs, m).map((r) => ({ ...r, info: targetInfo(r.target) }));
    res.json({ attacker: att.name, rows, disclaimer: m === 'ranged' ? DPS_RANGED_DISCLAIMER : DPS_DISCLAIMER, debuffs: result.enemyDebuffs.map((d) => d.ability) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

function dpsRows(att: ComputedCard, targets: string[] | undefined, d: AttackDir, debuffs: ReturnType<typeof compute>['enemyDebuffs'], m: AttackMode = 'melee') {
  return targetsFromCards(targets ?? [])
    .map((t) => applyDebuffs(t, debuffs))
    .map((t) => {
      const mine = attackDps(m, att, t, d);
      // Al revés: el enemigo (stats base, con tus debufos) contra tu unidad (con sus bufos), del mismo modo (a distancia,
      // si no dispara, no te hace daño)
      const u = getTarget(t.id);
      const back = u ? duel(mine, attackDps(m, unitAsAttacker(u, debuffs), cardAsTarget(att))) : undefined;
      return { ...mine, duel: back };
    });
}

// Resultado del duelo de cada tarjeta del ejército contra cada objetivo (para marcar las que mejor se enfrentan)
// body: { army, targets, dir, mode } → { cards: { [id tarjeta]: { [objetivo]: 'win' | 'even' | 'lose' } } }
app.post('/api/dps/matchups', (req, res) => {
  try {
    const { army, targets, dir, mode } = req.body as { army: ComputeRequest; targets: string[]; dir?: AttackDir; mode?: AttackMode };
    const d: AttackDir = dir === 'flank' || dir === 'rear' ? dir : 'front';
    const m: AttackMode = mode === 'ranged' ? 'ranged' : 'melee';
    const result = compute({ ...army, units: army.units ?? [] });
    const cards = Object.fromEntries(
      result.cards.map((c) => [c.id, Object.fromEntries(dpsRows(c, targets, d, result.enemyDebuffs, m).flatMap((r) => (r.duel ? [[r.target, r.duel.verdict]] : [])))]),
    );
    res.json({ cards });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// ---------- Builds guardados ----------
app.get('/api/builds', (_req, res) => res.json(listBuilds()));
app.get('/api/builds/:id', (req, res) => {
  const b = getBuild(req.params.id);
  if (!b) return res.status(404).json({ error: 'Build no encontrado' });
  res.json(b);
});
app.post('/api/builds', (req, res) => {
  const { id, name, notes, army } = req.body ?? {};
  if (!name || !army) return res.status(400).json({ error: 'Faltan name y army' });
  res.json(upsertBuild({ id, name, notes, army }));
});
app.delete('/api/builds/:id', (req, res) => {
  res.json({ deleted: deleteBuild(req.params.id) });
});

app.listen(PORT, () => {
  console.log(`WH3 Planner API escuchando en http://localhost:${PORT}`);
  console.log(`Datos: ${sources.skills} | ${sources.units}`);
  console.log(sources.gameTrees ? `Árboles de todas las facciones (datos de tu juego): ${sources.gameTrees}` : 'Árboles: solo Guerreros del Caos (corre npm run extraer para todas las facciones)');
  console.log(sources.allUnits ? `Unidades de todas las facciones: ${sources.allUnits}` : 'Sin unidades de otras facciones (corre npm run extraer)');
  console.log(sources.officialLoc ? `Textos oficiales en español: ${sources.officialLoc}` : "Sin textos oficiales (backend/data/loc-es): se usa el glosario propio");
});
