// Tipos de unidad (grupos del panel de reclutamiento del juego): orden, nombre e icono

export const GROUP_ORDER = [
  'Lords', 'Heroes',
  'Infantry', 'Missile Infantry', 'Cavalry & Chariots', 'Missile Cavalry & Chariots',
  'Monsters & Beasts', 'Missile Monsters & Beasts', 'Artillery & War Machines',
];

export const GROUP_INFO: Record<string, { es: string; icon: string }> = {
  Lords: { es: 'Señores', icon: '👑' },
  Heroes: { es: 'Héroes', icon: '⭐' },
  Infantry: { es: 'Infantería', icon: '🛡️' },
  'Missile Infantry': { es: 'Infantería de proyectiles', icon: '🏹' },
  'Cavalry & Chariots': { es: 'Caballería y carros', icon: '🐎' },
  'Missile Cavalry & Chariots': { es: 'Caballería de proyectiles', icon: '🏇' },
  'Monsters & Beasts': { es: 'Monstruos y bestias', icon: '🐉' },
  'Missile Monsters & Beasts': { es: 'Monstruos de proyectiles', icon: '🔥' },
  'Artillery & War Machines': { es: 'Artillería y máquinas de guerra', icon: '💣' },
};

export function groupInfo(g?: string) {
  return GROUP_INFO[g ?? ''] ?? { es: g || 'Otros', icon: '❔' };
}

export function groupIndex(g?: string) {
  const i = GROUP_ORDER.indexOf(g ?? '');
  return i < 0 ? GROUP_ORDER.length : i;
}
