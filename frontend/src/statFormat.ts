/**
 * Las stats se muestran en números enteros, como en el juego (redondeo al más cercano). Solo es la vista: el motor y el
 * DPS siguen usando los valores exactos. La recarga es un tiempo en segundos y se deja con un decimal.
 */
const KEEP_DECIMAL = new Set(['reload']);

export function fmtStat(v: number, stat?: string): string {
  if (stat && KEEP_DECIMAL.has(stat)) return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(Math.round(v));
}

/** Diferencia entre lo que se muestra (final − base ya redondeados), para que cuadre con los números en pantalla */
export function statDiff(final: number, base: number, stat?: string): number {
  if (stat && KEEP_DECIMAL.has(stat)) return Math.round((final - base) * 10) / 10;
  return Math.round(final) - Math.round(base);
}
