import { useEffect, useState } from 'react';
import { attrIcon } from './attrIcons';
import { groupInfo } from './unitGroups';

// Iconos oficiales copiados del juego por npm run extraer (frontend/public/...). Si falta alguno, no se muestra
// (o se usa el emoji de respaldo en los atributos).

const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };

/** Icono de hechizo o habilidad (/abilities/<icon>.png) */
export function AbilityImg({ icon, size = 22, title }: { icon?: string; size?: number; title?: string }) {
  if (!icon) return null;
  return <img className="ab-img" src={`/abilities/${icon}.png`} width={size} height={size} alt="" title={title} onError={hide} />;
}

/** Bandera de facción (/flags/<faccion>.png) */
export function Flag({ flag, size = 22, title }: { flag?: string; size?: number; title?: string }) {
  if (!flag) return null;
  return <img className="flag-img" src={`/flags/${flag}.png`} width={size} height={size} alt="" title={title} onError={hide} />;
}

// Atributo (nombre en español) -> clave del icono; se carga una vez
let attrIndex: Record<string, string> | null = null;
let attrPromise: Promise<Record<string, string>> | null = null;
function loadAttrIndex() {
  attrPromise ??= fetch('/attrs/index.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (attrIndex = j));
  return attrPromise;
}
export function useAttrIndex() {
  const [idx, setIdx] = useState<Record<string, string> | null>(attrIndex);
  useEffect(() => {
    if (!idx) loadAttrIndex().then(setIdx);
  }, [idx]);
  return idx ?? {};
}

// Grupo del roster (Infantry, Lords...) -> icono oficial de categoría; lo llena App al cargar /api/meta
let groupIconMap: Record<string, string> = {};
export function setGroupIcons(m: Record<string, string> | undefined) {
  groupIconMap = m ?? {};
}

/** Imagen oficial con respaldo: si el archivo aún no existe (falta re-extraer), muestra el respaldo genérico */
export function OfficialImg({ src, size, title, fallback, className }: { src?: string; size: number; title?: string; fallback: React.ReactNode; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return <img className={'game-icon ' + (className ?? '')} src={src} width={size} height={size} alt="" title={title} onError={() => setFailed(src)} />;
}

/** Icono del grupo del roster: el oficial del juego o el emoji de respaldo */
export function GroupIcon({ g, size = 16 }: { g?: string; size?: number }) {
  const info = groupInfo(g);
  const icon = groupIconMap[g ?? ''];
  return <OfficialImg src={icon ? `/unitcat/${icon}.png` : undefined} size={size} title={info.es} fallback={<span title={info.es}>{info.icon}</span>} />;
}

// Stat -> icono oficial (ui/skins/default/icon_stat_*.png)
const STAT_ICON: Record<string, string> = {
  ma: 'icon_stat_attack', md: 'icon_stat_defence', armour: 'icon_stat_armour', ld: 'icon_stat_morale', speed: 'icon_stat_speed',
  charge: 'icon_stat_charge_bonus', hp: 'icon_stat_health', ws: 'icon_stat_damage', dmg: 'icon_stat_damage_base',
  ap: 'icon_stat_explosive_armour_piercing_damage', missileDmg: 'icon_stat_ranged_damage', range: 'icon_stat_range',
  ammo: 'icon_stat_ammo', reload: 'icon_stat_reload_time', shield: 'icon_stat_missile_block_chance',
};

/** Icono de stat: el oficial del juego o el emoji de respaldo */
export function StatImg({ stat, emoji, size = 16, title }: { stat: string; emoji: string; size?: number; title?: string }) {
  const f = STAT_ICON[stat];
  return <OfficialImg src={f ? `/stats/${f}.png` : undefined} size={size} title={title} fallback={<span title={title}>{emoji}</span>} />;
}

/** Icono de atributo: el oficial si existe; si no, el emoji de respaldo */
export function AttrImg({ name, size = 14, idx }: { name: string; size?: number; idx: Record<string, string> }) {
  const key = idx[name];
  if (key) return <img className="attr-img" src={`/attrs/${key}.png`} width={size} height={size} alt="" onError={hide} />;
  const e = attrIcon(name);
  return e ? <span className="attr-emoji">{e}</span> : null;
}
