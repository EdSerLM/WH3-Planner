/**
 * Árboles de habilidades de TODAS las facciones desde db.pack (+ textos de local_sp.pack).
 * Mismo resultado que el prototipo validado contra totalwarhammerplanner.com con los 66 personajes del Caos:
 * nodos, requisitos, rangos, efectos, monturas (stats) y hechizos.
 */
type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

// Guerreros del Caos: sus señores y héroes se consagran a un dios y pasan a la versión marcada (script
// wh3_campaign_character_upgrading.lua, iniciativas "devote_*"/"ascend_*"): esas versiones también son de los Guerreros del Caos
const CHAOS_DEVOTED = /^(wh3_dlc20_chs_exalted_hero_mkho|wh3_dlc20_chs_exalted_hero_mnur|wh3_dlc27_chs_exalted_hero_msla|wh3_dlc24_chs_exalted_hero_mtze|wh3_dlc25_chs_sorcerer_(death|nurgle)_mnur|wh3_dlc20_chs_sorcerer_(shadows|slaanesh)_msla|wh3_dlc20_chs_sorcerer_(metal|tzeentch)_mtze|wh3_dlc20_chs_lord_mkho|wh3_dlc20_chs_lord_msla|wh3_dlc25_chs_lord_mnur|wh3_dlc24_chs_lord_mtze|wh3_dlc20_chs_sorcerer_lord_(death|nurgle)_mnur|wh3_dlc27_chs_sorcerer_lord_(shadows|slaanesh)_msla|wh3_dlc20_chs_sorcerer_lord_(metal|tzeentch)_mtze|wh3_dlc20_chs_daemon_prince_(khorne|nurgle|slaanesh|tzeentch|undivided))$/;

// Héroes legendarios que se desbloquean por misión (script wh3_main_legendary_characters.lua, lista de Imperios Inmortales):
// subtipo -> [culturas permitidas (sus facciones jugables), facciones permitidas], de wh3_main_legendary_characters.lua: todos los
// bloques del mismo subtipo juntos (Caradryan, Emil Valgeir) más su facción inicial (Gotrek y Félix con Malakai) y la que
// lo desbloquea por otra misión (priority_alternate_unlock_faction: Skreech para Thanquol). El script los da aunque la facción no los
// tenga en faction_agent_permitted_subtypes (Aekold y los Escribas Azules para Archaón, Kholek, Vilitch...).
const LEGENDARY_UNLOCKS: Record<string, [string[], string[]]> = {
  "wh2_dlc12_lzd_lord_kroak": [["wh2_main_lzd_lizardmen"], ["wh2_main_lzd_itza"]],
  "wh2_dlc16_skv_ghoritch": [[], ["wh2_main_skv_clan_moulder"]],
  "wh2_dlc16_wef_ariel": [[], ["wh2_dlc16_wef_sisters_of_twilight", "wh_dlc05_wef_argwylon", "wh_dlc05_wef_wood_elves"]],
  "wh2_dlc16_wef_coeddil": [[], ["wh2_dlc16_wef_drycha"]],
  "wh3_dlc23_chd_gorduz_backstabber": [["wh3_dlc23_chd_chaos_dwarfs"], []],
  "wh3_dlc23_neu_ulrika": [["wh3_main_ksl_kislev", "wh_main_emp_empire"], ["wh3_dlc25_dwf_malakai", "wh3_dlc29_vmp_neferata"]],
  "wh3_pro11_chs_cha_harald_hammerstorm": [["wh_main_chs_chaos"], []],
  "wh3_dlc24_tze_blue_scribes": [[], ["wh3_dlc20_chs_kholek", "wh3_dlc20_chs_vilitch", "wh3_dlc24_tze_the_deceivers", "wh3_main_chs_shadow_legion", "wh3_main_dae_daemon_prince", "wh3_main_tze_oracles_of_tzeentch", "wh_main_chs_chaos"]],
  "wh3_dlc24_tze_aekold_helbrass": [[], ["wh3_dlc20_chs_kholek", "wh3_dlc20_chs_vilitch", "wh3_dlc24_tze_the_deceivers", "wh3_main_chs_shadow_legion", "wh3_main_dae_daemon_prince", "wh3_main_tze_oracles_of_tzeentch", "wh_main_chs_chaos"]],
  "wh3_dlc24_cth_saytang_the_watcher": [["wh3_main_cth_cathay"], []],
  "wh3_dlc24_ksl_the_golden_knight": [["wh3_main_ksl_kislev"], []],
  "wh3_pro12_kho_cha_karanak": [[], ["wh3_dlc20_chs_kholek", "wh3_dlc20_chs_valkia", "wh3_dlc26_kho_arbaal", "wh3_dlc26_kho_skulltaker", "wh3_main_chs_shadow_legion", "wh3_main_dae_daemon_prince", "wh3_main_kho_exiles_of_khorne", "wh_main_chs_chaos"]],
  "wh3_dlc25_neu_gotrek_hero": [[], ["wh2_dlc13_emp_golden_order", "wh2_dlc13_emp_the_huntmarshals_expedition", "wh2_dlc14_brt_chevaliers_de_lyonesse", "wh2_dlc17_dwf_thorek_ironbrow", "wh3_cp1_cth_tiger_warriors", "wh3_dlc24_cth_the_celestial_court", "wh3_dlc24_ksl_daughters_of_the_forest", "wh3_dlc25_dwf_malakai", "wh3_main_cth_the_northern_provinces", "wh3_main_cth_the_western_provinces", "wh3_main_dwf_the_ancestral_throng", "wh3_main_emp_cult_of_sigmar", "wh3_main_ksl_the_great_orthodoxy", "wh3_main_ksl_the_ice_court", "wh3_main_ksl_ursun_revivalists", "wh_main_brt_bordeleaux", "wh_main_brt_bretonnia", "wh_main_brt_carcassonne", "wh_main_dwf_dwarfs", "wh_main_dwf_karak_izor", "wh_main_dwf_karak_kadrin", "wh_main_emp_empire", "wh_main_emp_middenland", "wh_main_emp_wissenland"]],
  "wh2_pro08_neu_felix": [[], ["wh2_dlc13_emp_golden_order", "wh2_dlc13_emp_the_huntmarshals_expedition", "wh2_dlc14_brt_chevaliers_de_lyonesse", "wh2_dlc17_dwf_thorek_ironbrow", "wh3_cp1_cth_tiger_warriors", "wh3_dlc24_cth_the_celestial_court", "wh3_dlc24_ksl_daughters_of_the_forest", "wh3_dlc25_dwf_malakai", "wh3_main_cth_the_northern_provinces", "wh3_main_cth_the_western_provinces", "wh3_main_dwf_the_ancestral_throng", "wh3_main_emp_cult_of_sigmar", "wh3_main_ksl_the_great_orthodoxy", "wh3_main_ksl_the_ice_court", "wh3_main_ksl_ursun_revivalists", "wh_main_brt_bordeleaux", "wh_main_brt_bretonnia", "wh_main_brt_carcassonne", "wh_main_dwf_dwarfs", "wh_main_dwf_karak_izor", "wh_main_dwf_karak_kadrin", "wh_main_emp_empire", "wh_main_emp_middenland", "wh_main_emp_wissenland"]],
  "wh3_dlc25_dwf_garagrim_ironfist": [["wh_main_dwf_dwarfs"], []],
  "wh3_dlc25_emp_theodore_bruckner": [["wh_main_emp_empire"], []],
  "wh3_dlc26_grn_snagla_grobpsit": [["wh_main_grn_greenskins"], []],
  "wh3_dlc26_ogr_bragg_the_gutsman": [["wh3_main_ogr_ogre_kingdoms"], []],
  "wh3_dlc26_kho_skarr_bloodwrath": [[], ["wh3_dlc20_chs_valkia", "wh3_dlc26_kho_arbaal", "wh3_dlc26_kho_skulltaker", "wh3_main_dae_daemon_prince", "wh3_main_kho_exiles_of_khorne", "wh_main_chs_chaos"]],
  "wh3_dlc26_kho_scyla_anfingrimm": [[], ["wh3_dlc20_chs_kholek", "wh3_dlc20_chs_valkia", "wh3_dlc26_kho_arbaal", "wh3_dlc26_kho_skulltaker", "wh3_dlc27_nor_sayl", "wh3_main_chs_shadow_legion", "wh3_main_dae_daemon_prince", "wh3_main_kho_exiles_of_khorne", "wh_dlc08_nor_norsca", "wh_dlc08_nor_wintertooth", "wh_main_chs_chaos"]],
  "wh3_dlc27_sla_styrkaar_the_sortsvinaer": [[], ["wh3_dlc20_chs_azazel", "wh3_dlc20_chs_kholek", "wh3_dlc20_chs_sigvald", "wh3_dlc27_nor_sayl", "wh3_dlc27_sla_masque_of_slaanesh", "wh3_dlc27_sla_the_tormentors", "wh3_main_chs_shadow_legion", "wh3_main_sla_seducers_of_slaanesh", "wh_dlc08_nor_norsca", "wh_dlc08_nor_wintertooth", "wh_main_chs_chaos"]],
  "wh3_dlc27_hef_caradryan": [[], ["wh2_dlc15_hef_imrik", "wh2_main_hef_avelorn", "wh2_main_hef_eataine", "wh2_main_hef_nagarythe", "wh2_main_hef_order_of_loremasters", "wh2_main_hef_yvresse", "wh3_dlc27_hef_aislinn"]],
  "wh3_dlc27_nor_beorg_bearstruck": [[], ["wh3_dlc20_chs_azazel", "wh3_dlc20_chs_festus", "wh3_dlc20_chs_kholek", "wh3_dlc20_chs_sigvald", "wh3_dlc20_chs_valkia", "wh3_dlc20_chs_vilitch", "wh3_dlc27_nor_sayl", "wh3_main_chs_shadow_legion", "wh_dlc08_nor_norsca", "wh_dlc08_nor_wintertooth", "wh_main_chs_chaos"]],
  "wh3_cp1_cth_cha_taoyan": [["wh3_main_cth_cathay"], []],
  "wh3_dlc29_emp_cha_emil_valgeir": [[], ["wh2_dlc13_emp_golden_order", "wh2_dlc13_emp_the_huntmarshals_expedition", "wh3_main_emp_cult_of_sigmar", "wh_main_emp_empire", "wh_main_emp_middenland", "wh_main_emp_wissenland"]],
  "wh3_dlc29_chs_gutrot_spume": [["wh3_main_nur_nurgle", "wh_dlc08_nor_norsca"], ["wh3_dlc20_chs_festus", "wh3_dlc20_chs_kholek", "wh3_dlc29_chs_host_of_the_triplets", "wh3_main_chs_shadow_legion", "wh_main_chs_chaos"]],
  "wh3_dlc29_skv_skreech_verminking": [[], ["wh3_dlc29_skv_clan_scruten", "wh2_dlc09_skv_clan_rictus", "wh2_main_skv_clan_eshin", "wh2_main_skv_clan_mors", "wh2_main_skv_clan_moulder", "wh2_main_skv_clan_pestilens", "wh2_main_skv_clan_skryre"]],
  "wh3_dlc29_chs_morbidex": [["wh3_main_nur_nurgle"], ["wh3_dlc20_chs_festus", "wh3_dlc29_chs_host_of_the_triplets", "wh_main_chs_chaos"]],
};
// Héroes que solo da un script a una facción: jefes vasallos de Tamurkhan y los Trillizos (salen con su facción)
const SCRIPT_ONLY: [RegExp, string[]][] = [
  [/^wh3_dlc25_nur_(bray_shaman_wild|castellan|exalted_hero|fimir_balefiend_shadow|skin_wolf_werekin)_chieftain$|^wh3_dlc25_nur_kayzk_the_befouled$/, ['wh3_dlc25_nur_tamurkhan']],
  [/^wh3_dlc29_chs_(bloab|orghotts)$/, ['wh3_dlc29_chs_host_of_the_triplets']],
];

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
  // Efectos de contacto que da un efecto a un conjunto de unidades (Manufactura de la Forja Infernal: armadura destrozada, supresión)
  'effect_bonus_value_unit_set_special_ability_phase_junctions_tables', 'unit_set_special_ability_phase_junctions_tables',
  // A quién NO afecta cada habilidad (p. ej. la pasiva Guardián solo a señores y héroes)
  'special_ability_to_invalid_target_flags_tables', 'special_ability_invalid_usage_flags_tables',
  'main_units_tables', 'land_units_tables', 'melee_weapons_tables', 'battle_entities_tables', 'unit_armour_types_tables',
  'unit_shield_types_tables', 'units_custom_battle_permissions_tables', 'factions_tables', 'frontend_faction_leaders_tables', 'faction_agent_permitted_subtypes_tables', 'unit_attributes_to_groups_junctions_tables',
  'land_units_to_unit_abilites_junctions_tables', 'mounts_tables', 'character_skill_nodes_skill_locks_tables',
  'character_skill_level_to_ancillaries_junctions_tables', 'ancillaries_tables', 'ancillaries_included_agent_subtypes_tables', 'faction_set_items_tables',
  'effect_bonus_value_agent_action_record_junctions_tables',
  'technologies_tables', 'technology_effects_junction_tables', 'technology_node_links_tables', 'technology_node_sets_tables',
  'technology_nodes_tables', 'technology_required_technology_junctions_tables', 'cultures_subcultures_tables', 'start_pos_factions_tables',
  'ancillary_to_effects_tables', 'character_ancillary_quest_ui_details_tables', 'ancillary_set_ancillary_junctions_tables',
  'ancillary_set_effect_junctions_tables',
  // Estandartes que desbloquean algunos personajes (Elspeth, Oxyotl, Throgg, Morghur, Magistrados de Catai): van en una unidad
  'banners_tables', 'banners_permitted_unit_sets_tables',
  // Grafos de iniciativas (p. ej. la Pirámide Negra de las Legiones No Muertas): nodos con efectos, como tecnologías
  'initiatives_tables', 'initiative_set_items_tables', 'initiative_sets_tables', 'faction_initiative_sets_tables',
  'campaign_effect_list_effect_junctions_tables', 'ui_graphs_tables', 'ui_graph_nodes_tables', 'ui_graph_node_links_tables',
  'ui_graph_node_unlock_thresholds_tables', 'ui_graph_node_clusters_tables', 'initiative_to_ui_graph_node_junctions_tables',
  // Hechizos elegibles por espacio (Kairos: Fragmentos de hechicería), como iniciativas de personaje
  'effect_bonus_value_initiative_set_junctions_tables',
  // Iniciativas de personaje (Senda a la Gloria: dones y devociones), ligadas al subtipo por grupos de campaña
  // Nombres de poder (Elfos Oscuros): habilidad -> dilema al azar con 2 nombres -> rasgo con efectos
  'character_skill_level_to_dilemmas_junctions_tables', 'cdir_events_dilemma_payloads_tables', 'trait_level_effects_tables',
  // Corte de Hielo (Kislev): formación de Doncellas y Brujas de Hielo; Votos de Bretonia
  'character_training_dilemma_choice_traits_tables', 'character_training_dilemma_choices_tables', 'character_training_group_dilemma_junctions_tables',
  'character_training_groups_tables', 'character_training_dilemma_choice_agent_types_tables',
  // Icono de cada efecto y si un valor positivo es bueno (para marcar bufos y penalizaciones)
  'effects_tables',
  // Nombres que el juego da a los personajes genéricos (por cultura y género)
  'names_tables',
  'bretonnia_vows_tables', 'bretonnia_vows_to_traits_tables', 'agent_subtype_to_vows_tables', 'character_trait_levels_tables',
  // Gloria demoníaca (Legión del Caos de Daniel): umbrales de gloria por dios -> ofrendas, unidades y dones
  'pooled_resource_threshold_operation_sets_tables', 'campaign_operation_set_effect_bundle_elements_tables', 'effect_bundles_tables', 'campaign_operation_effect_bundles_tables',
  'campaign_operation_set_armory_item_elements_tables', 'campaign_operation_armory_items_tables',
  // Da Plan de Gorbad (tácticas con unidades requeridas) y Danza Eterna de la Máscara (tempos)
  'initiative_unit_set_requirements_tables',
  // Mejoras de unidad compradas en campaña (aspectos de Dríades y Árboles, mejoras de Ogros, genes de Moulder...)
  'unit_purchasable_effects_tables', 'unit_purchasable_effect_sets_tables', 'faction_banned_unit_purchasable_effects_tables',
  // Forja de Daith (Heraldas de Ariel): rituales que forjan y mejoran objetos (nivel 1-4)
  'rituals_tables', 'ritual_payload_ancillaries_tables',
  // Colegios de Magia (Gelt): coste de cada ritual en Ensayos Arcanos
  'resource_cost_pooled_resource_junctions_tables',
  // Norsca: umbrales de altares de cada nivel de Devoción a los Dioses
  'campaign_group_member_criteria_numeric_ranges_tables',
  // Acciones de héroe en su ejército (Instrucción, Formación de asalto...): acción -> resultados con efecto y valor; mejoras por habilidad
  'agent_actions_tables', 'action_results_additional_outcomes_tables', 'effect_bonus_value_id_action_results_additional_outcomes_junctions_tables',
  // Guaridas de Vampiros: edificios secundarios que se eligen al despertar a un vampiro
  'building_levels_tables',
  // Espíritu de Grungni (Malakai): edificios del dirigible (efectos y unidades) y recompensas de las misiones de aventura
  'building_effects_junction_tables', 'building_units_allowed_tables', 'cdir_events_mission_payloads_tables',
  // Visor de hechizos: saberes (grupos de habilidades) y el daño de proyectiles, explosiones, vórtices y bombardeos
  'projectiles_tables', 'projectiles_explosions_tables', 'battle_vortexs_tables', 'projectile_bombardments_tables',
  'special_ability_groups_tables', 'special_ability_groups_to_unit_abilities_junctions_tables',
  'campaign_group_cooking_recipes_tables',
  // Más mecánicas: rituales con paquetes de efectos, Caldero de Grom y plagas de Nurgle
  'ritual_payload_effect_bundles_tables', 'cooking_recipes_tables', 'cooking_ingredients_tables', 'cooking_recipe_required_ingredient_groups_tables',
  'cooking_recipe_required_ingredients_tables', 'plague_components_tables', 'plague_effect_setups_tables', 'plague_effects_tables',
  // Corte del Rey Fénix (Altos Elfos): patronazgo de una provincia de Ulthuan, niveles 1-3
  'patronage_slots_tables',
  // Cargos de la corte (Consejo de los Elfos, Congregación de los Antiguos, Drycha, Hermanas del Crepúsculo)
  'ministerial_positions_culture_details_tables', 'ministerial_positition_to_subtype_restrictions_tables',
  'campaign_group_member_criteria_ministerial_positions_tables', 'campaign_group_member_criteria_factions_tables',
  'ministerial_position_effect_bundles_tables', 'effect_bundles_to_effects_junctions_tables', 'frontend_faction_leaders_tables',
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
  battle_barrier_replenish_rate_mod: ['barrierRate', true], battle_barrier_replenish_delay_mod: ['barrierDelay', true],
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
// force_to_force_own: plagas de Nurgle (el ejército infectado se bonifica a sí mismo)
// faction_to_force_not_garrsion_own (sic): Manufactura de la Forja Infernal (ejércitos en campaña, no guarniciones)
const ARMY_SCOPE = /^(general_to_force_own|character_to_force_own|agent_to_parent_army_own|faction_to_force_own|force_to_force_own|faction_to_force_not_garr\w*_own)/;
const LORD_SCOPE = /^(agent_to_parent_army_general_own|character_to_army_general_own|force_to_general_own)/;
// Tecnologías: "a todos los personajes de la facción" (señores y héroes; a veces solo unos)
const CHARS_SCOPE = /^faction_to_character_own/;
const whoOf = (sc: string) => (/heroes_only|_agents/.test(sc) ? 'hero' : /lords_only|armytext/.test(sc) ? 'lord' : /wizard/.test(sc) ? 'wizard' : null);

export const ABILITY_STAT_ES: Record<string, string> = {
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
      hit_points: ent.hit_points ?? 0, bonus_hit_points: Lu.bonus_hit_points ?? 0, barrier: m.barrier_health || undefined,
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
  const bUsph = group('effect_bonus_value_unit_set_special_ability_phase_junctions_tables', 'effect');
  const usph = by('unit_set_special_ability_phase_junctions_tables', 'key');
  const invalidTargets = group('special_ability_to_invalid_target_flags_tables', 'special_ability');
  // Restricciones de objetivo usadas, con el texto del juego (para interpretarlas en el motor)
  const targetFlags: Record<string, string> = {};
  for (const f of T['special_ability_invalid_usage_flags_tables'])
    targetFlags[f.flag_key] = L(`special_ability_invalid_usage_flags_flag_description_${f.flag_key}`) ?? L(`special_ability_invalid_usage_flags_alt_description_${f.flag_key}`) ?? '';
  // Daño directo de un hechizo o habilidad: proyectil (con su explosión y vórtice), vórtice o bombardeo
  const projT = by('projectiles_tables', 'key'), explT = by('projectiles_explosions_tables', 'key');
  const vortT = by('battle_vortexs_tables', 'vortex_key'), bombT = by('projectile_bombardments_tables', 'bombardment_key');
  const vortexOf = (k: unknown): Row | null => {
    const v = typeof k === 'string' && k ? vortT.get(k) : undefined;
    if (!v) return null;
    return strip({
      kind: 'vortex', dmg: v.damage, ap: v.damage_ap, dur: r2(v.duration), r: r2(v.goal_radius || v.start_radius), r0: v.start_radius !== v.goal_radius ? r2(v.start_radius) : null,
      n: v.num_vortexes > 1 ? v.num_vortexes : null, spd: v.movement_speed ? r2(v.movement_speed) : null, mag: v.is_magical || null, fire: v.ignition_amount > 0 || null,
      allies: v.affects_allies || null, next: vortexOf(v.subsequent_vortex),
    });
  };
  const projOf = (k: unknown): Row | null => {
    const pr = typeof k === 'string' && k ? projT.get(k) : undefined;
    if (!pr) return null;
    const ex = pr.explosion_type ? explT.get(pr.explosion_type) : undefined;
    return strip({
      kind: 'projectile', dmg: pr.damage, ap: pr.ap_damage, n: (pr.projectile_number || 1) * (pr.shots_per_volley || 1) * (pr.burst_size || 1) > 1 ? (pr.projectile_number || 1) * (pr.shots_per_volley || 1) * (pr.burst_size || 1) : null,
      vInf: pr.bonus_v_infantry || null, vLarge: pr.bonus_v_large || null, mag: pr.is_magical || null, fire: pr.ignition_amount > 0 || null,
      ex: ex && (ex.detonation_damage || ex.detonation_damage_ap) ? strip({ dmg: ex.detonation_damage, ap: ex.detonation_damage_ap, r: r2(ex.detonation_radius) }) : null,
      vortex: vortexOf(pr.spawned_vortex),
    });
  };
  const spellDamage = (s: Row): Row | null => {
    const v = vortexOf(s.vortex);
    if (v) return v;
    const b = s.bombardment ? bombT.get(s.bombardment) : undefined;
    if (b) { const pj = projOf(b.projectile_type); return pj ? { ...pj, kind: 'bombardment', n: (b.num_projectiles || 1) * (pj.n ?? 1), spread: r2(b.radius_spread) } : null; }
    return projOf(s.activated_projectile);
  };
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
      // Recupera barrera: barrier_heal_amount es la fracción de la barrera máxima cada hp_change_frequency segundos
      if (p.barrier_heal_amount > 0) {
        const v = r2((p.barrier_heal_amount * 100) / (p.hp_change_frequency || 1));
        stats.push({ stat: 'barrier_heal', how: 'add', v, d: `+${v}% de la barrera por segundo` });
      }
      // Imbuir: los ataques aplican un efecto de contacto a los enemigos que golpean (p. ej. "¡Veneno!" de Bendecido con roña)
      const ic = p.imbue_contact ? ph.get(p.imbue_contact) : undefined;
      const imb = ic ? {
        n: L(`special_ability_phases_onscreen_name_${ic.id}`) ?? String(ic.id).replace(/^wh\d?_(main|dlc\d+)_/, '').replace(/_/g, ' '), dur: ic.duration ?? 0,
        stats: (phSt.get(ic.id) ?? []).map((st) => {
          const nm = ABILITY_STAT_ES[st.stat] ?? st.stat;
          return { stat: st.stat, how: st.how, v: st.value, d: st.how === 'mult' ? `×${r2(st.value)} ${nm}` : `${st.value > 0 ? '+' : ''}${r2(st.value)} ${nm}` };
        }),
      } : null;
      // Daño o curación por tiempo: damage_amount es daño por entidad cada hp_change_frequency s; heal_amount es fracción de la vida
      const freq = p.hp_change_frequency || 1;
      return strip({
        dur: p.duration ?? 0, tf: j.target_friends, te: j.target_enemies, ts: j.target_self, type: p.effect_type,
        dot: p.damage_amount > 0 ? r2(p.damage_amount / freq) : null, dotMax: p.damage_amount > 0 && p.max_damaged_entities > 0 ? p.max_damaged_entities : null,
        heal: p.heal_amount > 0 ? r2((p.heal_amount * 100) / freq) : null, res: p.resurrect ? true : null,
        mag: p.imbue_magical ? true : null, fire: p.imbue_ignition ? true : null, imb, stats,
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
      dmg: spellDamage(s), reach: s.target_intercept_range > 0 ? r2(s.target_intercept_range) : null,
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
      } else if ((r.bonus_value_id === 'unit_flaming_attack_mod' || r.bonus_value_id === 'unit_is_magical') && tgt !== 'none') {
        out.push({ kind: 'attribute', target: tgt, who, attribute: r.bonus_value_id === 'unit_is_magical' ? 'Ataques mágicos' : 'Ataques flamígeros', u: listed ? listId(members(r.unit_set)) : null });
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
      // Cambio a una habilidad concreta (duración, recarga, coste...): se guarda cuál y qué valor, para aplicarlo aunque el texto no la nombre
      else out.push({ kind: 'magic', target: 'self', on: r.unit_ability, bv: r.bonus_value_id, value });
    }
    // Efecto de contacto para un conjunto de unidades: sus golpes aplican una fase al enemigo (p. ej. -30 de armadura 10 s)
    for (const r of bUsph.get(key) ?? []) {
      const j = usph.get(r.unit_set_special_ability_phase_junction);
      const p = j ? ph.get(j.special_ability_phase) : undefined;
      if (!j || !p) continue;
      const stats = (phSt.get(p.id) ?? []).map((st) => {
        const nm = ABILITY_STAT_ES[st.stat] ?? st.stat;
        return { stat: st.stat, how: st.how, v: st.value, d: st.how === 'mult' ? `×${r2(st.value)} ${nm}` : `${st.value > 0 ? '+' : ''}${r2(st.value)} ${nm}` };
      });
      const n = L(`special_ability_phases_onscreen_name_${p.id}`) ?? String(p.id).replace(/^wh\d?_(main|dlc\d+)_unit_contact_/, '').replace(/_/g, ' ');
      out.push({ kind: 'attribute', target: 'army', attribute: `Al golpear: ${n}`, u: listId(members(j.unit_set)), contact: { n, dur: p.duration ?? 0, stats } });
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
      u: a.uniqueness_score || undefined, sub: a.subcategory || undefined,
    });
  };
  // Estandartes (ancillaries con provided_banner): efectos del paquete del estandarte, a la unidad que lo lleva
  const bannerBundle = by('banners_tables', 'banner');
  const bannerSets = group('banners_permitted_unit_sets_tables', 'banner');
  const bannerBundleEff = group('effect_bundles_to_effects_junctions_tables', 'effect_bundle_key');
  const banners: Record<string, Row> = {};
  const isBanner = (k: string) => !!anc.get(k)?.provided_banner && bannerBundle.has(anc.get(k)!.provided_banner);
  const bannerDef = (k: string) => {
    if (banners[k]) return;
    const b = anc.get(k)!.provided_banner as string;
    const recs = [...new Set((bannerSets.get(b) ?? []).flatMap((r) => members(r.unit_set)))].sort();
    banners[k] = strip({
      n: L(`ancillaries_onscreen_name_${k}`) ?? k, d: L(`ancillaries_colour_text_${k}`) ?? undefined,
      e: effRows(bannerBundleEff.get(bannerBundle.get(b)!.effect_bundle) ?? [], 'effect_key'),
      ul: recs.length ? listId(recs) : undefined,
    });
  };
  /** Estandartes que desbloquea un personaje: con sus habilidades (sk) o como objeto propio */
  const bannersFor = (subtype: string, skills: string[]): Row[] => {
    const out = new Map<string, Row>();
    for (const sk of skills) for (const r of skillAnc.get(sk) ?? []) {
      if (!isBanner(r.granted_ancillary) || out.has(r.granted_ancillary)) continue;
      const subs = new Set((ancSubs.get(r.granted_ancillary) ?? []).map((x) => x.agent_subtype));
      if (subs.size && !subs.has(subtype)) continue;
      out.set(r.granted_ancillary, { k: r.granted_ancillary, sk });
    }
    for (const r of [...(questBySub.get(subtype) ?? []), ...(ancBySub.get(subtype) ?? [])]) {
      if (isBanner(r.ancillary) && !out.has(r.ancillary)) out.set(r.ancillary, { k: r.ancillary });
    }
    return [...out.values()];
  };
  const itemsFor = (subtype: string): Row[] => {
    const out = new Map<string, Row>();
    for (const q of questBySub.get(subtype) ?? []) {
      if (!anc.has(q.ancillary) || isBanner(q.ancillary)) continue;
      ancDef(q.ancillary);
      out.set(q.ancillary, strip({ k: q.ancillary, rank: q.rank || null, quest: q.is_quest_battle || null }));
    }
    for (const r of ancBySub.get(subtype) ?? []) {
      const a = anc.get(r.ancillary);
      if (!a || a.category === 'mount' || out.has(r.ancillary) || isBanner(r.ancillary)) continue;
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
  const effMeta = by('effects_tables', 'effect');
  /** Bufo o penalización como lo pinta el juego: verde si el valor es "bueno" según la tabla de efectos */
  const effTone = (key: string, value: number, scope: string): { b?: 1; ic?: string } => {
    const m = effMeta.get(key);
    if (!m) return {};
    const good = m.is_positive_value_good !== false;
    // Igual que el juego: el color sale solo de is_positive_value_good (los efectos sobre enemigos ya vienen definidos así)
    const bad = value === 0 ? false : (value > 0) !== good;
    void scope;
    const ic = String((bad && m.icon_negative) || m.icon || '').replace(/\.png$/i, '').toLowerCase();
    return { ...(bad ? { b: 1 as const } : {}), ...(ic && ic !== 'placeholder' ? { ic } : {}) };
  };
  const effRows = (list: Row[], kKey = 'effect') => {
    const e: Row[] = [];
    for (const r of list) {
      // armory_*_to_effects usan effect_scope; campaign_effect_list_effect_junctions usa scope
      const sc = r.effect_scope ?? r.scope ?? '';
      const text = effectText(r[kKey], r.value, sc);
      const tone = effTone(r[kKey], Number(r.value ?? 0), sc);
      parts(r[kKey], r.value, sc).forEach((p, j) => e.push(j === 0 ? { k: r[kKey], d: text, ...tone, s: p } : { k: r[kKey], d: '', s: p }));
      if (!parts(r[kKey], r.value, sc).length && text) e.push({ k: r[kKey], d: text, ...tone, s: { kind: 'other', target: 'none' } });
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
  // ---------------- Nombres de poder (Elfos Oscuros) ----------------
  // Cada habilidad "Nombre de poder marcial/venerado/aristocrático" lanza un dilema al azar entre varios; cada dilema ofrece
  // 2 nombres (rasgos). En la app: un espacio por habilidad con todos los nombres que puede dar.
  const dilOfSkill = group('character_skill_level_to_dilemmas_junctions_tables', 'character_skill_key');
  const dilPayloads = group('cdir_events_dilemma_payloads_tables', 'dilemma_key');
  const traitEff = group('trait_level_effects_tables', 'trait_level');
  const namesFor = (sk: string): Row | null => {
    const dils = dilOfSkill.get(sk) ?? [];
    if (!dils.length) return null;
    const opts: Row[] = [];
    for (const dj of dils) {
      const title = L(`dilemmas_localised_title_${dj.dilemma_key}`) ?? dj.dilemma_key;
      for (const pl of dilPayloads.get(dj.dilemma_key) ?? []) {
        const tl = pl.payload_key === 'GIVE_TRAIT' ? /TRAIT_LEVEL_KEY\[([^\]]+)\]/.exec(pl.value ?? '')?.[1] : undefined;
        if (!tl || opts.some((o) => o.k === tl)) continue;
        opts.push(strip({ k: tl, lore: title, lk: dj.dilemma_key, n: L(`character_trait_levels_onscreen_name_${tl}`) ?? tl, e: effRows(traitEff.get(tl) ?? [], 'effect') }));
      }
    }
    if (!opts.length) return null;
    const ef = skillsOut[sk]?.lv?.[0]?.e?.[0]?.k ?? sk;
    return { k: `names:${sk}`, n: skillsOut[sk]?.n ?? sk, r: 'name', o: 100 + Number(/(\d+)$/.exec(sk)?.[1] ?? 0), by: sk, ef, opts };
  };

  const spellSlotsFor = (nodeSkills: string[]): Row[] | null => {
    const out: Row[] = [];
    for (const sk of nodeSkills) {
      const nm = namesFor(sk);
      if (nm && !out.some((x) => x.k === nm.k)) out.push(nm);
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

  // Ascenso a Príncipe Demonio (Senda a la Gloria): el Señor del Caos o Gran Hechicero marcado se vuelve el Príncipe Demonio de su dios.
  // El príncipe sale en las facciones que reclutan a esos señores (también las de demonios de un solo dios)
  const ascendFrom = new Map<string, Set<string>>();
  for (const b of T['background_character_initiative_sets_tables']) {
    const subs = (groupMembers.get(b.campaign_group) ?? []).flatMap((m) => (memberSubs.get(m.id) ?? []).map((x) => x.agent_subtype as string));
    for (const it of iniSetItems.get(b.initiative_set) ?? []) {
      const g = /ascend_lord_to_daemon_prince_(khorne|nurgle|slaanesh|tzeentch)$/.exec(it.item)?.[1];
      if (!g) continue;
      const to = `wh3_dlc20_chs_daemon_prince_${g}`;
      for (const sub of subs) (ascendFrom.get(to) ?? ascendFrom.set(to, new Set()).get(to)!).add(sub);
    }
  }

  // Facciones que lleva cada señor legendario en la pantalla de campaña: si su unidad no sale en batalla personalizada
  // (p. ej. Malus Darkblade) es la única forma de saber su facción
  const leaderSc = new Map<string, string[]>();
  for (const r of T['frontend_faction_leaders_tables']) {
    if (!r.agent_subtype_record || !fac.has(r.faction)) continue;
    const sc = fac.get(r.faction)!.subculture as string;
    leaderSc.set(r.agent_subtype_record, [...new Set([...(leaderSc.get(r.agent_subtype_record) ?? []), sc])].sort());
  }

  // Facciones jugables de Imperios Inmortales: los permisos de facciones de IA (incursiones, retadores) no cuentan
  const scCulture = new Map<string, string>(T['cultures_subcultures_tables'].map((c) => [c.subculture as string, c.culture as string]));
  const ieFac = new Set<string>(T['start_pos_factions_tables'].filter((r) => r.campaign === 'wh3_main_combi' && r.playable).map((r) => r.faction as string));
  // Lo que cada facción puede reclutar en campaña (el planner es de campaña, no de batalla personalizada)
  const campSc = new Map<string, string[]>();
  // Solo con facciones jugables (para héroes: Kihar no es de los Guerreros del Caos aunque se lo permitan a sus retadores de IA)
  const campScIE = new Map<string, string[]>();
  const questOnly = new Set<string>(), realPerm = new Set<string>();
  const campFacIE = new Map<string, Set<string>>();
  for (const r of T['faction_agent_permitted_subtypes_tables']) {
    if (r.mod_disabled || !r.subtype || !fac.has(r.faction)) continue;
    // Facciones de batalla de misión (Gotrek como señor solo existe en las batallas de misión del Imperio)
    if (fac.get(r.faction)!.is_quest_faction) { questOnly.add(r.subtype); continue; }
    realPerm.add(r.subtype);
    const sc = fac.get(r.faction)!.subculture as string;
    campSc.set(r.subtype, [...new Set([...(campSc.get(r.subtype) ?? []), sc])].sort());
    if (!ieFac.size || ieFac.has(r.faction)) campScIE.set(r.subtype, [...new Set([...(campScIE.get(r.subtype) ?? []), sc])].sort());
    if (ieFac.has(r.faction)) (campFacIE.get(r.subtype) ?? campFacIE.set(r.subtype, new Set()).get(r.subtype)!).add(r.faction);
  }
  // Facciones jugables de cada subcultura: un personaje que solo permiten algunas (p. ej. los malévolos de Drycha) es de ellas
  const ieBySc = new Map<string, Set<string>>();
  for (const f of ieFac) { const sc = fac.get(f)?.subculture as string | undefined; if (sc) (ieBySc.get(sc) ?? ieBySc.set(sc, new Set()).get(sc)!).add(f); }

  // ---------------- Cargos de la corte (ministerial positions) ----------------
  // Consejo de los Elfos (Talsyn/Orión), Congregación de los Antiguos (Argwylon/Durthu), Hablantes de Drycha y la corte de las
  // Hermanas del Crepúsculo: cada cargo da un paquete de efectos al personaje que lo ocupa (y a su ejército).
  const courtPos = group('ministerial_positions_culture_details_tables', 'faction_key');
  const courtForbidden = group('ministerial_positition_to_subtype_restrictions_tables', 'ministerial_position');
  const courtMembers = group('campaign_group_member_criteria_ministerial_positions_tables', 'ministerial_position');
  const memberFactions = group('campaign_group_member_criteria_factions_tables', 'member');
  const groupsOfMember = group('campaign_group_members_tables', 'id');
  const courtBundles = group('ministerial_position_effect_bundles_tables', 'campaign_group');
  const bundleEff = group('effect_bundles_to_effects_junctions_tables', 'effect_bundle_key');
  const leaderSub = new Map<string, string>(T['frontend_faction_leaders_tables'].map((r) => [r.faction as string, r.agent_subtype_record as string]));
  const COURT_ES: Record<string, string> = {
    wh_dlc05_wef_wood_elves: 'Consejo de los Elfos', wh_dlc05_wef_argwylon: 'Congregación de los Antiguos',
    wh2_dlc16_wef_drycha: 'Hablantes de Drycha', wh2_dlc16_wef_sisters_of_twilight: 'Corte de las Hermanas del Crepúsculo',
  };
  // Nombres de los cargos que el juego no trae en sus textos (Drycha y las Hermanas)
  const COURT_POS_ES: Record<string, string> = {
    drycha_speaker_lost: 'Hablante de los Perdidos', drycha_speaker_forgotten: 'Hablante de los Olvidados',
    drycha_speaker_embittered: 'Hablante de los Resentidos', drycha_speaker_wild: 'Hablante de lo Salvaje',
    sisters_consort_to_the_queen: 'Consorte de la Reina', sisters_darkweaver: 'Tejedor Oscuro', sisters_highweaver: 'Alto Tejedor',
    sisters_isha: 'Sacerdote de Isha', sisters_kurnous: 'Sacerdote de Kurnous', sisters_loec: 'Sacerdote de Loec',
  };
  const locAny = (k?: string | null) => (k && k !== 'placeholder'
    ? L(`campaign_localised_strings_string_${k}`) ?? L(`ui_text_replacements_localised_text_${k}`) ?? L(`random_localisation_strings_string_${k}`) ?? null
    : null);
  const courts: { fac: string; sc: string; set: Row; leaderItem: Row | null; forbidden: Map<string, Set<string>> }[] = [];
  for (const [fk, rows] of courtPos) {
    const offices = rows.filter((r) => r.ministerial_position_key !== 'faction_leader');
    if (offices.length < 2 || !fac.has(fk)) continue;
    const bundlesOf = (pos: string) => (courtMembers.get(pos) ?? [])
      .filter((m) => pos !== 'faction_leader' || (memberFactions.get(m.member) ?? []).some((f) => f.faction === fk))
      .flatMap((m) => (groupsOfMember.get(m.member) ?? []).flatMap((g) => (courtBundles.get(g.group) ?? []).map((b) => b.effect_bundle as string)));
    const item = (r: Row) => {
      const bs = [...new Set(bundlesOf(r.ministerial_position_key))];
      if (!bs.length) return null;
      const e = bs.flatMap((b) => effRows(bundleEff.get(b) ?? [], 'effect_key'));
      // Muchos cargos no tienen nombre en el texto del juego: nombre propio + el título que da el cargo
      const title = e.map((x) => /t[ií]tulo:\s*"([^"]+)"/i.exec(x.d ?? '')?.[1]).find(Boolean);
      const pos = String(r.ministerial_position_key);
      let n = locAny(r.localised_string_key) ?? COURT_POS_ES[pos.replace(/^wh\d?_(main|dlc\d+)_minister_wef_/, '')] ?? L(`effect_bundles_localised_title_${bs[0]}`)
        ?? (pos === 'faction_leader' ? 'Líder de la facción' : pos);
      if (title && !n.includes(title)) n = `${n} («${title}»)`;
      const req = locAny(r.localised_description_key) ?? L(`effect_bundles_localised_description_${bs[0]}`) ?? undefined;
      return strip({ k: `court:${fk}:${r.ministerial_position_key}`, n, req: req && !/^\[HIDDEN\]$/.test(req) ? req : undefined, e });
    };
    const items = offices.sort((a, b) => (a.y_coordinate - b.y_coordinate) || (a.x_coordinate - b.x_coordinate)).map(item).filter(Boolean) as Row[];
    if (!items.length) continue;
    const leaderRow = rows.find((r) => r.ministerial_position_key === 'faction_leader');
    const leaderItem = leaderRow ? item(leaderRow) : null;
    if (leaderItem && !/^Líder de la facción/.test(leaderItem.n)) leaderItem.n = `Líder de la facción: ${leaderItem.n}`;
    const forbidden = new Map(offices.map((r) => [`court:${fk}:${r.ministerial_position_key}`, new Set((courtForbidden.get(r.ministerial_position_key) ?? []).map((x) => x.agent_subtype as string))]));
    courts.push({
      fac: fk, sc: fac.get(fk)!.subculture, leaderItem, forbidden,
      set: { k: `court:${fk}`, cat: 'COURT', fac: fk, n: `${COURT_ES[fk] ?? 'Cargos de la corte'} (${L(`factions_screen_name_${fk}`) ?? fk})`, max: 1, items },
    });
  }
  // ---------------- Corte del Rey Fénix (Altos Elfos, Mareas del Tormento) ----------------
  // Un señor toma el patronazgo de una provincia de Ulthuan; según su nivel (1-3) recibe el paquete de efectos de esa provincia
  const patronage: Row[] = [];
  for (const r of [...T['patronage_slots_tables']].sort((a, b) => String(a.slot).localeCompare(String(b.slot)) || a.rank - b.rank)) {
    const prov = L(`provinces_onscreen_${r.slot}`) ?? String(r.slot).replace(/^wh3_main_combi_province_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const title = L(`effect_bundles_localised_title_${r.occupying_lord_effect_bundle}`) ?? r.occupying_lord_effect_bundle;
    patronage.push(strip({
      k: `patron:${r.slot}:${r.rank}`, n: `${prov} · nivel ${r.rank}: ${title}`, req: L(`effect_bundles_localised_description_${r.occupying_lord_effect_bundle}`) ?? undefined,
      e: effRows(bundleEff.get(r.occupying_lord_effect_bundle) ?? [], 'effect_key'),
    }));
  }
  const patronageFor = (type: string, scs: string[]): Row[] =>
    patronage.length && type === 'general' && scs.includes('wh2_main_sc_hef_high_elves')
      ? [{ k: 'patronage:hef', cat: 'PATRONAGE', n: 'Corte del Rey Fénix: patronazgo de provincia', max: 1, items: patronage }] : [];

  // ---------------- Gloria demoníaca (Demonios del Caos, Daniel) ----------------
  // Cada dios tiene su gloria (0-4400). Al cruzar umbrales: ofrendas (efectos para todos los ejércitos de la facción),
  // desbloqueo de unidades y de dones (piezas) del Príncipe Demonio. Una opción por nivel de ofrenda, acumulativa.
  const opEb = group('campaign_operation_set_effect_bundle_elements_tables', 'operation_set');
  const opEbRow = by('campaign_operation_effect_bundles_tables', 'key');
  const opAr = group('campaign_operation_set_armory_item_elements_tables', 'operation_set');
  const opArRow = by('campaign_operation_armory_items_tables', 'key');
  // Icono de cada paquete de efectos (ui/campaign ui/effect_bundles/<icono>)
  const ebIcon = new Map<string, string>(T['effect_bundles_tables'].filter((r) => r.ui_icon).map((r) => [r.key as string, String(r.ui_icon).replace(/\.png$/i, '').toLowerCase()]));
  const GOD_ES: Record<string, string> = { khorne: 'Khorne', nurgle: 'Nurgle', slaanesh: 'Slaanesh', tzeentch: 'Tzeentch', undivided: 'Caos Absoluto' };
  const glorySets: Row[] = [];
  for (const god of Object.keys(GOD_ES)) {
    const res = `wh3_main_dae_${god}_points`;
    const th = T['pooled_resource_threshold_operation_sets_tables'].filter((r) => r.pooled_resource_set === res).sort((a, b) => a.lower_bound - b.lower_bound);
    if (!th.length) continue;
    const maxUpper = Math.min(...th.map((r) => r.upper_bound));
    const items: Row[] = [];
    // Línea de tiempo como en la pantalla del juego: ofrendas, unidades y dones en su umbral de gloria
    const track: Row[] = [];
    let accBundles: string[] = [];
    let units: string[] = [], gifts = 0;
    for (const t of th.filter((r) => r.upper_bound === maxUpper)) {
      const ebs = (opEb.get(t.operation_set_group) ?? []).map((e) => opEbRow.get(e.operation_effect_bundle)).filter((e) => e && !e.is_removal).map((e) => e!.effect_bundle as string);
      const giftKeys = (opAr.get(t.operation_set_group) ?? []).map((e) => opArRow.get(e.operation_armory_item)).filter((a) => a && !a.is_removal).map((a) => a!.armory_item as string);
      gifts += giftKeys.length;
      for (const g of giftKeys) track.push({ at: t.lower_bound, kind: 'gift', key: g });
      for (const b of ebs) {
        const lock = /^wh3_\w+_bundle_lock_recruitment_(.+)$/.exec(b);
        if (lock) {
          const un = L(`land_units_onscreen_name_${lock[1]}`) ?? lock[1];
          units.push(un);
          track.push({ at: t.lower_bound, kind: 'unit', key: lock[1], n: un });
          continue;
        }
        accBundles = [...accBundles, b];
        const title = L(`effect_bundles_localised_title_${b}`) ?? b;
        track.push(strip({ at: t.lower_bound, kind: 'offering', key: `glory:${god}:${t.lower_bound}`, n: title, icon: ebIcon.get(b)?.split('/').pop() ?? null }));
        items.push(strip({
          k: `glory:${god}:${t.lower_bound}`, n: `${t.lower_bound} de gloria: ${title}`,
          req: [units.length ? `Unidades que desbloquea hasta este nivel: ${units.join(', ')}` : '', gifts ? `${gifts} dones (piezas) de ${GOD_ES[god]} desbloqueados` : ''].filter(Boolean).join(' · ') || undefined,
          e: accBundles.flatMap((x) => effRows(bundleEff.get(x) ?? [], 'effect_key')),
        }));
        units = []; gifts = 0;
      }
    }
    if (items.length) glorySets.push({
      k: `glory:${god}`, cat: 'GLORY', fac: 'wh3_main_dae_daemon_prince', n: `Gloria de ${GOD_ES[god]}`, max: 1, items,
      god, top: Math.max(...th.filter((r) => r.upper_bound === maxUpper).map((r) => r.lower_bound)), track,
    });
  }
  const gloryFor = (scs: string[]): Row[] => (scs.includes('wh3_main_sc_dae_daemons') ? glorySets : []);

  // ---------------- Da Plan (Gorbad) y Danza Eterna (Máscara de Slaanesh) ----------------
  const iniReq = group('initiative_unit_set_requirements_tables', 'initiative');
  // Nombres de los conjuntos de unidades de Da Plan (el juego no los traduce: solo muestra el icono)
  const USET_ES: Record<string, string> = {"grn_wolf_riders": "Jinetez de Lobo", "wh2_dlc11_grn_all_orc_infantry": "Infantería orca", "grn_archers": "Arqueros", "grn_infantry_goblin": "Infantería goblin", "grn_trolls_all": "Trolls", "grn_arachnarok": "Aracnarok", "grn_spider_riders": "Jinetez de Araña", "grn_characters": "Personajes", "grn_gorbad_ironclaw": "Gorbad Garra'ierro", "grn_waaagh_wyvern": "Serpiente Alada", "grn_black_orcs": "Orcos Negros", "mp_cap_unit_grn_inf_orc_boyz": "Guerreroz Orkoz", "grn_cav_orc": "Caballería orca", "grn_fanatics": "Fanáticos", "wh2_dlc15_grn_veh_snotling_pump_wagon_all": "Vagonetas Snotling", "grn_large_monsters": "Monstruos grandes", "grn_giants": "Gigantes", "mp_cap_unit_grn_mon_squig_herd": "Rebaño de Garrapatos", "mp_cap_unit_grn_art_doom_diver_catapult": "Katapultas de Goblins Voladorez", "mp_cap_unit_grn_cav_goblin_wolf_rider_archers": "Arqueros Jinetez de Lobo", "grn_river_trolls_and_hag": "Trolls de Río y Bruja", "grn_dlc06_night_goblins": "Goblins Nocturnos", "grn_dlc06_grn_inf_nasty_skukers": "Merodeadores odiosos", "grn_dlc06_squigs": "Garrapatos", "grn_cha_black_orc_big_boss": "Gran Jefe Orco Negro", "grn_poison": "Unidades venenosas", "grn_artillery": "Artillería", "wh2_dlc15_grn_mon_rogue_idol": "Ídolo Errático", "wh2_dlc11_grn_all_ranged_cavalry_chariots": "Caballería y carros a distancia", "grn_shaman": "Chamanes", "grn_cha_night_goblin_shaman": "Chamán Goblin Nocturno", "grn_night_goblin_archers": "Arqueros Goblins Nocturnos", "grn_mon_colossal_squig": "Garrapato Colosal", "grn_spear_infantry": "Infantería con lanzas", "mp_cap_unit_grn_inf_orc_arrer_boyz": "Arkeroz Orkoz", "grn_dlc06_savage_orc_infantry": "Orkoz Zalvajez"};

  const unitSetName = (k: string) => L(`unit_sets_localised_name_${k}`) ?? L(`unit_sets_onscreen_name_${k}`) ?? k.replace(/^(wh\d?_(main|dlc\d+)_)?(grn_)?/, '').replace(/_/g, ' ');
  const iniItemsOf = (set: string) => (iniSetItems.get(set) ?? []).map((it) => {
    const ini = iniBy.get(it.item);
    if (!ini) return null;
    const req = (iniReq.get(it.item) ?? []).map((r) => `${r.required_number} × ${USET_ES[r.unit_set] ?? unitSetName(r.unit_set)}`);
    return strip({
      k: it.item, n: L(`initiatives_localised_name_${it.item}`) ?? it.item.replace(/^.*_(da_plan|tempo_\d)_/, '').replace(/_/g, ' '),
      req: [req.length ? `Requiere en el ejército: ${req.join(', ')}` : '', L(`initiatives_localised_description_${it.item}`) ?? ''].filter(Boolean).join(' · ') || undefined,
      e: effRows(iniEff.get(ini.effects) ?? [], 'effect'),
    });
  }).filter(Boolean) as Row[];
  const iconBase = (p: unknown) => (typeof p === 'string' && p ? p.replace(/\\/g, '/').split('/').pop()!.replace(/\.png$/i, '').toLowerCase() : undefined);
  const daPlan: Row[] = (() => {
    const items = iniItemsOf('wh3_dlc26_force_initiative_grn_da_plan');
    if (!items.length) return [];
    // Cada táctica pide unidades de ciertos conjuntos: se guardan los conjuntos (nombre, icono y unidades) una vez
    const usets: Record<string, Row> = {};
    for (const it of items) {
      const ini = iniBy.get(it.k)!;
      const reqs = iniReq.get(it.k) ?? [];
      it.need = reqs.map((r) => ({ s: r.unit_set, n: r.required_number }));
      for (const r of reqs) usets[r.unit_set] ??= strip({ n: USET_ES[r.unit_set] ?? unitSetName(r.unit_set), icon: iconBase(r.icon_path), units: members(r.unit_set) });
      it.img = iconBase(ini.image_path);
      it.tier = Number(/_(\d)$/.exec(it.k)?.[1] ?? 0) || undefined;
      it.dur = ini.duration || undefined;
      it.cd = ini.cooldown || undefined;
    }
    return [{ k: 'daplan:grn', cat: 'DA_PLAN', fac: 'wh3_dlc26_grn_gorbad_ironclaw', n: 'Da Plan: tácticas del ejército', max: 0, items, usets }];
  })();
  const DANCE_ES: Record<string, string> = { elves: 'Danza de la Envidia', final_battle: 'Danza del Orgullo', khorne: 'Danza del Exceso', nurgle: 'Danza de la Avaricia' };
  const dances: Row[] = [];
  for (const [dk, dn] of Object.entries(DANCE_ES)) for (const tempo of [1, 2, 3]) {
    const set = `wh3_dlc27_eternal_dance_of_${dk}_tempo_${tempo}`;
    const items = iniItemsOf(set);
    // Solo la Máscara de Slaanesh (La Tropa Maldita) tiene la Danza Eterna
    if (items.length) dances.push({ k: `dance:${set}`, cat: 'DANCE', fac: 'wh3_dlc27_sla_masque_of_slaanesh', n: `${dn} · Tempo ${tempo}`, max: 1, items });
  }
  const forceInitFor = (type: string, scs: string[]): Row[] => type !== 'general' ? [] : [
    ...(scs.includes('wh_main_sc_grn_greenskins') ? daPlan : []),
    ...(scs.includes('wh3_main_sc_sla_slaanesh') ? dances : []),
  ];

  // ---------------- Forja de Daith (Heraldas de Ariel, Hermanas del Crepúsculo) ----------------
  // Cada ritual DAITH_* forja un objeto (nivel 1) o lo mejora (2-4). Un conjunto por ranura; se elige objeto y nivel.
  const ritualAnc = group('ritual_payload_ancillaries_tables', 'payload');
  const ancRows = by('ancillaries_tables', 'key');
  const forgeAncEff = group('ancillary_to_effects_tables', 'ancillary');
  const FORGE_FAM: Record<string, string> = { dragon: 'del Dragón', dreaming: 'del Ensueño', eagle: 'del Águila', twilight: 'del Crepúsculo' };
  const FORGE_OBJ: Record<string, string> = {
    cuirass: 'Coraza', mask: 'Máscara', pendant: 'Colgante', spear: 'Lanza', boots: 'Botas', bow: 'Arco', cloak: 'Capa', ring: 'Anillo',
    quiver: 'Carcaj', vambraces: 'Brazales', helm: 'Yelmo', horn: 'Cuerno', standard: 'Estandarte',
  };
  const FORGE_SLOT: Record<string, string> = { weapon: 'Arma', armour: 'Armadura', talisman: 'Talismán', enchanted_item: 'Objeto encantado', arcane_item: 'Objeto arcano' };
  const ROMAN4 = ['I', 'II', 'III', 'IV'];
  const forgeBySlot = new Map<string, Row[]>();
  for (const r of T['rituals_tables'].filter((x) => /^DAITH_/.test(x.category ?? '')).sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
    const m = /_forge_([a-z]+)_([a-z]+)_level_(\d)$/.exec(r.key);
    if (!m) continue;
    for (const pa of ritualAnc.get(r.completion_payload) ?? []) {
      const anc = ancRows.get(pa.ancillary);
      if (!anc) continue;
      const lvl = Number(m[3]);
      const base = L(`ancillaries_onscreen_name_${anc.key}`) ?? `${FORGE_OBJ[m[2]] ?? m[2]} ${FORGE_FAM[m[1]] ?? m[1]}`;
      const slot = anc.category as string;
      forgeBySlot.set(slot, [...(forgeBySlot.get(slot) ?? []), strip({
        k: anc.key, n: `${base}${/\b(I|II|III|IV)$/.test(base) ? '' : ` ${ROMAN4[lvl - 1] ?? lvl}`}`,
        req: `Forja de Daith · nivel ${lvl}${lvl === 4 ? ' (reforjado)' : ''}`,
        e: effRows(forgeAncEff.get(anc.key) ?? [], 'effect'),
      })]);
    }
  }
  const forgeSets: Row[] = [...forgeBySlot].map(([slot, items]) => ({
    k: `forge:${slot}`, cat: 'FORGE', fac: 'wh2_dlc16_wef_sisters_of_twilight', n: `Forja de Daith · ${FORGE_SLOT[slot] ?? slot}`, max: 1, items,
  }));
  const forgeFor = (scs: string[]): Row[] => (scs.includes('wh_dlc05_sc_wef_wood_elves') ? forgeSets : []);

  // ---------------- Más mecánicas de campaña (rituales, Caldero de Grom, plagas de Nurgle) ----------------
  // Cada pieza: k, n (nombre), g/l (fila y etiqueta corta si va en filas por nivel), tier (sección), req, img (icono), e (efectos)
  const payBundles = group('ritual_payload_effect_bundles_tables', 'payload');
  const ritualEff = (r: Row) => {
    const bs = [r.completion_payload, r.start_payload, r.self_payload].filter(Boolean)
      .flatMap((p) => (payBundles.get(p) ?? []).map((b) => b.effect_bundle as string));
    if (r.effects_while_performing) bs.push(r.effects_while_performing);
    return [...new Set(bs)].flatMap((b) => effRows(bundleEff.get(b) ?? [], 'effect_key'));
  };
  const ritualDur = (r: Row) => Math.max(0, ...[r.completion_payload, r.start_payload].flatMap((p) => (payBundles.get(p) ?? []).map((b) => b.duration ?? 0)));
  const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];
  const ritualsOf = (cats: string[]) => T['rituals_tables'].filter((r) => cats.includes(r.category)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.key).localeCompare(String(b.key)));
  const ritualItem = (r: Row, extra: Row = {}) => strip({
    k: r.key, n: L(`rituals_display_name_${r.key}`) ?? extra.n ?? pretty(String(r.key).replace(/^wh\d?_(main|dlc\d+)_(ritual_)?/, '')),
    req: L(`rituals_description_${r.key}`) ?? undefined, img: iconBase(r.icon), e: ritualEff(r), dur: ritualDur(r) || undefined, ...extra,
  });
  const mech: { sets: Row[]; who: (sub: string, type: string, scs: string[]) => boolean }[] = [];
  const isLord = (t: string) => t === 'general';

  // Capa de Cráneos y Trono de Cráneos (Despojacráneos, Khorne)
  {
    const cloak = ritualsOf(['CLOAK_OF_SKULLS']).map((r) => {
      const m = /_(\d+)_(\d)$/.exec(r.key)!;
      return ritualItem(r, { g: L(`ritual_chains_display_name_wh3_dlc26_kho_cloak_of_skulls_${m[1]}`) ?? `Cráneo ${m[1]}`, l: ROMAN[Number(m[2])], gi: Number(m[1]) });
    }).sort((a, b) => a.gi - b.gi || String(a.k).localeCompare(String(b.k)));
    for (const it of cloak) delete it.gi;
    const throne = ritualsOf(['SKULLS_RITUAL']).map((r) => ritualItem(r, { tier: Number(/_(\d)_\d$/.exec(r.key)?.[1] ?? 0) || undefined }));
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh3_main_sc_kho_khorne'),
      sets: [
        { k: 'mech:cloak_of_skulls', cat: 'CLOAK', fac: 'wh3_dlc26_kho_skulltaker', n: 'Capa de Cráneos', max: 0, rows: true, items: cloak },
        { k: 'mech:skull_throne', cat: 'CLOAK', fac: 'wh3_dlc26_kho_skulltaker', n: 'Trono de Cráneos (rituales)', max: 0, items: throne },
      ],
    });
  }
  // Escuela de Artillería y Armería de Amatista (Elspeth, Wissenland y Nuln)
  {
    const school = ritualsOf(['DON_GUNNERY_SCHOOL']).map((r) => {
      const m = /don_(.+)_(\d)$/.exec(r.key)!;
      return ritualItem(r, { g: m[1], l: ROMAN[Number(m[2])] });
    });
    // El icono va solo en el nivel 1: se copia a los demás de la fila
    const iconOfG = new Map(school.filter((i) => i.img).map((i) => [i.g, i.img]));
    for (const i of school) i.img ??= iconOfG.get(i.g);
    const armory = ritualsOf(['DON_AMETHYST_ARMORY_UNITS', 'DON_AMETHYST_ARMORY_ARTILLERY']).map((r) => ritualItem(r));
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh_main_sc_emp_empire'),
      sets: [
        { k: 'mech:gunnery_school', cat: 'GUNNERY', fac: 'wh_main_emp_wissenland', n: 'Escuela de Artillería de Nuln', max: 0, rows: true, items: school },
        { k: 'mech:amethyst_armory', cat: 'GUNNERY', fac: 'wh_main_emp_wissenland', n: 'Armería de Amatista', max: 0, items: armory },
      ],
    });
  }
  // Colegio de Magia (Balthasar Gelt, Orden Dorada): rituales por cada uno de los 8 colegios, pagados con Ensayos
  // Arcanos; el ritual del hechicero desbloquea los demás de su colegio (wh3_dlc25_college_of_magic.lua)
  {
    const COLS: [string, string][] = [
      ['COM_METAL', 'Metal (Dorado)'], ['COM_FIRE', 'Fuego (Brillante)'], ['COM_HEAVENS', 'Cielos (Celestial)'], ['COM_LIFE', 'Vida (Jade)'],
      ['COM_LIGHT', 'Luz'], ['COM_BEAST', 'Bestias (Ámbar)'], ['COM_SHADOW', 'Sombras (Gris)'], ['COM_DEATH', 'Muerte (Amatista)'],
    ];
    // Lo que hace el script (no viene en los paquetes de efectos)
    const SCRIPTED: Record<string, string> = {
      wizard: 'Desbloquea los demás rituales del colegio; el hechicero llega con sus puntos de acción llenos',
      amethyst_damage_enemies: 'Quita el 30% de la vida máxima a cada unidad de los ejércitos enemigos en la misma región',
    };
    const ancN = (a: string) => L(`ancillaries_onscreen_name_${a}`) ?? pretty(a);
    const essays = new Map(T['resource_cost_pooled_resource_junctions_tables'].filter((r) => /arcane_essays/.test(r.pooled_resource_factor ?? '')).map((r) => [r.resource_cost, -Number(r.amount)]));
    const ancE = (a: string) => (ancEff.get(a) ?? []).flatMap((r) => parts(r.effect, r.value, r.effect_scope).map((p, j) => ({ k: r.effect, d: j === 0 ? effectText(r.effect, r.value, r.effect_scope) : '', s: p })));
    const items = COLS.flatMap(([cat, sec], i) => ritualsOf([cat]).map((r) => {
      const tail = String(r.key).replace('wh3_dlc25_college_of_magic_', '');
      const ancK = [r.completion_payload, r.start_payload].filter(Boolean).flatMap((p) => (ritualAnc.get(p) ?? []).map((a) => a.ancillary as string));
      const scr = SCRIPTED[tail] ?? (tail.startsWith('wizard_') ? SCRIPTED.wizard : undefined);
      const it = ritualItem(r, { tier: i + 1, sec });
      if (ancK.length) it.e = [...(it.e ?? []), ...ancK.flatMap(ancE)];
      const cost = essays.get(r.expended_resources), cd = Number(r.cooldown_time);
      const meta = [cost ? `${cost} Ensayos Arcanos${r.percentage_cost_increase_per_use ? ` (+${Math.round(r.percentage_cost_increase_per_use * 100)}% por cada uso)` : ''}` : '',
        cd > 0 ? `recarga ${cd} turno${cd > 1 ? 's' : ''}` : cd < 0 ? 'una sola vez' : ''].filter(Boolean).join(' · ');
      const extra = [meta, scr, ancK.length ? `Objeto: ${ancK.map(ancN).join(', ')}` : undefined].filter(Boolean).join(' · ');
      if (extra) it.req = it.req ? `${extra}\n${it.req}` : extra;
      return it;
    }));
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh_main_sc_emp_empire'),
      sets: [{ k: 'mech:college_of_magic', cat: 'COLLEGE_MAGIC', fac: 'wh2_dlc13_emp_golden_order', n: 'Colegios de Magia', max: 0, secs: COLS.map(([, n]) => n), items }],
    });
  }
  // El Cambiante: Maquinaciones por teatro (misiones del script wh3_dlc24_the_changeling.lua, Imperios Inmortales). Cada
  // maquinación menor da un paquete permanente para la facción, un objeto o una forma; la gran conspiración pide la mitad
  // de las menores y una batalla. [teatro, misión, objetivo, paquetes, objetos, otras recompensas]
  {
  const CHANGELING_SCHEMES: [string, string, string, string[], string[], string[]][] = [
    ["the_empire", "the_empire_minor_1", "the_empire_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["the_empire", "the_empire_minor_2", "the_empire_sylvania_corruption_objective", ["the_empire_minor_2"], [], ["open_rift_payload", "rift_gem_payload"]],
    ["the_empire", "the_empire_minor_3", "the_empire_sack_altdorf_objective", [], [], ["unlock_ror_steam_tank"]],
    ["the_empire", "the_empire_minor_4", "the_empire_win_battles", ["the_empire_minor_4"], [], ["hidden_cultist_payload"]],
    ["the_empire", "the_empire_minor_5", "", ["the_empire_minor_5"], [], []],
    ["the_empire", "the_empire_minor_6", "", ["the_empire_minor_6"], [], []],
    ["the_empire", "the_empire_grand", "grand_scheme_objective", ["the_empire_grand"], ["wh3_dlc24_anc_weapon_runefang"], ["ultimate_battle_empire", "the_empire_grand_scripted", "aekold_form", "rift_gem_payload"]],
    ["bretonnia", "bretonnia_minor_1", "bretonnia_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["bretonnia", "bretonnia_minor_2", "bretonnia_skavenblight_corruption_objective", [], [], []],
    ["bretonnia", "bretonnia_minor_3", "bretonnia_form_orion_objective", [], ["wh3_dlc24_anc_talisman_tree_sap"], ["hidden_cultist_payload"]],
    ["bretonnia", "bretonnia_minor_4", "", ["bretonnia_minor_4"], [], []],
    ["bretonnia", "bretonnia_minor_5", "", ["bretonnia_minor_5"], [], ["bretonnia_athel_loren_beastmen_rebels"]],
    ["bretonnia", "bretonnia_grand", "grand_scheme_objective", ["bretonnia_grand"], [], ["ultimate_battle_bretonnia", "bretonnia_grand_scripted", "green_knight_form", "rift_gem_payload"]],
    ["norsca", "norsca_minor_1", "norsca_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["norsca", "norsca_minor_2", "norsca_sack_hell_pit_objective", [], ["wh3_dlc24_anc_armour_scavenged_laboratory_materials"], ["unlock_ror_feral_carnosaur", "ghoritch_form"]],
    ["norsca", "norsca_minor_3", "norsca_great_cities_objective", [], [], ["kislev_all_forms_payload", "hidden_cultist_payload"]],
    ["norsca", "norsca_minor_4", "norsca_monolith_corruption_objective_roc", ["norsca_minor_4"], [], []],
    ["norsca", "norsca_minor_5", "", ["norsca_minor_5"], [], ["wulfrik_throgg_form"]],
    ["norsca", "norsca_grand", "grand_scheme_objective", ["norsca_grand"], [], ["ultimate_battle_norsca", "norsca_grand_scripted_roc", "unlock_ror_frost_wyrm", "rift_gem_payload"]],
    ["chaos_wastes", "chaos_wastes_minor_1", "chaos_wastes_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["chaos_wastes", "chaos_wastes_minor_2", "", [], ["wh3_dlc24_anc_armour_unknown_champions_cloak"], ["hidden_cultist_payload"]],
    ["chaos_wastes", "chaos_wastes_minor_3", "", ["chaos_wastes_minor_3"], ["wh3_main_anc_weapon_chainsword"], []],
    ["chaos_wastes", "chaos_wastes_minor_4", "chaos_wastes_province_capitals_objective", ["chaos_wastes_minor_4"], [], []],
    ["chaos_wastes", "chaos_wastes_minor_5", "chaos_wastes_win_battles", ["chaos_wastes_minor_5"], [], []],
    ["chaos_wastes", "chaos_wastes_grand", "grand_scheme_objective", ["chaos_wastes_grand"], [], ["ultimate_battle_chaos", "chaos_wastes_grand_scripted", "blue_scribes_form", "rift_gem_payload"]],
    ["grand_cathay", "grand_cathay_minor_1", "grand_cathay_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["grand_cathay", "grand_cathay_minor_2", "grand_cathay_win_battles", [], ["wh3_main_anc_caravan_von_carstein_blade", "wh3_main_anc_caravan_luminark_lens"], []],
    ["grand_cathay", "grand_cathay_minor_3", "grand_cathay_form_zhao_ming_objective", [], ["wh3_dlc24_anc_arcane_item_alchemical_notes"], []],
    ["grand_cathay", "grand_cathay_minor_4", "grand_cathay_nan-gau_corruption_objective", ["grand_cathay_minor_4"], [], ["hidden_cultist_payload"]],
    ["grand_cathay", "grand_cathay_minor_5", "", ["grand_cathay_minor_5"], [], ["grand_cathay_theatre_corruption_payload"]],
    ["grand_cathay", "grand_cathay_minor_6", "grand_cathay_form_snikch_objective", [], ["wh3_dlc24_anc_weapon_weeping_blade"], []],
    ["grand_cathay", "grand_cathay_minor_7_ie", "", ["grand_cathay_minor_7_ie"], [], []],
    ["grand_cathay", "grand_cathay_grand", "grand_scheme_objective", ["grand_cathay_grand"], [], ["ultimate_battle_cathay", "grand_cathay_grand_scripted", "rift_gem_payload"]],
    ["darklands", "darklands_minor_1", "darklands_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["darklands", "darklands_minor_2", "darklands_pigbarter_cult_objective", ["darklands_minor_2"], [], ["hidden_cultist_payload"]],
    ["darklands", "darklands_minor_3", "darklands_form_astragoth_objective", [], ["wh3_dlc24_anc_talisman_hellforge_flame"], []],
    ["darklands", "darklands_minor_4", "darklands_zharr_naggrund_corruption_objective", ["darklands_minor_4"], [], []],
    ["darklands", "darklands_minor_5", "", ["darklands_minor_5"], [], []],
    ["darklands", "darklands_minor_6", "", ["darklands_minor_6"], [], []],
    ["darklands", "darklands_minor_7", "", [], ["wh3_dlc24_anc_arcane_item_corrupted_flame"], []],
    ["darklands", "darklands_grand", "grand_scheme_objective", ["darklands_grand"], [], ["ultimate_battle_greenskins", "darklands_grand_scripted", "gorduz_form", "rift_gem_payload"]],
    ["badlands", "badlands_minor_1", "badlands_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["badlands", "badlands_minor_2", "badlands_form_skarbrand_objective", [], ["wh3_main_anc_weapon_chainsword"], []],
    ["badlands", "badlands_minor_3", "", [], ["wh3_dlc24_anc_armour_unknown_champions_cloak"], ["hidden_cultist_payload"]],
    ["badlands", "badlands_minor_4", "", ["badlands_minor_4"], [], []],
    ["badlands", "badlands_minor_5", "", ["badlands_minor_5"], [], []],
    ["badlands", "badlands_grand", "grand_scheme_objective", [], ["wh3_dlc24_anc_talisman_undead_tome"], ["ultimate_battle_tomb_kings", "badlands_grand_scripted", "rift_gem_payload"]],
    ["ulthuan", "ulthuan_minor_1", "ulthuan_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["ulthuan", "ulthuan_minor_2", "ulthuan_form_alarielle_objective", [], ["wh3_dlc24_anc_talisman_corrupted_icon"], []],
    ["ulthuan", "ulthuan_minor_3", "ulthuan_spawn_chaos_rebels_objective", [], [], ["ulthuan_sword_of_khaine", "hidden_cultist_payload"]],
    ["ulthuan", "ulthuan_minor_4", "", ["ulthuan_minor_4"], [], ["ulthuan_inner_ring_chaos_rebels"]],
    ["ulthuan", "ulthuan_minor_5", "ulthuan_sack_galleons_graveyard_objective", [], ["wh3_dlc24_anc_talisman_kraken_fang"], []],
    ["ulthuan", "ulthuan_grand", "grand_scheme_objective", ["ulthuan_grand"], [], ["ultimate_battle_high_elves", "ulthuan_scripted", "blue_scribes_form", "rift_gem_payload"]],
    ["naggaroth", "naggaroth_minor_1", "naggaroth_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["naggaroth", "naggaroth_minor_2", "naggaronth_great_cities_objective", [], [], ["naggaroth_all_forms_payload", "hidden_cultist_payload"]],
    ["naggaroth", "naggaroth_minor_3", "naggaroth_sack_the_witchwood_objective", ["naggaroth_minor_3"], [], ["naggaroth_witchwood_greenskins_payload"]],
    ["naggaroth", "naggaroth_minor_4", "", [], ["wh3_dlc24_anc_talisman_facial_scruff"], []],
    ["naggaroth", "naggaroth_minor_5", "", ["naggaroth_minor_5"], [], []],
    ["naggaroth", "naggaroth_grand", "grand_scheme_objective", [], ["wh3_dlc24_anc_arcane_item_captains_horn"], ["ultimate_battle_vampire_coast", "naggaroth_scripted", "rift_gem_payload"]],
    ["lustria", "lustria_minor_1", "lustria_create_cult_objective", [], [], ["reveal_shroud_payload"]],
    ["lustria", "lustria_minor_2", "lustria_form_mazdamundi_objective", [], ["wh3_dlc24_anc_talisman_pilfered_palanquin"], []],
    ["lustria", "lustria_minor_3", "", ["lustria_minor_3"], [], ["hidden_cultist_payload"]],
    ["lustria", "lustria_minor_4", "lustria_spawn_chaos_rebels_objective", ["lustria_minor_4"], [], []],
    ["lustria", "lustria_minor_5", "lustria_elven_colonies_objective", ["lustria_minor_5"], [], []],
    ["lustria", "lustria_grand", "grand_scheme_objective", ["lustria_grand"], [], ["ultimate_battle_skaven", "lustria_grand_scripted", "unlock_ror_feral_carnosaur", "lord_kroak_form", "rift_gem_payload"]],
  ];
    const P = 'wh3_dlc24_mission_schemes_';
    const clean = (t?: string | null) => t?.replace(/\[\[\/?[a-z]+(:[^\]]*)?\]\]/g, '').replace(/\{\{tr:[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim();
    const ancN = (a: string) => L(`ancillaries_onscreen_name_${a}`) ?? pretty(a.replace(/^.*_anc_/, ''));
    const ancE = (a: string) => (ancEff.get(a) ?? []).flatMap((r) => parts(r.effect, r.value, r.effect_scope).map((p, j) => ({ k: r.effect, d: j === 0 ? effectText(r.effect, r.value, r.effect_scope) : '', s: p })));
    const theatres = [...new Set(CHANGELING_SCHEMES.map((r) => r[0]))];
    const secOf = (t: string) => clean(L(`missions_localised_title_${P}${t}_grand`))?.replace(/^.*?:\s*/, '') ?? pretty(t);
    const items: Row[] = [];
    for (const [t, m, obj, bs, as, extra] of CHANGELING_SCHEMES) {
      const e = [...bs.flatMap((b) => effRows(bundleEff.get(P + b) ?? [], 'effect_key')), ...as.flatMap(ancE)];
      const other = extra.map((x) => clean(L(`campaign_payload_ui_details_description_dummy_${P}${x}`))).filter((x): x is string => !!x && !/^Desvela|niebla/i.test(x));
      if (!e.length && !as.length && !other.length) continue;
      const grand = m.endsWith('_grand');
      const name = clean(L(`missions_localised_title_${P}${m}`)) ?? pretty(m);
      const bName = bs.map((b) => clean(L(`effect_bundles_localised_title_${P}${b}`))).filter(Boolean);
      items.push(strip({
        k: `scheme:${m}`, n: grand ? `★ ${bName[0] ?? name.replace(/^Gran conspiración:\s*/, '')}` : (bName[0] ?? name), tier: theatres.indexOf(t) + 1, sec: secOf(t),
        req: [grand ? name : `Maquinación: ${name}`, as.length ? `🎁 Objeto: ${as.map(ancN).join(', ')}` : '',
          ...other.map((o) => `🎁 ${o}`), clean(L(`mission_text_text_${P}${obj}`))?.replace(/\s*\(Total actual: %n\)/, '')].filter(Boolean).join('\n'),
        e,
      }));
    }
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh3_main_sc_tze_tzeentch'),
      sets: [{ k: 'mech:changeling_schemes', cat: 'CHANGELING_SCHEMES', fac: 'wh3_dlc24_tze_the_deceivers', n: 'Maquinaciones del Embustero', max: 0, secs: theatres.map(secOf), items }],
    });
  }
  // Norsca: Devoción a los Dioses (todos los legendarios norses menos Sayl) y, para Sayl el Infiel, Ritual oscuro y
  // Manipulaciones (wh3_dlc27_nor_sayl_manipulation.lua). Cada altar suma 1 al dios al que está dedicado
  {
    const rng = new Map(T['campaign_group_member_criteria_numeric_ranges_tables'].map((r) => [r.member, r]));
    const GODS: [string, string, string][] = [['khorne', 'hound', 'El Mastín (Khorne)'], ['nurgle', 'crow', 'El Cuervo (Nurgle)'], ['slaanesh', 'serpent', 'La Serpiente (Slaanesh)'], ['tzeentch', 'eagle', 'El Águila (Tzeentch)']];
    const clean = (t?: string | null) => t?.replace(/\{\{tr:[^}]*\}\}\s*-?\s*/g, '').replace(/\[\[\/?[a-z]+(:[^\]]*)?\]\]/g, '').replace(/\s+/g, ' ').trim();
    const godItems = GODS.flatMap(([g, , sec], i) => [1, 2, 3, 4].map((n) => {
      const b = `wh_dlc08_bundle_god_bar_${g}_${n}`, r = rng.get(b);
      const alt = r ? (r.max_range >= 15 || n === 4 ? `${r.min_range}+ altares` : `${r.min_range}–${r.max_range} altares`) : '';
      // Un nivel por dios (cada nivel reemplaza al anterior): fila = dios, pieza = nivel
      return strip({ k: `god:${b}`, n: `${['I', 'II', 'III', 'IV'][n - 1]}. ${clean(L(`effect_bundles_localised_title_${b}`))?.replace(/\s*-\s*Nivel \d+$/, '') || sec}`, tier: i + 1, sec,
        g: sec, l: ['I', 'II', 'III', 'IV'][n - 1],
        req: [`Nivel ${n} de ${sec}${alt ? ` · ${alt} dedicados` : ''}`, n === 1 ? 'Activo aunque no tengas altares de este dios' : '',
          n === 4 ? 'Te ofrece a su campeón (solo puedes aceptar uno en toda la campaña); si lo aceptas, el dios rival te manda un ejército retador' : ''].filter(Boolean).join('\n'),
        e: effRows(bundleEff.get(b) ?? [], 'effect_key') });
    }));
    // Campeones (wh_dlc08_norscan_gods.lua): aceptar uno trae al retador del dios rival (Khorne↔Slaanesh, Nurgle↔Tzeentch);
    // rechazar a los cuatro trae a los cuatro retadores. Vencerlos da una de estas dos recompensas (se excluyen)
    const CH = 'Campeones';
    godItems.push(
      strip({ k: 'god:rival', n: clean(L('effect_bundles_localised_title_wh3_dlc27_bundle_nor_allegiance_victory_against_rival')) ?? 'Rival destruido', tier: 5, sec: CH, g: CH, l: 'Aceptado',
        req: 'Aceptaste al campeón de un dios y destruiste al retador de su dios rival', e: effRows(bundleEff.get('wh3_dlc27_bundle_nor_allegiance_victory_against_rival') ?? [], 'effect_key') }),
      strip({ k: 'god:refusal', n: clean(L('effect_bundles_localised_title_wh3_dlc27_bundle_nor_allegiance_ultimate_refusal')) ?? 'Campeones deshechos', tier: 5, sec: CH, g: CH, l: 'Rechazados',
        req: 'Rechazaste a los cuatro campeones y destruiste a los cuatro retadores', e: effRows(bundleEff.get('wh3_dlc27_bundle_nor_allegiance_ultimate_refusal') ?? [], 'effect_key') }),
    );
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh_dlc08_sc_nor_norsca'),
      sets: [{ k: 'mech:norsca_gods', cat: 'NORSCA_GODS', nfac: 'wh3_dlc27_nor_sayl', n: 'Devoción a los Dioses', max: 0, rows: true, secs: [...GODS.map((x) => x[2]), 'Campeones'], items: godItems }],
    });
    // Sayl: etapas del Ritual oscuro (altares del Caos Absoluto: 4 / 10 / 18 / 30) y manipulaciones por nivel
    const STAGES = [4, 10, 18, 30];
    const ritual = STAGES.map((a, i) => {
      const b = `wh3_dlc27_nor_sayl_narrative_t${i + 1}`, bb = `${b}_battle`;
      return strip({ k: `sayl:${b}`, n: clean(L(`effect_bundles_localised_title_${b}`)) ?? `Etapa ${i + 1}`, tier: i + 1, sec: 'Ritual oscuro',
        req: `${a} altares del Caos Absoluto${i < 3 ? ' · al vencer el encuentro: +5000 de oro y desbloquea el siguiente nivel de Manipulaciones' : ' · victoria de campaña'}`,
        e: [...effRows(bundleEff.get(b) ?? [], 'effect_key'), ...effRows((bundleEff.get(bb) ?? []).filter((r) => !/treasury/.test(r.effect_key)), 'effect_key')] });
    });
    const TIERS: [string[], string][] = [
      [['faction_vision', 'force_bundle', 'region_spoils', 'self_magic'], 'Nivel 0 · Atención +1 a +3'],
      [['faction_recruitment', 'force_movement', 'region_foreign', 'self_recruit'], 'Nivel I · Atención +2 a +4'],
      [['faction_treaties', 'force_damage', 'region_garrison', 'self_daemon'], 'Nivel II · Atención +3 a +5'],
      [['faction_war', 'force_rebel', 'region_destroy', 'self_force'], 'Nivel III · Atención +8'],
    ];
    const rit = new Map(T['rituals_tables'].filter((r) => /^SAYL_/.test(r.category)).map((r) => [r.key, r]));
    const manip = TIERS.flatMap(([ks, sec], i) => ks.map((k) => rit.get(`wh3_dlc27_sayl_manipulations_${k}`)).filter(Boolean).map((r) => {
      const it = ritualItem(r!, { tier: i + 1, sec });
      const desc = clean(L(`rituals_description_${r!.key}`));
      // Las que afectan a un enemigo no son bufos tuyos: sus efectos van como texto para que no se sumen a tus tarjetas
      const onEnemy = r!.category !== 'SAYL_SELF';
      const fx = onEnemy ? ((it.e ?? []) as Row[]).map((e) => e.d).filter(Boolean) : [];
      if (onEnemy) it.e = [];
      it.req = [`Recarga ${r!.cooldown_time} turnos · objetivo: ${({ SAYL_FACTION: 'una facción', SAYL_FORCE: 'un ejército', SAYL_REGION: 'un asentamiento', SAYL_SELF: 'Sayl' } as Row)[r!.category]}`,
        ...fx.map((d) => `• ${d}`), desc].filter(Boolean).join('\n');
      return it;
    }));
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh_dlc08_sc_nor_norsca'),
      sets: [
        { k: 'mech:sayl_ritual', cat: 'SAYL_RITUAL', fac: 'wh3_dlc27_nor_sayl', n: 'Ritual oscuro', max: 0, secs: ['Ritual oscuro'], items: ritual },
        { k: 'mech:sayl_manip', cat: 'SAYL_MANIP', fac: 'wh3_dlc27_nor_sayl', n: 'Manipulaciones', max: 0, secs: TIERS.map((x) => x[1]), items: manip },
      ],
    });
  }
  // Kislev: favores de la Corte de Hielo / la Gran Ortodoxia y rituales de la Madre Patria
  {
    const BOON_ES: Record<string, string> = { battle: 'Batalla', character: 'Personajes', global: 'Global', magic: 'Magia', economy: 'Economía', military: 'Militar', public_order: 'Orden público', recruitment: 'Reclutamiento', diplomacy: 'Diplomacia' };
    const boons = (cat: string) => ritualsOf([cat]).map((r) => {
      const m = /_([a-z]+)_(\d)_(\d)$/.exec(r.key);
      return ritualItem(r, m ? { g: `${BOON_ES[m[1]] ?? pretty(m[1])} ${m[2]}`, l: ROMAN[Number(m[3])] } : {});
    });
    const GOD_KSL: Record<string, string> = { dazh: 'Dazh', salyak: 'Salyak', tor: 'Tor', ursun: 'Ursun' };
    const KIND_KSL: Record<string, string> = { '': 'Ritual', upgraded: 'Mejorado', force: 'Ejército', province: 'Provincia' };
    const motherland = ritualsOf(['MOTHERLAND_RITUAL', 'MOTHERLAND_RITUAL_FORCE', 'MOTHERLAND_RITUAL_PROVINCE']).map((r) => {
      const m = /winter_([a-z]+)(?:_(upgraded|force|province))?$/.exec(r.key);
      return ritualItem(r, m ? { g: GOD_KSL[m[1]] ?? m[1], l: KIND_KSL[m[2] ?? ''] } : {});
    });
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh3_main_sc_ksl_kislev'),
      sets: [
        { k: 'mech:ice_court', cat: 'KISLEV', fac: 'wh3_main_ksl_the_ice_court', n: 'Favores de la Corte de Hielo', max: 0, rows: true, items: boons('KISLEV_ICE_COURT_BOON') },
        { k: 'mech:orthodoxy', cat: 'KISLEV', fac: 'wh3_main_ksl_the_great_orthodoxy', n: 'Favores de la Gran Ortodoxia', max: 0, rows: true, items: boons('KISLEV_ORTHODOXY_BOON') },
        { k: 'mech:motherland', cat: 'KISLEV', n: 'Rituales de la Madre Patria', max: 0, rows: true, items: motherland },
      ],
    });
  }
  // Secretos de la Torre Blanca (Teclis, Señores del Conocimiento): rituales con Pergaminos del Saber en 5 escuelas
  {
    const SWT: [string, string][] = [
      ['SWT_LOREMASTER', 'Gran Señor del Conocimiento'], ['SWT_BRILLIANCE', 'Genialidad (Luz y Cielos)'], ['SWT_BEING', 'Ser (Vida y Bestias)'],
      ['SWT_DARKNESS', 'Oscuridad (Muerte y Sombras)'], ['SWT_OBLIVION', 'Olvido (Fuego y Metal)'],
    ];
    const cats = SWT.map(([c]) => c);
    const items = ritualsOf(cats).map((r) => {
      const lvl = /_(?:rank|wom_cost)_(\d)$/.exec(r.key)?.[1];
      const base = L(`rituals_display_name_${r.key}`) ?? pretty(String(r.key).replace(/^.*white_tower_/, ''));
      return ritualItem(r, { tier: cats.indexOf(r.category) + 1, sec: SWT[cats.indexOf(r.category)][1], n: lvl ? `${base} ${ROMAN[Number(lvl)]}` : base });
    });
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh2_main_sc_hef_high_elves'),
      sets: [{ k: 'mech:white_tower', cat: 'WHITE_TOWER', fac: 'wh2_main_hef_order_of_loremasters', n: 'Secretos de la Torre Blanca', max: 0, secs: SWT.map(([, n]) => n), items }],
    });
  }
  // Athel Tamarha (Eltharion, Yvresse): mejoras de la cárcel con Suministros del Guardián, efectos de los prisioneros
  // según su cultura y la mejora de los Caminantes de la Niebla al interrogar (wh2_dlc15_eltharion_lair.lua).
  {
    const FAC = 'wh2_main_hef_yvresse';
    const LINES: [RegExp, string][] = [
      [/_prison_/, 'Cárcel'], [/_interrogation_/, 'Interrogatorio'], [/_influence_/, 'Influencia'], [/_mist_\d/, 'Niebla de Yvresse'],
      [/_mistwalkers_recruitment_/, 'Reclutamiento de Caminantes'], [/_mistwalkers_upgrades_/, 'Mejoras de Caminantes'],
      [/_melee_mistwalkers_/, 'Caminantes cuerpo a cuerpo'], [/_ranged_mistwalkers_/, 'Caminantes a distancia'],
    ];
    const lineOf = (k: string) => LINES.findIndex(([re]) => re.test(k));
    const ups = ritualsOf(['ATHEL_TAMARHA_RITUAL']).filter((r) => lineOf(r.key) >= 0).map((r) => {
      const li = lineOf(r.key), lvl = /_(\d)$/.exec(r.key)?.[1];
      return ritualItem(r, { tier: li + 1, sec: LINES[li][1], n: `${L(`rituals_display_name_${r.key}`) ?? LINES[li][1]}${lvl ? ` ${ROMAN[Number(lvl)]}` : ''}` });
    }).sort((a, b) => a.tier - b.tier);
    // Cultura del prisionero -> paquete mientras está en la cárcel / mejora de los Caminantes al interrogarlo
    const CULT: [string, string, string][] = [
      ['wh_dlc03_bst_beastmen', 'beastmen', 'beastmen'], ['wh_main_brt_bretonnia', 'bretonnia', 'bretonnia'], ['wh3_main_cth_cathay', 'cathay', 'cathay'],
      ['wh_main_chs_chaos', 'chaos_warriors', 'chaos_warriors'], ['wh3_dlc23_chd_chaos_dwarfs', 'chaos_dwarfs', 'chaos_dwarfs'], ['wh2_main_def_dark_elves', 'dark_elves', 'dark_elves'],
      ['wh3_main_dae_daemons', 'daemons', 'daemons'], ['wh_main_dwf_dwarfs', 'dwarfs', 'dwarfs'], ['wh_main_emp_empire', 'empire', 'empire'],
      ['wh_main_grn_greenskins', 'greenskins', 'greenskins'], ['wh2_main_hef_high_elves', 'high_elves', 'high_elves'], ['wh3_main_ksl_kislev', 'kislev', 'kislev'],
      ['wh2_main_lzd_lizardmen', 'lizardmen', 'lizardmen'], ['wh_dlc08_nor_norsca', 'norsca', 'norsca'], ['wh3_main_ogr_ogre_kingdoms', 'ogre_kingdoms', 'ogre_kingdoms'],
      ['wh2_main_rogue', 'rogue_armies', 'rogue_army'], ['wh2_main_skv_skaven', 'skaven', 'skaven'], ['wh2_dlc09_tmb_tomb_kings', 'tomb_kings', 'tomb_kings'],
      ['wh3_dlc29_nag_undead_legions', 'undead_legions', 'undead_legions'], ['wh2_dlc11_cst_vampire_coast', 'vampire_coast', 'vampire_coast'],
      ['wh_main_vmp_vampire_counts', 'vampire_counts', 'vampire_counts'], ['wh_dlc05_wef_wood_elves', 'wood_elves', 'wood_elves'],
    ];
    const cultN = (c: string) => (c === 'wh3_main_dae_daemons' ? 'Demonios (y los 4 dioses)' : c === 'wh2_main_rogue' ? 'Ejércitos renegados' : L(`cultures_name_${c}`) ?? pretty(c));
    const bItem = (b: string, cult: string, extra: Row) => {
      const e = effRows(bundleEff.get(b) ?? [], 'effect_key');
      return e.length ? strip({ k: b, n: cultN(cult), req: L(`effect_bundles_localised_title_${b}`) ?? undefined, e, ...extra }) : undefined;
    };
    const pre = (c: string) => (c === 'wh3_dlc29_nag_undead_legions' ? 'wh3_dlc29' : 'wh2_dlc15');
    const prisoners = CULT.map(([c, r]) => bItem(`${pre(c)}_hef_eltharion_dungeon_reward_${r}`, c, {})).filter(Boolean) as Row[];
    const interro = CULT.map(([c, , u]) => bItem(`${pre(c)}_hef_dungeon_mistwalker_upgrade_${u}`, c, {})).filter(Boolean) as Row[];
    const grom = bItem('wh2_dlc15_hef_dungeon_mistwalker_upgrade_greenskins_grom', 'wh_main_grn_greenskins', { n: 'Pieles Verdes (Grom el Panzudo)' });
    if (grom) interro.push(grom);
    // Cavill: el Señor del Conocimiento de Hoeth con el que empieza Yvresse (personaje de la posición inicial, no de la
    // base de datos) trae el rasgo único "Lobo Blanco" (wh2_dlc15_trait_white_wolf)
    const ww = effRows(traitEff.get('wh2_dlc15_trait_white_wolf') ?? [], 'effect');
    if (ww.length) mech.push({
      who: (sub) => sub === 'wh2_main_hef_loremaster_of_hoeth',
      sets: [{ k: 'mech:cavill', cat: 'CAVILL', fac: FAC, n: 'Cavill', max: 1, items: [strip({
        k: 'trait:wh2_dlc15_trait_white_wolf', n: L('character_trait_levels_onscreen_name_wh2_dlc15_trait_white_wolf') ?? 'Lobo Blanco',
        req: `Rasgo único de Cavill${L('character_trait_levels_colour_text_wh2_dlc15_trait_white_wolf') ? ` · ${L('character_trait_levels_colour_text_wh2_dlc15_trait_white_wolf')}` : ''}`,
        img: 'trait_high_elves', e: ww,
      })] }],
    });
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh2_main_sc_hef_high_elves'),
      sets: [
        { k: 'mech:athel_tamarha', cat: 'ATHEL_TAMARHA', fac: FAC, n: 'Athel Tamarha: mejoras', max: 0, secs: LINES.map(([, n]) => n), items: ups },
        { k: 'mech:athel_prisoners', cat: 'ATHEL_TAMARHA', fac: FAC, n: 'Prisioneros en la cárcel (por cultura)', max: 2, items: prisoners },
        { k: 'mech:athel_interrogate', cat: 'ATHEL_TAMARHA', fac: FAC, n: 'Interrogar: mejora de los Caminantes de la Niebla', max: 1, items: interro },
      ],
    });
  }
  // Forja Infernal (Enanos del Caos): rituales que suben el máximo de unidades por tipo
  {
    const HF_ES: Record<string, string> = {
      HELLFORGE_CAPS_FLYING_BEASTS: 'Bestias y monstruos', HELLFORGE_CAPS_BULL_CENTAURS: 'Centauros Toro', HELLFORGE_CAPS_MISSILE_INFANTRY: 'Infantería a distancia',
      HELLFORGE_CAPS_MELEE_INFANTRY: 'Infantería cuerpo a cuerpo', HELLFORGE_CAPS_WARMACHINES: 'Máquinas de guerra', HELLFORGE_CAPS_KDAAI: "K'daai",
    };
    const cats = Object.keys(HF_ES);
    const items = ritualsOf(cats).map((r) => ritualItem(r, {
      tier: cats.indexOf(r.category) + 1, sec: HF_ES[r.category],
      n: L(`rituals_display_name_${r.key}`) ?? pretty(String(r.key).replace(/^.*unit_cap_/, '')),
      req: 'Sube en 1 el máximo de esta unidad en tus ejércitos (Forja Infernal).',
    }));
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh3_dlc23_sc_chd_chaos_dwarfs'),
      sets: [{ k: 'mech:hellforge', cat: 'HELLFORGE', n: 'Forja Infernal: límites de unidades', max: 0, items, secs: Object.values(HF_ES) }],
    });
    // Manufactura: mejoras de categorías enteras de unidades (iniciativas de facción, hasta 3 activas por categoría;
    // se pagan con armamento por turno según cuántas unidades de la categoría tengas)
    const MANU: [string, string][] = [
      ['melee_infantry', 'Infantería cuerpo a cuerpo'], ['missile_infantry', 'Infantería a distancia'], ['bull_centaurs', 'Centauros Toro'],
      ['flying_beasts', 'Bestias y monstruos'], ['kdaai', "K'daai"], ['warmachines', 'Máquinas de guerra'],
    ];
    const manuSets = MANU.map(([k, n]) => {
      const set = `wh3_dlc23_faction_initiative_set_chd_category_${k}`;
      const max = iniSetBy.get(set)?.active_initiative_limit ?? 3;
      return { k: `mech:hellforge_manu_${k}`, cat: 'HELLFORGE_MANU', n: `Manufactura de la Forja Infernal · ${n}`, max, items: iniItemsOf(set) };
    }).filter((x) => x.items.length);
    if (manuSets.length) mech.push({ who: (sub, t, scs) => isLord(t) && scs.includes('wh3_dlc23_sc_chd_chaos_dwarfs'), sets: manuSets });
  }
  // Rituales de los Glottkin (Nurgle)
  {
    const GL_ES: Record<string, string> = { garden_cycle: 'Ciclo del Jardín', gifted_unit: 'Unidad bendecida', rains: 'Lluvias pestilentes', transported_army: 'Ejército transportado', xp: 'Experiencia' };
    const items = ritualsOf(['GLOTTKIN_ROTBORNE_RITUALS']).map((r) => {
      const m = /glottkin_([a-z_]+?)_(no_upgrade|upgrade_(\d))$/.exec(r.key);
      return ritualItem(r, m ? { g: GL_ES[m[1]] ?? pretty(m[1]), l: m[3] ? `+${m[3]}` : 'Base' } : {});
    });
    mech.push({
      who: (sub) => sub === 'wh3_dlc29_chs_glottkin',
      sets: [{ k: 'mech:glottkin', cat: 'GLOTTKIN', fac: 'wh3_dlc29_chs_host_of_the_triplets', n: 'Rituales Podridos de los Glottkin', max: 0, rows: true, items }],
    });
  }
  // Caldero de Grom: platos (efectos para Grom) e ingredientes (efectos de facción)
  {
    const recipes = T['cooking_recipes_tables'].filter((r) => /^wh2_dlc15_food_/.test(r.key));
    const reqG = group('cooking_recipe_required_ingredient_groups_tables', 'recipe');
    const reqI = group('cooking_recipe_required_ingredients_tables', 'recipe');
    const ING_G: Record<string, string> = {
      wh2_dlc15_animals: 'Animales', wh2_dlc15_birds: 'Aves', wh2_dlc15_slimes: 'Babas', wh2_dlc15_mushrooms: 'Hongos', wh2_dlc15_bugs: 'Bichos',
      wh2_dlc15_magic: 'Mágicos', wh2_dlc15_meat: 'Carne', wh2_dlc15_fish: 'Pescado', wh2_dlc15_humanoids: 'Humanoides', wh2_dlc15_plants: 'Plantas', wh2_dlc15_special: 'Especiales',
    };
    const ingName = (k: string) => L(`cooking_ingredients_display_text_${k}`) ?? L(`cooking_ingredients_name_${k}`) ?? pretty(k.replace(/^wh2_dlc15_/, ''));
    const dishes = recipes.map((r) => strip({
      k: r.key, n: L(`cooking_recipes_display_text_${r.key}`) ?? L(`cooking_recipes_name_${r.key}`) ?? pretty(iconBase(r.icon)?.replace(/^grom_recipes_/, '') ?? r.key),
      req: [...(reqG.get(r.key) ?? []).map((x) => L(`cooking_ingredient_groups_display_name_${x.ingredient_group}`) ?? ING_G[x.ingredient_group] ?? x.ingredient_group),
        ...(reqI.get(r.key) ?? []).map((x) => ingName(x.ingredient))].join(' + ') || undefined,
      img: iconBase(r.icon), tier: /special/.test(r.key) ? 2 : 1,
      e: [r.faction_leader_effects, r.faction_effects].filter(Boolean).flatMap((b) => effRows(iniEff.get(b) ?? [], 'effect')),
    }));
    const ings = T['cooking_ingredients_tables'].filter((r) => /^wh2_dlc15_/.test(r.key)).map((r) => strip({
      k: r.key, n: ingName(r.key), img: iconBase(r.icon), sec: L(`cooking_ingredient_groups_display_name_${r.group}`) ?? ING_G[r.group] ?? r.group,
      e: [r.faction_leader_effects, r.faction_effects].filter(Boolean).flatMap((b) => effRows(iniEff.get(b) ?? [], 'effect')),
    })).sort((a, b) => String(a.sec).localeCompare(String(b.sec)));
    const secs = [...new Set(ings.map((i) => i.sec as string))];
    for (const i of ings) i.tier = secs.indexOf(i.sec) + 1;
    mech.push({
      who: (sub) => sub === 'wh2_dlc15_grn_grom_the_paunch',
      sets: [
        { k: 'mech:grom_dishes', cat: 'COOKING', fac: 'wh2_dlc15_grn_broken_axe', n: 'Caldero de Grom: platos', max: 1, items: dishes, secs: ['Platos', 'Platos especiales'] },
        { k: 'mech:grom_ingredients', cat: 'COOKING', fac: 'wh2_dlc15_grn_broken_axe', n: 'Caldero de Grom: ingredientes', max: 4, items: ings, secs },
      ],
    });
  }
  // Recetas de otras facciones (mismo sistema que el Caldero de Grom): los efectos van en la lista de efectos de la receta
  {
    const byGroup = group('campaign_group_cooking_recipes_tables', 'campaign_group');
    const recipeOf = by('cooking_recipes_tables', 'key');
    const reqG = group('cooking_recipe_required_ingredient_groups_tables', 'recipe');
    const recipeItems = (cg: string) => (byGroup.get(cg) ?? []).map((x) => recipeOf.get(x.recipe)).filter(Boolean).map((r) => strip({
      k: r!.key, n: L(`cooking_recipes_display_text_${r!.key}`) ?? pretty(String(r!.key).replace(/^.*_recipe_/, '')),
      req: (reqG.get(r!.key) ?? []).map((g) => L(`cooking_ingredient_groups_display_name_${g.ingredient_group}`) ?? g.ingredient_group).join(' + ') || undefined,
      img: iconBase(r!.icon),
      e: [r!.key, r!.faction_effects, r!.faction_leader_effects].filter(Boolean).flatMap((l) => effRows(iniEff.get(l) ?? [], 'effect')),
    })).filter((i) => i.e.length);
    // Madre Ostankya: brebajes de la Choza de la Bruja que se le dan a un señor (habilidad de ejército)
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh3_main_sc_ksl_kislev'),
      sets: [{ k: 'mech:ostankya_brews', cat: 'BREW', fac: 'wh3_dlc24_ksl_daughters_of_the_forest', n: 'Brebajes de la Choza de la Bruja', max: 1, items: recipeItems('wh3_dlc24_ksl_daughters_of_the_forest') }],
    });
    // Dechala: Marcas de Crueldad (nivel I-III por marca), habilidades para sus personajes
    const marks = recipeItems('wh3_dlc27_sla_the_tormentors').map((i) => {
      const m = /^(.*?)(?: (I{1,3}))?$/.exec(String(i.n))!;
      return { ...i, g: m[1], l: m[2] ?? 'I' };
    });
    mech.push({
      who: (sub, t, scs) => scs.includes('wh3_main_sc_sla_slaanesh'),
      sets: [{ k: 'mech:dechala_marks', cat: 'MARKS', fac: 'wh3_dlc27_sla_the_tormentors', n: 'Marcas de Crueldad', max: 0, rows: true, items: marks }],
    });
    // Middenland (Boris Todbringer): rituales del ejército de Ulric (Empoderado por Ulric, Lecciones de la caza...)
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh_main_sc_emp_empire'),
      sets: [{ k: 'mech:middenland', cat: 'ULRIC', fac: 'wh_main_emp_middenland', n: 'Rituales de Ulric (ejército de Middenland)', max: 0, items: ritualsOf(['MIDDENLAND_ARMY_RITUALS']).map((r) => ritualItem(r)) }],
    });
  }
  // Forja de Daith: bendiciones de facción que se compran en la forja (rituales)
  {
    const items = ritualsOf(['DAITH_BUFF_RITUAL']).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((r) => ritualItem(r, { req: `Dura ${ritualDur(r)} turnos · todos los ejércitos` })).filter((i) => i.e?.length);
    if (items.length) mech.push({
      who: (sub, t, scs) => scs.includes('wh_dlc05_sc_wef_wood_elves'),
      sets: [{ k: 'mech:daith_buffs', cat: 'FORGE_BUFF', fac: 'wh2_dlc16_wef_sisters_of_twilight', n: 'Forja de Daith · bendiciones de facción', max: 0, items }],
    });
  }
  // Taller de Ikit (Clan Skryre): mejoras de las armas de los equipos, Ruedas de Muerte, Picadoras y Monstruormentas.
  // Rituales del script wh2_dlc12_ikit_workshop.lua; el nivel de taller que pide cada uno es su índice en workshop_rite_keys.
  {
    const LEVELS: string[][] = [
      ['gatling_part_1', 'jezail_part_0', 'warpfire_part_2', 'doomwheel_part_0', 'doomwheel_part_2', 'doomwheel_part_6', 'doomwheel_part_9', 'doomflayer_part_1', 'doomflayer_part_5', 'doomflayer_part_6', 'doomflayer_part_9', 'poison_wind_globaldier_0', 'poison_wind_mortar_0', 'warpgrinder_0', 'stormfiend_melee_type_0', 'stormfiend_ranged_type_0'],
      ['gatling_part_2', 'jezail_part_2', 'warpfire_part_1', 'doomwheel_part_1', 'doomwheel_part_4', 'doomwheel_part_8', 'doomflayer_part_0', 'doomflayer_part_2', 'doomflayer_part_7', 'poison_wind_globaldier_1', 'poison_wind_mortar_1', 'warpgrinder_1', 'stormfiend_ranged_type_1', 'stormfiend_melee_type_1'],
      ['gatling_part_0', 'jezail_part_1', 'warpfire_part_0', 'doomwheel_part_5', 'doomwheel_part_7', 'doomflayer_part_3', 'doomflayer_part_8', 'poison_wind_globaldier_2', 'poison_wind_mortar_2', 'warpgrinder_2', 'stormfiend_ranged_type_2', 'stormfiend_melee_type_2'],
      ['doomwheel_part_3', 'doomflayer_part_4'],
    ];
    const UNITS: [RegExp, string][] = [
      [/gatling/, 'Amerratadoras'], [/jezail/, 'Jezzails'], [/warpfire/, 'Lanzallamas de Disformidad'], [/globaldier/, 'Lanzadores de Viento Envenenado'],
      [/mortar/, 'Morteros de Viento Envenenado'], [/warpgrinder/, 'Tuneladoras de disformidad'], [/stormfiend_melee/, 'Monstruormentas (cuerpo a cuerpo)'],
      [/stormfiend_ranged/, 'Monstruormentas (a distancia)'], [/doomwheel/, 'Rueda de Muerte'], [/doomflayer/, 'Picadoras de condenación'],
    ];
    const rit = by('rituals_tables', 'key');
    const items: Row[] = [];
    LEVELS.forEach((list, lvl) => {
      for (const part of list) {
        const key = (part.startsWith('stormfiend') ? 'wh3_dlc29_ikit_workshop_' : 'wh2_dlc12_ikit_workshop_') + part;
        const r = rit.get(key);
        if (!r) continue;
        const u = UNITS.findIndex(([re]) => re.test(part));
        const it = ritualItem(r, { tier: u + 1, req: `Taller nivel ${lvl + 1}` });
        if (it.e?.length) items.push(it);
      }
    });
    items.sort((a, b) => a.tier - b.tier || String(a.req).localeCompare(String(b.req)));
    if (items.length) mech.push({
      who: (sub, t, scs) => scs.includes('wh2_main_sc_skv_skaven'),
      sets: [{ k: 'mech:ikit_workshop', cat: 'WORKSHOP', fac: 'wh2_main_skv_clan_skryre', n: 'Taller de Ikit', max: 0, items, secs: UNITS.map(([, n]) => n) }],
    });
  }
  // Tamurkhan: jefes vasallos. Datos del script wh3_dlc25_campaign_nur_chieftains.lua (paquetes por nivel de lealtad
  // y habilidades que el script pone en el ejército del jefe). Umbrales de lealtad copiados del script.
  {
    const CHIEFS: [string, string, number, number, string[]][] = [
      ['bray_shaman', 'wh3_dlc25_nur_bray_shaman_wild_chieftain', 10, 30, []],
      ['castellan', 'wh3_dlc25_nur_castellan_chieftain', 10, 30, ['tier_2']],
      ['exalted_hero', 'wh3_dlc25_nur_exalted_hero_chieftain', 10, 25, ['tier_2']],
      ['fimir_balefiend', 'wh3_dlc25_nur_fimir_balefiend_shadow_chieftain', 10, 25, ['tier_2', 'tier_3']],
      ['kazyk', 'wh3_dlc25_nur_kayzk_the_befouled', 7, 20, ['tier_2', 'tier_3']],
      ['werekin', 'wh3_dlc25_nur_skin_wolf_werekin_chieftain', 10, 30, []],
    ];
    const items: Row[] = [];
    for (const [c, agent, t2, t3, abil] of CHIEFS) {
      const g = L(`agent_subtypes_onscreen_name_override_${agent}`) ?? pretty(c);
      const lvl = ['Lealtad 1 (al unirse)', `Lealtad 2 (${t2})`, `Lealtad 3 (${t3})`, 'Lealtad 4 (batalla del jefe)'];
      for (let t = 1; t <= 4; t++) {
        const b = `wh3_dlc25_chieftain_deference_${c}_tier_${t}`;
        const e = effRows(bundleEff.get(b) ?? [], 'effect_key').filter((x) => x.d || x.s?.kind !== 'campaign').map((x) => x.d ? x : { ...x, d: x.s?.attribute ? `Atributo: ${x.s.attribute} (ejército)` : x.k });
        if (e.length) items.push(strip({ k: b, n: `${g}: ${lvl[t - 1]}`, g, l: `L${t}`, tier: t, e }));
      }
      for (const a of abil) {
        const b = `wh3_dlc25_ritual_nur_${c}_${a}_ability_scripted`;
        const e = effRows(bundleEff.get(b) ?? [], 'effect_key').filter((x) => x.d || x.s?.kind !== 'campaign').map((x) => x.d ? x : { ...x, d: x.s?.attribute ? `Atributo: ${x.s.attribute} (ejército)` : x.k });
        if (e.length) items.push(strip({ k: b, n: `${g}: habilidad de ejército (${a.replace('tier_', 'lealtad ')})`, g: `${g} · ejército del jefe`, l: `Ejército ${a.replace('tier_', 'L')}`, e }));
      }
    }
    mech.push({
      who: (sub, t, scs) => scs.includes('wh3_main_sc_nur_nurgle'),
      sets: [{ k: 'mech:tamurkhan_chiefs', cat: 'CHIEF', fac: 'wh3_dlc25_nur_tamurkhan', n: 'Jefes vasallos de Tamurkhan', max: 0, rows: true, items }],
    });
  }
  // Plagas de Nurgle: síntomas de batalla y de ejército (efecto en tu ejército infectado, normal o bendito)
  {
    const pes = by('plague_effect_setups_tables', 'key'), pe = by('plague_effects_tables', 'key');
    const comps = T['plague_components_tables'].filter((r) => /^wh3_dlc25_nur_(battle|force)_\d+$/.test(r.key));
    const items: Row[] = [];
    for (const c of comps) {
      const fx = pe.get(pes.get(c.key)?.force_effects ?? '');
      if (!fx) continue;
      const name = L(`plague_components_name_${c.key}`) ?? L(`plague_components_localised_name_${c.key}`) ?? `Síntoma ${/battle/.test(c.key) ? 'de batalla' : 'de ejército'} ${c.key.split('_').pop()}`;
      for (const [b, l] of [[fx.positive_effect_for_factions, 'Normal'], [fx.positive_blessed_effect_for_factions, 'Bendita']] as [string, string][]) {
        if (!b) continue;
        items.push(strip({ k: `${c.key}:${l === 'Bendita' ? 'b' : 'n'}`, n: `${name} (${l.toLowerCase()})`, g: name, l, img: iconBase(c.image_path), e: effRows(bundleEff.get(b) ?? [], 'effect_key') }));
      }
    }
    mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh3_main_sc_nur_nurgle'),
      sets: [{ k: 'mech:nurgle_plague', cat: 'PLAGUE', n: 'Plagas de Nurgle: síntomas', max: 3, rows: true, items }],
    });
  }
  // Guaridas de Vampiros (Condes Vampiro): al despertar a un vampiro de linaje se construyen hasta 6 edificios secundarios.
  // Qué da cada edificio lo decide el script del juego (data_script.pack: script/campaign/wh3_dlc29_vampire_lairs.lua):
  // rasgos (Legado / Poder) con efectos en trait_level_effects, rango inicial, objetos, seguidores, montura, nigromante...
  {
    const LAIR_TRAITS: Record<string, string> = {
      legacy_1: 'wh3_main_vmp_trait_legacy_lucky', legacy_2: 'wh3_main_vmp_trait_legacy_undefeated', legacy_3: 'wh3_main_vmp_trait_legacy_corrupted',
      legacy_4: 'wh3_main_vmp_trait_legacy_silent', legacy_5: 'wh3_main_vmp_trait_legacy_inflamed', legacy_6: 'wh3_main_vmp_trait_legacy_command',
      power_1: 'wh3_main_vmp_trait_power_stalker', power_2: 'wh3_main_vmp_trait_power_death', power_3: 'wh3_main_vmp_trait_power_fixation',
      power_4: 'wh3_main_vmp_trait_power_magic', power_5: 'wh3_main_vmp_trait_power_battle', power_6: 'wh3_main_vmp_trait_power_health',
    };
    const LAIR_RANK: Record<string, number> = { knowledge_rank_1: 10, knowledge_rank_2: 20, knowledge_rank_3: 30 };
    const LAIR_SEC: [RegExp, string][] = [[/^legacy_/, 'Legado'], [/^power_/, 'Poder'], [/^knowledge_/, 'Conocimiento'], [/^followers_/, 'Seguidores'], [/^items_/, 'Objetos y cripta']];
    const traitEff = group('trait_level_effects_tables', 'trait_level');
    const keys = [...new Set(T['building_levels_tables'].map((r) => r.level_name as string).filter((k) => /^wh3_dlc29_vmp_lair_secondary_/.test(k)))].sort();
    const items = keys.map((k) => {
      const short = k.replace('wh3_dlc29_vmp_lair_secondary_', '');
      const trait = LAIR_TRAITS[short];
      const sec = LAIR_SEC.findIndex(([re]) => re.test(short));
      const desc = L(`building_short_description_texts_short_description_${k}`);
      return strip({
        k: `lair:${short}`, n: L(`building_culture_variants_name_${k}wh_main_vmp_vampire_counts`) ?? (trait ? L(`character_trait_levels_onscreen_name_${trait}`) : null) ?? pretty(short),
        req: LAIR_RANK[short] ? `El vampiro despierta en rango ${LAIR_RANK[short]}.` : desc ?? undefined,
        tier: sec + 1, img: undefined,
        e: trait ? effRows(traitEff.get(trait) ?? [], 'effect') : [],
      });
    });
    mech.push({
      who: (sub) => /^wh2_dlc11_vmp_bloodline_/.test(sub),
      sets: [{ k: 'mech:vampire_lair', cat: 'LAIR', n: 'Guarida de Vampiros: despertar', max: 6, items, secs: LAIR_SEC.map(([, n]) => n) }],
    });
  }
  // Corte de Hielo (Kislev): una Doncella de Hielo (héroe) o Bruja de Hielo (señora) en formación pasa por 3 dilemas
  // y en cada uno elige 1 de 4 rasgos (character_training_*). Los rasgos de la Doncella llevan el sufijo _hero.
  {
    const traitEff = group('trait_level_effects_tables', 'trait_level');
    const levelsOf = group('character_trait_levels_tables', 'trait');
    const choiceTrait = new Map(T['character_training_dilemma_choice_traits_tables'].map((r) => [r.choice_key as string, r.m_character_trait_level_key as string]));
    const choicesOf = group('character_training_dilemma_choices_tables', 'dilemma_key');
    const ORDER = ['FIRST', 'SECOND', 'THIRD', 'FOURTH'];
    const lastLevel = (trait: string) => (levelsOf.get(trait) ?? []).sort((a, b) => b.level - a.level)[0]?.key ?? trait;
    for (const g of T['character_training_groups_tables']) {
      const dilemmas = T['character_training_group_dilemma_junctions_tables'].filter((j) => j.group_key === g.key).map((j) => j.dilemma_key as string)
        .filter((d) => (choicesOf.get(d) ?? []).some((c) => choiceTrait.has(c.key))).sort();
      const items = dilemmas.flatMap((d, i) => {
        const title = L(`character_training_dilemmas_localised_title_${d}`) ?? `Dilema ${i + 1}`;
        return (choicesOf.get(d) ?? []).filter((c) => choiceTrait.has(c.key)).sort((a, b) => ORDER.indexOf(a.index) - ORDER.indexOf(b.index)).map((c) => {
          const tl = lastLevel(choiceTrait.get(c.key)!);
          return strip({ k: `icecourt:${tl}`, n: L(`character_trait_levels_onscreen_name_${tl}`) ?? pretty(tl.replace(/^.*ice_training_/, '')), g: `${i + 1}. ${title}`, l: L(`character_trait_levels_onscreen_name_${tl}`) ?? undefined, e: effRows(traitEff.get(tl) ?? [], 'effect') });
        });
      }).filter((it) => it.e.length);
      const hero = /frost_maiden/.test(g.key);
      if (items.length) mech.push({
        who: (sub) => (hero ? /^wh3_main_ksl_frost_maiden_/ : /^wh3_main_ksl_ice_witch_/).test(sub),
        sets: [{ k: `mech:icecourt:${hero ? 'maiden' : 'witch'}`, cat: 'ICE_COURT', n: `Corte de Hielo: formación (${hero ? 'Doncella de Hielo' : 'Bruja de Hielo'})`, max: 0, rows: true, items }],
      });
    }
  }
  // Votos de Bretonia: el señor jura el Voto del Caballero, luego el de la Búsqueda y el del Grial (las damiselas, Promesas);
  // cada voto se cumple con uno de 3 juramentos y el rasgo de su último nivel trae los efectos.
  {
    const traitEff = group('trait_level_effects_tables', 'trait_level');
    const levelsOf = group('character_trait_levels_tables', 'trait');
    const vowOrder = new Map(T['bretonnia_vows_tables'].map((v) => [v.key as string, v.order as number]));
    const traitsOf = group('bretonnia_vows_to_traits_tables', 'vow');
    const vowsOf = group('agent_subtype_to_vows_tables', 'agent_subtype');
    const lastLevel = (trait: string) => (levelsOf.get(trait) ?? []).sort((a, b) => b.level - a.level)[0]?.key ?? trait;
    const setFor = new Map<string, Row>();
    for (const [sub, vs] of vowsOf) {
      const vows = vs.map((v) => v.vow as string).sort((a, b) => (vowOrder.get(a) ?? 0) - (vowOrder.get(b) ?? 0));
      const sig = vows.join('|');
      if (!setFor.has(sig)) {
        // Los 3 juramentos de un voto dan los mismos efectos (solo cambia cómo se cumple): una pieza por voto
        const items = vows.flatMap((v, i) => {
          const ps = (traitsOf.get(v) ?? []).sort((a, b) => a.order - b.order).map((t) => lastLevel(t.trait));
          const effs = ps.map((tl) => effRows(traitEff.get(tl) ?? [], 'effect'));
          const same = effs.every((e) => JSON.stringify(e) === JSON.stringify(effs[0]));
          const vn = L(`bretonnia_vows_localised_name_${v}`) ?? pretty(v);
          const pn = (tl: string) => L(`character_trait_levels_onscreen_name_${tl}`) ?? pretty(tl);
          return (same ? [ps[0]] : ps).map((tl, j) => strip({
            k: `vow:${tl}`, n: same ? vn : `${vn}: ${pn(tl)}`, tier: i + 1,
            req: same ? `Se cumple con uno de sus juramentos: ${ps.map(pn).join(', ')}.${i ? ' Requiere haber cumplido el voto anterior.' : ''}` : undefined,
            e: same ? effs[0] : effs[j],
          }));
        }).filter((it) => it.e.length);
        const secs = vows.map((v) => L(`bretonnia_vows_localised_name_${v}`) ?? pretty(v));
        setFor.set(sig, { k: `mech:vows:${setFor.size}`, cat: 'VOWS', n: vows.some((v) => /troth/.test(v)) ? 'Promesas de la Dama' : 'Votos de Bretonia', max: 0, items, secs });
      }
      const set = setFor.get(sig)!;
      if (set.items.length) mech.push({ who: (s) => s === sub, sets: [set] });
    }
  }
  // Costa del Vampiro: la Saloma perdida. Cada verso encontrado da una habilidad de ejército y la canción completa, liderazgo.
  {
    const bundleEff = group('effect_bundles_to_effects_junctions_tables', 'effect_bundle_key');
    const keys = ['wh2_dlc11_bundle_sea_shanty_verse_1', 'wh2_dlc11_bundle_sea_shanty_verse_2', 'wh2_dlc11_bundle_sea_shanty_verse_3', 'wh2_dlc11_bundle_sea_shanty_complete'];
    const items = keys.map((k, i) => strip({
      k: `shanty:${k}`, n: L(`effect_bundles_localised_title_${k}`) ?? pretty(k.replace(/^.*shanty_/, '')),
      req: i === 3 ? 'Con los 3 versos encontrados.' : undefined,
      e: effRows(bundleEff.get(k) ?? [], 'effect_key'),
    })).filter((it) => it.e.length);
    if (items.length) mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh2_dlc11_sc_cst_vampire_coast'),
      sets: [{ k: 'mech:shanty', cat: 'SHANTY', n: 'La Saloma perdida', max: 0, items }],
    });
  }
  // Malakai Makaisson: el Espíritu de Grungni (edificios del dirigible, horda) y las Aventuras de Malakai (7 cadenas de
  // misiones con mejoras de unidades). Las recompensas que da el script (wh3_dlc25_malakai_battles.lua) están copiadas
  // aquí; las de las misiones de la base de datos salen de cdir_events_mission_payloads.
  {
    const FAC = 'wh3_dlc25_dwf_malakai';
    const MALAKAI = 'wh3_dlc25_dwf_malakai_makaisson';
    const beff = group('building_effects_junction_tables', 'building');
    const bunits = group('building_units_allowed_tables', 'building');
    const unitN = (u: string) => L(`land_units_onscreen_name_${u}`) ?? pretty(u.replace(/^wh\d?_(main|dlc\d+)_dwf_/, ''));
    const lv = T['building_levels_tables'].filter((r) => /^wh3_dlc25_dwarf_spirit_of_grungni_/.test(r.level_name) && /spirit_of_grungni/.test(r.chain));
    const chains = [...new Set(lv.map((r) => r.chain as string))].sort((a, b) => (a.endsWith('main_chain') ? -1 : b.endsWith('main_chain') ? 1 : a.localeCompare(b)));
    const ship: Row[] = [];
    const shipSecs: string[] = [];
    for (const ch of chains) {
      const levels = lv.filter((r) => r.chain === ch).sort((a, b) => a.level - b.level);
      const g = L(`building_culture_variants_name_${levels[0].level_name}`) ?? pretty(levels[0].building_instance_key.replace(/^.*grungni_/, ''));
      for (const r of levels) {
        const units = [...new Set((bunits.get(r.level_name) ?? []).map((u) => unitN(u.unit)))];
        ship.push(strip({
          k: r.level_name, n: `${ROMAN[r.level + 1]}. ${L(`building_culture_variants_name_${r.level_name}`) ?? g}`, tier: shipSecs.length + 1, sec: g,
          req: [r.create_cost ? `${r.create_cost} de oro` : 'Inicial', units.length ? `Recluta: ${units.join(', ')}` : ''].filter(Boolean).join(' · '),
          e: effRows(beff.get(r.level_name) ?? [], 'effect'),
        }));
      }
      shipSecs.push(g);
    }
    const ADV = ['dragon_hunters', 'dreadquake_destruction', 'spider_swarm', 'undead_empowered', 'malevolent_tree_spirits', 'exalted_bloodthirster', 'warpstone_bomb'];
    const SCRIPTED: Record<string, Record<number, string>> = {
      dragon_hunters: { 2: 'wh3_dlc25_reward_dwf_malakai_dragon_hunters_level_1', 3: 'wh3_dlc25_dwf_upgrade_exp_gain_cannons', 5: 'wh3_dlc25_reward_dwf_malakai_dragon_hunters_level_2' },
      dreadquake_destruction: { 2: 'wh3_dlc25_reward_dwf_malakai_gyrocopters_2', 3: 'wh3_dlc25_dwf_upgrade_exp_gain_gyrocopters', 5: 'wh3_dlc25_reward_dwf_malakai_dreadquake_destruction_level_5' },
      spider_swarm: { 2: 'wh3_dlc25_reward_dwf_malakai_goblin_hewers_2', 3: 'wh3_dlc25_dwf_upgrade_armour_sundering_goblin_hewer_war', 4: 'wh3_dlc25_reward_dwf_malakai_goblin_hewers_4', 5: 'wh3_dlc25_dwf_upgrade_exp_gain_goblin_hewers' },
      undead_empowered: { 2: 'wh3_dlc25_reward_dwf_malakai_gyrobombers_2', 3: 'wh3_dlc25_dwf_upgrade_exp_gain_gyrobombers', 5: 'wh3_dlc25_reward_dwf_malakai_gyrobombers_5' },
      malevolent_tree_spirits: { 2: 'wh3_dlc25_reward_dwf_malakai_flame_cannon_2', 3: 'wh3_dlc25_reward_dwf_malakai_flame_cannon_3', 5: 'wh3_dlc25_reward_dwf_malakai_flame_cannon_5' },
      exalted_bloodthirster: { 2: 'wh3_dlc25_dwf_upgrade_exp_gain_organ_guns', 5: 'wh3_dlc25_reward_dwf_malakai_organ_guns_5', 6: 'wh3_dlc25_dwf_upgrade_reload_organ_guns' },
      warpstone_bomb: { 2: 'wh3_dlc25_reward_dwf_malakai_thunderbarge_2', 3: 'wh3_dlc25_dwf_upgrade_missile_resist_thunderbarge_veh', 4: 'wh3_dlc25_reward_dwf_malakai_thunderbarge_4', 6: 'wh3_dlc25_reward_dwf_malakai_thunderbarge_6' },
    };
    // Recompensas de la base de datos: misión -> paquetes y objetos (sin repetir la versión _ie de Imperios Inmortales)
    const dbPay = new Map<string, { b: string[]; a: string[] }>();
    for (const r of T['cdir_events_mission_payloads_tables']) {
      const m = /^wh3_dlc25_mis_dwf_malakai_(.+?)(?:_ie)?$/.exec(r.mission_key);
      if (!m) continue;
      const x = dbPay.get(m[1]) ?? { b: [], a: [] };
      const b = /KEY\[([^\]]+)\]/.exec(r.value)?.[1], a = /ANCILLARY_KEY\[([^\]]+)\]/.exec(r.value)?.[1];
      if (r.payload_key === 'EFFECT_BUNDLE' && b && !x.b.includes(b)) x.b.push(b);
      if (r.payload_key === 'ADD_ANCILLARY' && a && !x.a.includes(a)) x.a.push(a);
      dbPay.set(m[1], x);
    }
    const ancN = (a: string) => L(`ancillaries_onscreen_name_${a}`) ?? pretty(a.replace(/^.*_anc_/, ''));
    const secs = ADV.map((a) => L(`missions_localised_title_wh3_dlc25_mis_dwf_malakai_${a}_1`) ?? pretty(a));
    const adv: Row[] = [];
    ADV.forEach((a, i) => {
      const steps: [string, string, string[]][] = [];
      for (let n = 1; n <= 6; n++) {
        const bs = [...(dbPay.get(`${a}_${n}`)?.b ?? []), ...(SCRIPTED[a][n] ? [SCRIPTED[a][n]] : [])];
        for (const b of bs) steps.push([b, `Misión ${n}`, []]);
      }
      // Araña: el nivel 2 de la recompensa llega con su propia misión
      for (const b of dbPay.get(`${a}_level_2`)?.b ?? []) steps.push([b, 'Misión adicional', dbPay.get(`${a}_level_2`)?.a ?? []]);
      const fin = dbPay.get(`${a}_narrative_battle`);
      for (const b of fin?.b ?? []) steps.push([b, 'Batalla legendaria (final)', fin?.a ?? []]);
      for (const [b, req, ancs] of steps) {
        const e = effRows(bundleEff.get(b) ?? [], 'effect_key');
        if (!e.length) continue;
        adv.push(strip({
          k: `malakai:${b}`, n: L(`effect_bundles_localised_title_${b}`) ?? pretty(b.replace(/^.*malakai_|^.*dwf_upgrade_/, '')), tier: i + 1, sec: secs[i],
          req: [req, ancs.length ? `también da: ${ancs.map(ancN).join(', ')}` : ''].filter(Boolean).join(' · '), e,
        }));
      }
    });
    mech.push({
      who: (sub) => sub === MALAKAI,
      sets: [{ k: 'mech:spirit_of_grungni', cat: 'GRUNGNI', fac: FAC, n: 'Espíritu de Grungni (dirigible)', max: 0, secs: shipSecs, items: ship }],
    });
    if (adv.length) mech.push({
      who: (sub, t, scs) => isLord(t) && scs.includes('wh_main_sc_dwf_dwarfs'),
      sets: [{ k: 'mech:malakai_adventures', cat: 'MALAKAI_ADV', fac: FAC, n: 'Aventuras de Malakai', max: 0, secs, items: adv }],
    });
  }
  // Grupo de nombres de cada subcultura (el de su primera facción con grupo) y listas de nombres por grupo y género
  const scNameGroup = new Map<string, string>();
  for (const f of T['factions_tables']) if (f.name_group && !scNameGroup.has(f.subculture)) scNameGroup.set(f.subculture, f.name_group);
  // Nombres y apellidos por género (los apellidos también: "la Hermosa" es de mujer)
  const namesOut: Record<string, { m: string[]; f: string[]; sm: string[]; sf: string[] }> = {};
  for (const r of T['names_tables']) {
    const t = L(`names_name_${r.id}`);
    if (!t || t.length > 30 || (r.type === 'forename' && /\s/.test(t))) continue;
    const g = (namesOut[r.names_group] ??= { m: [], f: [], sm: [], sf: [] });
    const [mk, fk] = r.type === 'family_name' ? (['sm', 'sf'] as const) : r.type === 'forename' ? (['m', 'f'] as const) : [null, null];
    if (!mk) continue;
    if (r.gender !== 'f') g[mk].push(t);
    if (r.gender !== 'm') g[fk!].push(t);
  }
  for (const g of Object.values(namesOut)) for (const k of ['m', 'f', 'sm', 'sf'] as const) g[k] = [...new Set(g[k])].sort();
  const trainedSubs = new Set(T['character_training_dilemma_choice_agent_types_tables'].map((r) => r.agent_subtype_key as string));
  const mechFor = (sub: string, type: string, scs: string[]): Row[] => mech.filter((m) => m.who(sub, type, scs)).flatMap((m) => m.sets).filter((s) => s.items.length);

  /** Cortes a las que puede pertenecer un personaje: de su subcultura, sin los cargos que el juego le prohíbe */
  const courtsFor = (sub: string, scs: string[]): Row[] => courts.filter((c) => scs.includes(c.sc)).map((c) => {
    const items = c.set.items.filter((i: Row) => !c.forbidden.get(i.k)?.has(sub));
    if (c.leaderItem && leaderSub.get(c.fac) === sub) items.unshift(c.leaderItem);
    return items.length ? { ...c.set, items } : null;
  }).filter(Boolean) as Row[];

  // ---------------- Acciones de héroe "Ayudar al ejército" (Instrucción, Formación de asalto, Guardia mortífera...) ----------------
  // La habilidad desbloquea la acción (bonus "active"); la acción da efectos al ejército del héroe (resultados "generic_bonus_value")
  // y otras habilidades suben su valor (value_addition). El héroe elige una acción a la vez.
  const actEnable = group('effect_bonus_value_agent_action_record_junctions_tables', 'effect');
  const actBy = by('agent_actions_tables', 'unique_id');
  const outByRes = group('action_results_additional_outcomes_tables', 'action_result_key');
  const outBuff = T['effect_bonus_value_id_action_results_additional_outcomes_junctions_tables'].filter((r) => /value_addition/.test(r.bonus_value_id));
  const buffOut = new Map(outBuff.map((r) => [r.effect as string, r.action_results_additional_outcome_record as string]));
  const heroActions: Record<string, Row> = {};
  const actionOfEffect = new Map<string, string>();
  for (const [eff, rows] of actEnable) for (const r of rows) {
    if (r.bonus_value_id !== 'active') continue;
    const a = actBy.get(r.agent_action_record);
    if (!a || a.ability !== 'assist_army') continue;
    actionOfEffect.set(eff, a.unique_id);
    if (heroActions[a.unique_id]) { heroActions[a.unique_id].en.push(eff); continue; }
    const outs = (outByRes.get(a.cannot_fail) ?? outByRes.get(a.success) ?? []).filter((o) => o.outcome === 'generic_bonus_value' && o.effect_record);
    heroActions[a.unique_id] = strip({
      n: L(`agent_actions_localised_action_name_${a.unique_id}`) ?? (/\{\{tr:/.test(a.localised_action_name ?? '') ? null : a.localised_action_name) ?? pretty(String(a.unique_id).replace(/^.*agent_action_/, '')),
      img: iconBase(a.icon_path), en: [eff],
      out: outs.map((o) => strip({ k: o.key, v: o.value, d: effectText(o.effect_record, o.value, o.effect_scope_record) || undefined, e: o.effect_record, s: parts(o.effect_record, o.value, o.effect_scope_record) })),
    });
  }
  // Mejoras por nivel de habilidad: { habilidad, nivel, resultado, valor }
  for (const [sk, rows] of lvlEff) for (const r of rows) {
    const out = buffOut.get(r.effect_key);
    if (!out) continue;
    const act = Object.entries(heroActions).find(([, a]) => a.out.some((o: Row) => o.k === out));
    if (act) (act[1].buffs ??= []).push({ sk, lv: r.level, o: out, v: r.value });
  }
  const actionsOfNodes = (ns: Row[]) => [...new Set(ns.flatMap((n) => (lvlEff.get(n.s) ?? []).map((r) => actionOfEffect.get(r.effect_key)).filter(Boolean)))] as string[];

  const characters: Row[] = [];
  // Facciones con un árbol propio para cada personaje (sin contar navíos ni ejércitos)
  const ownSets = new Map<string, string[]>();
  for (const s of T['character_skill_node_sets_tables']) if (s.faction_key && !s.for_navy && !s.for_army && fac.has(s.faction_key)) (ownSets.get(s.agent_subtype_key) ?? ownSets.set(s.agent_subtype_key, []).get(s.agent_subtype_key)!).push(s.faction_key);
  for (const s of T['character_skill_node_sets_tables']) {
    if (s.for_navy || s.for_army || !ag.has(s.agent_subtype_key)) continue;
    const a = ag.get(s.agent_subtype_key)!;
    const unit: string | undefined = a.associated_unit_override;
    if (!unit) continue;
    if (questOnly.has(s.agent_subtype_key) && !realPerm.has(s.agent_subtype_key) && !leaderSc.has(s.agent_subtype_key) && !LEGENDARY_UNLOCKS[s.agent_subtype_key]) continue;
    // Facciones de campaña: las que lo pueden reclutar y las que lo llevan de líder; si no sale en campaña, las de batalla personalizada
    // Solo facciones jugables; si ninguna jugable lo permite se usan todas (algunos solo los da un script o un edificio)
    const perm = campScIE.get(s.agent_subtype_key)?.length ? campScIE : campSc;
    let scs = [...new Set([...(perm.get(s.agent_subtype_key) ?? []), ...(leaderSc.get(s.agent_subtype_key) ?? [])])].sort();
    if (CHAOS_DEVOTED.test(s.agent_subtype_key) && !scs.includes('wh_main_sc_chs_chaos')) scs = [...scs, 'wh_main_sc_chs_chaos'].sort();
    for (const src of ascendFrom.get(s.agent_subtype_key) ?? []) scs = [...new Set([...scs, ...((campScIE.get(src)?.length ? campScIE : campSc).get(src) ?? [])])].sort();
    // Retadores del Caos: solo los llevan las facciones de IA que retan a Norsca
    if (/^wh_dlc08_chs_challenger_/.test(s.agent_subtype_key)) scs = [];
    if (!scs.length) scs = unitSc.get(unit)?.length ? unitSc.get(unit)! : setPieceSc.get(unit) ?? [];
    if (s.subculture) scs = scs.includes(s.subculture) ? [s.subculture] : [s.subculture];
    if (s.faction_key && fac.has(s.faction_key)) scs = [fac.get(s.faction_key)!.subculture];
    // Héroes legendarios por misión o por script: solo en las facciones que dice el juego
    let only: string[] | null = null;
    if (s.agent_key !== 'general') {
      const u = LEGENDARY_UNLOCKS[s.agent_subtype_key];
      const so = SCRIPT_ONLY.find(([re]) => re.test(s.agent_subtype_key));
      if (u) {
        const cults = new Set(u[0]);
        only = [...new Set([...u[1], ...[...ieFac].filter((f) => cults.has(String(scCulture.get(fac.get(f)?.subculture))))])]
          .filter((f) => fac.has(f) && (!ieFac.size || ieFac.has(f))).sort();
      } else if (so) only = so[1];
      if (only) scs = [...new Set(only.map((f) => fac.get(f)!.subculture as string))].sort();
    }
    // Personajes que el juego permite solo a algunas facciones jugables de su subcultura (Espectros de los Árboles y Hombres
    // Árbol Malévolos: solo Drycha; Tejehechizos: todos menos Drycha): solo esas facciones, más las que lo llevan de líder
    // Solo genéricos reclutables: a los legendarios se les puede tener por confederación
    if (a.auto_generate && !only && !s.faction_key && !CHAOS_DEVOTED.test(s.agent_subtype_key) && !ascendFrom.has(s.agent_subtype_key) && campFacIE.get(s.agent_subtype_key)?.size) {
      const pf = new Set(campFacIE.get(s.agent_subtype_key));
      for (const r of T['frontend_faction_leaders_tables']) if (r.agent_subtype_record === s.agent_subtype_key && ieFac.has(r.faction)) pf.add(r.faction);
      const partial = scs.some((sc) => { const all = ieBySc.get(sc); return all && [...all].some((f) => !pf.has(f)); });
      if (partial) only = [...pf].sort();
    }
    // Árbol propio de una facción (p. ej. los de afinidad de los Altos Elfos): solo en esa facción; en ella sustituye
    // al árbol genérico del mismo personaje
    if (s.faction_key && fac.has(s.faction_key) && !only) only = [s.faction_key];
    const notFactions = !s.faction_key ? (ownSets.get(s.agent_subtype_key) ?? []).filter((f) => f !== null) : [];
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
    // Las Doncellas y Brujas de Hielo no se generan solas (salen de la formación de la Corte de Hielo), pero son genéricas
    const legendary = !a.auto_generate && !/^wh3_dlc20_chs_daemon_prince_|^wh3_dlc29_episode_/.test(s.agent_subtype_key) && !trainedSubs.has(s.agent_subtype_key);
    let name = s.agent_subtype_key === 'wh3_main_dae_daemon_prince' ? 'Daniel, el Príncipe Demonio' : charName(s.agent_subtype_key, unit, legendary);
    if (s.faction_key) name += ` (${L(`factions_screen_name_${s.faction_key}`) ?? s.faction_key})`;
    characters.push(strip({
      key: s.key, subtype: s.agent_subtype_key, name, nameEn: a.key, unit,
      type: s.agent_key === 'general' ? 'lord' : 'hero', agent: s.agent_key, legendary,
      // Género (has_female_name) y grupo de nombres del juego: para nombrar a los genéricos en la crónica
      fem: a.has_female_name || undefined, ng: a.names_group || scNameGroup.get(homeSc(unit, scs) ?? '') || scNameGroup.get(scs[0]) || undefined,
      subcultures: scs, factions: only ?? undefined, nf: notFactions.length ? notFactions : undefined, home: homeSc(unit, scs), nodes: outNodes, bg, stats: charStats(unit), mounts: Object.keys(mounts).length ? mounts : null,
      items: legendary && itemsFor(s.agent_subtype_key).length ? itemsFor(s.agent_subtype_key) : null,
      armory: armoryFor(s.agent_subtype_key),
      bn: (() => {
        const l = bannersFor(s.agent_subtype_key, [...outNodes, ...bg].map((n) => n.s));
        l.forEach((x) => bannerDef(x.k));
        return l.length ? l : undefined;
      })(),
      acts: s.agent_key !== 'general' && actionsOfNodes([...outNodes, ...bg]).length ? actionsOfNodes([...outNodes, ...bg]) : null,
      spellSlots: spellSlotsFor([...outNodes, ...bg].map((n) => n.s)),
      initiatives: (() => {
        const all = [...(charInitBySub.get(s.agent_subtype_key) ?? []), ...courtsFor(s.agent_subtype_key, scs), ...patronageFor(s.agent_key, scs), ...gloryFor(scs), ...forceInitFor(s.agent_key, scs), ...forgeFor(scs), ...mechFor(s.agent_subtype_key, s.agent_key, scs)];
        return all.length ? all : null;
      })(),
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

  // ---------------- Mejoras de unidad (unit purchasable effects) ----------------
  const UPG_CAT_ES: Record<string, string> = {
    birch_aspect: 'Aspecto del Abedul', oak_aspect: 'Aspecto del Roble', willow_aspect: 'Aspecto del Sauce',
    weapon: 'Arma', armour: 'Armadura', mount: 'Montura', bag: 'Bolsa', flask: 'Frasco', arrow: 'Flechas',
    breed: 'Cría', gene: 'Gen', augment: 'Aumento', meta: 'Meta', Instability: 'Inestabilidad', offensive: 'Ofensiva', defensive: 'Defensiva', wild: 'Salvaje',
  };
  const upgBy = by('unit_purchasable_effects_tables', 'key');
  const upgBans = group('faction_banned_unit_purchasable_effects_tables', 'unit_purchasable_effect');
  const unitUpgrades: Record<string, Row[]> = {};
  for (const s of T['unit_purchasable_effect_sets_tables']) {
    const up = upgBy.get(s.purchasable_effect);
    if (!up) continue;
    const title = L(`unit_purchasable_effects_onscreen_name_${up.key}`) ?? L(`effect_bundles_localised_title_${up.effect_bundle}`) ?? up.key;
    // Las ocultas del Laboratorio de Moulder (descuentos, mantenimiento, inestabilidades sin texto) las pone el script, no se eligen
    if (title === up.key || /_hidden_/.test(up.key)) continue;
    (unitUpgrades[s.unit] ??= []).push(strip({
      k: up.key, cat: up.category, catN: L(`unit_purchasable_effects_categories_onscreen_name_${up.category}`) ?? UPG_CAT_ES[up.category] ?? up.category,
      n: title, x: s.is_exclusive || null, ban: (upgBans.get(up.key) ?? []).map((b) => b.faction) , e: effRows(bundleEff.get(up.effect_bundle) ?? [], 'effect_key'),
    }));
  }
  for (const list of Object.values(unitUpgrades)) for (const r of list) if (!r.ban.length) delete r.ban;

  // Habilidades propias de cada unidad (para explicar qué hacen en su ficha) y descripción de cada atributo
  const unitAbilities: Record<string, string[]> = {};
  for (const m of T['main_units_tables']) {
    const Lu = lu.get(m.land_unit);
    const ks = Lu ? (luAbil.get(Lu.key) ?? []).map((a) => a.ability as string).filter((k) => ua.has(k) && !ua.get(k)!.is_hidden_in_ui) : [];
    if (!ks.length) continue;
    ks.forEach(ability);
    unitAbilities[m.unit] = ks;
  }
  const attrDesc: Record<string, string> = {};
  for (const rows of attrGroups.values()) for (const r of rows) {
    const t = resolve(sp.get(`unit_attributes_bullet_text_${r.attribute}`) ?? '');
    const [n, ...d] = t.split('||');
    const desc = clean(d.join(' '));
    if (n?.trim() && desc) attrDesc[n.trim()] ??= desc;
  }

  const subs = [...new Set(characters.flatMap((c) => c.subcultures as string[]))].sort()
    .map((k) => ({ key: k, name: L(`cultures_subcultures_name_${k}`) ?? k }));

  // ---------------- Objetos de campaña que no son de un personaje ----------------
  // Botín al azar (wh3_campaign_magic_items.lua), seguidores (wh3_campaign_followers.lua) y únicos del mundo
  // (wh3_campaign_rare_items.lua, fusión). faction_set dice qué facciones los pueden tener.
  const fsRows = group('faction_set_items_tables', 'set');
  const factionSets: Record<string, Row> = {};
  const setDef = (k: string | null) => {
    if (!k || k === 'all' || factionSets[k] || !fsRows.has(k)) return;
    const rows = [...fsRows.get(k)!].sort((a, b) => a.id - b.id);
    const sc: string[] = [], f: string[] = [], fx: string[] = [];
    for (const { key } of subs) {
      let inn = false;
      for (const r of rows) {
        if (r.faction) continue;
        if ((!r.culture && !r.subculture) || r.subculture === key || (r.culture && r.culture === scCulture.get(key))) inn = !r.remove;
      }
      if (inn) sc.push(key);
    }
    for (const r of rows) if (r.faction) (r.remove ? fx : f).push(r.faction);
    factionSets[k] = strip({ sc, f: f.length ? f : undefined, fx: fx.length ? fx : undefined });
  };
  const loot: Row[] = [];
  const lootBanners: Row[] = [];
  for (const a of T['ancillaries_tables']) {
    if (a.category === 'mount') continue;
    // Todos los demás (también los limitados a ciertos subtipos, con su lista "ag"); en el árbol no se repiten
    // los que ya son del personaje
    setDef(a.faction_set);
    const ag = (ancSubs.get(a.key) ?? []).map((x) => x.agent_subtype as string);
    const row = strip({ k: a.key, fs: a.faction_set && a.faction_set !== 'all' && fsRows.has(a.faction_set) ? a.faction_set : undefined, ag: ag.length ? ag : undefined });
    if (isBanner(a.key)) { bannerDef(a.key); lootBanners.push(row); continue; }
    ancDef(a.key); loot.push(row);
  }
  // Saberes de magia para el visor de hechizos: grupos de habilidades del juego (special_ability_groups) con hechizos.
  // Hay grupos por unidad con solo parte del saber (p. ej. el de los Espectros del Árbol); de cada nombre se queda el
  // grupo con más hechizos.
  const groupAb = group('special_ability_groups_to_unit_abilities_junctions_tables', 'special_ability_groups');
  const loreBy = new Map<string, Row>();
  for (const g of [...T['special_ability_groups_tables']].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (g.is_naval || /_upgraded$/.test(g.ability_group) || !/lore/.test(g.ability_group)) continue;
    const name = L(`special_ability_groups_name_${g.ability_group}`);
    if (!name) continue;
    const spells = (groupAb.get(g.ability_group) ?? []).map((r) => r.unit_special_abilities as string)
      .filter((k) => ua.has(k) && (usa.get(k)?.mana_cost ?? 0) > 0 && !/_upgraded$/.test(k) && !ua.get(k)!.is_hidden_in_ui);
    // Los grupos compuestos son saberes de un personaje concreto; los que juntan decenas de hechizos (Escribas Azules,
    // Kairos, "Otros hechizos") no son un saber
    if (!spells.length || (g.is_composite_group && spells.length > 12) || !g.show_lore_icon) continue;
    const id = name.toLowerCase();
    const prev = loreBy.get(id);
    // El saber general gana al de un personaje con el mismo nombre; entre iguales, el de más hechizos
    if (prev && (prev.main ? g.is_composite_group || prev.spells.length >= spells.length : g.is_composite_group && prev.spells.length >= spells.length)) continue;
    loreBy.set(id, { k: g.ability_group, n: name, img: iconBase(g.icon_path), c: [g.colour_r, g.colour_g, g.colour_b], main: !g.is_composite_group || undefined, spells });
  }
  const lores = [...loreBy.values()].sort((a, b) => a.n.localeCompare(b.n, 'es'));
  for (const l of lores) for (const k of l.spells) ability(k);
  // Solo las acciones que tiene algún personaje
  const usedActs = new Set(characters.flatMap((c) => (c.acts ?? []) as string[]));
  for (const k of Object.keys(heroActions)) if (!usedActs.has(k)) delete heroActions[k];
  return {
    unitUpgrades, unitAbilities, attrDesc, heroActions,
    source: 'db.pack + local_sp.pack de tu instalación (Total War: WARHAMMER III)', format: 2,
    subcultures: subs, characters, skills: skillsOut, names: namesOut, abilities, unitLists, locks, techTrees, techs, ancillaries, banners, itemSets, graphs, loot, lootBanners, factionSets, lores,
    // Solo las restricciones que usan las habilidades extraídas
    targetFlags: Object.fromEntries(Object.entries(targetFlags).filter(([k]) => Object.values(abilities).some((a) => a.inv?.includes(k)))),
  };
}
