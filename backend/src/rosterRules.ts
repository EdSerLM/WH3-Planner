/**
 * Reglas del roster de campaña que salen de las tablas del juego. Las usa el extractor (npm run extraer) y, mientras la
 * extracción no traiga el resultado, el backend con el volcado diag_roster_<subcultura>.json.
 */

export interface RosterTables {
  mercenary_unit_groups: { key: string; unit_record: string }[];
  mercenary_pool_to_groups_junctions: { group: string; faction_requirement?: string | null; subculture_requirement?: string | null }[];
  building_units_allowed: { building: string; unit: string }[];
}

/** Código de cultura de la subcultura (wh_main_sc_vmp_vampire_counts -> vmp), el que llevan sus claves de edificio */
export function cultureCode(subculture: string): string | undefined {
  const parts = subculture.split('_');
  const i = parts.indexOf('sc');
  return i >= 0 ? parts[i + 1] : undefined;
}

/**
 * Unidades del grupo militar que la reserva de la subcultura reserva a OTRA facción (p. ej. la Guardia de las Tumbas en
 * wh3_dlc29_vmp_additional_units con faction_requirement = Neferata). Devuelve unidad -> edificios de la cultura que
 * también la reclutan (claves); lista vacía = esa facción no la puede tener.
 * No cuenta: el juego no dice aquí qué cultura construye cada edificio (building_culture_variants sale vacío), así que
 * se toma por el código de cultura en la clave del edificio (wh3_main_vmp_...).
 */
export function lockedToOtherFaction(
  t: RosterTables, faction: string, subculture: string, factionsOfSub: Set<string>, units: Iterable<string>,
): Map<string, string[]> {
  const unitOfGroup = new Map(t.mercenary_unit_groups.map((g) => [g.key, g.unit_record]));
  const pools = new Map<string, RosterTables['mercenary_pool_to_groups_junctions']>();
  for (const r of t.mercenary_pool_to_groups_junctions) {
    const u = unitOfGroup.get(r.group);
    // Solo las filas que valen para esta subcultura: sin requisito, su subcultura o una de sus facciones
    const mine = r.faction_requirement ? factionsOfSub.has(r.faction_requirement) : !r.subculture_requirement || r.subculture_requirement === subculture;
    if (u && mine) pools.set(u, [...(pools.get(u) ?? []), r]);
  }
  const code = cultureCode(subculture);
  const out = new Map<string, string[]>();
  for (const u of units) {
    const rows = pools.get(u);
    if (!rows?.length || !rows.every((r) => r.faction_requirement && r.faction_requirement !== faction)) continue;
    const blds = code ? t.building_units_allowed.filter((b) => b.unit === u && b.building.includes(`_${code}_`)).map((b) => b.building) : [];
    out.set(u, [...new Set(blds)].sort());
  }
  return out;
}
