import { useEffect, useState } from 'react';
import { attrIcon } from './attrIcons';

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

/** Icono de atributo: el oficial si existe; si no, el emoji de respaldo */
export function AttrImg({ name, size = 14, idx }: { name: string; size?: number; idx: Record<string, string> }) {
  const key = idx[name];
  if (key) return <img className="attr-img" src={`/attrs/${key}.png`} width={size} height={size} alt="" onError={hide} />;
  const e = attrIcon(name);
  return e ? <span className="attr-emoji">{e}</span> : null;
}
