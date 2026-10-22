import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { TechNode, TechTreeData, TechTreeSummary } from '../types';

interface Props {
  faction: string;
  treeKey?: string;
  variant?: string;
  researched: string[];
  onChange: (p: { techs?: string[]; techTree?: string; techVariant?: string }) => void;
}

const TARGET: Record<string, string> = { army: 'ejército', chars: 'personajes', self: 'propio', lord: 'señor', none: '' };
const WHO: Record<string, string> = { lord: 'solo señores', hero: 'solo héroes', wizard: 'solo hechiceros' };

/** Requisitos de un nodo: sus padres (todos o los N que pide) + tecnologías obligatorias. */
function prerequisites(n: TechNode, byKey: Map<string, TechNode>, have: Set<string>): string[] {
  const parents = n.parentsNeeded >= n.parents.length
    ? n.parents
    : [...n.parents].sort((a, b) => Number(have.has(byKey.get(b)!.tech)) - Number(have.has(byKey.get(a)!.tech))).slice(0, n.parentsNeeded);
  return [...new Set([...parents, ...n.requires])];
}

function isAvailable(n: TechNode, byKey: Map<string, TechNode>, have: Set<string>): boolean {
  const ok = n.parents.filter((p) => have.has(byKey.get(p)!.tech)).length;
  return ok >= Math.min(n.parentsNeeded, n.parents.length) && n.requires.every((r) => have.has(byKey.get(r)!.tech));
}

export function TechTree({ faction, treeKey, variant, researched, onChange }: Props) {
  const [trees, setTrees] = useState<TechTreeSummary[]>([]);
  const [tree, setTree] = useState<TechTreeData | null>(null);
  const [onlyBattle, setOnlyBattle] = useState(false);
  const [hover, setHover] = useState<{ node: TechNode; rect: DOMRect } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.techTrees(faction).then(setTrees).catch((e) => setErr(e.message));
  }, [faction]);

  const current = trees.find((t) => t.key === treeKey) ?? trees[0];
  useEffect(() => {
    if (!current) { setTree(null); return; }
    const v = current.variants.some((x) => x.fk === variant) ? variant : undefined;
    api.techTree(current.key, v).then(setTree).catch((e) => setErr(e.message));
  }, [current?.key, variant]); // eslint-disable-line react-hooks/exhaustive-deps

  const byKey = useMemo(() => new Map((tree?.nodes ?? []).map((n) => [n.key, n])), [tree]);
  const have = useMemo(() => new Set(researched), [researched]);
  const inTree = useMemo(() => (tree?.nodes ?? []).filter((n) => have.has(n.tech)), [tree, have]);

  if (err) return <div className="warn">{err}</div>;
  if (!trees.length) {
    return <p className="muted">Esta facción no tiene árbol de tecnologías en el juego (o falta correr <code>npm run extraer</code>).</p>;
  }
  if (!tree) return <p className="muted">Cargando tecnologías…</p>;

  const cols = Math.max(...tree.nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...tree.nodes.map((n) => n.row)) - tree.minRow + 1;

  const research = (n: TechNode) => {
    const next = new Set(have);
    const visit = (k: string, depth = 0) => {
      const x = byKey.get(k)!;
      if (next.has(x.tech) || depth > 60) return;
      next.add(x.tech);
      for (const p of prerequisites(x, byKey, next)) visit(p, depth + 1);
    };
    visit(n.key);
    onChange({ techs: [...next] });
  };
  const forget = (n: TechNode) => {
    // Quitar la tecnología y todo lo que ya no cumple requisitos
    const next = new Set(have);
    next.delete(n.tech);
    let changed = true;
    while (changed) {
      changed = false;
      for (const x of tree.nodes) {
        if (next.has(x.tech) && (x.parents.length || x.requires.length) && !isAvailable(x, byKey, next)) {
          next.delete(x.tech);
          changed = true;
        }
      }
    }
    onChange({ techs: [...next] });
  };
  const all = (battleOnly: boolean) => {
    const next = new Set(have);
    for (const n of tree.nodes) if (!battleOnly || n.battle) {
      const visit = (k: string, d = 0) => {
        const x = byKey.get(k)!;
        if (next.has(x.tech) || d > 60) return;
        next.add(x.tech);
        for (const p of prerequisites(x, byKey, next)) visit(p, d + 1);
      };
      visit(n.key);
    }
    onChange({ techs: [...next] });
  };
  const clear = () => onChange({ techs: researched.filter((t) => !tree.nodes.some((n) => n.tech === t)) });
  const cost = inTree.reduce((s, n) => s + (n.cost ?? 0), 0);

  return (
    <div className="techs">
      <div className="tree-stats">
        {trees.length > 1 && (
          <label>
            Árbol:{' '}
            <select value={current.key} onChange={(e) => onChange({ techTree: e.target.value, techVariant: undefined })}>
              {trees.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </label>
        )}
        {current.variants.length > 0 && (
          <label title="Algunas facciones tienen tecnologías propias en lugar de las genéricas">
            Facción concreta:{' '}
            <select value={tree.variant ?? ''} onChange={(e) => onChange({ techVariant: e.target.value || undefined })}>
              <option value="">Genérica</option>
              {current.variants.map((v) => <option key={v.fk} value={v.fk}>{v.name}</option>)}
            </select>
          </label>
        )}
        <span>Investigadas: <b>{inTree.length}</b> / {tree.nodes.length}</span>
        <span className="muted">Coste: {cost.toLocaleString('es-MX')} puntos</span>
        <label><input type="checkbox" checked={onlyBattle} onChange={(e) => setOnlyBattle(e.target.checked)} /> Resaltar las de batalla</label>
        <button className="ghost" onClick={() => all(true)} title="Investiga todas las que dan bufos de batalla (y sus requisitos)">+ Todas las de batalla</button>
        <button className="ghost" onClick={() => all(false)}>+ Todas</button>
        <button className="ghost" onClick={clear}>Limpiar</button>
      </div>
      <div className="tech-scroll">
        <div className="tech-grid" style={{ gridTemplateColumns: `repeat(${cols}, 128px)`, gridTemplateRows: `repeat(${rows}, auto)` }}>
          {tree.nodes.map((n) => {
            const got = have.has(n.tech);
            const avail = !got && isAvailable(n, byKey, have);
            const cls = ['tech', got ? 'got' : avail ? 'avail' : 'locked', n.battle ? 'battle' : '', onlyBattle && !n.battle ? 'dim' : ''].join(' ');
            return (
              <button
                key={n.key}
                className={cls}
                style={{ gridColumn: n.col + 1, gridRow: n.row - tree.minRow + 1 }}
                onClick={() => (got ? undefined : research(n))}
                onContextMenu={(e) => { e.preventDefault(); if (got) forget(n); }}
                onMouseEnter={(e) => setHover({ node: n, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHover(null)}
              >
                <span className="tech-name">{got ? '✓ ' : ''}{n.battle ? '⚔ ' : ''}{n.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="small muted">
        Clic: investigar (también sus requisitos) · Clic derecho: quitar · ⚔ = da bufos de batalla. Los bufos se suman a las tarjetas de tus tropas y personajes
        (aparecen como "Tecnologías" en el desglose de cada stat).
      </p>
      {hover && <TechTip hover={hover} byKey={byKey} have={have} />}
    </div>
  );
}

function TechTip({ hover, byKey, have }: { hover: { node: TechNode; rect: DOMRect }; byKey: Map<string, TechNode>; have: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: 0 });
  const { node, rect } = hover;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = rect.right + 10;
    if (left + w > window.innerWidth - 8) left = Math.max(8, rect.left - w - 10);
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - h - 8));
    setPos({ left, top });
  }, [rect, node]);
  const req = [...node.parents, ...node.requires].map((k) => byKey.get(k)!).filter(Boolean);
  return (
    <div className="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <h4>{node.name}</h4>
      {node.description && <div className="tt-desc">{node.description}</div>}
      <ul>
        {node.effects.filter((e) => e.text).map((e, i) => (
          <li key={i}>
            <span className={'tag ' + e.kind}>
              {e.kind === 'battle' || e.kind === 'attribute' ? `Batalla · ${TARGET[e.target] ?? ''}${e.who ? ` (${WHO[e.who]})` : ''}` : e.kind === 'magic' ? 'Magia' : 'Campaña'}
            </span>{' '}
            {e.text}
          </li>
        ))}
      </ul>
      {req.length > 0 && (
        <div className="small">
          {node.parentsNeeded < node.parents.length ? `Requiere ${node.parentsNeeded} de: ` : 'Requiere: '}
          {req.map((r, i) => <span key={r.key} className={have.has(r.tech) ? 'ok' : 'bad'}>{i ? ', ' : ''}{r.name}</span>)}
        </div>
      )}
      {node.cost ? <div className="muted small">Investigación: {node.cost} puntos</div> : null}
    </div>
  );
}
