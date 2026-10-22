/**
 * Traducción al español de los textos del juego.
 *
 * Dos capas:
 *  1) Textos OFICIALES si existen en backend/data/loc-es/ (export TSV de RPFM de los .loc en español).
 *     Ahí salen los nombres oficiales de habilidades, unidades, hechizos y las plantillas de efectos.
 *  2) Si no hay texto oficial: glosario propio de frases repetidas + reglas por patrón.
 *     Los nombres propios (habilidades, unidades, hechizos) se dejan como vienen del juego.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ======================================================================
// 1) Textos oficiales (RPFM -> TSV)
// ======================================================================
const officialLoc = new Map<string, string>();

function cleanLoc(t: string): string {
  return t
    .replace(/\[\[\/?[^\]]*\]\]/g, '') // etiquetas [[col:..]] [[img:..]]
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(dir: string, out: string[]) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsv|txt)$/i.test(f)) out.push(p);
  }
}

/** Carga todos los .tsv de backend/data/loc-es (formato RPFM: key \t text \t tooltip). */
export function loadOfficialLoc(dataDir: string): number {
  const dir = join(dataDir, 'loc-es');
  if (!existsSync(dir)) return 0;
  const files: string[] = [];
  walk(dir, files);
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const [key, text] = line.split('\t');
      if (!key || text === undefined || key === 'key') continue;
      officialLoc.set(key.trim(), cleanLoc(text));
    }
  }
  return officialLoc.size;
}

export function official(key: string): string | undefined {
  const v = officialLoc.get(key);
  return v ? v : undefined;
}

export const officialCount = () => officialLoc.size;

/** Nombre oficial de una habilidad del árbol (character_skills). */
export const officialSkillName = (skillKey: string) => official(`character_skills_localised_name_${skillKey}`);
export const officialSkillDesc = (skillKey: string) => official(`character_skills_localised_description_${skillKey}`);
export const officialAbilityName = (abilityKey: string) => official(`unit_abilities_onscreen_name_${abilityKey}`);
export const officialCharacterName = (nodeSetKey: string) => official(`planner_character_name_${nodeSetKey}`);
export const officialUnitName = (unitKey: string) =>
  official(`land_units_onscreen_name_${unitKey}`) ?? official(`main_units_onscreen_name_${unitKey}`);

// ======================================================================
// 2) Glosario propio
// ======================================================================

/** Etiqueta del efecto (lo que va antes de ":") */
export const LABELS: Record<string, string> = {
  'Melee defence': 'Defensa cuerpo a cuerpo',
  'Melee attack': 'Ataque cuerpo a cuerpo',
  'Cooldown': 'Recarga',
  'Winds of Magic cost': 'Coste de Vientos de la Magia',
  'Weapon strength': 'Fuerza de arma',
  'Armour': 'Armadura',
  'Charge bonus': 'Bonificación de carga',
  'Miscast base chance': 'Probabilidad base de fallo de hechizo',
  'Control': 'Control',
  'Leadership': 'Liderazgo',
  'Missile resistance': 'Resistencia a proyectiles',
  'Speed': 'Velocidad',
  'Character experience gain': 'Experiencia del personaje',
  'Casualty replenishment rate': 'Ritmo de reposición de bajas',
  'Ambush defence chance': 'Probabilidad de defensa ante emboscadas',
  'Hit points': 'Salud',
  'Missile strength': 'Fuerza de proyectiles',
  'Income from post-battle loot': 'Ingresos por botín tras la batalla',
  'Hero action cost': 'Coste de acciones de héroe',
  'Hero action success chance': 'Probabilidad de éxito de acciones de héroe',
  'Vigour loss reduction': 'Reducción de pérdida de vigor',
  'Ammunition': 'Munición',
  'Recruitment cost': 'Coste de reclutamiento',
  'Undivided Authority': 'Autoridad Indivisa',
  'Attrition': 'Desgaste',
  'Tzeentch Authority': 'Autoridad de Tzeentch',
  'Nurgle Authority': 'Autoridad de Nurgle',
  'Khorne Authority': 'Autoridad de Khorne',
  'Slaanesh Authority': 'Autoridad de Slaanesh',
  'All Authority': 'Toda la Autoridad',
  'Regiments of Renown army capacity': 'Capacidad de Regimientos de Renombre en el ejército',
  'Income from raiding': 'Ingresos por saqueo de territorio',
  'Attrition suffered by defender': 'Desgaste sufrido por el defensor',
  'Enemy battle reinforcement time': 'Tiempo de refuerzos enemigos en batalla',
  'Battle reinforcement time': 'Tiempo de refuerzos en batalla',
  'Post battle chance of stealing a magic item': 'Probabilidad de robar un objeto mágico tras la batalla',
  'Souls gained from battles': 'Almas obtenidas en batallas',
  'Leadership aura size': 'Tamaño del aura de liderazgo',
  'Income from sacking settlements': 'Ingresos por saquear asentamientos',
  'Increased experience gain': 'Ganancia de experiencia',
  'Chance of intercepting an army using Tunnelling, beast-paths or Worldroots': 'Probabilidad de interceptar ejércitos que usan túneles, sendas de bestias o Raíces del Mundo',
  'Campaign movement range': 'Alcance de movimiento en campaña',
  'Physical resistance': 'Resistencia física',
  'Winds of Magic power reserve capacity': 'Capacidad de reserva de Vientos de la Magia',
  'Winds of Magic power reserve': 'Reserva de Vientos de la Magia',
  'Unit experience gain per turn': 'Experiencia de unidades por turno',
  'Spell resistance': 'Resistencia a hechizos',
  'Unit Upgrades cost': 'Coste de mejoras de unidades',
  'Upkeep': 'Mantenimiento',
  'Campaign line of sight': 'Línea de visión en campaña',
  'Path to Glory': 'Senda de la Gloria',
  'Unit mass': 'Masa de la unidad',
  "Character's aura leadership effect": 'Efecto de liderazgo del aura del personaje',
  'Nurgle corruption': 'Corrupción de Nurgle',
  'Khorne corruption': 'Corrupción de Khorne',
  'Slaanesh corruption': 'Corrupción de Slaanesh',
  'Tzeentch corruption': 'Corrupción de Tzeentch',
  'Chaos Undivided corruption': 'Corrupción del Caos Indiviso',
  'Nurgle corruption in adjacent provinces': 'Corrupción de Nurgle en provincias adyacentes',
  'Armour-piercing weapon damage': 'Daño perforante de arma',
  'Wound recovery time': 'Tiempo de recuperación de heridas',
  'Ward save': 'Salvación especial',
  'Reload time reduction': 'Reducción del tiempo de recarga',
  'Missile block chance': 'Probabilidad de bloquear proyectiles',
  'Fire resistance': 'Resistencia al fuego',
  'Daemons Reforged': 'Demonios reformados',
  'Enemy Hero action success chance': 'Probabilidad de éxito de acciones de héroes enemigos',
  'Unit experience gain': 'Experiencia de unidades',
  'Experience gain': 'Ganancia de experiencia',
  'Growth': 'Crecimiento',
  'Bonus vs Infantry': 'Bonificación contra infantería',
  'Bonus vs Large': 'Bonificación contra grandes',
  'Enemy leadership': 'Liderazgo enemigo',
  'Diplomatic relations': 'Relaciones diplomáticas',
  'Recruit rank': 'Rango de reclutamiento',
  'Hero recruit rank': 'Rango de reclutamiento de héroes',
  'Lord recruit rank': 'Rango de reclutamiento de señores',
  'Targeting range': 'Alcance de objetivo',
  'Battle healing cap': 'Límite de curación en batalla',
  'Income from all buildings': 'Ingresos de todos los edificios',
  'Damage Walls action': 'Acción Dañar murallas',
  'Effect range': 'Alcance del efecto',
  'Effect duration': 'Duración del efecto',
  'Barrier hit points': 'Salud de barrera',
  'Barrier': 'Barrera',
  'Barrier replenishment rate': 'Ritmo de recarga de barrera',
  'Barrier replenishment delay': 'Retraso de recarga de barrera',
  'Ambush success chance': 'Probabilidad de éxito de emboscada',
  'Hero self-defence': 'Autodefensa del héroe',
  'Chance of a plague spreading': 'Probabilidad de propagar una plaga',
  'Ability number of uses': 'Número de usos de la habilidad',
  'Plague duration': 'Duración de la plaga',
  'Income from razing settlements': 'Ingresos por arrasar asentamientos',
  'Income from sacking and looting settlements': 'Ingresos por saquear y despojar asentamientos',
  'Spell intensity': 'Intensidad de hechizos',
  'Magic item drop chance from battle': 'Probabilidad de obtener objetos mágicos en batalla',
  'Range': 'Alcance',
  'Chance of Winds of Magic changing in strength': 'Probabilidad de que cambie la fuerza de los Vientos de la Magia',
  'Chance of Winds of Magic increasing in strength when changing': 'Probabilidad de que aumenten los Vientos de la Magia al cambiar',
  'Enemy Winds of Magic power reserve capacity': 'Capacidad de reserva de Vientos de la Magia enemiga',
  'Casualties captured post-battle': 'Bajas capturadas tras la batalla',
  'Infection cost to create a Plague': 'Coste de infección para crear una plaga',
  'Incoming Healing Modifier': 'Modificador de curación recibida',
  'Warband upgrade cost': 'Coste de mejora de banda de guerra',
  'Hero capacity': 'Capacidad de héroes',
  'Construction cost': 'Coste de construcción',
  'Allegiance points gained': 'Puntos de lealtad obtenidos',
  'Seduce Units cost': 'Coste de seducir unidades',
  'Seduce Units budget': 'Presupuesto para seducir unidades',
  'Souls cost': 'Coste en almas',
  'Tribute from vassals': 'Tributo de vasallos',
  'Research rate': 'Ritmo de investigación',
  'Changing of the Ways cost': 'Coste del Cambio de los Caminos',
  'Request army cost': 'Coste de solicitar ejército',
  'Souls gained from own casualties': 'Almas obtenidas de bajas propias',
  'Teleport stance usage cost': 'Coste de usar la postura de teletransporte',
  'Raiding stance usage cost': 'Coste de usar la postura de saqueo',
  'Recruitment health': 'Salud al reclutar',
  'Skulls gained from kills': 'Cráneos obtenidos por muertes',
  'Allied recruitment cost': 'Coste de reclutamiento aliado',
  'Explosive missile damage': 'Daño explosivo de proyectiles',
};

/** Alcance entre paréntesis al final del efecto */
export const SCOPES: Record<string, string> = {
  "Lord's army": 'ejército del señor',
  'own army': 'ejército propio',
  "Hero's army": 'ejército del héroe',
  'local province': 'provincia local',
  'local enemy province': 'provincia enemiga local',
  'local region': 'región local',
  "Heroes in Lord's army": 'héroes en el ejército del señor',
  'all units in army': 'todas las unidades del ejército',
  'enemy armies in local province': 'ejércitos enemigos en la provincia local',
  'all armies factionwide': 'todos los ejércitos de la facción',
  'accompanying Lord': 'señor al que acompaña',
  'armies in province': 'ejércitos en la provincia',
  'factionwide': 'toda la facción',
  'all characters': 'todos los personajes',
  'all Heroes': 'todos los héroes',
  'armies in local owned region': 'ejércitos en región propia local',
  'If Spellcaster': 'si es hechicero',
  'when not embedded': 'cuando no está integrado en un ejército',
  'all armies': 'todos los ejércitos',
  'all provinces': 'todas las provincias',
  'enemy characters in province': 'personajes enemigos en la provincia',
  'armies in region regardless of ownership': 'ejércitos en la región, sea de quien sea',
  'enemy armies in local region': 'ejércitos enemigos en la región local',
  'armies in local province': 'ejércitos en la provincia local',
  'reduced Speed and Melee Defence': 'reduce velocidad y defensa cuerpo a cuerpo',
  'enemy armies in region': 'ejércitos enemigos en la región',
  'factionwide when on map': 'toda la facción mientras esté en el mapa',
  'reduced Speed and acceleration': 'reduce velocidad y aceleración',
  'local province regardless of ownership': 'provincia local, sea de quien sea',
  'Lord': 'señor',
  'afflicted units lose morale and charge defence capability': 'las unidades afectadas pierden moral y defensa contra cargas',
  'projectiles will cause explosive damage': 'los proyectiles causan daño explosivo',
  'Rank 7 and above': 'rango 7 o más',
};

/** Categorías de unidades (en frases "for all ... units") */
const UNIT_CATS: [RegExp, string][] = [
  [/^non-Daemonic war beasts, monstrous,? and monster$/i, 'las bestias de guerra, unidades monstruosas y monstruos no demoníacos'],
  [/^war beasts, monstrous,? and monster$/i, 'las bestias de guerra, unidades monstruosas y monstruos'],
  [/^non-Daemonic Missile Cavalry and Artillery$/i, 'la caballería de proyectiles y la artillería no demoníacas'],
  [/^non-Daemonic Cavalry and Chariot$/i, 'la caballería y los carros no demoníacos'],
  [/^non-Daemonic Infantry$/i, 'la infantería no demoníaca'],
  [/^Daemonic Missile and Flying$/i, 'los demonios de proyectiles y voladores'],
  [/^Daemonic melee$/i, 'los demonios cuerpo a cuerpo'],
  [/^Daemonic Flying$/i, 'los demonios voladores'],
  [/^Daemonic Missile$/i, 'los demonios de proyectiles'],
  [/^Cavalry, Chariot and Flying$/i, 'la caballería, los carros y los voladores'],
  [/^Cavalry and Chariot$/i, 'la caballería y los carros'],
  [/^Chaos Monstrous Infantry and Monster$/i, 'la infantería monstruosa y los monstruos del Caos'],
  [/^Infantry$/i, 'la infantería'],
  [/^Missile$/i, 'las unidades de proyectiles'],
  [/^non-Daemonic$/i, 'las unidades no demoníacas'],
  [/^Daemonic$/i, 'las unidades demoníacas'],
  [/^Daemon$/i, 'las unidades demoníacas'],
  [/^flying$/i, 'los voladores'],
  [/^war beast$/i, 'las bestias de guerra'],
  [/^Undivided$/i, 'las unidades indivisas'],
  [/^(Khorne|Nurgle|Slaanesh|Tzeentch) Daemon$/i, 'los demonios de $1'],
  [/^(Khorne|Nurgle|Slaanesh|Tzeentch)$/i, 'las unidades de $1'],
];

const FACTIONS_ES: Record<string, string> = {
  'Undead factions': 'facciones no muertas',
  'Slaaneshi factions': 'facciones de Slaanesh',
  'Tzeentchian factions': 'facciones de Tzeentch',
  'Khornate factions': 'facciones de Khorne',
  'Slaanesh': 'Slaanesh',
  'Humans': 'humanos',
  'High Elves': 'Altos Elfos',
  'the Forces of Order': 'las Fuerzas del Orden',
  'Empire': 'el Imperio',
  'Bretonnia': 'Bretonia',
  'Kislev': 'Kislev',
  'Cathay': 'Catai',
  'Dwarfs': 'los Enanos',
};

function unitScope(raw: string): string {
  const s = raw.trim();
  for (const [re, es] of UNIT_CATS) if (re.test(s)) return s.replace(re, es);
  // nombres concretos de unidades: se quedan como en el juego
  return s.replace(/,? and /g, ' y ').replace(/ & /g, ' y ');
}

/** Traduce lo que viene después del valor: "for all non-Daemonic Infantry units (Rank 7 and above)" */
export function translateTail(tail: string): string {
  let t = tail.trim();
  if (!t) return '';
  let rank7 = '';
  if (/\(Rank 7 and above\)/i.test(t)) {
    rank7 = ' (rango 7 o más)';
    t = t.replace(/\s*\(Rank 7 and above\)/i, '').trim();
  }
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^for all units$/i, () => 'para todas las unidades'],
    [/^for units when fighting against (.+)$/i, (m) => `para las unidades al luchar contra ${FACTIONS_ES[m[1]] ?? m[1]}`],
    [/^for all (.+?) units?$/i, (m) => `para ${unitScope(m[1])}`],
    [/^for (.+?) units?$/i, (m) => `para ${unitScope(m[1])}`],
    [/^for this unit$/i, () => 'para esta unidad'],
    [/^for this Lord$/i, () => 'para este señor'],
    [/^for all enemy spellcasters$/i, () => 'para todos los hechiceros enemigos'],
    [/^for embedded Heroes$/i, () => 'para héroes integrados'],
    [/^for Chaos Sorcerers$/i, () => 'para los Hechiceros del Caos'],
    [/^for Exalted Heroes$/i, () => 'para los Héroes Exaltados'],
    [/^for Undivided Lords and Heroes$/i, () => 'para señores y héroes indivisos'],
    [/^for all buildings$/i, () => 'para todos los edificios'],
    [/^(?:to|for) (?:all )?spells$/i, () => 'para todos los hechizos'],
    [/^to enemy spells$/i, () => 'para hechizos enemigos'],
    [/^(?:to|for) Lore of (.+) spells$/i, (m) => `para los hechizos del Saber de ${m[1]}`],
    [/^(?:to|for) "(.+)" Upgraded$/i, (m) => `para "${m[1]}" potenciado`],
    [/^for "(.+) Upgraded"$/i, (m) => `para "${m[1]}" (potenciado)`],
    [/^(?:to|for) (".+")(.*)$/i, (m) => `para ${m[1]}${m[2].replace(/ and /, ' y ')}`],
    [/^when fighting against (.+)$/i, (m) => `al luchar contra ${FACTIONS_ES[m[1]] ?? m[1]}`],
    [/^when fighting at sea$/i, () => 'al luchar en el mar'],
    [/^when attacking at sea$/i, () => 'al atacar en el mar'],
    [/^when attacking$/i, () => 'al atacar'],
    [/^when laying siege or encircling$/i, () => 'al asediar o rodear'],
    [/^during siege battles$/i, () => 'en batallas de asedio'],
    [/^with (.+)$/i, (m) => `con ${m[1].replace(/ and /g, ' y ')}`],
    [/^per turn$/i, () => 'por turno'],
    [/^turns?$/i, () => 'turnos'],
    [/^casualties suffered from all attrition$/i, () => 'bajas sufridas por todo desgaste'],
    [/^Souls cost to devote to (\w+)$/i, (m) => `coste en almas para consagrar a ${m[1]}`],
    [/^Souls cost to upgrade characters to a Daemon Prince of (\w+)$/i, (m) => `coste en almas para ascender personajes a Príncipe Demonio de ${m[1]}`],
    [/^chance for destroyed (.+?) (?:units )?to be restored after battle$/i, (m) => `probabilidad de que ${m[1]} destruidos se restauren tras la batalla`],
    [/^hit points for destroyed (.+?) (?:units )?restored after battle$/i, (m) => `salud restaurada a ${m[1]} destruidos tras la batalla`],
    [/^chance of wounding aggressors$/i, () => 'probabilidad de herir a los agresores'],
    [/^additional wall breaches$/i, () => 'brechas adicionales en la muralla'],
    [/^in friendly, neutral and enemy territory$/i, () => 'en territorio amigo, neutral y enemigo'],
    [/^Winds of Magic$/i, () => 'Vientos de la Magia'],
    [/^for alliances and vassalage with (.+)$/i, (m) => `para alianzas y vasallaje con ${m[1]}`],
    [/^for (.+)$/i, (m) => `para ${unitScope(m[1])}`],
  ];
  for (const [re, fn] of rules) {
    const m = t.match(re);
    if (m) return fn(m) + rank7;
  }
  return t + rank7;
}

const ACTIONS_ES: Record<string, string> = {
  'Assassinate': 'Asesinar',
  'Training': 'Entrenar',
  'Assault Units': 'Atacar unidades',
  'Spread Control': 'Extender control',
  'Assault Garrison': 'Atacar guarnición',
  'Wound': 'Herir',
  'Steal Technology': 'Robar tecnología',
  'Scouting': 'Explorar',
  'Block Army': 'Bloquear ejército',
  'Replenish Troops': 'Reponer tropas',
  'Spread Corruption': 'Extender corrupción',
  'Increase Mobility': 'Aumentar movilidad',
  'Stimulate Growth': 'Estimular crecimiento',
  'Hinder Replenishment': 'Dificultar reposición',
  'Siphon Winds': 'Absorber Vientos',
  'Funnel Magic': 'Canalizar magia',
  'Damage Building': 'Dañar edificio',
  'Boost Income': 'Aumentar ingresos',
};

const ACTION_PARTS: [RegExp, string][] = [
  [/^Additional ([\d.]+)% success chance$/i, '+$1% de probabilidad de éxito'],
  [/^Additional ([\d.]+)% casualties inflicted$/i, '+$1% de bajas causadas'],
  [/^Additional ([\d.]+)% chance of wounding target$/i, '+$1% de probabilidad de herir al objetivo'],
  [/^Additional ([\d.]+)% damage caused$/i, '+$1% de daño causado'],
  [/^Unit experience gain is increased by an additional ([\d.]+)%$/i, 'experiencia de unidades +$1% adicional'],
  [/^Control is modified by an additional ([+-]?[\d.]+)$/i, 'control modificado en $1 adicional'],
  [/^Research rate is increased by an additional ([\d.]+)$/i, 'ritmo de investigación +$1 adicional'],
  [/^Magic item drop chance is increased by an additional ([\d.]+)%$/i, 'probabilidad de objeto mágico +$1% adicional'],
  [/^Movement range is modified by an additional (-?[\d.]+)%$/i, 'alcance de movimiento $1% adicional'],
  [/^Movement range is increased by an additional ([\d.]+)%$/i, 'alcance de movimiento +$1% adicional'],
  [/^Replenishment rate is increased by an additional ([\d.]+)%$/i, 'ritmo de reposición +$1% adicional'],
  [/^Replenishment is modified by an additional (-?[\d.]+)%$/i, 'reposición $1% adicional'],
  [/^(\w+(?: \w+)?) corruption is increased by an additional ([\d.]+)$/i, 'corrupción de $1 +$2 adicional'],
  [/^Growth is modified by an additional ([+-]?[\d.]+)$/i, 'crecimiento $1 adicional'],
  [/^Winds of Magic power reserve is modified by an additional (-?[\d.]+)$/i, 'reserva de Vientos de la Magia $1 adicional'],
  [/^Winds of Magic power reserve is increased by an additional ([\d.]+)$/i, 'reserva de Vientos de la Magia +$1 adicional'],
  [/^Income is modified by an additional ([+-]?[\d.]+)%$/i, 'ingresos $1% adicional'],
];

/** Frases completas sin número (o con un número dentro) */
const SENTENCES: [RegExp, string][] = [
  [/^When normally killed in action, this Hero will be wounded instead$/i, 'Si muere en combate, este héroe queda herido en su lugar'],
  [/^This Lord will be wounded instead of killed in battle$/i, 'Este señor queda herido en lugar de morir en batalla'],
  [/^Character will share \+?([\d.]+)% of experience earned between all other active Lords$/i, 'El personaje reparte el $1% de su experiencia entre los demás señores activos'],
  [/^Character will share \+?([\d.]+)% of experience earned between all other active Heroes of the same type$/i, 'El personaje reparte el $1% de su experiencia entre los demás héroes activos del mismo tipo'],
  [/^Steal \+?([\d.]+)% of the experience earned by other Lords$/i, 'Roba el $1% de la experiencia que ganan otros señores'],
  [/^Reinforcements supporting this army can have their arrival point adjusted by \+?([\d.]+) metres without incurring any time penalty$/i, 'Los refuerzos de este ejército pueden mover su punto de llegada $1 m sin penalización de tiempo'],
  [/^Enables lightning strike battles when reinforcements are present$/i, 'Permite batallas de ataque relámpago aunque haya refuerzos'],
  [/^Enables flaming attacks$/i, 'Activa ataques flamígeros'],
  [/^Enables magical attacks$/i, 'Activa ataques mágicos'],
  [/^Enables sundering attacks$/i, 'Activa ataques destructores de armadura'],
  [/^Enables poison attacks$/i, 'Activa ataques envenenados'],
  [/^Enables Warpflame attacks$/i, 'Activa ataques de Llama de Disformidad'],
  [/^Enables "(.+)" contact effect.*$/i, 'Activa el efecto de contacto "$1"'],
  [/^Enables (?:Enriched )?Soporific Musk attacks$/i, 'Activa ataques de Almizcle Soporífero'],
  [/^Enables (?:Enriched )?Soporific Musk attacks for (.+?): (.+)$/i, 'Activa ataques de Almizcle Soporífero para $1: reduce ataque y defensa cuerpo a cuerpo al golpear'],
  [/^Attacks cause "(.+?)" effect,? ?(.*)$/i, 'Los ataques causan el efecto "$1" $2'],
  [/^Replenishes ([\d.]+)% campaign movement range after razing a settlement$/i, 'Recupera el $1% del movimiento de campaña tras arrasar un asentamiento'],
  [/^Replenishes ([\d.]+)% campaign movement range after enemy retreats from battle$/i, 'Recupera el $1% del movimiento de campaña si el enemigo se retira de la batalla'],
  [/^Replenishes ([\d.]+)% campaign movement range after winning a battle$/i, 'Recupera el $1% del movimiento de campaña tras ganar una batalla'],
  [/^Double experience gain for units when fighting against (.+)$/i, 'Experiencia doble para las unidades al luchar contra $1'],
  [/^Units gain \+?([\d.]+)% weapon and missile strength per rank achieved$/i, 'Las unidades ganan +$1% de fuerza de arma y de proyectiles por cada rango'],
  [/^This character can equip \+?(\d+) additional (.+)$/i, 'Este personaje puede equipar +$1 objeto(s) adicional(es): $2'],
  [/^Income from looting, sacking and razing settlements \+?([\d.]+)%$/i, 'Ingresos por saquear, despojar y arrasar asentamientos +$1%'],
  [/^Removes Raiding stance fatigue penalty$/i, 'Quita la penalización de fatiga de la postura de saqueo'],
  [/^Enables replenishment in foreign territory$/i, 'Permite reponer tropas en territorio extranjero'],
  [/^Enables Sea-to-Land movement without penalties$/i, 'Permite pasar del mar a tierra sin penalización'],
  [/^Immune to all sea based attrition$/i, 'Inmune a todo desgaste en el mar'],
  [/^Immune to Vampiric attrition$/i, 'Inmune al desgaste vampírico'],
  [/^All spells (?:from|of) the (.+?) are added to the Scrolls of Sorcery$/i, 'Todos los hechizos de "$1" se añaden a los Pergaminos de Hechicería'],
  [/^Each turn, the army will have access to a randomly chosen Cataclysm Spell$/i, 'Cada turno el ejército tiene acceso a un hechizo de Cataclismo al azar'],
  [/^Every (\d+) turns, adds a unit a Nurglings to your gifted units recruitment pool$/i, 'Cada $1 turnos añade una unidad de Nurglings a tu reserva de unidades regaladas'],
  [/^Adds Blue-flame explosions to the Blue Scribe's attacks$/i, 'Añade explosiones de llama azul a los ataques de los Escribas Azules'],
];

const PREFIXES: [RegExp, string][] = [
  [/^Passive ability: (.+)$/i, 'Habilidad pasiva: $1'],
  [/^Army ability: (.+)$/i, 'Habilidad de ejército: $1'],
  [/^Ability: (.+)$/i, 'Habilidad: $1'],
  [/^Overcast [Ss]pell: (.+)$/i, 'Hechizo potenciado: $1'],
  [/^Bound [Ss]pell: (.+)$/i, 'Hechizo vinculado: $1'],
  [/^Spell: (.+)$/i, 'Hechizo: $1'],
  [/^Mount: (.+)$/i, 'Montura: $1'],
  [/^Replaces: (.+)$/i, 'Reemplaza a: $1'],
  [/^Ability "(.+)"$/i, 'Habilidad: "$1"'],
];

/** Atributos de unidades y personajes */
export const ATTRIBUTES: Record<string, string> = {
  'Hide (forest)': 'Ocultarse (bosque)',
  'Daemonic': 'Demoníaco',
  'Causes Fear': 'Causa miedo',
  'Can Cause Fear': 'Causa miedo',
  'Causes Terror': 'Causa terror',
  'Can Cause Terror': 'Causa terror',
  'Wallbreaker': 'Rompemurallas',
  'Strider': 'Andarín',
  'Immune to Contact Effects': 'Inmune a efectos de contacto',
  'Fire Whilst Moving': 'Disparar en movimiento',
  'Unbreakable': 'Inquebrantable',
  'Encourage': 'Alentar',
  'Charge Reflection': 'Reflejo de carga',
  'Expert Charge Defence': 'Defensa experta contra cargas',
  'Immune to Psychology': 'Inmune a la psicología',
  'Immune to Flanking': 'Inmune a flanqueos',
  'Vanguard Deployment': 'Despliegue de vanguardia',
  'Can Fly': 'Puede volar',
  'Can fly': 'Puede volar',
  'Devastating Flanker': 'Flanqueador devastador',
  'Rampage': 'Desenfreno',
  'Rampage!': 'Desenfreno',
  'Underground': 'Subterráneo',
  'Stalk': 'Acechar',
  'Woodsman': 'Leñador',
  'Charge Defence vs. Large': 'Defensa contra cargas de grandes',
  '360 Missile Block': 'Bloqueo de proyectiles en 360°',
  'Ogre Charge': 'Carga de ogro',
  'Unyielding Assault': 'Asalto implacable',
  'Directional Shield': 'Escudo direccional',
  'Cannot Run': 'No puede correr',
  'Perfect Vigour': 'Vigor perfecto',
  'Randomises spells on cast': 'Hechizos aleatorios al lanzar',
  'Mark of Nurgle': 'Marca de Nurgle',
  'Mark of Tzeentch': 'Marca de Tzeentch',
  'Mark of Slaanesh': 'Marca de Slaanesh',
  'Mark of Khorne': 'Marca de Khorne',
  'Cannot Die': 'No puede morir',
  'Silenced': 'Silenciado',
  'Glorious Charge': 'Carga gloriosa',
  'Unspottable': 'Indetectable',
  'Snipe': 'Francotirador',
  'Reveals Unit': 'Revela la unidad',
  'Removes Immune to Psychology': 'Quita inmunidad a la psicología',
  'Removes Expert Charge Defence': 'Quita defensa experta contra cargas',
  'Removes Charge Defence vs. Large': 'Quita defensa contra cargas de grandes',
  'Removes Undead': 'Quita No muerto',
  'Ataques flamígeros': 'Ataques flamígeros',
  'Ataques mágicos': 'Ataques mágicos',
};

/** Stats dentro de las habilidades: "x1.3 Base Weapon Damage", "+24 Melee Defence" */
const ABILITY_STATS: Record<string, string> = {
  'Speed': 'Velocidad',
  'Base Weapon Damage': 'Daño base de arma',
  'Armour-Piercing Weapon Damage': 'Daño perforante de arma',
  'Melee Attack': 'Ataque cuerpo a cuerpo',
  'Charge Bonus': 'Bonificación de carga',
  'Charge Speed': 'Velocidad de carga',
  'Weakness to Fire Damage': 'Debilidad al fuego',
  'Base Missile Damage': 'Daño base de proyectil',
  'Melee Defence': 'Defensa cuerpo a cuerpo',
  'Leadership': 'Liderazgo',
  'Melee Damage Reflection': 'Reflejo de daño cuerpo a cuerpo',
  'Damage Resistance': 'Resistencia al daño',
  'Turn Speed': 'Velocidad de giro',
  'Armour': 'Armadura',
  'Missile Block Chance': 'Probabilidad de bloquear proyectiles',
  'Bonus vs. Large': 'Bonificación contra grandes',
  'Incoming Healing Modifier': 'Curación recibida',
  'Spell Mastery': 'Maestría de hechizos',
  'Miscast Chance': 'Probabilidad de fallo de hechizo',
  'Acceleration': 'Aceleración',
  'Deceleration': 'Deceleración',
  'Reload Skill': 'Habilidad de recarga',
  'Forest Spotting': 'Detección en bosques',
  'Physical Resistance': 'Resistencia física',
  'Mass': 'Masa',
  'Missile Resistance': 'Resistencia a proyectiles',
  'Accuracy': 'Precisión',
  'Armour-Piercing Missile Damage': 'Daño perforante de proyectil',
  'Range': 'Alcance',
  'Armour-Piercing Explosive Damage': 'Daño explosivo perforante',
  'Base Explosive Damage': 'Daño explosivo base',
};

export const ABILITY_TYPES: Record<string, string> = {
  'Hex': 'Maleficio',
  'Hex (Area)': 'Maleficio (área)',
  'Chain Hex': 'Maleficio en cadena',
  'Hex of the Winds': 'Maleficio de los Vientos',
  'Augment': 'Potenciador',
  'Augment (Area)': 'Potenciador (área)',
  'Chain Augment': 'Potenciador en cadena',
  'Augment of the Winds': 'Potenciador de los Vientos',
  'Direct Damage': 'Daño directo',
  'Direct Damage (Area)': 'Daño directo (área)',
  'Chain Direct Damage': 'Daño directo en cadena',
  'Bombardment': 'Bombardeo',
  'Ward Save': 'Salvación especial',
  'Ward Save (Area)': 'Salvación especial (área)',
  'Ward Save Hex (Area)': 'Maleficio de salvación (área)',
  'Wind': 'Viento',
  'Vortex': 'Vórtice',
  'Regeneration': 'Regeneración',
  'Regeneration (Area)': 'Regeneración (área)',
  'Breath': 'Aliento',
  'Magic Missiles': 'Proyectiles mágicos',
  'Magic Missile': 'Proyectil mágico',
  'Explosion': 'Explosión',
  'Summon Unit': 'Invocar unidad',
  'Hiding': 'Ocultación',
};

export const CASTES: Record<string, string> = {
  'Missile Infantry': 'Infantería de proyectiles',
  'Monster': 'Monstruo',
  'Melee Infantry': 'Infantería cuerpo a cuerpo',
  'Chariot': 'Carro',
  'Monstrous Infantry': 'Infantería monstruosa',
  'Missile Cavalry': 'Caballería de proyectiles',
  'Melee Cavalry': 'Caballería cuerpo a cuerpo',
  'Monstrous Cavalry': 'Caballería monstruosa',
  'War Beast': 'Bestia de guerra',
  'Generic': 'Genérico',
  'War Machine': 'Máquina de guerra',
  'Lord': 'Señor',
  'Hero': 'Héroe',
};

// ======================================================================
// Funciones públicas
// ======================================================================

export function translateAttribute(a: string): string {
  const t = a.trim().replace(/^➖\s*/, '');
  return ATTRIBUTES[t] ?? t;
}

export function translateAbilityStat(d: string): string {
  const m = d.trim().match(/^([x+-]?[\d.]+)\s+(.+?)\s*$/);
  if (!m) return d;
  const name = ABILITY_STATS[m[2]] ?? m[2];
  return `${m[1].replace(/^x/, '×')} ${name}`;
}

/**
 * Traduce un efecto completo. Si hay plantilla oficial (effects_description_<key>), la usa.
 * Formato del juego: "Etiqueta: +N[%] <a quién>\n\t(alcance)"
 */
/** Separa "nombre/frase" de la cola " for X units" / " when ..." / " during ..." (fuera de comillas). */
function splitTail(t: string): [string, string] {
  const m = t.match(/^((?:"[^"]*"|[^"])*?)\s+((?:for|when|during|with) .+)$/);
  return m ? [m[1], m[2]] : [t, ''];
}

export function translateEffect(effectKey: string, text: string): string {
  const [mainRaw, ...rest] = text.split('\n');
  const main = mainRaw.trim();
  const scopeM = rest.join(' ').match(/\(([^)]+)\)\s*$/);
  const scopeEs = scopeM ? ` (${SCOPES[scopeM[1].trim()] ?? scopeM[1].trim()})` : '';

  // 1) Plantilla oficial con el número del texto inglés
  const tpl = official(`effects_description_${effectKey}`);
  if (tpl) {
    const num = main.match(/([+-]?\d+(?:\.\d+)?)/);
    if (num) {
      const v = parseFloat(num[1]);
      const signed = v > 0 ? `+${num[1].replace(/^\+/, '')}` : num[1];
      return tpl.replace(/%\+n/g, signed).replace(/%n/g, num[1].replace(/^\+/, '')) + scopeEs;
    }
    if (!/%\+?n/.test(tpl)) return tpl + scopeEs;
  }

  // 2) Frases completas y prefijos (Hechizo:, Habilidad:, Atributo:...), con su cola traducida aparte
  for (const [re, es] of SENTENCES) if (re.test(main)) return main.replace(re, es) + scopeEs;
  {
    const [head, tail] = splitTail(main);
    const tailEs = tail ? ' ' + translateTail(tail) : '';
    for (const [re, es] of SENTENCES) if (re.test(head)) return head.replace(re, es) + tailEs + scopeEs;
    for (const [re, es] of PREFIXES) if (re.test(head)) return head.replace(re, es) + tailEs + scopeEs;
    const at = head.match(/^Attribute:\s*(.+)$/);
    if (at) return `Atributo: ${translateAttribute(at[1])}${tailEs}${scopeEs}`;
  }

  // 3) Acciones de héroe: "Assassinate action: Additional 15% success chance"
  const act = main.match(/^([A-Za-z ]+?) action: (.+)$/);
  if (act) {
    const name = ACTIONS_ES[act[1]] ?? act[1];
    let part = act[2];
    for (const [re, es] of ACTION_PARTS) if (re.test(part)) { part = part.replace(re, es); break; }
    return `Acción "${name}": ${part}${scopeEs}`;
  }

  // 4) "Etiqueta: valor resto"
  const m = main.match(/^([^:]+):\s*([+-]?\d+(?:\.\d+)?%?)\s*(.*)$/);
  if (m) {
    const label = LABELS[m[1].trim()] ?? m[1].trim();
    const tail = translateTail(m[3]);
    return `${label}: ${m[2]}${tail ? ' ' + tail : ''}${scopeEs}`;
  }
  // 5) "Etiqueta: texto" sin número
  const m2 = main.match(/^([^:]+):\s*(.+)$/);
  if (m2 && LABELS[m2[1].trim()]) return `${LABELS[m2[1].trim()]}: ${m2[2]}${scopeEs}`;
  if (m2 && m2[1].trim() === 'Attribute') return `Atributo: ${translateAttribute(m2[2].replace(/\s+for .*/, ''))}${m2[2].includes(' for ') ? ' ' + translateTail(m2[2].slice(m2[2].indexOf(' for ') + 1)) : ''}${scopeEs}`;

  return main + scopeEs;
}

/** Etiqueta corta (para el resumen): "Melee defence" -> "Defensa cuerpo a cuerpo" */
export function translateLabel(label: string): string {
  return LABELS[label] ?? label;
}
