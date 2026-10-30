/**
 * "Sistema de archivos" en memoria para correr el backend en el navegador (web estática para el celular).
 * Los archivos de datos se descargan al abrir la app; los builds guardados van al almacenamiento del navegador.
 */
export const vfs = new Map<string, string>();
/** Carpetas con su lista de archivos (p. ej. las cartas de unidad que existen) */
export const vdirs = new Map<string, string[]>();

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
const isBuilds = (p: string) => /\/builds\.json$/.test(p);
const BUILDS_KEY = 'wh3planner.builds';

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function existsSync(p: string): boolean {
  const n = norm(p);
  if (isBuilds(n)) { try { return !!store()?.getItem(BUILDS_KEY); } catch { return false; } }
  return vfs.has(n) || vdirs.has(n);
}
export function readFileSync(p: string): string {
  const n = norm(p);
  if (isBuilds(n)) { try { return store()?.getItem(BUILDS_KEY) ?? '[]'; } catch { return '[]'; } }
  const t = vfs.get(n);
  if (t === undefined) throw new Error(`No existe ${n}`);
  return t;
}
export function writeFileSync(p: string, data: string): void {
  const n = norm(p);
  if (isBuilds(n)) { try { store()?.setItem(BUILDS_KEY, String(data)); } catch { /* sin almacenamiento */ } return; }
  vfs.set(n, String(data));
}
export function readdirSync(p: string): string[] {
  return vdirs.get(norm(p)) ?? [];
}
export function statSync(p: string) {
  const n = norm(p);
  return { isDirectory: () => vdirs.has(n), isFile: () => vfs.has(n) };
}
export default { existsSync, readFileSync, writeFileSync, readdirSync, statSync };
