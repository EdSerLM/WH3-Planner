/**
 * Backend en el navegador (web estática para el celular): descarga los datos del juego una vez,
 * los pone en el sistema de archivos en memoria y usa las mismas rutas que el servidor (backend/src/routes.ts).
 */
import { vdirs, vfs } from './fs';

const BASE = import.meta.env.BASE_URL;
const DATA = '/app/backend/data';
// [archivo publicado en /data, ruta que lee el backend, obligatorio]
const FILES: [string, string, boolean][] = [
  ['wh3_all_skills.json', `${DATA}/raw/wh3_all_skills.json`, true],
  ['wh3_all_units.json', `${DATA}/raw/wh3_all_units.json`, true],
  ['wh3_skill_locks.json', `${DATA}/raw/wh3_skill_locks.json`, false],
  ['nombres-es.json', `${DATA}/nombres-es.json`, false],
  ['exclusivas.json', `${DATA}/exclusivas.json`, false],
  ['wh3_es.tsv', `${DATA}/loc-es/wh3_es.tsv`, false],
];

function progress(text: string | null) {
  let el = document.getElementById('static-loading');
  if (!text) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'static-loading';
    el.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;background:#1e1814;color:#e6c98a;border:1px solid #6b4a2e;border-radius:8px;padding:8px 14px;font:14px Inter,system-ui,sans-serif;box-shadow:0 4px 18px #000a';
    document.body.appendChild(el);
  }
  el.textContent = text;
}

async function fetchText(name: string, required: boolean, onBytes: (n: number) => void): Promise<string | null> {
  const r = await fetch(`${BASE}data/${name}`);
  if (!r.ok) {
    if (required) throw new Error(`No se pudo descargar ${name} (${r.status})`);
    return null;
  }
  if (!r.body) return r.text();
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes(value.length);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

const ready = (async () => {
  let mb = 0;
  progress('Cargando datos del juego…');
  const texts = await Promise.all(FILES.map(([name, , req]) => fetchText(name, req, (n) => {
    mb += n / 1e6;
    progress(`Cargando datos del juego… ${mb.toFixed(1)} MB`);
  })));
  FILES.forEach(([, path], i) => { if (texts[i] !== null) vfs.set(path, texts[i]!); });
  vdirs.set(`${DATA}/loc-es`, vfs.has(`${DATA}/loc-es/wh3_es.tsv`) ? ['wh3_es.tsv'] : []);
  // Cartas de unidad que existen (el backend pregunta qué arte hay)
  const cards = await fetch(`${BASE}units/index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []) as string[];
  vdirs.set('/app/frontend/public/units', cards.map((c) => `${c}.png`));
  progress('Preparando…');
  const routes = await import('../../../backend/src/routes');
  progress(null);
  window.dispatchEvent(new Event('wh3-data-ready'));
  return routes;
})();
ready.catch((e) => progress(`Error al cargar los datos: ${(e as Error).message}`));

/** Igual que pedirle al servidor: método, ruta /api/..., cuerpo JSON */
export async function handle(method: string, url: string, body?: unknown): Promise<unknown> {
  const routes = await ready;
  const u = new URL(url, 'http://local');
  const q = Object.fromEntries(u.searchParams.entries());
  try {
    // Copia por JSON: el servidor también recibe y devuelve JSON (nadie comparte objetos con el motor)
    return JSON.parse(JSON.stringify(routes.handle(method, u.pathname, q, body === undefined ? undefined : JSON.parse(JSON.stringify(body)))));
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
