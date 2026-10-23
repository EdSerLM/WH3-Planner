import express from 'express';
import cors from 'cors';
import { abilities, DEFAULT_FACTION, getCharacter, getGraph, getTechTree, listGraphs, techSummary, listTechTrees, getUnit, listCampaign, listCharacterFactions, listCharacters, listRoster, listSubcultures, listTargets, sources, targetInfo, getTarget, bulletsInfo } from './data.js';
import { compute } from './engine.js';
import { type AttackDir, applyDebuffs, cardAsTarget, DPS_DISCLAIMER, duel, meleeDps, targetsFromCards, unitAsAttacker } from './dps.js';
import { deleteBuild, getBuild, listBuilds, upsertBuild } from './builds.js';
import { STAT_LABELS_ES } from './effects.js';
import type { ComputeRequest } from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 3001);

app.get('/api/health', (_req, res) => res.json({ ok: true, sources }));

app.get('/api/meta', (_req, res) => res.json({ sources, statLabels: STAT_LABELS_ES, dpsDisclaimer: DPS_DISCLAIMER }));

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
  res.json(listTargets(sc).map((u) => ({ key: u.key, name: u.name, caste: u.casteEs ?? u.caste, group: u.group, cost: u.cost, models: u.models })));
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
// body: { army: ComputeRequest, attacker: id de tarjeta, targets: [unit cards] }
app.post('/api/dps', (req, res) => {
  try {
    const { army, attacker, targets, dir } = req.body as { army: ComputeRequest; attacker: string; targets: string[]; dir?: AttackDir };
    const d: AttackDir = dir === 'flank' || dir === 'rear' ? dir : 'front';
    const result = compute({ ...army, units: army.units ?? [] });
    const att = result.cards.find((c) => c.id === attacker);
    if (!att) return res.status(404).json({ error: 'Atacante no está en el ejército' });
    const rows = targetsFromCards(targets ?? [])
      .map((t) => applyDebuffs(t, result.enemyDebuffs))
      .map((t) => {
        const mine = meleeDps(att, t, d);
        // Al revés: el enemigo (stats base, con tus debufos) contra tu unidad (con sus bufos)
        const u = getTarget(t.id);
        const back = u ? duel(mine, meleeDps(unitAsAttacker(u, result.enemyDebuffs), cardAsTarget(att))) : undefined;
        return { ...mine, info: targetInfo(t.id), duel: back };
      });
    res.json({ attacker: att.name, rows, disclaimer: DPS_DISCLAIMER, debuffs: result.enemyDebuffs.map((d) => d.ability) });
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
