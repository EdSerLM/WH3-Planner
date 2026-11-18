import type { ArmyState } from './types';

/**
 * Compartir un ejército por enlace: el ejército completo (facción, campaña, señor, héroes, unidades, tecnologías…)
 * va comprimido en el #fragmento de la URL, así que no se sube a ningún servidor.
 * Formato: #e=<base64url de deflate-raw de JSON {v, f, n, a}> (un ejército) o {v, f, l: [{n, a}]} (varios guardados)
 */
export interface SharedArmy { faction: string; name?: string; army: ArmyState }
export interface SharedList { faction: string; list: { name: string; army: ArmyState }[] }

const toB64u = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (t: string) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function link(payload: object): Promise<string> {
  const z = await pipe(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream('deflate-raw'));
  const base = `${location.origin}${location.pathname}`;
  return `${base}#e=${toB64u(z)}`;
}

export const armyLink = (s: SharedArmy) => link({ v: 1, f: s.faction, n: s.name || undefined, a: s.army });
/** Varios ejércitos guardados (con su nombre) en un solo enlace */
export const armiesLink = (s: SharedList) => link({ v: 1, f: s.faction, l: s.list.map((x) => ({ n: x.name, a: x.army })) });

/** Lee el ejército del enlace (si lo hay) */
export async function readArmyLink(hash = location.hash): Promise<SharedArmy | SharedList | null> {
  const m = /[#&]e=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  const raw = await pipe(fromB64u(m[1]), new DecompressionStream('deflate-raw'));
  const o = JSON.parse(new TextDecoder().decode(raw));
  if (!o || typeof o.f !== 'string') return null;
  if (Array.isArray(o.l)) {
    const list = o.l.filter((x: { a?: ArmyState }) => x?.a && Array.isArray(x.a.units)).map((x: { n?: string; a: ArmyState }) => ({ name: String(x.n ?? 'Ejército'), army: x.a }));
    return list.length ? { faction: o.f, list } : null;
  }
  if (!o.a || !Array.isArray(o.a.units)) return null;
  return { faction: o.f, name: typeof o.n === 'string' ? o.n : undefined, army: o.a };
}

/** Quita el ejército del enlace de la barra de direcciones (para que recargar no lo vuelva a cargar) */
export function clearArmyLink() {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}
