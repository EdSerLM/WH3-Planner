// Iconos genéricos de unidad (SVG propios) mientras no tengamos el arte de las cartas del juego.
// El tipo sale de los datos del juego (extractor): arma cuerpo a cuerpo, proyectil, montura, si vuela, tamaño...

export const ICON_ES: Record<string, string> = {
  n_daemon: 'Demonio', n_undead: 'No muerto', n_construct: 'Constructo', n_mortal: 'Mortal (de carne y hueso)',
  lord: 'Señor', hero: 'Héroe', sword: 'Infantería con espada', axe: 'Infantería con hacha o arma pesada', spear: 'Lanzas o alabardas',
  bow: 'Arcos o ballestas', gun: 'Armas de fuego', throw: 'Arrojadizas (jabalinas, hachas)', blast: 'Proyectiles explosivos o especiales',
  cav: 'Caballería de choque', cav_lance: 'Caballería con lanza', cav_missile: 'Caballería de proyectiles', chariot: 'Carro',
  beast: 'Bestias de guerra', monster: 'Monstruo', flyer: 'Volador', artillery: 'Artillería',
};

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Shape({ k }: { k: string }) {
  switch (k) {
    case 'sword':
      return <g {...P}><path d="M27 5l-1 4-12 12-2-2L24 7z" fill="currentColor" /><path d="M8 16l8 8" strokeWidth={2.4} /><path d="M11 21l-5 5" strokeWidth={2.4} /><circle cx="5" cy="27" r="1.8" fill="currentColor" /></g>;
    case 'axe':
      return <g {...P}><path d="M8 26L22 8" /><path d="M17 6c4-3 10 1 11 6l-7 4" /><path d="M17 6l4 10" /></g>;
    case 'spear':
      return <g {...P}><path d="M5 27L24 8" /><path d="M21 5l7-1-1 7-3-3z" fill="currentColor" /><path d="M9 19l4 4" /></g>;
    case 'bow':
      return <g {...P}><path d="M9 4c10 3 14 13 9 24" /><path d="M9 4l9 24" strokeWidth={1.2} /><path d="M4 18h17" /><path d="M18 15l3 3-3 3" /></g>;
    case 'gun':
      return <g {...P}><path d="M3 12h21v4H3z" /><path d="M24 13h5" /><path d="M10 16l-4 9h4l3-9" /><path d="M16 16v3h-3" /></g>;
    case 'throw':
      return <g {...P}><path d="M6 26L26 6" /><path d="M22 6h4v4" /><path d="M4 16h5M8 22h4M12 28h3" strokeWidth={1.4} /></g>;
    case 'blast':
      return <g {...P}><circle cx="14" cy="19" r="8" /><path d="M19 12l4-4" /><path d="M24 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="currentColor" /></g>;
    case 'cav':
      return <g {...P}><path d="M9 27V15a7 7 0 0 1 14 0v12" strokeWidth={3} /><path d="M7 27h5M20 27h5" /></g>;
    case 'cav_lance':
      return <g {...P}><path d="M7 28V18a6 6 0 0 1 12 0v10" strokeWidth={3} /><path d="M15 15L29 3" /><path d="M25 3h4v4" /></g>;
    case 'cav_missile':
      return <g {...P}><path d="M5 28V19a6 6 0 0 1 12 0v9" strokeWidth={3} /><path d="M20 4c6 3 8 9 5 16" /><path d="M20 4l5 16" strokeWidth={1.2} /></g>;
    case 'chariot':
      return <g {...P}><circle cx="12" cy="20" r="7" /><path d="M12 13v14M5 20h14M7 15l10 10M17 15L7 25" strokeWidth={1.2} /><path d="M18 14h10l-3-7H16" /></g>;
    case 'beast':
      return <g fill="currentColor"><ellipse cx="16" cy="21" rx="6" ry="5" /><circle cx="8" cy="13" r="2.6" /><circle cx="13" cy="8.5" r="2.6" /><circle cx="19" cy="8.5" r="2.6" /><circle cx="24" cy="13" r="2.6" /></g>;
    case 'monster':
      return <g {...P} strokeWidth={2.6}><path d="M7 5c5 6 6 14 3 23" /><path d="M15 4c5 7 6 15 2 24" /><path d="M23 5c4 6 4 14 0 22" /></g>;
    case 'flyer':
      return <g {...P}><path d="M16 14c-3-6-9-8-14-6 4 2 5 6 6 9 2-1 5-1 8 1z" /><path d="M16 14c3-6 9-8 14-6-4 2-5 6-6 9-2-1-5-1-8 1z" /><path d="M16 15v10" /></g>;
    case 'artillery':
      return <g {...P}><path d="M5 17l20-9 2 4-20 9z" /><circle cx="12" cy="23" r="5" /><path d="M12 23l0 0" strokeWidth={3} /></g>;
    case 'n_daemon':
      return <g {...P}><path d="M7 6c0 6 3 9 6 10M25 6c0 6-3 9-6 10" strokeWidth={2.4} /><path d="M9 15c0 7 3 12 7 12s7-5 7-12c-2-2-4-3-7-3s-5 1-7 3z" fill="currentColor" fillOpacity={0.25} /><path d="M12 19l2.5 1.5M20 19l-2.5 1.5" /></g>;
    case 'n_undead':
      return <g {...P}><path d="M8 15a8 8 0 0 1 16 0v4l-2 2v4h-3v-2h-2v2h-2v-2h-2v2h-3v-4l-2-2z" fill="currentColor" fillOpacity={0.25} /><circle cx="12.5" cy="16" r="2" fill="currentColor" /><circle cx="19.5" cy="16" r="2" fill="currentColor" /></g>;
    case 'n_construct':
      return <g {...P}><circle cx="16" cy="16" r="5" /><path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M7.5 24.5l2.8-2.8M21.7 10.3l2.8-2.8" strokeWidth={2.6} /></g>;
    case 'n_mortal':
      return <g {...P}><circle cx="16" cy="9" r="4.5" /><path d="M7 28c0-6 4-10 9-10s9 4 9 10" /></g>;
    case 'lord':
      return <g {...P}><path d="M5 24l-1-14 7 6 5-9 5 9 7-6-1 14z" /><path d="M5 27h22" /></g>;
    case 'hero':
      return <g {...P}><path d="M16 3l3.6 8 8.4.8-6.4 5.6 2 8.6L16 21.6 8.4 26l2-8.6L4 11.8l8.4-.8z" /></g>;
    default:
      return <g {...P}><circle cx="16" cy="16" r="9" /><path d="M16 11v6M16 21v.5" /></g>;
  }
}

/** Icono SVG del tipo de unidad; `title` describe el tipo */
export function UnitIcon({ kind, size = 28, className }: { kind?: string; size?: number; className?: string }) {
  const k = kind ?? '';
  return (
    <svg className={'unit-icon ' + (className ?? '')} width={size} height={size} viewBox="0 0 32 32" aria-label={ICON_ES[k] ?? 'Unidad'}>
      <title>{ICON_ES[k] ?? 'Unidad'}</title>
      <Shape k={k} />
    </svg>
  );
}
