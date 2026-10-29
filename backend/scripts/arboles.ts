/**
 * Árboles de habilidades de TODAS las facciones desde db.pack (+ textos de local_sp.pack).
 * Mismo resultado que el prototipo validado contra totalwarhammerplanner.com con los 66 personajes del Caos:
 * nodos, requisitos, rangos, efectos, monturas (stats) y hechizos.
 */
type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

export const SKILL_TABLES = [
  'character_skill_node_sets_tables', 'character_skill_node_set_items_tables', 'character_skill_nodes_tables',
  'character_skill_node_links_tables', 'character_skills_tables', 'character_skill_level_details_tables',
  'character_skill_level_to_effects_junctions_tables', 'character_skills_to_level_reached_criterias_tables',
  'effect_bonus_value_ids_unit_sets_tables', 'effect_bonus_value_basic_junction_tables',
  'effect_bonus_value_unit_ability_junctions_tables', 'effect_bonus_value_unit_set_unit_ability_junctions_tables',
  'effect_bonus_value_unit_set_unit_attribute_junctions_tables', 'effect_bonus_value_unit_attribute_junctions_tables',
  'unit_set_unit_ability_junctions_tables', 'unit_set_unit_attribute_junctions_tables',
  'unit_sets_tables', 'unit_set_to_unit_junctions_tables', 'agent_subtypes_tables',
  'unit_abilities_tables', 'unit_special_abilities_tables', 'special_ability_to_special_ability_phase_junctions_tables',
  'special_ability_phases_tables', 'special_ability_phase_stat_effects_tables', 'special_ability_phase_attribute_effects_tables',
  // A quién NO afecta cada habilidad (p. ej. la pasiva Guardián solo a señores y héroes)
  'special_ability_to_invalid_target_flags_tables', 'special_ability_invalid_usage_flags_tables',
  'main_units_tables', 'land_units_tables', 'melee_weapons_tables', 'battle_entities_tables', 'unit_armour_types_tables',
  'unit_shield_types_tables', 'units_custom_battle_permissions_tables', 'factions_tables', 'frontend_faction_leaders_tables', 'unit_attributes_to_groups_junctions_tables',
  'land_units_to_unit_abilites_junctions_tables', 'mounts_tables', 'character_skill_nodes_skill_locks_tables',
  'character_skill_level_to_ancillaries_junctions_tables', 'ancillaries_tables', 'ancillaries_included_agent_subtypes_tables',
  'effect_bonus_value_agent_action_record_junctions_tables',
  'technologies_tables', 'technology_effects_junction_tables', 'technology_node_links_tables', 'technology_node_sets_tables',
  'technology_nodes_tables', 'technology_required_technology_junctions_tables', 'cultures_subcultures_tables',
  'ancillary_to_effects_tables', 'character_ancillary_quest_ui_details_tables', 'ancillary_set_ancillary_junctions_tables',
  'ancillary_set_effect_junctions_tables',
  // Grafos de iniciativas (p. ej. la Pirámide Negra de las Legiones No Muertas): nodos con efectos, como tecnologías
  'initiatives_tables', 'initiative_set_items_tables', 'initiative_sets_tables', 'faction_initiative_sets_tables',
  'campaign_effect_list_effect_junctions_tables', 'ui_graphs_tables', 'ui_graph_nodes_tables', 'ui_graph_node_links_tables',
  'ui_graph_node_unlock_thresholds_tables', 'ui_graph_node_clusters_tables', 'initiative_to_ui_graph_node_junctions_tables',
  // Hechizos elegibles por espacio (Kairos: Fragmentos de hechicería), como iniciativas de personaje
  'effect_bonus_value_initiative_set_junctions_tables',
  // Iniciativas de personaje (Senda a la Gloria: dones y devociones), ligadas al subtipo por grupos de campaña
  'background_character_initiative_sets_tables', 'campaign_group_members_tables', 'campaign_group_member_criteria_agent_subtypes_tables', 'initiative_sets_tables',
  // Dones del Príncipe Demonio (Daniel): piezas por ranura, con efectos, conjuntos y exclusiones
  'armory_items_tables', 'armory_slot_types_tables', 'armory_slot_type_ui_infos_tables', 'armory_item_set_items_tables', 'armory_item_set_to_effects_tables', 'armory_items_to_effects_tables', 'armory_item_to_category_sets_tables', 'armory_item_slot_blacklists_tables', 'armory_item_category_blacklists_tables', 'armory_item_ui_infos_tables', 'armory_item_variants_tables',
];

// bonus_value_id (con conjunto de unidades) -> [stat, es %]
const UNITSET_STATS: Record<string, [string, boolean]> = {
  melee_attack_mod: ['ma', false], melee_defence_mod: ['md', false], armour_mod: ['armour', false], morale: ['ld', false],
  charge_add: ['charge', false], charge_bonus: ['charge', true], charge_bonus_for_land_units: ['charge', true],
  melee_damage_mod_mult: ['dmg', true], melee_damage_ap_mod_mult: ['ap', true],
  melee_damage_mod_add: ['dmg', false], melee_damage_ap_mod_add: ['ap', false],
  missile_damage_mod_mult: ['missileDmg', true], missile_damage_mod_add: ['missileDmg', false],
  unit_damage_resistance_missile_mod: ['resMissile', false], unit_damage_resistance_all_mod: ['resWard', false],
  unit_damage_resistance_magic_mod: ['resMagic', false], unit_damage_resistance_physical_mod: ['resPhysical', false],
  unit_damage_resistance_flame_mod: ['resFlame', false],
  mod_land_movement_battle: ['speed', true], reload: ['reload', true], ammo_mod: ['ammo', true], range_mod: ['range', true],
  battle_barrier_health: ['barrier', false], battle_barrier_health_mod: ['barrier', true],
  damage_vs_infantry: ['bvi', false], damage_vs_large_entities: ['bvl', false], missile_block_chance_mod: ['shield', false],
  general_bodyguard_size_mod: ['hp', true],
};
const BASIC_STATS: Record<string, [string, boolean]> = {
  general_bodyguard_size_mod: ['hp', true], damage_resistance_physical_mod: ['resPhysical', false],
  damage_resistance_magic_mod: ['resMagic', false], damage_resistance_flame_mod: ['resFlame', false],
  damage_resistance_missile_mod: ['resMissile', false], damage_resistance_all_mod: ['resWard', false],
  missile_block_chance_mod: ['shield', false], armour_mod: ['armour', false], morale: ['ld', false],
  melee_attack_mod: ['ma', false], melee_defence_mod: ['md', false], battle_barrier_health: ['barrier', false],
  melee_damage_ap_mod_add: ['ap', false], melee_damage_ap_mod_mult: ['ap', true], melee_damage_mod_add: ['dmg', false],
  charge_bonus_for_land_units: ['charge', true], ammo_mod: ['ammo', true],
};
const BASIC_ATTR: Record<string, string> = { unit_is_magical: 'Ataques mágicos', unit_flaming_attack_mod: 'Ataques flamígeros' };

const SELF_SCOPE = /^character_to_character_own/;
// "character_to_force_own_factionwide" (todos los ejércitos de la facción) también cuenta: incluye el ejército del personaje
// (p. ej. Estandartes de Middenheim de Boris: +4 ataque a las unidades del Culto de Ulric)
const ARMY_SCOPE = /^(general_to_force_own|character_to_force_own|agent_to_parent_army_own|faction_to_force_own)/;
const LORD_SCOPE = /^(agent_to_parent_army_general_own|character_to_army_general_own)/;
// Tecnologías: "a todos los personajes de la facción" (señores y héroes; a veces solo unos)
const CHARS_SCOPE = /^faction_to_character_own/;
const whoOf = (sc: string) => (/heroes_only|_agents/.test(sc) ? 'hero' : /lords_only|armytext/.test(sc) ? 'lord' : /wizard/.test(sc) ? 'wizard' : null);

const ABILITY_STAT_ES: Record<string, string> = {
  stat_melee_attack: 'Ataque cuerpo a cuerpo', stat_melee_defence: 'Defensa cuerpo a cuerpo', stat_armour: 'Armadura',
  stat_morale: 'Liderazgo', stat_charge_bonus: 'Bonificación de carga', stat_melee_damage_base: 'Daño base de arma',
  stat_melee_damage_ap: 'Daño perforante de arma', scalar_speed: 'Velocidad', scalar_charge_speed: 'Velocidad de carga',
  stat_resistance_all: 'Resistencia al daño', stat_resistance_physical: 'Resistencia física', stat_resistance_missile: 'Resistencia a proyectiles',
  stat_resistance_spell: 'Resistencia a hechizos', stat_resistance_flame: 'Resistencia al fuego', stat_weakness_flame: 'Debilidad al fuego',
  stat_damage_reflection: 'Reflejo de daño cuerpo a cuerpo', stat_missile_block_chance: 'Probabilidad de bloquear proyectiles',
  scalar_missile_damage_base: 'Daño base de proyectil', scalar_missile_damage_ap: 'Daño perforante de proyectil',
  stat_bonus_vs_large: 'Bonificación contra grandes', stat_bonus_vs_infantry: 'Bonificación contra infantería',
  stat_accuracy: 'Precisión', stat_reloading: 'Habilidad de recarga', scalar_missile_range: 'Alcance',
  stat_healing_power: 'Curación recibida', stat_mass: 'Masa', scalar_spell_mastery: 'Maestría de hechizos',
  scalar_miscast_chance: 'Probabilidad de fallo de hechizo', scalar_entity_acceleration_modifier: 'Aceleración',
  scalar_entity_deceleration_modifier: 'Deceleración', scalar_entity_turn_speed_modifier: 'Velocidad de giro',
};

const clean = (t?: string | null) => (t ?? '').replace(/\{\{tr:[^}]*\}\}/g, '').replace(/\[\[[^\]]*\]\]/g, '').replace(/\s+/g, ' ').trim();
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => String(r2(v));
const strip = (o: Row) => { for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined) delete o[k]; return o; };

export function buildAllSkills(T: Tables, sp: Map<string, string>) {
  for (const t of SKILL_TABLES) T[t] ??= [];
  const resolve = (t: string, d = 0): string => (d > 5 || !t ? t ?? '' : t.replace(/\{\{tr:([^}]+)\}\}/g, (_m, k) => resolve(sp.get(k) ?? '', d + 1)));
  const L = (k: string): string | null => clean(resolve(sp.get(k) ?? '')) || null;
  const by = (t: string, k: string) => new Map<string, Row>(T[t].map((r) => [r[k], r]));
  const group = (t: string, k: string) => {
    const m = new Map<string, Row[]>();
    for (const r of T[t]) { const a = m.get(r[k]); if (a) a.push(r); else m.set(r[k], [r]); }
    return m;
  };

  // ---------------- unidades ----------------
  const lu = by('land_units_tables', 'key'), be = by('battle_entities_tables', 'key'), mw = by('melee_weapons_tables', 'key');
  const arm = by('unit_armour_types_tables', 'key'), shd = by('unit_shield_types_tables', 'key'), mnt = by('mounts_tables', 'key');
  const fac = by('factions_tables', 'key'), main = by('main_units_tables', 'unit');
  const perms = new Map<string, Set<string>>();
  for (const p of T['units_custom_battle_permissions_tables']) { if (!perms.has(p.unit)) perms.set(p.unit, new Set()); perms.get(p.unit)!.add(p.faction); }
  const unitSc = new Map<string, string[]>();
  for (const [u, fs] of perms) unitSc.set(u, [...new Set([...fs].filter((f) => fac.has(f)).map((f) => fac.get(f)!.subculture as string))].sort());
  // Algunos legendarios (p. ej. Kairos) usan en batalla personalizada otra unidad ("..._custom_battle_0") que apunta a la
  // suya con set_piece_character: sus facciones se toman de esa
  const setPieceSc = new Map<string, string[]>();
  for (const p of T['units_custom_battle_permissions_tables']) {
    if (!p.set_piece_character || !fac.has(p.faction)) continue;
    const sc = fac.get(p.faction)!.subculture as string;
    setPieceSc.set(p.set_piece_character, [...new Set([...(setPieceSc.get(p.set_piece_character) ?? []), sc])].sort());
  }
  const attrGroups = group('unit_attributes_to_groups_junctions_tables', 'attribute_group');
  const luAbil = group('land_units_to_unit_abilites_junctions_tables', 'land_unit');
  // Todas las unidades con datos de batalla (no solo las de batalla personalizada): las variantes de campaña
  // (p. ej. "Malditos de Nurgle" de los Guerreros del Caos) también entran en los conjuntos de unidades de los efectos
  const universe: { rec: string; caste: string; cat: string; cls: string }[] = [];
  for (const m of T['main_units_tables']) {
    const Lu = lu.get(m.land_unit);
    if (!Lu) continue;
    universe.push({ rec: m.unit, caste: m.caste, cat: Lu.category, cls: Lu.class });
  }
  const attrName = (a: string) => (L(`unit_attributes_bullet_text_${a}`) ?? a).split('||')[0].trim();

  const charStats = (unitKey: string) => {
    const m = main.get(unitKey);
    if (!m) return null;
    const Lu = lu.get(m.land_unit) ?? {};
    const ent = be.get(Lu.man_entity) ?? {};
    const mount = Lu.mount ? mnt.get(Lu.mount) : undefined;
    const ment = mount ? be.get(mount.entity) ?? {} : {};
    const w = mw.get(Lu.primary_melee_weapon ?? '') ?? {};
    return {
      run_speed: (mount ? ment.run_speed : ent.run_speed) ?? 0, mass: ent.mass, size: mount ? ment.size : ent.size,
      hit_points: ent.hit_points ?? 0, bonus_hit_points: Lu.bonus_hit_points ?? 0,
      armour: arm.get(Lu.armour ?? '')?.armour_value ?? 0, missile_block_chance: shd.get(Lu.shield ?? '')?.missile_block_chance ?? 0,
      morale: Lu.morale ?? 0, damage_mod_flame: Lu.damage_mod_flame ?? 0, damage_mod_magic: Lu.damage_mod_magic ?? 0,
      damage_mod_physical: Lu.damage_mod_physical ?? 0, damage_mod_missile: Lu.damage_mod_missile ?? 0, damage_mod_all: Lu.damage_mod_all ?? 0,
      melee_attack: Lu.melee_attack ?? 0, melee_defence: Lu.melee_defence ?? 0, charge_bonus: Lu.charge_bonus ?? 0,
      bonus_v_large: w.bonus_v_large ?? 0, bonus_v_infantry: w.bonus_v_infantry ?? 0, damage: w.damage ?? 0, ap_damage: w.ap_damage ?? 0,
      splash_attack_max_attacks: w.splash_attack_max_attacks ?? 1, melee_attack_interval: r2(w.melee_attack_interval || 4),
      is_flaming: !!w.ignition_amount, is_magical: !!w.is_magical,
      attributes: (attrGroups.get(Lu.attribute_group ?? '') ?? []).map((a) => attrName(a.attribute)),
      abilities: (luAbil.get(Lu.key) ?? []).map((a) => a.ability as string),
      unit: unitKey,
    };
  };

  // ---------------- conjuntos de unidades ----------------
  const usRules = group('unit_set_to_unit_junctions_tables', 'unit_set');
  const usMeta = by('unit_sets_tables', 'key');
  const unitLists: string[][] = [];
  const listIdx = new Map<string, number>();
  const membersCache = new Map<string, string[]>();
  const FIELDS: [string, 'rec' | 'caste' | 'cat' | 'cls'][] = [['unit_record', 'rec'], ['unit_caste', 'caste'], ['unit_category', 'cat'], ['unit_class', 'cls']];
  const match = (u: (typeof universe)[number], r: Row) => FIELDS.every(([f, k]) => r[f] === null || r[f] === undefined || r[f] === u[k]);
  const members = (us: string) => {
    if (!membersCache.has(us)) {
      const rs = usRules.get(us) ?? [];
      const inc = rs.filter((r) => !r.exclude), exc = rs.filter((r) => r.exclude);
      membersCache.set(us, universe.filter((u) => inc.some((r) => match(u, r)) && !exc.some((r) => match(u, r))).map((u) => u.rec).sort());
    }
    return membersCache.get(us)!;
  };
  const listId = (recs: string[]): number | null => {
    if (recs.length === universe.length) return null; // todas
    const k = recs.join(',');
    if (!listIdx.has(k)) { listIdx.set(k, unitLists.length); unitLists.push(recs); }
    return listIdx.get(k)!;
  };
  const rankOfSet = (us: string) => {
    const m = usMeta.get(us);
    return m?.use_unit_exp_level_range && (m.min_unit_exp_level_inclusive ?? -1) > 0 ? m.min_unit_exp_level_inclusive : null;
  };

  // ---------------- habilidades / hechizos ----------------
  const ua = by('unit_abilities_tables', 'key'), usa = by('unit_special_abilities_tables', 'key');
  const phJ = group('special_ability_to_special_ability_phase_junctions_tables', 'special_ability');
  const ph = by('special_ability_phases_tables', 'id');
  const phSt = group('special_ability_phase_stat_effects_tables', 'phase'), phAt = group('special_ability_phase_attribute_effects_tables', 'phase');
  const invalidTargets = group('special_ability_to_invalid_target_flags_tables', 'special_ability');
  // Restricciones de objetivo usadas, con el texto del juego (para interpretarlas en el motor)
  const targetFlags: Record<string, string> = {};
  for (const f of T['special_ability_invalid_usage_flags_tables'])
    targetFlags[f.flag_key] = L(`special_ability_invalid_usage_flags_flag_description_${f.flag_key}`) ?? L(`special_ability_invalid_usage_flags_alt_description_${f.flag_key}`) ?? '';
  const abilities: Record<string, Row> = {};
  const ability = (key: string) => {
    if (abilities[key] || !ua.has(key)) return;
    const a = ua.get(key)!, s = usa.get(key) ?? {};
    const phases = [...(phJ.get(key) ?? [])].sort((x, y) => x.order - y.order).map((j) => {
      const p = ph.get(j.phase) ?? {};
      const stats = (phSt.get(j.phase) ?? []).map((st) => {
        const nm = ABILITY_STAT_ES[st.stat] ?? st.stat;
        const d = st.how === 'mult' ? `×${r2(st.value)} ${nm}` : `${st.value > 0 ? '+' : ''}${r2(st.value)} ${nm}`;
        return { stat: st.stat, how: st.how, v: st.value, d };
      });
      return strip({
        dur: p.duration ?? 0, tf: j.target_friends, te: j.target_enemies, ts: j.target_self, type: p.effect_type,
        mag: p.imbue_magical ? true : null, fire: p.imbue_ignition ? true : null, stats,
        attr: (phAt.get(j.phase) ?? []).filter((x) => x.attribute_type !== 'negative').map((x) => attrName(x.attribute)),
      });
    });
    abilities[key] = strip({
      key, name: L(`unit_abilities_onscreen_name_${key}`) ?? key, nameEn: key, img: a.icon_name || null,
      type: L(`unit_ability_types_onscreen_name_${a.type}`) ?? a.type, typeKey: a.type, spell: (s.mana_cost ?? 0) > 0 ? true : null,
      over: a.overpower_option, active: s.active_time, range: s.effect_range, mana: s.mana_cost, cd: s.recharge_time,
      tf: s.target_friends, te: s.target_enemies, ts: s.affect_self, tg: s.target_ground, hidden: a.is_hidden_in_ui || null,
      passive: !!s.passive, phases,
      inv: invalidTargets.has(key) ? invalidTargets.get(key)!.map((r) => r.invalid_target as string) : null,
    });
    if (a.overpower_option) ability(a.overpower_option);
  };

  // ---------------- efectos ----------------
  const bIus = group('effect_bonus_value_ids_unit_sets_tables', 'effect'), bBasic = group('effect_bonus_value_basic_junction_tables', 'effect');
  const bAb = group('effect_bonus_value_unit_ability_junctions_tables', 'effect');
  const bUsab = group('effect_bonus_value_unit_set_unit_ability_junctions_tables', 'effect');
  const bUsat = group('effect_bonus_value_unit_set_unit_attribute_junctions_tables', 'effect');
  const bAt = group('effect_bonus_value_unit_attribute_junctions_tables', 'effect');
  const bAction = new Set(T['effect_bonus_value_agent_action_record_junctions_tables'].map((r) => r.effect as string));
  const usab = by('unit_set_unit_ability_junctions_tables', 'key'), usat = by('unit_set_unit_attribute_junctions_tables', 'key');

  const scopeTarget = (sc: string) =>
    SELF_SCOPE.test(sc) ? 'self' : LORD_SCOPE.test(sc) ? 'lord' : ARMY_SCOPE.test(sc) || /^faction_to_army_own/.test(sc) ? 'army' : CHARS_SCOPE.test(sc) ? 'chars' : 'none';
  const effectText = (key: string, value: number, scope: string) => {
    let t = resolve(sp.get(`effects_description_${key}`) ?? '');
    if (!t) return '';
    const v = r2(value);
    t = t.replace(/%\+n/g, (v > 0 ? '+' : '') + fmt(v)).replace(/%n/g, fmt(v));
    const sc = clean(resolve(sp.get(`campaign_effect_scopes_localised_text_${scope}`) ?? ''));
    return clean(t) + (sc ? ` ${sc}` : '');
  };

  const parts = (key: string, value: number, scope: string): Row[] => {
    const tgt = scopeTarget(scope);
    const who = tgt === 'chars' ? whoOf(scope) : null;
    const listed = tgt === 'army' || tgt === 'chars';
    const out: Row[] = [];
    for (const r of bIus.get(key) ?? []) {
      const st = UNITSET_STATS[r.bonus_value_id];
      if (st && tgt !== 'none') {
        out.push({ kind: 'battle', target: tgt, who, stat: st[0], value, pct: st[1], u: listed ? listId(members(r.unit_set)) : null, rank: rankOfSet(r.unit_set) });
      } else if (r.bonus_value_id === 'unit_flaming_attack_mod' && tgt !== 'none') {
        out.push({ kind: 'attribute', target: tgt, who, attribute: 'Ataques flamígeros', u: listed ? listId(members(r.unit_set)) : null });
      }
    }
    for (const r of bBasic.get(key) ?? []) {
      const b = r.bonus_value_id;
      if (BASIC_STATS[b] && tgt !== 'none') out.push({ kind: 'battle', target: tgt, who, stat: BASIC_STATS[b][0], value, pct: BASIC_STATS[b][1] });
      else if (BASIC_ATTR[b] && tgt !== 'none') out.push({ kind: 'attribute', target: tgt, who, attribute: BASIC_ATTR[b] });
    }
    for (const r of bAt.get(key) ?? []) if (tgt !== 'none') out.push({ kind: 'attribute', target: tgt, attribute: attrName(r.attribute ?? r.unit_attribute ?? '') });
    for (const r of bUsat.get(key) ?? []) {
      const j = usat.get(r.unit_set_attribute);
      if (j) out.push({ kind: 'attribute', target: 'army', attribute: attrName(j.unit_attribute), u: listId(members(j.unit_set)) });
    }
    for (const r of bUsab.get(key) ?? []) {
      const j = usab.get(r.unit_set_ability);
      if (!j) continue;
      ability(j.unit_ability);
      if (tgt === 'self' || tgt === 'lord') out.push({ kind: 'ability', target: 'self', ability: j.unit_ability });
      else out.push({ kind: 'attribute', target: 'army', attribute: 'Habilidad: ' + (L(`unit_abilities_onscreen_name_${j.unit_ability}`) ?? j.unit_ability), u: listId(members(j.unit_set)) });
    }
    for (const r of bAb.get(key) ?? []) {
      if (r.bonus_value_id === 'enable') { ability(r.unit_ability); out.push({ kind: 'ability', target: tgt === 'chars' ? 'chars' : 'self', who, ability: r.unit_ability }); }
      else if (r.bonus_value_id === 'disable') out.push({ kind: 'ability', target: 'self', disable: r.unit_ability });
      else out.push({ kind: 'magic', target: 'self' });
    }
    // "Activa ataques envenenados/desgarradores/encantados..." no tienen tabla de bonificación: atributo con el nombre del texto
    if (!out.length && /enable_[a-z_]*attacks/.test(key) && tgt !== 'none') {
      const t = clean(resolve(sp.get(`effects_description_${key}`) ?? '')).replace(/\s*\(.*$/, '').replace(/^Activa\s+/i, '');
      if (t) out.push({ kind: 'attribute', target: tgt, who, attribute: t.charAt(0).toUpperCase() + t.slice(1) });
    }
    if (!out.length) out.push({ kind: key.includes('enable_mount') ? 'mount' : 'campaign', target: 'none', action: bAction.has(key) ? true : null });
    // Un mismo efecto con varios conjuntos de unidades para la misma stat: unir las listas
    const merged: Row[] = [];
    const idx = new Map<string, Row & { ids?: Set<string> | null }>();
    for (const p of out) {
      if (p.kind === 'battle') {
        const k = `${p.target}|${p.who}|${p.stat}|${p.pct}|${p.rank}`;
        const q = idx.get(k);
        if (q) {
          if (q.ids) {
            if (p.u === null || p.u === undefined) q.ids = null;
            else for (const x of unitLists[p.u]) q.ids.add(x);
          }
          continue;
        }
        const e: Row = { ...p, ids: p.u === null || p.u === undefined ? null : new Set(unitLists[p.u]) };
        idx.set(k, e);
        merged.push(e);
        continue;
      }
      merged.push(p);
    }
    for (const p of merged) {
      if ('ids' in p) { p.u = p.ids ? listId([...p.ids].sort()) : null; delete p.ids; }
      strip(p);
    }
    return merged.sort((a, b) => (a.stat === 'dmg' ? 0 : 1) - (b.stat === 'dmg' ? 0 : 1));
  };

  // ---------------- árboles ----------------
  const nodes = by('character_skill_nodes_tables', 'key'), skills = by('character_skills_tables', 'key');
  const items = group('character_skill_node_set_items_tables', 'set'), links = group('character_skill_node_links_tables', 'child_key');
  const lvlDet = group('character_skill_level_details_tables', 'skill_key');
  const lvlEff = group('character_skill_level_to_effects_junctions_tables', 'character_skill_key');
  const crit = group('character_skills_to_level_reached_criterias_tables', 'character_skill');
  const ag = by('agent_subtypes_tables', 'key');
  const skillsOut: Record<string, Row> = {};
  // Nombre en inglés (db): algunas habilidades lo toman de otra ({{tr:character_skills_localised_name_<otra>}})
  const englishName = (sk: string, d = 0): string | undefined => {
    const n: string | undefined = skills.get(sk)?.localised_name;
    const m = n?.match(/^\{\{tr:character_skills_localised_name_([^}]+)\}\}$/);
    if (m && d < 5) return englishName(m[1], d + 1);
    return n && !n.includes('{{tr:') ? n : undefined;
  };
  const skillDef = (sk: string) => {
    if (skillsOut[sk]) return;
    const s = skills.get(sk) ?? {};
    const effs = lvlEff.get(sk) ?? [], det = lvlDet.get(sk) ?? [], cr = crit.get(sk) ?? [];
    const nLv = Math.max(1, ...effs.map((r) => r.level), ...det.map((r) => r.level), ...cr.map((r) => r.upgrade_to_skill_level));
    const lv: Row[] = [];
    for (let i = 1; i <= nLv; i++) {
      const es: Row[] = [];
      for (const r of effs) {
        if (r.level !== i) continue;
        const text = effectText(r.effect_key, r.value, r.effect_scope);
        parts(r.effect_key, r.value, r.effect_scope).forEach((p, j) => es.push({ k: r.effect_key, d: j === 0 ? text : '', s: p }));
      }
      const ab = es.filter((e) => e.s.ability).map((e) => e.s.ability);
      // el juego guarda los rangos desde 0; en pantalla (y en el planner) empiezan en 1
      let ur: number | null = det.find((r) => r.level === i && r.unlocked_at_rank > 0)?.unlocked_at_rank ?? null;
      if (ur !== null) ur += 1;
      if (ur === null && i === 1 && (s.unlocked_at_rank ?? 0) > 0) ur = s.unlocked_at_rank + 1;
      const c = cr.find((r) => r.upgrade_to_skill_level === i && r.character_level > 0);
      const ar = c ? c.character_level + 1 : null;
      if (ar) ur = null;
      lv.push(strip({ e: es, ab: ab.length ? ab : null, ur, ar }));
    }
    skillsOut[sk] = {
      sk, n: L(`character_skills_localised_name_${sk}`) || clean(resolve(s.localised_name ?? '')) || sk, nEn: englishName(sk),
      d: L(`character_skills_localised_description_${sk}`) ?? (clean(resolve(s.localised_description ?? '')) || undefined), img: String(s.image_path ?? '').replace('.png', ''),
      lv, bgSkill: !!s.is_background_skill,
    };
  };

  // Monturas: habilidad -> ancillary (character_skill_level_to_ancillaries) -> unidad montada (provided_bodyguard_unit)
  const anc = by('ancillaries_tables', 'key');
  const ancSubs = group('ancillaries_included_agent_subtypes_tables', 'ancillary');
  const skillAnc = group('character_skill_level_to_ancillaries_junctions_tables', 'skill');
  // Objetos propios de los legendarios: los de su misión (character_ancillary_quest_ui_details) y los exclusivos de su subtipo
  const ancEff = group('ancillary_to_effects_tables', 'ancillary');
  const questBySub = group('character_ancillary_quest_ui_details_tables', 'agent_subtype');
  const ancBySub = group('ancillaries_included_agent_subtypes_tables', 'agent_subtype');
  const ancillaries: Record<string, Row> = {};
  const ancDef = (k: string) => {
    if (ancillaries[k]) return;
    const a = anc.get(k) ?? {};
    const e: Row[] = [];
    for (const r of ancEff.get(k) ?? []) {
      const text = effectText(r.effect, r.value, r.effect_scope);
      parts(r.effect, r.value, r.effect_scope).forEach((p, j) => e.push({ k: r.effect, d: j === 0 ? text : '', s: p }));
    }
    ancillaries[k] = strip({
      n: L(`ancillaries_onscreen_name_${k}`) ?? k, d: L(`ancillaries_colour_text_${k}`) ?? undefined, cat: a.category, e,
    });
  };
  const itemsFor = (subtype: string): Row[] => {
    const out = new Map<string, Row>();
    for (const q of questBySub.get(subtype) ?? []) {
      if (!anc.has(q.ancillary)) continue;
      ancDef(q.ancillary);
      out.set(q.ancillary, strip({ k: q.ancillary, rank: q.rank || null, quest: q.is_quest_battle || null }));
    }
    for (const r of ancBySub.get(subtype) ?? []) {
      const a = anc.get(r.ancillary);
      if (!a || a.category === 'mount' || out.has(r.ancillary)) continue;
      ancDef(r.ancillary);
      out.set(r.ancillary, { k: r.ancillary });
    }
    return [...out.values()];
  };

  const mountFor = (sk: string, subtype: string) => {
    for (const r of [...(skillAnc.get(sk) ?? [])].sort((a, b) => a.level - b.level)) {
      const a = anc.get(r.granted_ancillary);
      if (!a || a.category !== 'mount' || !a.provided_bodyguard_unit) continue;
      const subs = new Set((ancSubs.get(a.key) ?? []).map((x) => x.agent_subtype));
      if (subs.size && !subs.has(subtype)) continue;
      const st = charStats(a.provided_bodyguard_unit);
      if (st) return st;
    }
    return null;
  };
  const charName = (sub: string, unit: string, legendary: boolean) => {
    const bySub = L(`agent_subtypes_onscreen_name_override_${sub}`);
    const byUnit = L(`land_units_onscreen_name_${main.get(unit)?.land_unit ?? unit}`);
    const ok = (n: string | null): n is string => !!n && !/legendari/i.test(n) && !n.includes('{{');
    // Legendarios: el nombre de su unidad ("Thorgrim Custodio de Agravios"); genéricos: el tipo ("Señor Enano")
    if (legendary && ok(byUnit)) return byUnit;
    return ok(bySub) ? bySub : ok(byUnit) ? byUnit : sub;
  };
  const homeSc = (unit: string, scs: string[]) => {
    const tok = unit.split('_')[2] ?? '';
    return scs.find((sc) => sc.includes(`_sc_${tok}_`)) ?? scs[0];
  };

  // ---------------- Dones del Príncipe Demonio (armería) ----------------
  // Personajes con piezas intercambiables: Daniel (wh3_main_dae_daemon_prince). Las piezas "_fe_" son las del cuerpo
  // femenino (mismos efectos), así que no se duplican.
  const ARMORY_PREFIX: Record<string, string> = { wh3_main_dae_daemon_prince: 'wh3_main_dae_cha_daemon_prince_' };
  const armItemEff = group('armory_items_to_effects_tables', 'armory_item');
  const armCats = group('armory_item_to_category_sets_tables', 'armory_item');
  const armSlotBl = group('armory_item_slot_blacklists_tables', 'armory_item');
  const armUi = by('armory_item_ui_infos_tables', 'armory_item');
  const armVar = group('armory_item_variants_tables', 'armory_item');
  const armSetItems = group('armory_item_set_items_tables', 'armory_item_set');
  const armSetEff = group('armory_item_set_to_effects_tables', 'armory_item_set');
  const effRows = (list: Row[], kKey = 'effect') => {
    const e: Row[] = [];
    for (const r of list) {
      // armory_*_to_effects usan effect_scope; campaign_effect_list_effect_junctions usa scope
      const sc = r.effect_scope ?? r.scope ?? '';
      const text = effectText(r[kKey], r.value, sc);
      parts(r[kKey], r.value, sc).forEach((p, j) => e.push({ k: r[kKey], d: j === 0 ? text : '', s: p }));
      if (!parts(r[kKey], r.value, sc).length && text) e.push({ k: r[kKey], d: text, s: { kind: 'other', target: 'none' } });
    }
    return e;
  };
  const armoryFor = (subtype: string): Row | null => {
    const pre = ARMORY_PREFIX[subtype];
    if (!pre) return null;
    const items = T['armory_items_tables'].filter((r) => r.key.startsWith(pre) && !r.key.includes('_fe_'));
    if (!items.length) return null;
    const keys = new Set(items.map((r) => r.key as string));
    const order = by('armory_slot_type_ui_infos_tables', 'slot_type');
    const mand = by('armory_slot_types_tables', 'slot_type_name');
    const slots = [...new Set(items.map((r) => r.slot_type as string))]
      .map((k) => strip({ k, n: L(`armory_slot_type_ui_infos_localised_name_${k}`) ?? k, o: order.get(k)?.sort_order ?? 99, m: mand.get(k)?.mandatory || null }))
      .sort((x, y) => x.o - y.o);
    const vName = (k: string) => {
      const v = (armVar.get(k) ?? []).find((x) => x.use_as_default) ?? (armVar.get(k) ?? [])[0];
      return v?.ui_info ? L(`armory_item_variant_ui_infos_localised_name_${v.ui_info}`) : null;
    };
    const out = items.map((r) => {
      const k = r.key as string;
      const cats = (armCats.get(k) ?? []).map((x) => x.category_set as string);
      return strip({
        k, s: r.slot_type, n: L(`armory_item_ui_infos_localised_name_${k}`) ?? vName(k) ?? k.replace(pre, ''),
        d: L(`armory_item_ui_infos_description_${k}`) ?? undefined, g: cats.find((c) => ['khorne', 'nurgle', 'slaanesh', 'tzeentch'].includes(c)) ?? 'generic', st: armUi.get(k)?.type ?? null,
        c: cats.length ? cats : null, bs: (armSlotBl.get(k) ?? []).map((x) => x.slot).filter(Boolean),
        e: effRows(armItemEff.get(k) ?? []),
      });
    });
    out.forEach((x) => { if (!x.bs?.length) delete x.bs; });
    const setKeysFor = [...armSetItems.keys()].filter((sk) => (armSetItems.get(sk) ?? []).every((x) => keys.has(x.armory_item)));
    const sets = setKeysFor
      .filter((sk) => (armSetEff.get(sk) ?? []).length)
      .map((sk) => strip({
        k: sk, n: L(`armory_item_set_ui_infos_name_${sk}`) ?? sk, d: L(`armory_item_set_ui_infos_description_${sk}`) ?? undefined,
        items: (armSetItems.get(sk) ?? []).map((x) => x.armory_item), e: effRows(armSetEff.get(sk) ?? []),
      }));
    // Equipo inicial (forma base)
    const defSet = [...armSetItems.keys()].find((sk) => sk === subtype + '_default');
    const def = (defSet ? armSetItems.get(defSet) ?? [] : []).map((x) => x.armory_item).filter((k) => keys.has(k));
    const black: Record<string, string[]> = {};
    for (const b of T['armory_item_category_blacklists_tables']) (black[b.source_category] ??= []).push(b.blacklisted_category);
    return { slots, items: out, sets, def, black };
  };

  // ---------------- Espacios de hechizo (Kairos) ----------------
  // Una habilidad da "+1 iniciativa activa" a un conjunto (common_1...rare_2); en cada espacio se elige uno de los saberes
  const slotByEffect = new Map<string, string>();
  for (const r of T['effect_bonus_value_initiative_set_junctions_tables']) if (r.bonus_value_id === 'active_initiative_count_mod') slotByEffect.set(r.effect, r.initiative_set);
  const iniBy = by('initiatives_tables', 'key');
  const iniSetItems = group('initiative_set_items_tables', 'set');
  const iniEff = group('campaign_effect_list_effect_junctions_tables', 'effect_list');
  const LORE_ES: Record<string, string> = {
    beast: 'Bestias', death: 'Muerte', fire: 'Fuego', heavens: 'Cielos', life: 'Vida', light: 'Luz', metal: 'Metal', shadows: 'Sombras', tzeentch: 'Tzeentch',
  };
  const RARITY_ES: Record<string, string> = {
    common: L('campaign_localised_strings_string_wh3_kairos_fragments_of_sorcery_rarity_ability_common') ?? 'Hechizos comunes',
    uncommon: L('campaign_localised_strings_string_wh3_kairos_fragments_of_sorcery_rarity_ability_uncommon') ?? 'Hechizos poco comunes',
    rare: L('campaign_localised_strings_string_wh3_kairos_fragments_of_sorcery_rarity_ability_rare') ?? 'Hechizos raros',
  };
  const spellSlotsFor = (nodeSkills: string[]): Row[] | null => {
    const out: Row[] = [];
    for (const sk of nodeSkills) {
      for (const lv of skillsOut[sk]?.lv ?? []) for (const e of lv.e ?? []) {
        const set = slotByEffect.get(e.k);
        if (!set || out.some((x) => x.k === set)) continue;
        const m = /_(common|uncommon|rare)_(\d+)$/.exec(set);
        const opts = (iniSetItems.get(set) ?? []).map((it) => {
          const ini = iniBy.get(it.item);
          if (!ini) return null;
          const lore = /_([a-z]+)$/.exec(it.item)?.[1] ?? '';
          const name = clean(resolve(L(`initiatives_localised_name_${it.item}`) ?? '')) || it.item;
          return strip({ k: it.item, lore: LORE_ES[lore] ?? lore, lk: lore, n: name, e: effRows(iniEff.get(ini.effects) ?? [], 'effect') });
        }).filter(Boolean);
        out.push({ k: set, n: m ? `${RARITY_ES[m[1]] ?? m[1]} ${m[2]}` : set, r: m?.[1] ?? '', o: (['common', 'uncommon', 'rare'].indexOf(m?.[1] ?? '') * 10) + Number(m?.[2] ?? 0), by: sk, ef: e.k, opts });
      }
    }
    return out.length ? out.sort((a, b) => a.o - b.o) : null;
  };

  // ---------------- Iniciativas de personaje (Senda a la Gloria) ----------------
  // background_character_initiative_sets.campaign_group -> miembros del grupo -> subtipos de agente
  const memberSubs = group('campaign_group_member_criteria_agent_subtypes_tables', 'member');
  const groupMembers = group('campaign_group_members_tables', 'group');
  const iniSetBy = by('initiative_sets_tables', 'key');
  const CAT_ES: Record<string, string> = {
    PATH_TO_GLORY_BOON: 'Regalos del Caos (Senda a la Gloria)', PATH_TO_GLORY_MARK: 'Devoción y ascenso (Senda a la Gloria)',
  };
  const charInitBySub = new Map<string, Row[]>();
  for (const b of T['background_character_initiative_sets_tables']) {
    const set = iniSetBy.get(b.initiative_set);
    if (!set || set.category === 'KAIROS_FRAGMENTS_OF_SORCERY') continue;
    const subs = new Set((groupMembers.get(b.campaign_group) ?? []).flatMap((m) => (memberSubs.get(m.id) ?? []).map((x) => x.agent_subtype as string)));
    if (!subs.size) continue;
    const items = (iniSetItems.get(b.initiative_set) ?? []).map((it) => {
      const ini = iniBy.get(it.item);
      if (!ini) return null;
      return strip({
        k: it.item, n: L(`initiatives_localised_name_${it.item}`) ?? it.item, req: L(`initiatives_localised_description_${it.item}`) ?? undefined,
        locked: it.initially_locked || null, e: effRows(iniEff.get(ini.effects) ?? [], 'effect'),
      });
    }).filter(Boolean);
    if (!items.length) continue;
    const row = strip({ k: b.initiative_set, cat: set.category, n: CAT_ES[set.category] ?? set.category, max: b.amount_to_select || null, items });
    for (const sub of subs) charInitBySub.set(sub, [...(charInitBySub.get(sub) ?? []), row]);
  }

  // Facciones que lleva cada señor legendario en la pantalla de campaña: si su unidad no sale en batalla personalizada
  // (p. ej. Malus Darkblade) es la única forma de saber su facción
  const leaderSc = new Map<string, string[]>();
  for (const r of T['frontend_faction_leaders_tables']) {
    if (!r.agent_subtype_record || !fac.has(r.faction)) continue;
    const sc = fac.get(r.faction)!.subculture as string;
    leaderSc.set(r.agent_subtype_record, [...new Set([...(leaderSc.get(r.agent_subtype_record) ?? []), sc])].sort());
  }

  const characters: Row[] = [];
  for (const s of T['character_skill_node_sets_tables']) {
    if (s.for_navy || s.for_army || !ag.has(s.agent_subtype_key)) continue;
    const a = ag.get(s.agent_subtype_key)!;
    const unit: string | undefined = a.associated_unit_override;
    if (!unit) continue;
    let scs = unitSc.get(unit)?.length ? unitSc.get(unit)! : setPieceSc.get(unit)?.length ? setPieceSc.get(unit)! : leaderSc.get(s.agent_subtype_key) ?? [];
    if (s.subculture) scs = scs.includes(s.subculture) ? [s.subculture] : [s.subculture];
    if (s.faction_key && fac.has(s.faction_key)) scs = [fac.get(s.faction_key)!.subculture];
    if (!scs.length) continue;
    const outNodes: Row[] = [], bg: Row[] = [], mounts: Record<string, Row> = {};
    for (const it of items.get(s.key) ?? []) {
      const n = nodes.get(it.item);
      if (!n) continue;
      const sk = n.character_skill_key;
      if (!skills.has(sk)) continue;
      // nodos de otra facción concreta: solo si el árbol es de esa facción (los rasgos innatos sí se guardan)
      if (n.faction_key && n.faction_key !== s.faction_key && !skills.get(sk)!.is_background_skill) continue;
      skillDef(sk);
      const ls = links.get(n.key) ?? [];
      const ent = strip({
        k: n.key, s: sk, t: n.tier, i: n.indent, poc: n.points_on_creation || null, rnp: n.required_num_parents || null,
        pr: ls.filter((l) => l.link_type === 'REQUIRED').map((l) => l.parent_key), psr: ls.filter((l) => l.link_type !== 'REQUIRED').map((l) => l.parent_key),
        sc: n.subculture, ck: n.campaign_key, fk: n.faction_key,
      });
      if (!ent.pr.length) delete ent.pr;
      if (!ent.psr.length) delete ent.psr;
      const so = skillsOut[sk];
      if (so.bgSkill || !n.visible_in_ui) {
        // ocultos que no son rasgos ni dan nada en batalla (p. ej. escalado de acciones de agente) no cuentan
        if (!so.bgSkill && !so.lv.some((l: Row) => l.e.some((e: Row) => ['battle', 'attribute', 'ability'].includes(e.s.kind)))) continue;
        ent.bg = true;
        if (!so.bgSkill) ent.auto = true;
        bg.push(ent);
      } else {
        const ms = mountFor(sk, s.agent_subtype_key);
        if (ms) mounts[sk] = ms;
        outNodes.push(ent);
      }
    }
    if (!outNodes.length) continue;
    // Marcados como no generados en el juego pero no son legendarios: los Príncipes Demonio que reclutan los Guerreros
    // del Caos y el del episodio de la Fortaleza Oscura
    const legendary = !a.auto_generate && !/^wh3_dlc20_chs_daemon_prince_|^wh3_dlc29_episode_/.test(s.agent_subtype_key);
    let name = s.agent_subtype_key === 'wh3_main_dae_daemon_prince' ? 'Daniel, el Príncipe Demonio' : charName(s.agent_subtype_key, unit, legendary);
    if (s.faction_key) name += ` (${L(`factions_screen_name_${s.faction_key}`) ?? s.faction_key})`;
    characters.push(strip({
      key: s.key, subtype: s.agent_subtype_key, name, nameEn: a.key, unit,
      type: s.agent_key === 'general' ? 'lord' : 'hero', agent: s.agent_key, legendary,
      subcultures: scs, home: homeSc(unit, scs), nodes: outNodes, bg, stats: charStats(unit), mounts: Object.keys(mounts).length ? mounts : null,
      items: legendary && itemsFor(s.agent_subtype_key).length ? itemsFor(s.agent_subtype_key) : null,
      armory: armoryFor(s.agent_subtype_key),
      spellSlots: spellSlotsFor([...outNodes, ...bg].map((n) => n.s)),
      initiatives: charInitBySub.get(s.agent_subtype_key) ?? null,
    }));
  }
  const nodeSet = new Set(characters.flatMap((c) => c.nodes.map((n: Row) => n.k)));
  const locks = T['character_skill_nodes_skill_locks_tables']
    .filter((l) => nodeSet.has(l.character_skill_node))
    .map((l) => ({ skill: l.character_skill, node: l.character_skill_node, level: l.level }));
  // Conjuntos de objetos (bonificación extra al llevar todas las piezas)
  const setItems = group('ancillary_set_ancillary_junctions_tables', 'set_key');
  const setEff = group('ancillary_set_effect_junctions_tables', 'set_key');
  const itemSets: Row[] = [];
  for (const [key, list] of setItems) {
    const items = list.map((x) => x.ancillary_key as string);
    if (!items.every((k) => ancillaries[k])) continue;
    const e: Row[] = [];
    for (const r of setEff.get(key) ?? []) {
      const text = effectText(r.effect_key, r.value, r.effect_scope);
      parts(r.effect_key, r.value, r.effect_scope).forEach((p, j) => e.push({ k: r.effect_key, d: j === 0 ? text : '', s: p }));
    }
    itemSets.push({ key, n: L(`ancillary_sets_name_${key}`) ?? L(`ancillary_sets_onscreen_name_${key}`) ?? 'Conjunto', items, e });
  }

  // ---------------- tecnologías ----------------
  const techTbl = by('technologies_tables', 'key');
  const techEff = group('technology_effects_junction_tables', 'technology');
  const techReq = group('technology_required_technology_junctions_tables', 'technology');
  const techLinks = group('technology_node_links_tables', 'child_key');
  const techNodes = group('technology_nodes_tables', 'technology_node_set');
  const cultureScs = new Map<string, Set<string>>();
  for (const c of T['cultures_subcultures_tables']) {
    if (!cultureScs.has(c.culture)) cultureScs.set(c.culture, new Set());
    cultureScs.get(c.culture)!.add(c.subculture);
  }
  const playable = new Set(characters.flatMap((c) => c.subcultures as string[]));
  const techs: Record<string, Row> = {};
  const techDef = (tk: string) => {
    if (techs[tk]) return;
    const t = techTbl.get(tk) ?? {};
    const e: Row[] = [];
    for (const r of techEff.get(tk) ?? []) {
      const text = effectText(r.effect, r.value, r.effect_scope);
      parts(r.effect, r.value, r.effect_scope).forEach((p, j) => e.push({ k: r.effect, d: j === 0 ? text : '', s: p }));
    }
    techs[tk] = strip({
      n: L(`technologies_onscreen_name_${tk}`) ?? tk, d: L(`technologies_short_description_${tk}`) ?? undefined,
      img: t.icon_name ?? undefined, e, req: (techReq.get(tk) ?? []).map((r) => r.required_technology),
    });
    if (!techs[tk].req.length) delete techs[tk].req;
  };
  const techTrees: Row[] = [];
  for (const set of T['technology_node_sets_tables']) {
    const all = (techNodes.get(set.key) ?? []).filter((n) => !n.campaign_key || n.campaign_key === 'wh3_main_combi');
    if (!all.length) continue;
    let scs = [...(cultureScs.get(set.culture) ?? [])];
    if (set.subculture) scs = [set.subculture];
    if (set.faction_key && fac.has(set.faction_key)) scs = [fac.get(set.faction_key)!.subculture];
    scs = scs.filter((x) => playable.has(x));
    if (!scs.length) continue;
    const present = new Set(all.map((n) => n.key));
    const nodesOut = all.map((n) => {
      techDef(n.technology_key);
      const pr = (techLinks.get(n.key) ?? []).map((l) => l.parent_key).filter((k) => present.has(k));
      return strip({
        k: n.key, tech: n.technology_key, t: n.tier, i: n.indent, rp: n.research_points_required,
        pr: pr.length ? pr : null, need: n.required_parents || null, fk: set.faction_key ? null : n.faction_key,
      });
    });
    // Variantes: la genérica y una por cada facción que tiene nodos propios en este árbol
    const fks = [...new Set(nodesOut.map((n) => n.fk).filter(Boolean))] as string[];
    const base = set.faction_key ? `Tecnologías · ${L(`factions_screen_name_${set.faction_key}`) ?? set.faction_key}` : 'Tecnologías';
    techTrees.push({
      key: set.key, name: base, subcultures: scs, nodes: nodesOut,
      variants: fks.map((fk) => ({ fk, name: L(`factions_screen_name_${fk}`) ?? fk, sc: fac.get(fk)?.subculture })),
    });
  }

  // ---------------- grafos de iniciativas (Pirámide Negra) ----------------
  // Cada nodo del grafo es una iniciativa con una lista de efectos; se guarda en techs para que el motor la aplique igual.
  const graphs: Row[] = [];
  const initTbl = by('initiatives_tables', 'key');
  const initOfNode = new Map<string, string>(T['initiative_to_ui_graph_node_junctions_tables'].map((r) => [r.ui_graph_node, r.initiative]));
  const effList = group('campaign_effect_list_effect_junctions_tables', 'effect_list');
  const setOfInit = new Map<string, string>(T['initiative_set_items_tables'].map((r) => [r.item, r.set]));
  const lookupsOfSet = group('faction_initiative_sets_tables', 'initiative_set');
  const graphLinks = group('ui_graph_node_links_tables', 'child_node');
  const thresholds = new Map<string, number>(T['ui_graph_node_unlock_thresholds_tables'].map((r) => [r.ui_graph_node, r.unlock_threshold]));
  const clusterTbl = by('ui_graph_node_clusters_tables', 'key');
  for (const g of T['ui_graphs_tables']) {
    const gnodes = T['ui_graph_nodes_tables'].filter((n) => n.graph === g.key && initOfNode.has(n.key));
    if (!gnodes.length) continue;
    const sets = [...new Set(gnodes.map((n) => setOfInit.get(initOfNode.get(n.key)!)).filter(Boolean))] as string[];
    // Subculturas: la búsqueda de campaña del set menciona el código de la facción (p. ej. "_nag_")
    const lookups = sets.flatMap((st) => (lookupsOfSet.get(st) ?? []).map((r) => String(r.campaign_lookup)));
    const scs = [...playable].filter((sc) => {
      const code = sc.split('_sc_')[1]?.split('_')[0];
      return !!code && lookups.some((l) => l.includes(`_${code}_`));
    });
    if (!scs.length) continue;
    const present = new Set(gnodes.map((n) => n.key));
    const clusters: Record<string, Row> = {};
    const nodesOut = gnodes.map((n) => {
      const ik = initOfNode.get(n.key)!;
      if (!techs[ik]) {
        const it = initTbl.get(ik) ?? {};
        const e: Row[] = [];
        for (const r of effList.get(it.effects ?? ik) ?? []) {
          const text = effectText(r.effect, r.value, r.scope);
          parts(r.effect, r.value, r.scope).forEach((pp, j) => e.push({ k: r.effect, d: j === 0 ? text : '', s: pp }));
        }
        techs[ik] = strip({
          n: L(`initiatives_localised_name_${ik}`) ?? ik, d: L(`initiatives_localised_description_${ik}`) ?? undefined,
          img: it.image_path ? String(it.image_path).split(/[\\/]/).pop()!.replace(/\.png$/i, '') : undefined, e, cost: it.point_cost ?? 1,
        });
      }
      if (n.cluster && !clusters[n.cluster]) {
        const c = clusterTbl.get(n.cluster) ?? {};
        clusters[n.cluster] = strip({
          n: L(`ui_graph_node_clusters_localised_title_${n.cluster}`) ?? n.cluster,
          d: L(`ui_graph_node_clusters_localised_description_${n.cluster}`) ?? undefined, sc: c.supercluster ?? undefined, order: c.sort_order ?? 0,
        });
      }
      const pr = (graphLinks.get(n.key) ?? []).map((l) => l.parent_node).filter((k) => present.has(k));
      return strip({ k: n.key, tech: ik, x: n.x_pos, y: n.y_pos, type: n.type, cl: n.cluster ?? undefined, pr: pr.length ? pr : null, th: thresholds.get(n.key) ?? null });
    });
    graphs.push({
      key: g.key, name: L(`initiative_sets_localised_name_${sets[0]}`) ?? g.key, subcultures: scs, origin: g.origin_node,
      originActive: !!g.origin_active_by_default, nodes: nodesOut, clusters,
    });
  }

  const subs = [...new Set(characters.flatMap((c) => c.subcultures as string[]))].sort()
    .map((k) => ({ key: k, name: L(`cultures_subcultures_name_${k}`) ?? k }));
  return {
    source: 'db.pack + local_sp.pack de tu instalación (Total War: WARHAMMER III)', format: 2,
    subcultures: subs, characters, skills: skillsOut, abilities, unitLists, locks, techTrees, techs, ancillaries, itemSets, graphs,
    // Solo las restricciones que usan las habilidades extraídas
    targetFlags: Object.fromEntries(Object.entries(targetFlags).filter(([k]) => Object.values(abilities).some((a) => a.inv?.includes(k)))),
  };
}
