// Iconos chicos para los atributos de unidad (nombres en español del juego)

const ICONS: [RegExp, string][] = [
  [/^Causa terror/i, '😱'],
  [/^Causa miedo|^Provoca miedo/i, '😨'],
  [/^Alentar/i, '📯'],
  [/^Puede volar|vuelo/i, '🦅'],
  [/^Esconderse/i, '🌲'],
  [/^Acechar/i, '👁️'],
  [/^Despliegue de vanguardia|vanguardia/i, '⏩'],
  [/^Cruzar/i, '🥾'],
  [/^Inmune a la psicolog/i, '🧠'],
  [/^Indesmoralizable/i, '💪'],
  [/^Disparar en movimiento/i, '🎯'],
  [/^Leñador/i, '🪓'],
  [/cargas/i, '🛑'],
  [/^Reflejar carga/i, '🔰'],
  [/^Rompemuros/i, '🧱'],
  [/^Flanqueo devastador/i, '↪️'],
  [/^Desprecio/i, '😤'],
  [/^Sacrificable/i, '⚰️'],
  [/^Arremetida/i, '💨'],
  [/^Vigor perfecto/i, '♾️'],
  [/^Inmune al flanqueo/i, '🧭'],
  [/^Inmune a los efectos de contacto/i, '🧤'],
  [/Dominio de los Vientos/i, '🌀'],
  [/mágic/i, '✨'],
  [/flamíg|inflamable/i, '🔥'],
  [/envenenad/i, '☠️'],
  [/desgarrador/i, '🔪'],
  [/encantad/i, '💫'],
  [/^Sin carreras/i, '🐢'],
  [/^Caballero/i, '🏰'],
  [/^Campesino/i, '🌾'],
  [/^Matador/i, '🪦'],
  [/^Yin$/i, '☯️'],
  [/^Yang$/i, '☯️'],
  [/^Regenera/i, '❤️‍🩹'],
  [/^Etére/i, '👻'],
  [/^Elemental/i, '🌋'],
  [/^Forjada en el infierno/i, '⚒️'],
];

/** Atributos que ya se muestran como naturaleza (demonio, no muerto, constructo, marca de dios) */
const NATURE = /^(Demonio|No Muertos|Constructo|Marca de )/;

export function attrIcon(name: string): string | undefined {
  return ICONS.find(([re]) => re.test(name))?.[1];
}

/** Atributos con icono, sin los de naturaleza; los que no tienen icono quedan como "otros" */
export function attrBadges(names: string[] = []) {
  const shown: { name: string; icon: string }[] = [];
  const other: string[] = [];
  for (const n of [...new Set(names)]) {
    if (NATURE.test(n)) continue;
    const i = attrIcon(n);
    if (i) shown.push({ name: n, icon: i });
    else other.push(n);
  }
  return { shown, other };
}
