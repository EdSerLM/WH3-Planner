// Lo mínimo de node:path que usa el backend (rutas con "/")
export function join(...parts: string[]): string {
  const out: string[] = [];
  for (const seg of parts.join('/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}
export function dirname(p: string): string {
  const i = p.replace(/\/$/, '').lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}
export default { join, dirname };
