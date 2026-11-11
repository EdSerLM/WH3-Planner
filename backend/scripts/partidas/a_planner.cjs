// Convierte los JSON de leer_partida.py a ejércitos del planner (formato de «Mis ejércitos») y los cifra.
// Uso: PARTIDAS_PASSWORD=... node backend/scripts/partidas/a_planner.cjs <carpeta_json> frontend/public/partidas
// Cifrado: PBKDF2-SHA256 (ITER vueltas, sal aleatoria) -> AES-256-GCM. index.json lleva la sal; cada archivo su iv.
// La contraseña nunca se guarda en el repositorio: sin ella no se puede leer nada de lo publicado.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PASS = process.env.PARTIDAS_PASSWORD;
if (!PASS) { console.error('Falta PARTIDAS_PASSWORD'); process.exit(1); }
const ITER = 300000;
const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(PASS, salt, ITER, 32, 'sha256');
const seal = (obj) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()]);
  return { iv: iv.toString('base64'), ct: ct.toString('base64') };
};
const repo = path.join(__dirname, '..', '..', '..');
const [inDir, outDir] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(path.join(repo, 'backend/data/raw/wh3_all_skills.json'), 'utf8'));
const U = JSON.parse(fs.readFileSync(path.join(repo, 'backend/data/raw/wh3_all_units.json'), 'utf8'));
const unitByKey = new Map(U.units.map((u) => [u.key, u]));
const camps = new Map(U.campaign.map((c) => [c.key, c]));
// Habilidades sin efecto en batalla que el planner no muestra
const lootKeys = new Set((g.loot ?? []).map((l) => l.k));
const bannerKeys = new Set(Object.keys(g.banners ?? {}));
const ancName = (k) => g.ancillaries?.[k]?.n ?? g.banners?.[k]?.n ?? k;
const IGNORE = /agent_action_success_scaling|army_of_renown|dummy_agent_actions|agent_actions_|path_to_glory_cost_modifier|hidden_.*_title|_technical$/;
fs.mkdirSync(outDir, { recursive: true });
// Se reescribe todo: fuera los archivos anteriores (también los que estaban sin cifrar)
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.json')) fs.rmSync(path.join(outDir, f));
const index = [];
for (const f of fs.readdirSync(inDir).filter((x) => x.endsWith('.json'))) {
  const { meta, armies, reserve, techs } = JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8'));
  const camp = camps.get(meta.player);
  const warn = [];
  let notes;
  const sub = camp?.subculture;
  const charOf = (subtype) => {
    const cs = g.characters.filter((c) => c.subtype === subtype);
    return cs.find((c) => c.home === sub) ?? cs.find((c) => c.subcultures.includes(sub)) ?? cs[0];
  };
  const build = (ch, unitKey, banner) => {
    const c = charOf(ch.subtype);
    if (!c) { warn.push(`Personaje sin datos en el planner: ${ch.subtype}`); return null; }
    const id = c.home === sub || !sub ? c.key : `${c.key}@${sub}`;
    const all = [...c.nodes, ...c.bg];
    const bySkill = new Map();
    for (const n of all) if (!n.sc || n.sc === sub) if (!bySkill.has(n.s) || n.sc) bySkill.set(n.s, n);
    const levels = {}; let innate; const miss = [];
    for (const [sk, lv] of ch.skills ?? []) {
      if (IGNORE.test(sk)) continue;
      const n = bySkill.get(sk);
      if (!n) { warn.push(`${c.name}: habilidad ${sk} no está en el árbol del planner`); miss.push(sk); continue; }
      if (c.bg.includes(n)) { innate = n.k; continue; }
      levels[n.k] = lv;
    }
    if (!innate && ch.innate) innate = bySkill.get(ch.innate)?.k;
    // Montura: la que corresponde a la unidad con la que va en el ejército
    let mount = null;
    for (const [sk, m] of Object.entries(c.mounts ?? {})) if (m.unit === unitKey) mount = bySkill.get(sk)?.k ?? null;
    const itemKeys = new Set((c.items ?? []).map((i) => i.k));
    // Los estandartes mágicos se guardan en el personaje pero los lleva una unidad (va en la unidad)
    const mine = (ch.items ?? []).filter((k) => !/_anc_mount_/.test(k) && !bannerKeys.has(k));
    const items = mine.filter((k) => itemKeys.has(k) || lootKeys.has(k));
    const other = mine.filter((k) => !items.includes(k));
    if (other.length) notes.push(`${c.name}: ${other.length} objetos que el planner no tiene (${other.map(ancName).join(', ')})`);
    if (miss.length) notes.push(`${c.name}: ${miss.length} habilidades que el planner no tiene (${miss.join(', ')})`);
    const sel = { character: id, levels, rank: ch.rank || 1, items };
    if (mount) sel.mount = mount;
    if (innate) sel.innate = innate;
    if (banner) sel.banner = banner;
    // Rasgos de mecánicas que el planner trata como piezas (Corte de Hielo «icecourt:», Votos de Bretonia «vow:»...)
    const mechKeys = (c.initiatives ?? []).flatMap((st) => st.items.map((it) => it.k)).filter((k) => /^[a-z]+:/.test(k));
    for (const [tk, , lv] of ch.traits ?? []) {
      const hit = mechKeys.find((k) => { const t = k.slice(k.indexOf(':') + 1); return t === lv || t.startsWith(tk); });
      if (hit && !sel.items.includes(hit)) sel.items.push(hit);
    }
    return { sel, name: c.name };
  };
  const out = [];
  for (const a of armies) {
    notes = [];
    if (!a.general || a.general.type !== 'general') continue; // las de "colonel" son guarniciones
    const lordUnit = a.units[0]?.key;
    const lord = build(a.general, lordUnit, a.units[0]?.banner);
    const heroes = [];
    const charUnits = a.units.filter((u) => unitByKey.get(u.key)?.casteKey === 'lord' || unitByKey.get(u.key)?.casteKey === 'hero' || /_cha_/.test(u.key));
    a.heroes.forEach((h, i) => {
      const c = charOf(h.subtype);
      const cu = charUnits.find((u) => c && (u.key === c.unit || Object.values(c.mounts ?? {}).some((m) => m.unit === u.key)));
      const b = build(h, cu?.key, cu?.banner); if (b) heroes.push(b.sel);
    });
    const groups = new Map();
    for (const u of a.units) {
      if (charUnits.includes(u)) continue;
      const card = u.key; // en el planner la carta es la clave de la unidad
      if (!unitByKey.has(u.key)) warn.push(`Unidad sin datos en el planner: ${u.key}`);
      const k = `${card}|${u.rank}|${u.banner ?? ''}`;
      const grp = { card, count: (groups.get(k)?.count ?? 0) + 1, rank: u.rank };
      if (u.banner) grp.banner = u.banner;
      groups.set(k, grp);
    }
    const units = [...groups.values()];
    const army = { lord: lord?.sel ?? null, heroes, units, activeAbilities: [], inAura: true, faction: sub, campaign: meta.player, ...(techs?.length ? { techs } : {}) };
    const dmg = a.units.filter((u) => u.hp < u.max).length;
    out.push({ name: `${lord?.name ?? a.general.subtype} · rango ${a.general.rank}`, army, damaged: dmg, notes });
  }
  const name = (meta.save ?? f).replace(/\.(json|save)$/, '').replace(/_(Autoguardado|Guardado rápido)/, '').replace(/\d+$/, '');
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  // Reserva: objetos de la facción que no lleva nadie, agrupados
  const res = new Map();
  for (const k of reserve ?? []) res.set(k, (res.get(k) ?? 0) + 1);
  const resOut = [...res].map(([k, n]) => ({ k, n: ancName(k), cat: bannerKeys.has(k) ? 'banner' : g.ancillaries?.[k]?.cat ?? '?', count: n, inPlanner: lootKeys.has(k) || bannerKeys.has(k) }));
  const file = `p${index.length + 1}.json`;
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(seal({ name, faction: sub, campaign: meta.player, turn: meta.turn, difficulty: meta.difficulty, armies: out, reserve: resOut })));
  index.push({ file, name, faction: sub, campaign: meta.player, turn: meta.turn, difficulty: meta.difficulty, armies: out.length });
  console.log(`== ${name} (${meta.player}, ${sub}, turno ${meta.turn}): ${out.length} ejércitos`);
  for (const o of out) console.log('  ', o.name, '| héroes', o.army.heroes.map((h) => h.character).join(','), '| unidades', o.army.units.reduce((t, u) => t + u.count, 0), '| montura', o.army.lord?.mount, '| obj', o.army.lord?.items.length, '| niveles', Object.keys(o.army.lord?.levels ?? {}).length);
  for (const w of [...new Set(warn)]) console.log('   !', w);
  for (const o of out) for (const n of o.notes) console.log('   ·', n);
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ v: 1, iter: ITER, salt: salt.toString('base64'), ...seal(index) }));
