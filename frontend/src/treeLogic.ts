import type { BuildSelection, CharacterTree, SkillNode } from './types';
import { MAX_RANK, autoRank, effectiveLevel, nextLevelBlock, pointsAtRank, pointsFor } from './rankRules';

/** Rango efectivo del personaje: el mínimo elegido o el que piden sus habilidades (lo que sea mayor). */
export function rankOf(sel: BuildSelection): number {
  return Math.min(MAX_RANK, Math.max(1, sel.rankEff ?? sel.rank ?? 1));
}

/** Recalcula el rango automático después de cada cambio. */
export function normalize(sel: BuildSelection, tree: CharacterTree): BuildSelection {
  const need = autoRank(tree.rows.flat(), sel.levels, sel.rank ?? 1);
  return { ...sel, rankEff: Math.min(MAX_RANK, need), rankOver: need > MAX_RANK ? need : undefined };
}

/** Nivel efectivo: comprado, inicial o desbloqueado solo por rango. */
export function levelOf(sel: BuildSelection, node: SkillNode): number {
  return effectiveLevel(node, sel.levels[node.key] ?? 0, rankOf(sel));
}

export function pointsUsed(sel: BuildSelection, tree: CharacterTree): number {
  const r = rankOf(sel);
  return tree.rows.flat().reduce((s, n) => s + pointsFor(n, levelOf(sel, n), r), 0);
}

export function pointsLeft(sel: BuildSelection, tree: CharacterTree): number {
  return pointsAtRank(rankOf(sel)) - pointsUsed(sel, tree);
}

export function isAvailable(node: SkillNode, sel: BuildSelection, tree: CharacterTree): boolean {
  const all = tree.rows.flat();
  const lvl = (k: string) => {
    const n = all.find((x) => x.key === k);
    return n ? levelOf(sel, n) : 0;
  };
  if (node.parentsRequired.some((p) => lvl(p) < 1)) return false;
  // N puntos gastados en total entre esas habilidades padre; con N = 0 (especialidades del Orador de la Garra) no pide nada
  if (node.parentSubset.length && node.parentSubsetCount > 0) {
    const points = node.parentSubset.reduce((s, p) => s + lvl(p), 0);
    if (points < node.parentSubsetCount) return false;
  }
  return true;
}

/** Si el nodo está bloqueado por otra habilidad de su grupo excluyente, devuelve quién lo bloquea. */
export function blockedBy(node: SkillNode, sel: BuildSelection, tree: CharacterTree): { group: string; by: string[] } | null {
  if (levelOf(sel, node) > 0) return null;
  const all = tree.rows.flat();
  // Bloqueos oficiales del juego: este nodo se bloquea si otra habilidad llega a cierto nivel
  const by: string[] = [];
  for (const l of tree.locks?.[node.key] ?? []) {
    const other = all.find((n) => n.skillKey === l.skill);
    if (other && levelOf(sel, other) >= l.level) by.push(other.name);
  }
  if (by.length) return { group: 'Excluyentes del juego', by: [...new Set(by)] };
  for (const g of (tree.exclusiveGroups ?? []).filter((x) => x.name !== 'Excluyentes del juego')) {
    if (!g.nodes.includes(node.key)) continue;
    const others = g.nodes.filter((k) => k !== node.key && (sel.levels[k] ?? 0) > 0);
    if (others.length >= g.max) return { group: g.name, by: others.map((k) => all.find((n) => n.key === k)?.name ?? k) };
  }
  return null;
}

/** Motivo por el que no se puede subir el siguiente nivel (null = se puede). */
export function whyNotBuy(node: SkillNode, sel: BuildSelection, tree: CharacterTree): string | null {
  const cur = levelOf(sel, node);
  const next = node.levels[cur];
  if (!next) return 'Nivel máximo';
  if (!isAvailable(node, sel, tree)) return 'Faltan habilidades previas en el árbol';
  const b = blockedBy(node, sel, tree);
  if (b) return `Bloqueada por ${b.by.join(', ')}`;
  // Lo que pide rango ya no bloquea: al comprarlo, el rango sube solo (máx. 50)
  const trial = next.autoRank ? { ...sel, rank: Math.max(sel.rank ?? 1, next.autoRank) } : { ...sel, levels: { ...sel.levels, [node.key]: cur + 1 } };
  const need = autoRank(tree.rows.flat(), trial.levels, trial.rank ?? 1);
  if (need > MAX_RANK) return `No cabe: necesitaría rango ${need} (máximo ${MAX_RANK})`;
  return null;
}

/** Qué pasará al hacer clic (para la ventanita). */
export function buyHint(node: SkillNode, sel: BuildSelection): string | null {
  const cur = levelOf(sel, node);
  const next = node.levels[cur];
  const rank = rankOf(sel);
  if (!next) return null;
  if (next.autoRank && next.autoRank > rank) return `Clic: sube al rango ${next.autoRank}, donde se desbloquea sola`;
  if (next.requiredRank && next.requiredRank > rank) return `Clic: la compra y sube al rango ${next.requiredRank}`;
  return null;
}

/** Sube un nivel si se puede. */
export function increment(sel: BuildSelection, node: SkillNode, tree: CharacterTree): BuildSelection {
  if (whyNotBuy(node, sel, tree)) return sel;
  const cur = levelOf(sel, node);
  const lvl = node.levels[cur];
  let next: BuildSelection;
  if (lvl.autoRank) {
    // Habilidad automática: sube el rango mínimo hasta donde se desbloquea
    next = { ...sel, rank: Math.max(sel.rank ?? 1, lvl.autoRank) };
  } else {
    next = { ...sel, levels: { ...sel.levels, [node.key]: cur + 1 } };
  }
  if (node.isMount && !sel.mount) next.mount = node.key;
  return normalize(next, tree);
}

/** Baja un nivel; si deja hijos sin requisitos, también los quita (en cascada). */
export function decrement(sel: BuildSelection, node: SkillNode, tree: CharacterTree): BuildSelection {
  const cur = levelOf(sel, node);
  const free = effectiveLevel(node, 0, rankOf(sel)); // lo que da el rango no se puede quitar
  if (cur <= free) return sel;
  let next: BuildSelection = { ...sel, levels: { ...sel.levels, [node.key]: cur - 1 } };
  if (cur - 1 === 0) {
    if (next.mount === node.key) next.mount = null;
    next = cascade(next, tree);
  }
  return normalize(next, tree);
}

/** Quita nodos que quedaron sin requisitos. */
export function cascade(sel: BuildSelection, tree: CharacterTree): BuildSelection {
  let next = sel;
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of tree.rows.flat()) {
      if ((next.levels[n.key] ?? 0) > 0 && !isAvailable(n, next, tree)) {
        next = { ...next, levels: { ...next.levels, [n.key]: 0 } };
        if (next.mount === n.key) next.mount = null;
        changed = true;
      }
    }
  }
  return next;
}

/**
 * Barra de rango: fija el rango mínimo. Si bajas por debajo de lo que piden tus habilidades,
 * se quitan los niveles que ya no caben (los que piden más rango).
 */
export function setRank(sel: BuildSelection, tree: CharacterTree, rank: number): BuildSelection {
  const r = Math.min(MAX_RANK, Math.max(1, rank));
  let next: BuildSelection = { ...sel, rank: r, levels: { ...sel.levels } };
  if (r >= rankOf(sel)) return normalize(next, tree); // subir: solo cambia el mínimo
  for (const n of tree.rows.flat()) {
    let lvl = next.levels[n.key] ?? 0;
    while (lvl > 0) {
      const l = n.levels[lvl - 1];
      const tooHigh = (l.requiredRank && l.requiredRank > r) || (l.autoRank && l.autoRank > r);
      if (!tooHigh) break;
      lvl--;
    }
    next.levels[n.key] = lvl;
    if (next.mount === n.key && effectiveLevel(n, lvl, r) === 0) next.mount = null;
  }
  next = cascade(next, tree);
  // Si la montura elegida ya no existe a este rango, a pie
  next = trimToRank(next, tree, r);
  const mount = tree.rows.flat().find((n) => n.key === next.mount);
  if (mount && levelOf(next, mount) === 0) next.mount = null;
  return next;
}

/** Quita puntos (de la última fila hacia atrás) hasta que el build quepa en el rango pedido. */
function trimToRank(sel: BuildSelection, tree: CharacterTree, r: number): BuildSelection {
  let next = normalize({ ...sel, rank: r }, tree);
  const nodes = [...tree.rows.flat()].reverse();
  let guard = 0;
  while (rankOf(next) > r && guard++ < 500) {
    const n = nodes.find((x) => (next.levels[x.key] ?? 0) > 0);
    if (!n) break;
    next = cascade({ ...next, levels: { ...next.levels, [n.key]: (next.levels[n.key] ?? 0) - 1 } }, tree);
    next = normalize(next, tree);
  }
  return next;
}

/**
 * Compra todo lo que se pueda del árbol visible (fila por fila, de arriba abajo) sin pasar del rango máximo.
 * Respeta lo ya elegido (en los excluyentes se queda con lo que tengas; si no hay nada, toma el primero).
 * `added` = niveles subidos; `missing` = habilidades que quedaron sin el nivel máximo por falta de puntos (0 = cabe todo).
 */
export function fillAll(sel: BuildSelection, tree: CharacterTree): { sel: BuildSelection; missing: number; added: number } {
  const nodes = tree.rows.flat().filter((n) => n.visible);
  let next = sel;
  let added = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      while (!whyNotBuy(n, next, tree)) {
        next = increment(next, n, tree);
        changed = true;
        added++;
      }
    }
  }
  next = { ...next, mount: sel.mount ?? null }; // comprar monturas no cambia con cuál vas
  const missing = nodes.filter((n) => whyNotBuy(n, next, tree)?.startsWith('No cabe')).length;
  return { sel: next, missing, added };
}

export function emptyBuild(tree: CharacterTree): BuildSelection {
  return normalize({ character: tree.key, levels: {}, mount: null, innate: tree.defaultInnate, rank: 1 }, tree);
}

const STAT_SIGN = (v: number) => (v > 0 ? `+${v}` : `${v}`);
export { STAT_SIGN };
