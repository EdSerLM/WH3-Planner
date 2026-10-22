/**
 * Reglas de rango del árbol (mismo archivo en backend/src y frontend/src):
 * - Niveles con "autoRank" se desbloquean solos al llegar a ese rango (no cuestan puntos ni se compran).
 * - Niveles con "requiredRank" solo se pueden comprar desde ese rango.
 * - "pointsOnCreation" son niveles gratis desde el inicio.
 * - Puntos disponibles: 1 por rango (aprox.; ajusta POINTS_AT_RANK si tu experiencia en el juego es distinta).
 */

export const MAX_RANK = 50;

export interface RankNode {
  pointsOnCreation: number;
  levels: { autoRank?: number; requiredRank?: number }[];
}

export function pointsAtRank(rank: number): number {
  return Math.max(0, rank);
}

/** ¿El nivel i (0 = primero) es gratis a este rango? */
export function isFreeLevel(node: RankNode, i: number, rank: number): boolean {
  if (i < node.pointsOnCreation) return true;
  const ar = node.levels[i]?.autoRank;
  return !!ar && ar <= rank;
}

/** Niveles que el personaje tiene sin gastar puntos (iniciales + automáticos por rango). */
export function freeLevels(node: RankNode, rank: number): number {
  let free = Math.min(node.pointsOnCreation, node.levels.length);
  node.levels.forEach((l, i) => {
    if (l.autoRank && l.autoRank <= rank) free = Math.max(free, i + 1);
  });
  return free;
}

export function effectiveLevel(node: RankNode, bought: number, rank: number): number {
  return Math.min(node.levels.length, Math.max(bought, freeLevels(node, rank)));
}

/** Puntos que cuesta tener este nodo al nivel dado. */
export function pointsFor(node: RankNode, level: number, rank: number): number {
  let p = 0;
  for (let i = 0; i < level; i++) if (!isFreeLevel(node, i, rank)) p++;
  return p;
}

/** ¿Se puede comprar el siguiente nivel a este rango? Devuelve el motivo si no. */
export function nextLevelBlock(node: RankNode, current: number, rank: number): string | null {
  const next = node.levels[current];
  if (!next) return 'Nivel máximo';
  if (next.autoRank) return `Se desbloquea sola en rango ${next.autoRank}`;
  if (next.requiredRank && next.requiredRank > rank) return `Requiere rango ${next.requiredRank}`;
  return null;
}

/**
 * Rango automático (como el planner original): empieza en "floor" (1 por defecto) y sube solo
 * hasta cubrir los puntos gastados y el rango que piden las habilidades compradas.
 * Al subir el rango se desbloquean las habilidades automáticas (que no cuestan puntos).
 * Devuelve el rango necesario (puede pasar de MAX_RANK si el build no cabe).
 */
export function autoRank(nodes: (RankNode & { key: string })[], bought: Record<string, number>, floor = 1): number {
  let r = Math.max(1, Math.min(MAX_RANK, floor));
  for (let iter = 0; iter < 100; iter++) {
    let pts = 0;
    let req = 1;
    for (const n of nodes) {
      const lvl = effectiveLevel(n, bought[n.key] ?? 0, r);
      for (let i = 0; i < lvl; i++) {
        if (i < n.pointsOnCreation) continue;
        const l = n.levels[i];
        // Los niveles automáticos nunca cuestan puntos: solo piden su rango
        if (l.autoRank) { req = Math.max(req, l.autoRank); continue; }
        pts++;
        req = Math.max(req, l.requiredRank ?? 1);
      }
    }
    const need = Math.max(r, pts, req);
    if (need === r) return r;
    if (need > MAX_RANK) return need;
    r = need;
  }
  return r;
}
