import express from 'express';
import cors from 'cors';
import { abilities, getCharacter, getUnit, listCharacters, listUnits, sources } from './data.js';
import { compute } from './engine.js';
import { applyDebuffs, DPS_DISCLAIMER, meleeDps, targetsFromCards } from './dps.js';
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
app.get('/api/characters', (_req, res) => res.json(listCharacters()));

app.get('/api/characters/:key', (req, res) => {
  const c = getCharacter(req.params.key);
  if (!c) return res.status(404).json({ error: 'Personaje no encontrado' });
  // Adjuntar la info de las habilidades/hechizos que aparecen en el árbol
  const keys = new Set<string>();
  for (const n of [...c.rows.flat(), ...c.background]) for (const l of n.levels) l.abilities.forEach((k) => keys.add(k));
  const abilityInfo = Object.fromEntries([...keys].filter((k) => abilities[k]).map((k) => [k, abilities[k]]));
  res.json({ ...c, abilityInfo });
});

// ---------- Unidades ----------
app.get('/api/units', (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase();
  const list = listUnits().filter((u) => !q || u.name.toLowerCase().includes(q) || u.card.includes(q));
  res.json(list);
});

app.get('/api/units/:card', (req, res) => {
  const u = getUnit(req.params.card);
  if (!u) return res.status(404).json({ error: 'Unidad no encontrada' });
  res.json(u);
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
    const { army, attacker, targets } = req.body as { army: ComputeRequest; attacker: string; targets: string[] };
    const result = compute({ ...army, units: army.units ?? [] });
    const att = result.cards.find((c) => c.id === attacker);
    if (!att) return res.status(404).json({ error: 'Atacante no está en el ejército' });
    const rows = targetsFromCards(targets ?? [])
      .map((t) => applyDebuffs(t, result.enemyDebuffs))
      .map((t) => meleeDps(att, t));
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
  console.log(sources.officialLoc ? `Textos oficiales en español: ${sources.officialLoc}` : "Sin textos oficiales (backend/data/loc-es): se usa el glosario propio");
});
