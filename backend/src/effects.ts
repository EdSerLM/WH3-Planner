import type { EffectKind, EffectTarget, ParsedEffect, StatKey } from './types.js';

/**
 * Convierte el texto de un efecto del juego (inglés) en algo calculable.
 * Ej.: "Melee attack: +8 for all non-Daemonic Infantry units\n\t(Lord's army)"
 *   -> { kind: 'battle', target: 'army', stat: 'ma', value: 8 }
 * La lista de unidades a las que aplica viene aparte (related_unit_cards del planner).
 */

// Etiqueta del juego -> stat calculable
const BATTLE_LABELS: Record<string, StatKey> = {
  'Melee attack': 'ma',
  'Melee defence': 'md',
  'Armour': 'armour',
  'Charge bonus': 'charge',
  'Leadership': 'ld',
  'Weapon strength': 'dmg', // % -> multiplica daño base y perforante
  'Armour-piercing weapon damage': 'ap',
  'Hit points': 'hp',
  'Speed': 'speed',
  'Bonus vs Infantry': 'bvi',
  'Bonus vs Large': 'bvl',
  'Physical resistance': 'resPhysical',
  'Missile resistance': 'resMissile',
  'Spell resistance': 'resMagic',
  'Fire resistance': 'resFlame',
  'Ward save': 'resWard',
  'Missile strength': 'missileDmg',
  'Ammunition': 'ammo',
  'Reload time reduction': 'reload',
  'Range': 'range',
  'Barrier hit points': 'barrier',
  'Barrier': 'barrier',
  'Missile block chance': 'shield',
};

const MAGIC_LABELS = [
  'Winds of Magic cost', 'Cooldown', 'Miscast base chance', 'Winds of Magic power reserve capacity',
  'Winds of Magic power reserve', 'Spell intensity', 'Ability number of uses', 'Effect range', 'Effect duration',
  'Chance of Winds of Magic changing in strength', 'Chance of Winds of Magic increasing in strength when changing',
  'Enemy Winds of Magic power reserve capacity', 'Targeting range',
];

const ABILITY_PREFIXES = ['Ability', 'Passive ability', 'Spell', 'Overcast spell', 'Overcast Spell', 'Army ability', 'Bound spell', 'Bound Spell', 'Replaces'];

// Alcances que significan "las tropas del ejército"
const ARMY_SCOPES = new Set(["Lord's army", "Hero's army", 'own army', 'all units in army']);

/**
 * ¿El texto del efecto nombra a qué unidades aplica? ("... for all Infantry units", "for Forsaken")
 * La lista de unidades del planner viene por NIVEL de habilidad, no por efecto: si un nivel mezcla un efecto
 * para ciertas unidades con otro para todo el ejército (p. ej. Vessel de Archaón: "+3% por rango a los RoR" y
 * "Resistencia física 5%"), la lista solo debe limitar al que nombra unidades.
 */
function namesUnits(main: string): boolean {
  const colon = main.indexOf(':');
  return /\sfor\s/.test(colon > 0 ? main.slice(colon + 1) : main);
}

export function parseEffect(key: string, text: string, unitCards?: string[]): ParsedEffect {
  const [mainRaw, ...rest] = text.split('\n');
  const main = mainRaw.trim();
  // Solo se usa la lista del nivel si este efecto nombra unidades; si no, aplica a todo el ejército
  if (unitCards && !namesUnits(main)) unitCards = undefined;
  const scopeMatch = rest.join(' ').match(/\(([^)]+)\)\s*$/);
  const scope = scopeMatch ? scopeMatch[1].trim() : '';
  const rank7 = /\(Rank 7 and above\)/i.test(main);

  const base: ParsedEffect = { key, text: text.replace(/\s+/g, ' ').trim(), kind: 'other', target: 'none', rank7: rank7 || undefined };

  // Montura
  if (/^Mount:/.test(main)) return { ...base, kind: 'mount', target: 'self' };

  // Habilidades / hechizos
  const colon = main.indexOf(':');
  const label = colon > 0 ? main.slice(0, colon).trim() : main;
  if (ABILITY_PREFIXES.includes(label)) return { ...base, kind: 'ability', target: 'self' };

  // Atributos ("Attribute: Perfect Vigour for Forsaken")
  if (label === 'Attribute') {
    const body = main.slice(colon + 1);
    const attr = body.replace(/\s+for .*$/, '').trim();
    // "for Forsaken" / "for all Infantry units": si nombra unidades concretas, solo a esas
    const forMatch = body.match(/\s+for (.+)$/);
    const forNames = forMatch && !/^all /i.test(forMatch[1])
      ? forMatch[1].replace(/ units?$/i, '').split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean)
      : undefined;
    const target: EffectTarget = ARMY_SCOPES.has(scope) ? 'army' : scope ? 'none' : 'self';
    return {
      ...base, kind: target === 'none' ? 'campaign' : 'attribute', target, attribute: attr,
      units: target === 'army' ? unitCards : undefined, forNames,
    };
  }
  if (/^Enables (flaming|magical) attacks/.test(main)) {
    const attr = /flaming/.test(main) ? 'Ataques flamígeros' : 'Ataques mágicos';
    const target: EffectTarget = ARMY_SCOPES.has(scope) ? 'army' : 'self';
    return { ...base, kind: 'attribute', target, attribute: attr, units: target === 'army' ? unitCards : undefined };
  }

  if (MAGIC_LABELS.includes(label)) return { ...base, kind: 'magic', target: 'self' };

  const stat = BATTLE_LABELS[label];
  if (stat) {
    const m = main.slice(colon + 1).match(/^\s*([+-]?\d+(?:\.\d+)?)\s*(%?)/);
    if (m) {
      const value = parseFloat(m[1]);
      const pct = m[2] === '%' && !stat.startsWith('res') && stat !== 'shield';
      let target: EffectTarget;
      if (!scope) target = 'self';
      else if (ARMY_SCOPES.has(scope)) target = 'army';
      else if (scope === 'accompanying Lord' || scope === 'Lord') target = 'lord';
      else target = 'none';
      if (target === 'none') return { ...base, kind: 'campaign' };
      // "Weapon strength" siempre es %. "Armour-piercing weapon damage" puede ser fijo o %.
      return { ...base, kind: 'battle', target, stat, value, pct, units: target === 'army' && unitCards?.length ? unitCards : undefined };
    }
  }

  // Todo lo demás (economía, autoridad, corrupción, acciones de héroe, etc.)
  return { ...base, kind: 'campaign' };
}

/** Traducción corta de la etiqueta de cada stat para la interfaz. */
export const STAT_LABELS_ES: Record<StatKey, string> = {
  ma: 'Ataque cuerpo a cuerpo',
  md: 'Defensa cuerpo a cuerpo',
  armour: 'Armadura',
  charge: 'Bonificación de carga',
  ld: 'Liderazgo',
  dmg: 'Daño base',
  ap: 'Daño perforante',
  hp: 'Salud por modelo',
  speed: 'Velocidad',
  bvl: 'Bonif. contra grandes',
  bvi: 'Bonif. contra infantería',
  resPhysical: 'Resistencia física',
  resMissile: 'Resistencia a proyectiles',
  resMagic: 'Resistencia a hechizos',
  resFlame: 'Resistencia al fuego',
  resWard: 'Salvación especial',
  missileDmg: 'Daño de proyectiles',
  ammo: 'Munición',
  reload: 'Recarga (s)',
  range: 'Alcance',
  barrier: 'Barrera',
  shield: 'Bloqueo de proyectiles',
};

export type { EffectKind };
