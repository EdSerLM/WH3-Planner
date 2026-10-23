/**
 * Prueba rápida: reproduce el build del Hechicero de Fuego + Héroe Exaltado del usuario
 * con su ejército de wh3.ninja y revisa que los bufos coincidan con lo leído en el planner.
 *   npm test
 */
import { getCharacter, listCharacters, listTechTrees, getTechTree } from './data.js';
import { compute } from './engine.js';
import { meleeDps, targetsFromCards } from './dps.js';
import type { BuildSelection } from './types.js';

function byNames(charKey: string, levels: Record<string, number>, mountName?: string): BuildSelection {
  const tree = getCharacter(charKey);
  if (!tree) throw new Error('No existe ' + charKey);
  const out: Record<string, number> = {};
  let mount: string | null = null;
  for (const n of tree.rows.flat()) {
    if (levels[n.nameEn ?? n.name] !== undefined) out[n.key] = levels[n.nameEn ?? n.name];
    if (mountName && (n.nameEn ?? n.name) === mountName) { out[n.key] = 1; mount = n.key; }
  }
  const missing = Object.keys(levels).filter((k) => !tree.rows.flat().some((n) => (n.nameEn ?? n.name) === k));
  if (missing.length) throw new Error('Habilidades no encontradas: ' + missing.join(', '));
  return { character: charKey, levels: out, mount, innate: null };
}

const lord = byNames('wh_main_skill_node_set_chs_sorcerer_lord_fire', {
  'Undivided Authority': 3, 'Infernal Champion': 1, 'Hearts of Iron': 1, 'Aura of Chaos': 1, 'Soldiers of Renown': 3,
  'Immortality': 1, 'Corrupt Mage': 1, 'Malefic Sorcerer': 1, 'Vile Enchanter': 1, 'Chaos Marked': 1, 'Ruinous Seal': 1,
  'Brand of Turmoil': 1, 'Fireball': 2, 'Kindleflame': 1, 'Cascading Fire-Cloak': 1, 'Flaming Sword of Rhuin': 2,
  'The Burning Head': 2, 'Evasion': 1, 'Piercing Bolts of Burning': 2, 'Flame Storm': 2, 'Earthing': 1,
  'Magical Reserves': 1, 'Arcane Conduit': 1, 'Dominating Presence': 1, 'Chaos Vanguard': 3, 'Hammer into Anvil': 3,
  'Monstrous Strength': 3, 'Rally!': 1, 'Legion of Doom': 1, 'Speed & Malice': 1, 'Malevolent Ranger': 1,
  'Stand or Die!': 1, 'Route Marcher': 1, 'Despoilers': 3, 'Devoted of Chaos': 1, 'Unholy Resilience': 1, 'Lightning Strike': 3,
});

const hero = byNames('wh2_main_skill_node_set_chs_exalted_hero', {
  'Infernal Champion': 1, 'Grip of Anarchy': 3, 'Aura of Chaos': 1, 'Immortality': 1, 'Mentor': 2, 'Blade Master': 1,
  'Devastating Charge': 3, 'Thick-Skinned': 3, 'Hard to Hit': 3, 'Deadly Blade': 3, 'Foe-Seeker': 1, 'Wound-Maker': 3,
  'Scarred Veteran': 3, 'Indomitable': 3, 'Blade Shield': 3, 'Deadly Onslaught': 1, 'Chaos Gladiator': 1, 'Ruinous Unity': 1,
});

const army = {
  lord, heroes: [hero], inAura: true,
  units: [
    { card: 'wh_main_chs_inf_chaos_marauders_0', count: 5 },
    { card: 'wh_dlc01_chs_inf_forsaken_0', count: 4 },
    { card: 'wh_main_chs_mon_chaos_spawn', count: 4 },
    { card: 'wh_main_chs_mon_giant', count: 1 },
    { card: 'wh3_dlc29_chs_mon_giant_spined_chaos_beast', count: 1 },
    { card: 'wh_dlc06_chs_cav_marauder_horsemasters_0', count: 3 },
  ],
};

const r = compute(army);
const show = (id: string) => {
  const c = r.cards.find((x) => x.id === id)!;
  const fmt = (k: keyof typeof c.stats) => `${c.stats[k].base}→${c.stats[k].final}`;
  console.log(`${c.name.padEnd(42)} MA ${fmt('ma')}  MD ${fmt('md')}  Arm ${fmt('armour')}  Dmg ${fmt('dmg')}  AP ${fmt('ap')}  Carga ${fmt('charge')}`);
  return c;
};
console.log('Builds:', r.builds.map((b) => `${b.name}: ${b.pointsUsed} pts, rango ≥ ${b.minRank} ${b.warnings.join('; ')}`));
for (const c of r.cards) show(c.id);

const expect = (label: string, got: number, want: number) => {
  const ok = Math.abs(got - want) < 0.01;
  console.log(`${ok ? 'OK ' : 'FALLA'} ${label}: ${got} (esperado ${want})`);
  if (!ok) process.exitCode = 1;
};
const spawn = r.cards.find((c) => c.id === 'wh_main_chs_mon_chaos_spawn')!;
const forsaken = r.cards.find((c) => c.id === 'wh_dlc01_chs_inf_forsaken_0')!;
const marauder = r.cards.find((c) => c.id === 'wh_main_chs_inf_chaos_marauders_0')!;
const lordCard = r.cards.find((c) => c.kind === 'lord')!;
const heroCard = r.cards.find((c) => c.kind === 'hero')!;
if (process.env.DEBUG) {
  console.log('Lord armour:', JSON.stringify(lordCard0().stats.armour.contributions));
  console.log('Hero md:', JSON.stringify(r.cards.find((c) => c.kind === 'hero')!.stats.md.contributions));
}
function lordCard0() { return r.cards.find((c) => c.kind === 'lord')!; }
expect('Engendros: ataque +13 (Monstrous Strength +8, Vile Enchanter +5)', spawn.stats.ma.final - spawn.stats.ma.base, 13);
expect('Abandonados: ataque +13 (Vanguard +8, Vile +5)', forsaken.stats.ma.final - forsaken.stats.ma.base, 13);
expect('Abandonados: armadura +12 (Vanguard)', forsaken.stats.armour.final - forsaken.stats.armour.base, 12);
expect('Bárbaros: ataque +8', marauder.stats.ma.final - marauder.stats.ma.base, 8);
expect('Lord: armadura +25', lordCard.stats.armour.final - lordCard.stats.armour.base, 25);
expect('Héroe: ataque +22', heroCard.stats.ma.final - heroCard.stats.ma.base, 22);
expect('Héroe: defensa +24', heroCard.stats.md.final - heroCard.stats.md.base, 24);

expect('Abandonados tienen Perfect Vigour (1 = sí)', forsaken.attributes.some((a) => a.name === 'Vigor perfecto') ? 1 : 0, 1);
expect('Engendros NO tienen Perfect Vigour (0 = no)', spawn.attributes.some((a) => a.name === 'Vigor perfecto') ? 1 : 0, 0);
const horse = r.cards.find((c) => c.id === 'wh_dlc06_chs_cav_marauder_horsemasters_0')!;
expect('Maestros jinetes: Hammer into Anvil no les aplica (defensa +0)', horse.stats.md.final - horse.stats.md.base, 0);

// Excluyentes: el build real (Gladiator + Ruinous Unity) es válido; Gladiator + Commander no
const heroInfo = r.builds.find((b) => b.character === hero.character)!;
expect('Build real del héroe sin avisos de excluyentes (0)', heroInfo.warnings.filter((w) => /solo se puede|bloqueada por/.test(w)).length, 0);
const badHero = byNames('wh2_main_skill_node_set_chs_exalted_hero', { 'Chaos Gladiator': 1, 'Chaos Commander': 1 });
const rBad = compute({ heroes: [badHero], units: [] });
expect('Gladiator + Commander da aviso (1 = sí)', rBad.builds[0].warnings.some((w) => /solo se puede|bloqueada por/.test(w)) ? 1 : 0, 1);

// Rango: en rango 5 el Corcel se desbloquea solo y Skullcrusher (requiere 10) da aviso
const r5sel = byNames('wh_main_skill_node_set_chs_lord', { 'Skullcrusher': 1 });
const r5 = compute({ lord: { ...r5sel, rank: 5 }, units: [] });
expect('Rango mínimo 5 + Skullcrusher (pide 10): el rango sube solo a 10', r5.builds[0].rank, 10);
const empty = compute({ lord: { character: 'wh_main_skill_node_set_chs_lord', levels: {} }, units: [] });
expect('Build vacío empieza en rango 1', empty.builds[0].rank, 1);
const four = byNames('wh_main_skill_node_set_chs_lord', { 'Dominating Presence': 1, 'Chaos Vanguard': 3 });
const r4 = compute({ lord: four, units: [] });
expect('4 puntos -> rango 4', r4.builds[0].rank, 4);
const steedTree = getCharacter('wh_main_skill_node_set_chs_lord')!;
const steed = steedTree.rows.flat().find((n) => n.nameEn === 'Chaos Steed')!;
const r5b = compute({ lord: { character: steedTree.key, levels: {}, mount: steed.key, rank: 5 }, units: [] });
expect('Rango 5: Corcel del Caos gratis y montado (1)', r5b.builds[0].mount ? 1 : 0, 1);
expect('Rango 5: puntos usados 0', r5b.builds[0].pointsUsed, 0);

// Con rango 7 y Stand or Die! + Flaming Sword activos
const sod = r.abilities.find((a) => a.key === 'wh_main_character_abilities_stand_or_die')!;
const fsw = r.abilities.find((a) => a.key === 'wh_main_spell_fire_flaming_sword_of_rhuin')!;
const r2 = compute({ ...army, activeAbilities: [sod.key, fsw.key], units: army.units.map((u) => ({ ...u, rank7: true })) });
const f2 = r2.cards.find((c) => c.id === 'wh_dlc01_chs_inf_forsaken_0')!;
expect('Abandonados R7 + Stand or Die!: defensa +29 (Legion +5, SoD +24)', f2.stats.md.final - f2.stats.md.base, 29);
expect('Abandonados con Flaming Sword: daño base ×1.3', Math.round((f2.stats.dmg.final / f2.stats.dmg.base) * 100) / 100, 1.3);
console.log('Flamígero:', f2.flamingAttacks, '| Atributos:', f2.attributes.map((a) => a.name).join(', '));

const targets = targetsFromCards(['wh_main_chs_inf_chaos_warriors_0', 'wh_main_chs_inf_chosen_0', 'wh_main_chs_mon_chaos_spawn']);
console.log('\nDPS Abandonados (R7 + SoD + Flaming Sword):');
for (const t of targets) console.log(meleeDps(f2, t));
console.log('\nHabilidades:', r.abilities.filter((a) => a.hasBattleStats).map((a) => `${a.name}[${a.mode}${a.passive ? ',pasiva' : ''}]`).join(', '));

// Tecnologías (solo con los datos del juego): Preparación del hierro da +10 armadura a los Barbaslargas
const dwfTrees = listTechTrees('wh_main_sc_dwf_dwarfs');
if (dwfTrees.length) {
  const tt = getTechTree(dwfTrees[0].key)!;
  const iron = tt.nodes.find((n) => n.name === 'Preparación del hierro');
  const thor = listCharacters('wh_main_sc_dwf_dwarfs').find((c) => /Thorgrim/.test(c.name));
  if (iron && thor) {
    const units = [{ card: 'wh_main_dwf_inf_longbeards', count: 1 }, { card: 'wh_main_dwf_inf_hammerers', count: 1 }];
    const sel = { character: thor.key, levels: {} };
    const a = compute({ lord: sel, units });
    const b = compute({ lord: sel, units, techs: [iron.tech] });
    const lb = (r: typeof a) => r.cards.find((c) => c.id === 'wh_main_dwf_inf_longbeards')!.stats.armour.final;
    const hm = (r: typeof a) => r.cards.find((c) => c.id === 'wh_main_dwf_inf_hammerers')!.stats.armour.final;
    expect('Tecnología Preparación del hierro: Barbaslargas armadura +10', lb(b) - lb(a), 10);
    expect('Tecnología Preparación del hierro: Martilladores no (+0)', hm(b) - hm(a), 0);
  }
}

// Objetos de legendario (datos del juego): Archaón con La Armadura de Morkar = +12 armadura, +6 defensa
const arch = getCharacter('wh_main_skill_node_set_chs_archaon');
const morkar = arch?.items?.find((i) => i.key === 'wh_main_anc_armour_the_armour_of_morkar');
if (arch && morkar) {
  const a0 = compute({ lord: { character: arch.key, levels: {} }, units: [] }).cards[0];
  const a1 = compute({ lord: { character: arch.key, levels: {}, items: [morkar.key], rank: 12 }, units: [] }).cards[0];
  expect('Archaón + Armadura de Morkar: armadura +12', a1.stats.armour.final - a0.stats.armour.final, 12);
  expect('Archaón + Armadura de Morkar: defensa +6', a1.stats.md.final - a0.stats.md.final, 6);
}
