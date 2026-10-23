/**
 * Extrae datos de TU instalación de Total War: WARHAMMER III (solo lectura, no modifica el juego).
 *
 *   npm run extraer -- "D:\Program Files\Steam\steamapps\common\Total War WARHAMMER III\data"
 *
 * Genera:
 *  - frontend/public/skills/*.png          iconos de habilidades (ui/campaign ui/skills)
 *  - backend/data/loc-es/wh3_es.tsv        textos oficiales en español que usa el planner
 *  - backend/data/raw/wh3_skill_locks.json bloqueos oficiales entre habilidades
 *  - backend/data/raw/wh3_all_units.json   unidades de todas las facciones
 *  - backend/data/raw/wh3_all_skills.json  árboles de habilidades de todas las facciones
 *
 * Lee los .pack (formato PFH5) por partes, sin cargarlos completos en memoria.
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decompress as zstdDecompress } from 'fzstd';
import { SKILL_TABLES, buildAllSkills } from './arboles.js';

const here = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(here, '..');
const FRONTEND = join(BACKEND, '..', 'frontend');

// ---------------------------------------------------------------- packs
interface PackEntry { name: string; offset: number; size: number; compressed: boolean }
interface Pack { path: string; fd: number; entries: PackEntry[] }

function readAt(fd: number, pos: number, len: number): Buffer {
  const b = Buffer.alloc(len);
  let got = 0;
  while (got < len) {
    const n = readSync(fd, b, got, len - got, pos + got);
    if (n <= 0) break;
    got += n;
  }
  return b;
}

function openPack(path: string): Pack {
  const fd = openSync(path, 'r');
  const head = readAt(fd, 0, 28);
  const magic = head.toString('latin1', 0, 4);
  if (magic !== 'PFH5') throw new Error(`${path}: formato ${magic} no soportado (se esperaba PFH5)`);
  const type = head.readUInt32LE(4);
  const depsSize = head.readUInt32LE(12);
  const fileCount = head.readUInt32LE(16);
  const indexSize = head.readUInt32LE(20);
  const hasTimestamps = (type & 0x40) !== 0;
  const extended = (type & 0x100) !== 0 ? 20 : 0;
  const indexStart = 28 + extended + depsSize;
  const idx = readAt(fd, indexStart, indexSize);
  const entries: PackEntry[] = [];
  let off = 0;
  let dataPos = indexStart + indexSize;
  for (let i = 0; i < fileCount; i++) {
    const size = idx.readUInt32LE(off); off += 4;
    if (hasTimestamps) off += 4;
    const compressed = idx[off] === 1; off += 1;
    const end = idx.indexOf(0, off);
    const name = idx.toString('utf8', off, end).replace(/\\/g, '/');
    off = end + 1;
    entries.push({ name, offset: dataPos, size, compressed });
    dataPos += size;
  }
  return { path, fd, entries };
}

function readEntry(p: Pack, e: PackEntry): Buffer {
  const raw = readAt(p.fd, e.offset, e.size);
  if (!e.compressed) return raw;
  const body = raw.subarray(4); // u32 tamaño descomprimido + datos
  if (body.readUInt32LE(0) === 0xfd2fb528) return Buffer.from(zstdDecompress(body));
  throw new Error(`${e.name}: compresión no soportada (solo zstd)`);
}

// ---------------------------------------------------------------- .loc
function readLoc(b: Buffer): Map<string, string> {
  if (b[0] !== 0xff || b[1] !== 0xfe) throw new Error('loc sin BOM');
  let off = 2 + 4; // BOM + "LOC\0"
  off += 4; // versión
  const count = b.readUInt32LE(off); off += 4;
  const out = new Map<string, string>();
  const str = () => {
    const n = b.readUInt16LE(off); off += 2;
    const t = b.toString('utf16le', off, off + n * 2); off += n * 2;
    return t;
  };
  for (let i = 0; i < count; i++) {
    const k = str();
    const t = str();
    off += 1;
    out.set(k, t);
  }
  return out;
}

// ---------------------------------------------------------------- tabla de bloqueos (db)
function readLocks(b: Buffer): { skill: string; node: string; level: number }[] {
  let off = 0;
  if (b.readUInt32LE(0) === 0xfffcfefd) { // GUID
    off = 4;
    const n = b.readUInt16LE(off); off += 2 + n * 2;
  }
  if (b.readUInt32LE(off) === 0xfffefdfc) off += 8; // versión
  off += 1;
  const count = b.readUInt32LE(off); off += 4;
  const str = () => {
    const n = b.readUInt16LE(off); off += 2;
    const t = b.toString('utf8', off, off + n); off += n;
    return t;
  };
  const rows = [];
  for (let i = 0; i < count; i++) {
    const skill = str();
    const node = str();
    const level = b.readInt32LE(off); off += 4;
    rows.push({ skill, node, level });
  }
  return rows;
}

// ---------------------------------------------------------------- tablas DB genéricas (esquema RPFM)
const schemaFile = JSON.parse(readFileSync(join(BACKEND, 'data/schema/wh3_db_subset.json'), 'utf8'));

function readTable(b: Buffer, table: string): Record<string, any>[] {
  let off = 0;
  if (b.readUInt32LE(0) === 0xfffcfefd) { off = 4; const n = b.readUInt16LE(off); off += 2 + n * 2; }
  let version = 0;
  if (b.readUInt32LE(off) === 0xfffefdfc) { version = b.readUInt32LE(off + 4); off += 8; }
  off += 1;
  const count = b.readUInt32LE(off); off += 4;
  const fields: [string, string][] | undefined = schemaFile.tables[table]?.[String(version)];
  if (!fields) throw new Error(`${table}: versión ${version} no está en el esquema (actualiza backend/data/schema)`);
  const s8 = () => { const n = b.readUInt16LE(off); off += 2; const t = b.toString('utf8', off, off + n); off += n; return t; };
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < count; i++) {
    const row: Record<string, any> = {};
    for (const [f, t] of fields) {
      switch (t) {
        case 'Boolean': row[f] = b[off] !== 0; off += 1; break;
        case 'I32': row[f] = b.readInt32LE(off); off += 4; break;
        case 'I16': row[f] = b.readInt16LE(off); off += 2; break;
        case 'I64': row[f] = Number(b.readBigInt64LE(off)); off += 8; break;
        case 'F64': row[f] = b.readDoubleLE(off); off += 8; break;
        case 'OptionalI32': row[f] = b[off++] ? b.readInt32LE(off) : null; if (row[f] !== null) off += 4; break;
        case 'F32': row[f] = Math.round(b.readFloatLE(off) * 10000) / 10000; off += 4; break;
        case 'ColourRGB': off += 4; break;
        case 'StringU8': row[f] = s8(); break;
        case 'OptionalStringU8': row[f] = b[off++] ? s8() : null; break;
        default: throw new Error(`${table}: tipo ${t} no soportado`);
      }
    }
    rows.push(row);
  }
  if (off !== b.length) throw new Error(`${table} v${version}: el esquema no coincide (sobran ${b.length - off} bytes)`);
  return rows;
}

function loadTables(p: Pack, names: string[]): Record<string, Record<string, any>[]> {
  const out: Record<string, Record<string, any>[]> = {};
  for (const n of names) {
    out[n] = [];
    for (const e of p.entries) if (e.name.startsWith(`db/${n}/`)) out[n].push(...readTable(readEntry(p, e), n));
  }
  return out;
}

const CASTE_ES: Record<string, string> = {
  lord: 'Señor', hero: 'Héroe', melee_infantry: 'Infantería cuerpo a cuerpo', monster: 'Monstruo', missile_infantry: 'Infantería de proyectiles',
  monstrous_infantry: 'Infantería monstruosa', melee_cavalry: 'Caballería cuerpo a cuerpo', chariot: 'Carro', warmachine: 'Máquina de guerra',
  war_beast: 'Bestia de guerra', monstrous_cavalry: 'Caballería monstruosa', missile_cavalry: 'Caballería de proyectiles', generic: 'Genérico',
};

/** Stats de todas las unidades de todas las facciones (mismo cálculo que twwstats; verificado con las 176 del Caos). */
function buildAllUnits(p: Pack, sp: Map<string, string>) {
  const T = loadTables(p, [
    'main_units_tables', 'land_units_tables', 'melee_weapons_tables', 'battle_entities_tables', 'unit_armour_types_tables',
    'unit_shield_types_tables', 'missile_weapons_tables', 'projectiles_tables', 'mounts_tables',
    'units_custom_battle_permissions_tables', 'unit_attributes_to_groups_junctions_tables', 'factions_tables', 'unit_variants_tables',
    // Campaña: qué puede reclutar cada facción (grupo militar + exclusivas) y quién la lidera
    'units_to_groupings_military_permissions_tables', 'units_to_exclusive_faction_permissions_tables',
    'frontend_factions_tables', 'frontend_faction_leaders_tables', 'ui_unit_groupings_tables',
    // Mejoras de Banda (Guerreros del Caos): grupo base -> grupo destino, con tecnología requerida
    'unit_to_unit_group_junctions_tables', 'unit_upgrade_to_unit_groups_tables', 'unit_upgrade_to_tech_requirements_tables',
    'technology_node_sets_tables', 'technology_nodes_tables',
  ]);
  const idx = (t: string, k: string) => new Map(T[t].map((r) => [r[k], r]));
  const lu = idx('land_units_tables', 'key'), mw = idx('melee_weapons_tables', 'key'), be = idx('battle_entities_tables', 'key');
  const arm = idx('unit_armour_types_tables', 'key'), shd = idx('unit_shield_types_tables', 'key'), msw = idx('missile_weapons_tables', 'key');
  const prj = idx('projectiles_tables', 'key'), mnt = idx('mounts_tables', 'key'), fac = idx('factions_tables', 'key');
  const card = new Map<string, string>();
  for (const v of T['unit_variants_tables']) if (!card.has(v.unit) && v.unit_card) card.set(v.unit, v.unit_card);
  const attrs = new Map<string, string[]>();
  for (const j of T['unit_attributes_to_groups_junctions_tables']) attrs.set(j.attribute_group, [...(attrs.get(j.attribute_group) ?? []), j.attribute]);
  const perms = new Map<string, Set<string>>();
  for (const r of T['units_custom_battle_permissions_tables']) { if (!perms.has(r.unit)) perms.set(r.unit, new Set()); perms.get(r.unit)!.add(r.faction); }

  // ---- Facciones de campaña jugables y su roster (lo que realmente puede reclutar o conseguir cada una)
  const byGroup = new Map<string, Set<string>>();
  for (const r of T['units_to_groupings_military_permissions_tables']) byGroup.set(r.military_group, (byGroup.get(r.military_group) ?? new Set()).add(r.unit));
  // Unidades exclusivas: solo las tienen las facciones listadas con allowed = true
  const exclusive = new Map<string, Map<string, boolean>>();
  for (const r of T['units_to_exclusive_faction_permissions_tables']) exclusive.set(r.key, (exclusive.get(r.key) ?? new Map()).set(r.faction, r.allowed));
  const leaders = new Map<string, string[]>();
  for (const r of T['frontend_faction_leaders_tables']) if (r.faction && r.agent_subtype_record) leaders.set(r.faction, [...(leaders.get(r.faction) ?? []), r.agent_subtype_record]);
  // Mejoras de unidad: qué grupos suben a cuáles, desde qué rango y con qué tecnología
  const groupUnits = new Map<string, string[]>();
  for (const r of T['unit_to_unit_group_junctions_tables']) groupUnits.set(r.unit_group, [...(groupUnits.get(r.unit_group) ?? []), r.unit]);
  const upTechs = new Map<string, string[]>();
  for (const r of T['unit_upgrade_to_tech_requirements_tables']) upTechs.set(r.unit_upgrade, [...(upTechs.get(r.unit_upgrade) ?? []), r.technology]);
  // Tecnologías de cada facción: su árbol propio o, si no tiene, el general de su subcultura
  const setTechs = new Map<string, Set<string>>();
  for (const n of T['technology_nodes_tables']) setTechs.set(n.technology_node_set, (setTechs.get(n.technology_node_set) ?? new Set()).add(n.technology_key));
  const techsOf = (f: Record<string, any>) => {
    const sets = T['technology_node_sets_tables'];
    const own = sets.filter((x) => x.faction_key === f.key);
    const list = own.length ? own : sets.filter((x) => !x.faction_key && x.subculture === f.subculture);
    return new Set(list.flatMap((x) => [...(setTechs.get(x.key) ?? [])]));
  };
  const campaign: { key: string; name: string; subculture: string; leaders: string[]; units: string[]; upgrades: Record<string, number> }[] = [];
  for (const ff of T['frontend_factions_tables']) {
    const f = fac.get(ff.faction);
    if (!f || f.is_quest_faction || f.is_rebel) continue;
    const list = new Set<string>();
    for (const u of byGroup.get(f.military_group) ?? []) { const ex = exclusive.get(u); if (!ex || ex.get(f.key)) list.add(u); }
    for (const [u, ex] of exclusive) if (ex.get(f.key)) list.add(u);
    // Lo que se consigue mejorando unidades que ya tiene (p. ej. Bloodletters -> Exaltados): unidad -> rango requerido
    const techs = techsOf(f);
    const upgrades: Record<string, number> = {};
    for (let changed = true; changed;) {
      changed = false;
      for (const up of T['unit_upgrade_to_unit_groups_tables']) {
        const req = upTechs.get(up.upgrade_key);
        if (req && !req.some((t) => techs.has(t))) continue;
        if (!(groupUnits.get(up.base_unit_group) ?? []).some((u) => list.has(u) || u in upgrades)) continue;
        for (const u of groupUnits.get(up.target_unit_group) ?? []) {
          if (list.has(u) || u in upgrades) continue;
          upgrades[u] = up.required_rank ?? 0;
          changed = true;
        }
      }
    }
    campaign.push({
      key: f.key, name: sp.get(`factions_screen_name_${f.key}`) ?? f.key, subculture: f.subculture,
      leaders: [...new Set(leaders.get(f.key) ?? [])], units: [...list].sort(), upgrades,
    });
  }
  campaign.sort((a, b) => a.subculture.localeCompare(b.subculture) || a.name.localeCompare(b.name, 'es'));
  const campSubcultures = new Map<string, Set<string>>();
  for (const c of campaign) for (const u of [...c.units, ...Object.keys(c.upgrades)]) campSubcultures.set(u, (campSubcultures.get(u) ?? new Set()).add(c.subculture));
  const uiParent = idx('ui_unit_groupings_tables', 'key');

  const units: any[] = [];
  for (const mu of T['main_units_tables']) {
    if (mu.is_naval) continue;
    const L = lu.get(mu.land_unit);
    if (!L) continue;
    // Facciones de batalla personalizada + las de campaña (unidades solo de campaña, como los demonios Exaltados del Caos)
    const subcultures = [...new Set([...[...(perms.get(mu.unit) ?? [])].map((f) => fac.get(f)?.subculture), ...(campSubcultures.get(mu.unit) ?? [])].filter(Boolean))].sort();
    if (!subcultures.length) continue;
    const ent = be.get(L.man_entity) ?? {};
    const mount = L.mount ? mnt.get(L.mount) : undefined;
    const ment = mount ? be.get(mount.entity) ?? {} : undefined;
    const w = mw.get(L.primary_melee_weapon ?? '') ?? {};
    const mis = L.primary_missile_weapon ? msw.get(L.primary_missile_weapon) : undefined;
    const pj = mis ? prj.get(mis.default_projectile) : undefined;
    const u: any = {
      key: mu.unit, card: card.get(mu.unit) ?? mu.unit, name: sp.get(`land_units_onscreen_name_${L.key}`) ?? mu.unit,
      caste: CASTE_ES[mu.caste] ?? mu.caste, casteKey: mu.caste, cost: mu.multiplayer_cost, models: mu.num_men,
      tier: mu.tier ?? 0, mounts: L.num_mounts ?? 0, uiGroup: uiParent.get(mu.ui_unit_group_land ?? '')?.parent_group ?? undefined,
      size: ent.size, hpPerModel: (ent.hit_points ?? 0) + (L.bonus_hit_points ?? 0),
      speed: Math.round(((ment ? ment.run_speed : ent.run_speed) ?? 0) * 10), leadership: L.morale,
      ma: L.melee_attack, md: L.melee_defence, charge: L.charge_bonus,
      armour: arm.get(L.armour ?? '')?.armour_value ?? 0, shield: shd.get(L.shield ?? '')?.missile_block_chance ?? 0,
      dmg: w.damage ?? 0, ap: w.ap_damage ?? 0, bvl: w.bonus_v_large ?? 0, bvi: w.bonus_v_infantry ?? 0,
      interval: Math.round((w.melee_attack_interval ?? 0) * 100) / 100, splash: w.splash_attack_max_attacks ?? 1,
      res: { physical: L.damage_mod_physical ?? 0, missile: L.damage_mod_missile ?? 0, magic: L.damage_mod_magic ?? 0, flame: L.damage_mod_flame ?? 0, ward: L.damage_mod_all ?? 0 },
      attrs: (attrs.get(L.attribute_group ?? '') ?? []).map((a) => (sp.get(`unit_attributes_bullet_text_${a}`) ?? a).split('||')[0].trim()),
      subcultures,
    };
    if (w.is_magical) u.magical = true;
    if (w.ignition_amount) u.flaming = true;
    if (pj) u.missile = { dmg: pj.damage, ap: pj.ap_damage, range: pj.effective_range, reload: pj.base_reload_time, shots: pj.projectile_number, ammo: L.primary_ammo, bvl: pj.bonus_v_large, bvi: pj.bonus_v_infantry };
    units.push(u);
  }
  const subs = [...new Set(units.flatMap((u) => u.subcultures))].map((k) => ({ key: k, name: sp.get(`cultures_subcultures_name_${k}`) ?? k }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { source: 'db.pack + local_sp.pack de tu instalación (Total War: WARHAMMER III)', subcultures: subs, units, campaign };
}

// ---------------------------------------------------------------- principal
const dataDir = process.argv[2];
if (!dataDir || !existsSync(dataDir)) {
  console.error('Uso: npm run extraer -- "<carpeta data del juego>"');
  console.error('Ej.:  npm run extraer -- "D:\\Program Files\\Steam\\steamapps\\common\\Total War WARHAMMER III\\data"');
  process.exit(1);
}

// Datos viejos del planner/twwstats (opcionales): solo para los textos y bloqueos del modo sin datos del juego
const readOpt = (f: string) => (existsSync(join(BACKEND, f)) ? JSON.parse(readFileSync(join(BACKEND, f), 'utf8')) : null);
const skillsFile = readOpt('data/raw/wh3_chs_skills.json') ?? { characters: [], skills: {}, abilities: {} };
const unitsFile = readOpt('data/raw/wh3_chs_units.json') ?? { units: [], roster: [] };

let allSkills: ReturnType<typeof buildAllSkills> | null = null;

// 1) Textos en español --------------------------------------------------
const spPath = join(dataDir, 'local_sp.pack');
let spGlobal = new Map<string, string>();
if (existsSync(spPath)) {
  const p = openPack(spPath);
  const locEntry = p.entries.find((e) => e.name.endsWith('.loc'));
  const raw = readLoc(readEntry(p, locEntry!));
  closeSync(p.fd);
  // {{tr:X}} apunta a otro texto: la clave completa X o, si no existe, ui_text_replacements_localised_text_X
  // (p. ej. "Despliegue de vanguardia"). Se resuelven todos una vez para que nada salga con {{tr:...}}.
  const resolve = (t: string, d = 0): string =>
    d > 5 ? t : t.replace(/\{\{tr:([^}]+)\}\}/g, (_m, k) => resolve(raw.get(k) ?? raw.get(`ui_text_replacements_localised_text_${k}`) ?? '', d + 1));
  const sp = new Map<string, string>();
  for (const [k, v] of raw) sp.set(k, v.includes('{{tr:') ? resolve(v) : v);
  spGlobal = sp;
  const out = new Map<string, string>();
  const add = (k: string) => { const v = sp.get(k); if (v) out.set(k, resolve(v)); };

  const effKeys = new Set<string>();
  for (const [key, s] of Object.entries<any>(skillsFile.skills)) {
    const k = key.split('#')[0];
    add(`character_skills_localised_name_${k}`);
    add(`character_skills_localised_description_${k}`);
    for (const lv of s.lv) for (const e of lv.e) effKeys.add(e.k);
  }
  for (const k of effKeys) add(`effects_description_${k}`);
  for (const k of Object.keys(skillsFile.abilities)) {
    add(`unit_abilities_onscreen_name_${k}`);
    add(`unit_abilities_tooltip_text_${k}`);
  }
  const roster: any[] = unitsFile.roster ?? [];
  for (const u of [...unitsFile.units, ...roster]) add(`land_units_onscreen_name_${u.key}`);

  // Nombres de personajes
  const subtypes = new Map<string, string>();
  for (const [k, v] of sp) if (k.startsWith('agent_subtypes_onscreen_name_override_')) subtypes.set(k.slice('agent_subtypes_onscreen_name_override_'.length), v);
  const byEn = new Map<string, string>();
  for (const r of roster) if (!byEn.has(r.name)) byEn.set(r.name, r.key);
  const GENERIC = /^(Chaos Lord|Chaos Sorcerer|Daemon Prince|Exalted Hero|Bloodspeaker|Plagueridden)/;
  const marks = new Set(['mkho', 'mnur', 'msla', 'mtze']);
  let named = 0;
  for (const c of skillsFile.characters) {
    let name: string | undefined;
    const tail = c.key.replace(/^.*skill_node_set_/, '').replace(/^wh\d?_(main|dlc\d+|pro\d+|twa\d+)_/, '');
    const tt = new Set<string>(tail.split('_'));
    if (GENERIC.test(c.name)) {
      const cands = [...subtypes.keys()].filter((s) => {
        const st = new Set(s.split('_'));
        if ([...st].some((x) => marks.has(x) && !tt.has(x))) return false;
        if (st.has('lord') && !tt.has('lord')) return false;
        return [...tt].every((t) => st.has(t) || st.has(t + 's') || st.has(t.replace(/s$/, '')));
      }).sort((a, b) => a.length - b.length);
      if (cands.length) name = resolve(subtypes.get(cands[0])!);
    }
    if (!name || /legendari/.test(name)) {
      name = undefined;
      const key = byEn.get(c.name);
      if (key) name = sp.get(`land_units_onscreen_name_${key}`);
      if (!name) {
        const base = tail.replace('_lord', '').replace(/^(chs|nur|kho|tze|sla|nor|dae)_/, '');
        const cands = [...sp.keys()].filter((k) => k.startsWith('land_units_onscreen_name_') && k.includes('_cha_') && k.includes(base)).sort((a, b) => a.length - b.length);
        if (cands.length) name = sp.get(cands[0]);
      }
    }
    if (name) { out.set(`planner_character_name_${c.key}`, resolve(name)); named++; }
  }

  mkdirSync(join(BACKEND, 'data/loc-es'), { recursive: true });
  const clean = (t: string) => t.replace(/[\t\r\n]+/g, ' ');
  const lines = ['key\ttext\ttooltip', ...[...out.keys()].sort().map((k) => `${k}\t${clean(out.get(k)!)}\tfalse`)];
  writeFileSync(join(BACKEND, 'data/loc-es/wh3_es.tsv'), lines.join('\n') + '\n', 'utf8');
  console.log(`Textos en español: ${out.size} (personajes con nombre: ${named}/${skillsFile.characters.length})`);
} else {
  console.warn('No encontré local_sp.pack: activa el idioma español del juego en Steam.');
}

// 2) Bloqueos entre habilidades ------------------------------------------
const dbPath = join(dataDir, 'db.pack');
if (existsSync(dbPath)) {
  const p = openPack(dbPath);
  const e = p.entries.find((x) => x.name.startsWith('db/character_skill_nodes_skill_locks_tables/'));
  if (e) {
    const rows = readLocks(readEntry(p, e));
    const nodes = new Set<string>();
    for (const c of skillsFile.characters) for (const r of c.rows) for (const n of r) if (n) nodes.add(n.k);
    const mine = rows.filter((r) => nodes.has(r.node));
    writeFileSync(join(BACKEND, 'data/raw/wh3_skill_locks.json'), JSON.stringify({ source: 'db.pack character_skill_nodes_skill_locks', locks: mine }, null, 0));
    console.log(`Bloqueos entre habilidades: ${mine.length}`);
  }
  // 4) Árboles de habilidades de todas las facciones
  try {
    allSkills = buildAllSkills(loadTables(p, SKILL_TABLES), spGlobal);
    writeFileSync(join(BACKEND, 'data/raw/wh3_all_skills.json'), JSON.stringify(allSkills));
    console.log(`Árboles de habilidades: ${allSkills.characters.length} señores y héroes de ${allSkills.subcultures.length} facciones`);
  } catch (err) {
    console.warn(`No pude leer los árboles de habilidades: ${(err as Error).message}`);
  }
  // Unidades de todas las facciones (objetivos del DPS y roster por facción)
  try {
    const all = buildAllUnits(p, spGlobal);
    writeFileSync(join(BACKEND, 'data/raw/wh3_all_units.json'), JSON.stringify(all));
    console.log(`Unidades de todas las facciones: ${all.units.length} (${all.subcultures.length} facciones, ${all.campaign.length} facciones de campaña jugables)`);
  } catch (err) {
    console.warn(`No pude leer las unidades: ${(err as Error).message}`);
  }
  closeSync(p.fd);
}
// 5) Iconos -------------------------------------------------------------
const wantedIcons = new Set<string>();
for (const s of [...Object.values<any>(skillsFile.skills), ...Object.values<any>(allSkills?.skills ?? {})]) if (s.img) wantedIcons.add(String(s.img).split('/').pop()!.toLowerCase());
const iconDir = join(FRONTEND, 'public/skills');
mkdirSync(iconDir, { recursive: true });
const packs = readdirSync(dataDir).filter((f) => /^(ui|data)[\w]*\.pack$/i.test(f) || /^local_(sp|en)\.pack$/i.test(f));
let icons = 0;
const ddsOnly: string[] = [];
for (const f of packs) {
  let p: Pack;
  try {
    p = openPack(join(dataDir, f));
  } catch (e) {
    console.warn(`  (omito ${f}: ${(e as Error).message})`);
    continue;
  }
  for (const e of p.entries) {
    const m = e.name.toLowerCase().match(/^ui\/campaign ui\/skills\/([^/]+)\.(png|dds)$/);
    if (!m || !wantedIcons.has(m[1])) continue;
    if (m[2] === 'dds') { ddsOnly.push(m[1]); continue; }
    writeFileSync(join(iconDir, `${m[1]}.png`), readEntry(p, e));
    icons++;
  }
  closeSync(p.fd);
}
console.log(`Iconos: ${icons} de ${wantedIcons.size} guardados en frontend/public/skills${ddsOnly.length ? ` (${ddsOnly.length} solo en .dds, no soportados)` : ''}`);

console.log('Listo. Reinicia el backend (npm run dev) para ver los cambios.');
void statSync;
