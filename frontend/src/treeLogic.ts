import type { BuildSelection, CharacterTree, SkillNode } from './types';
import { MAX_RANK, effectiveLevel, nextLevelBlock, pointsAtRank, pointsFor } from './rankRules';

export function rankOf(sel: BuildSelection): number {
  return Math.min(MAX_RANK, Math.max(1, sel.rank ?? MAX_RANK));
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
  if (node.parentSubset.length) {
    // N puntos gastados en total entre esas habilidades padre
    const points = node.parentSubset.reduce((s, p) => s + lvl(p), 0);
    if (points < Math.max(1, node.parentSubsetCount)) return false;
  }
  return true;
}

/** Si el nodo está bloqueado por otra habilidad de su grupo excluyente, devuelve quién lo bloquea. */
export function blockedBy(node: SkillNode, sel: BuildSelection, tree: CharacterTree): { group: string; by: string[] } | null {
  if (levelOf(sel, node) > 0) return null;
  const all = tree.rows.flat();
  for (const g of tree.exclusiveGroups ?? []) {
    if (!g.nodes.includes(node.key)) continue;
    const others = g.nodes.filter((k) => k !== node.key && (sel.levels[k] ?? 0) > 0);
    if (others.length >= g.max) return { group: g.name, by: others.map((k) => all.find((n) => n.key === k)?.name ?? k) };
  }
  return null;
}

/** Motivo por el que no se puede subir el siguiente nivel (null = se puede). */
export function whyNotBuy(node: SkillNode, sel: BuildSelection, tree: CharacterTree): string | null {
  const cur = levelOf(sel, node);
  const rankBlock = nextLevelBlock(node, cur, rankOf(sel));
  if (rankBlock) return rankBlock;
  if (!isAvailable(node, sel, tree)) return 'Faltan habilidades previas en el árbol';
  const b = blockedBy(node, sel, tree);
  if (b) return `Bloqueada por ${b.by.join(', ')}`;
  if (pointsLeft(sel, tree) <= 0) return 'Sin puntos: sube el rango del personaje';
  return null;
}

/** Sube un nivel si se puede. */
export function increment(sel: BuildSelection, node: SkillNode, tree: CharacterTree): BuildSelection {
  if (whyNotBuy(node, sel, tree)) return sel;
  const cur = levelOf(sel, node);
  const next = { ...sel, levels: { ...sel.levels, [node.key]: cur + 1 } };
  if (node.isMount && !sel.mount) next.mount = node.key;
  return next;
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
  return next;
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

/** Al bajar el rango, quita los niveles comprados que ya no se permiten. */
export function setRank(sel: BuildSelection, tree: CharacterTree, rank: number): BuildSelection {
  const r = Math.min(MAX_RANK, Math.max(1, rank));
  let next: BuildSelection = { ...sel, rank: r, levels: { ...sel.levels } };
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
  const mount = tree.rows.flat().find((n) => n.key === next.mount);
  if (mount && levelOf(next, mount) === 0) next.mount = null;
  return next;
}

export function emptyBuild(tree: CharacterTree): BuildSelection {
  return { character: tree.key, levels: {}, mount: null, innate: tree.defaultInnate, rank: MAX_RANK };
}

const STAT_SIGN = (v: number) => (v > 0 ? `+${v}` : `${v}`);
export { STAT_SIGN };
