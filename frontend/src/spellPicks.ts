/**
 * Hechizos que los foros recomiendan maximizar en campaña (Steam y Reddit, WH3). Clave = clave del hechizo en el juego;
 * también marca su versión mejorada. Es opinión de jugadores, no un dato del juego: depende del ejército y del rival.
 *
 * Fuentes:
 * - https://steamcommunity.com/app/1142710/discussions/0/4357872738332885393
 * - https://steamcommunity.com/app/1142710/discussions/0/4416424597685582384
 * - https://steamcommunity.com/app/1142710/discussions/0/6760518612032884035
 * - https://steamcommunity.com/app/1142710/discussions/0/3842178984955624307
 * - https://www.reddit.com/r/totalwar/comments/1jyajxr/best_spells_to_prioritize_as_kairos
 * - https://www.reddit.com/r/totalwar/comments/1dyjrhx/lore_of_death/
 * - https://gamersdecide.com/articles/total-war-warhammer-3-best-lores-of-magic
 */
export const SPELL_PICKS: Record<string, string> = {
  // Fuego
  wh_main_spell_fire_fireball: 'Barato, de largo alcance y preciso; sirve para bajar artillería.',
  wh_main_spell_fire_flaming_sword_of_rhuin: 'Bufo en área: más daño y ataques flamígeros. En tiradores o cohetes ahorra munición.',
  wh_main_spell_fire_the_burning_head: 'Barre infantería sin armadura y líneas de arqueros; muy bueno en asedios. Flojo contra armadura.',
  wh_main_spell_fire_piercing_bolts_of_burning: 'Daño perforante fiable contra monstruos y unidades blindadas.',
  // Cielos
  wh_main_spell_heavens_chain_lightning: 'Barato para su daño perforante; caza equipos de armas y artillería.',
  wh_main_spell_heavens_comet_of_casandora: 'Mucho daño en área sin movimiento al azar; borra bloques de infantería.',
  wh_main_spell_heavens_wind_blast: 'Muy bueno contra infantería sin armadura.',
  wh_main_spell_heavens_urannons_thunderbolt: 'Bueno desde el inicio, sobre todo contra unidades trabadas.',
  // Bestias
  wh_dlc03_spell_beasts_flock_of_doom: 'Lo mejor del saber de las Bestias; mucho daño, sobre todo en asedios.',
  // Vida
  wh_dlc05_spell_life_the_dwellers_below: 'Considerado el mejor daño en área: radio grande, sin movimiento al azar y mucho perforante.',
  wh_dlc05_spell_life_earth_blood: 'Curación barata que mantiene la línea desde el inicio.',
  wh_dlc05_spell_life_regrowth: 'Curación fuerte para la parte avanzada de la campaña.',
  // Muerte
  wh_main_spell_death_spirit_leech: 'Barato y sin fallo contra personajes y monstruos de una sola entidad.',
  wh_main_spell_death_the_fate_of_bjuna: 'Borra unidades de élite sin daño a los tuyos; caro en campaña.',
  wh_main_spell_death_the_purple_sun_of_xereus: 'Borra bloques de infantería, sobre todo en asedios; se mueve al azar.',
  // Luz
  wh_main_spell_light_net_of_amyntok: 'Inmoviliza varias unidades frente a tus tiradores.',
  wh_main_spell_light_banishment: 'Buen daño, más aún contra demonios y no muertos.',
  // Metal
  wh_main_spell_metal_final_transmutation: 'Contra unidades grandes y blindadas (Hombres Lagarto, monstruos).',
  // Sombras
  wh_dlc05_spell_shadow_pit_of_shades: 'Daño fuerte en área, bueno contra armadura.',
  // Hielo
  wh3_main_spell_ice_heart_of_winter: 'Mucho daño a varias unidades, sobre todo potenciado.',
  // Tzeentch
  wh3_main_spell_tzeentch_pink_fire_of_tzeentch: 'Barato y de espera corta; muy efectivo.',
  wh3_main_spell_tzeentch_infernal_gateway: 'Vórtice que casi gana solo los asedios.',
  // Skaven
  wh2_main_spell_plague_plague: 'De los hechizos en área más fuertes del juego.',
  wh2_main_spell_ruin_warp_lightning: 'Barato y con mucho daño.',
  // Yang
  wh3_main_spell_yang_might_of_heaven_and_earth: '+24 de daño, perforante y ataque melee a una unidad.',
  // Hashut
  wh3_dlc23_spell_hashut_ash_storm: 'Los enemigos reciben 20% más daño de fuego; combina con el resto del saber.',
};

/** Recomendación de un hechizo (o de su versión mejorada / de la rama) */
export function spellPick(abilityKey: string): string | undefined {
  if (SPELL_PICKS[abilityKey]) return SPELL_PICKS[abilityKey];
  const base = abilityKey.replace(/_(upgraded|branchwraith|\d)$/, '');
  return SPELL_PICKS[base];
}
