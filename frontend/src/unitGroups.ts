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

/** Regimiento de Renombre: la marca del juego (main_units.is_renown) o "_ror" en la clave, como respaldo */
export const isRoR = (u?: { key?: string; card?: string; ror?: boolean } | null) =>
  !!u && (!!u.ror || /_ror/.test(`${u.key ?? ''} ${u.card ?? ''}`));

/** Monstruo del Monstrous Arcanum (cacerías de Norsca): recompensa (…_monst_arcanum_reward) o jefe de la cacería (…_monst_arcanum) */
export const isMA = (u?: { key?: string; card?: string } | null) => !!u && /monst_arcanum/.test(`${u.key ?? ''} ${u.card ?? ''}`);
/** Jefe de una cacería del Monstrous Arcanum: enemigo, no se recluta (las recompensas terminan en _reward) */
export const isMABoss = (u?: { key?: string } | null) => !!u && /monst_arcanum$/.test(u.key ?? '');
