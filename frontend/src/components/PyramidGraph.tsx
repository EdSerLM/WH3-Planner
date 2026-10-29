import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { CharacterSummary, GraphData, GraphNode, StatKey, UnitData } from '../types';
import { TechUnits } from './TechUnits';

interface Props {
  faction: string;
  researched: string[];
  onChange: (p: { techs: string[] }) => void;
  units: UnitData[];
  characters: CharacterSummary[];
  labels: Record<StatKey, string>;
  /** Señor y héroes del ejército ("lord:<clave>" / "hero:<clave>") */
  armyChars?: string[];
}

// Color por gran grupo (supercluster) del juego
const SC_COLOR: Record<string, string> = {
  black_pyramid_frontline: '#c9a24a', black_pyramid_missiles: '#6fb36f', black_pyramid_cavalry: '#5b9bd5',
  black_pyramid_beasts_monsters: '#b36b4a', black_pyramid_war_machines: '#8f8f8f', black_pyramid_magic: '#9a6fd1',
  black_pyramid_mortarchs: '#d16f9a', black_pyramid_nagash: '#e0d36a', black_pyramid_campaign: '#4aa8a0',
};
const TARGET: Record<string, string> = { army: 'ejército', chars: 'personajes', self: 'propio', lord: 'señor', none: '' };
const STEP = 21.3; // separación de la cuadrícula del juego en px

/**
 * Pirámide Negra (Legiones No Muertas): grafo de nodos vecinos. Se puede tomar un nodo si algún vecino ya está tomado
 * (empezando por el origen); las puertas piden haber gastado cierto número de puntos.
 */
export function PyramidGraph({ faction, researched, onChange, units, characters, labels, armyChars }: Props) {
  const [graphs, setGraphs] = useState<{ key: string; name: string }[]>([]);
  const [g, setG] = useState<GraphData | null>(null);
  const [onlyBattle, setOnlyBattle] = useState(true);
  const [zoom, setZoom] = useState(1.3);
  const [hover, setHover] = useState<{ node: GraphNode; rect: DOMRect } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setG(null);
    api.graphs(faction).then(setGraphs).catch(() => setGraphs([]));
  }, [faction]);
  useEffect(() => {
    if (graphs[0]) api.graph(graphs[0].key).then(setG).catch(() => setG(null));
  }, [graphs]);

  const byKey = useMemo(() => new Map((g?.nodes ?? []).map((n) => [n.key, n])), [g]);
  // Vecinos (los enlaces del juego no tienen dirección útil)
  const nbrs = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of g?.nodes ?? []) for (const p of n.parents) {
      if (!byKey.has(p)) continue;
      m.set(n.key, (m.get(n.key) ?? new Set()).add(p));
      m.set(p, (m.get(p) ?? new Set()).add(n.key));
    }
    return m;
  }, [g, byKey]);
  const have = useMemo(() => new Set(researched), [researched]);

  // Al abrir: centrar la vista en el origen (abajo al centro de la pirámide)
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const o = box?.querySelector<HTMLElement>('.pyr-node.origin');
    if (!box || !o) return;
    box.scrollLeft = o.offsetLeft - box.clientWidth / 2;
    box.scrollTop = o.offsetTop - box.clientHeight * 0.75;
  }, [g]);

  if (!g) return null;
  const isGotIn = (set: Set<string>, n: GraphNode) => n.key === g.origin || set.has(n.tech);
  const isGot = (n: GraphNode) => isGotIn(have, n);
  const gotNodes = g.nodes.filter((n) => n.key !== g.origin && have.has(n.tech));
  const points = gotNodes.reduce((s, n) => s + n.cost, 0);
  const avail = (n: GraphNode) => !isGot(n) && [...(nbrs.get(n.key) ?? [])].some((k) => isGot(byKey.get(k)!)) && (n.threshold ?? 0) <= points;

  /** Camino más corto desde lo ya tomado hasta el nodo (los tomados cuestan 0) */
  const pathTo = (target: GraphNode, set: Set<string> = have): GraphNode[] | null => {
    const isGot = (n: GraphNode) => isGotIn(set, n);
    const dist = new Map<string, number>([[g.origin, 0]]);
    const prev = new Map<string, string>();
    const queue: string[] = [g.origin];
    for (const n of g.nodes) if (isGot(n) && n.key !== g.origin) { dist.set(n.key, 0); queue.push(n.key); }
    while (queue.length) {
      queue.sort((a, b) => dist.get(a)! - dist.get(b)!);
      const k = queue.shift()!;
      if (k === target.key) break;
      for (const nb of nbrs.get(k) ?? []) {
        const d = dist.get(k)! + (isGot(byKey.get(nb)!) ? 0 : byKey.get(nb)!.cost || 1);
        if (d < (dist.get(nb) ?? Infinity)) { dist.set(nb, d); prev.set(nb, k); queue.push(nb); }
      }
    }
    if (!dist.has(target.key)) return null;
    const path: GraphNode[] = [];
    for (let k: string | undefined = target.key; k && !isGot(byKey.get(k)!); k = prev.get(k)) path.unshift(byKey.get(k)!);
    return path;
  };

  const take = (n: GraphNode) => {
    const path = pathTo(n);
    if (!path) return;
    let pts = points;
    for (const x of path) {
      if ((x.threshold ?? 0) > pts) {
        setMsg(`"${x.name}" es una puerta: necesita ${x.threshold} puntos gastados antes (llevarías ${pts}).`);
        return;
      }
      pts += x.cost;
    }
    setMsg(null);
    onChange({ techs: [...new Set([...researched, ...path.map((x) => x.tech)])] });
  };
  /** Toma varios nodos (con su camino); los que piden más puntos de los que llevarías se saltan */
  const takeMany = (techs: string[]) => {
    const got = new Set(researched);
    const ptsOf = () => g.nodes.reduce((s, x) => s + (x.key !== g.origin && got.has(x.tech) ? x.cost : 0), 0);
    const targets = g.nodes.filter((n) => techs.includes(n.tech) && !isGotIn(got, n)).sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0));
    // Por vueltas: se toma cada camino hasta la primera puerta cerrada; los puntos gastados pueden abrirla en la siguiente vuelta
    for (let changed = true; changed;) {
      changed = false;
      for (const n of targets) {
        if (isGotIn(got, n)) continue;
        const path = pathTo(n, got);
        if (!path) continue;
        let pts = ptsOf();
        for (const x of path) {
          if ((x.threshold ?? 0) > pts) break;
          got.add(x.tech);
          pts += x.cost;
          changed = true;
        }
      }
    }
    const skipped = targets.filter((n) => !isGotIn(got, n)).map((n) => n.name);
    setMsg(skipped.length ? `No se pudieron tomar (puerta con más puntos de los que llevarías): ${skipped.join(', ')}` : null);
    onChange({ techs: [...got] });
  };
  const drop = (n: GraphNode) => {
    // Quitar el nodo y todo lo que quede desconectado del origen
    const keep = new Set<string>([g.origin]);
    const stack = [g.origin];
    while (stack.length) {
      const k = stack.pop()!;
      for (const nb of nbrs.get(k) ?? []) {
        const x = byKey.get(nb)!;
        if (!keep.has(nb) && nb !== n.key && have.has(x.tech)) { keep.add(nb); stack.push(nb); }
      }
    }
    const inGraph = new Set(g.nodes.map((x) => x.tech));
    onChange({ techs: researched.filter((t) => !inGraph.has(t) || g.nodes.some((x) => x.tech === t && keep.has(x.key))) });
  };
  const clear = () => {
    const inGraph = new Set(g.nodes.map((x) => x.tech));
    onChange({ techs: researched.filter((t) => !inGraph.has(t)) });
  };

  const minX = Math.min(...g.nodes.map((n) => n.x)), minY = Math.min(...g.nodes.map((n) => n.y));
  const maxX = Math.max(...g.nodes.map((n) => n.x)), maxY = Math.max(...g.nodes.map((n) => n.y));
  const sc = zoom;
  const pos = (n: GraphNode) => ({ left: (n.x - minX) * sc + 12, top: (n.y - minY) * sc + 12 });
  const size = Math.round(STEP * sc * 0.82);
  const battleGot = gotNodes.filter((n) => n.battle);
  const clusters = Object.entries(g.clusters).sort((a, b) => (a[1].sc ?? '').localeCompare(b[1].sc ?? '') || (a[1].order ?? 0) - (b[1].order ?? 0));

  return (
    <div className="techs pyramid">
      <div className="tree-stats">
        <b>{g.name}</b>
        <span>Nodos: <b>{gotNodes.length}</b> / {g.nodes.length - 1}</span>
        <span>Puntos gastados: <b>{points}</b></span>
        <span className="muted">Con bufos de batalla: {battleGot.length}</span>
        <label><input type="checkbox" checked={onlyBattle} onChange={(e) => setOnlyBattle(e.target.checked)} /> Resaltar los de batalla</label>
        <label>Zoom <input type="range" min={1} max={2.6} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        <button className="ghost" onClick={() => takeMany(g.nodes.filter((n) => n.battle).map((n) => n.tech))} title="Toma todos los nodos que dan bufos de batalla (y el camino hasta ellos)">
          + Todos los de batalla
        </button>
        <button className="ghost" onClick={() => takeMany(g.nodes.map((n) => n.tech))}>+ Todos</button>
        <button className="ghost" onClick={clear}>Limpiar</button>
      </div>
      {msg && <div className="warn small">{msg}</div>}
      <div className="tech-scroll" ref={scrollRef}>
        <div className="pyr-canvas" style={{ width: (maxX - minX) * sc + 24 + size, height: (maxY - minY) * sc + 24 + size }}>
          <svg className="pyr-links" width={(maxX - minX) * sc + 24 + size} height={(maxY - minY) * sc + 24 + size}>
            {g.nodes.flatMap((n) => n.parents.filter((p) => byKey.has(p)).map((p) => {
              const a = pos(n), b = pos(byKey.get(p)!);
              const on = isGot(n) && isGot(byKey.get(p)!);
              return <line key={n.key + p} x1={a.left + size / 2} y1={a.top + size / 2} x2={b.left + size / 2} y2={b.top + size / 2} className={on ? 'on' : ''} />;
            }))}
          </svg>
          {g.nodes.map((n) => {
            const got = isGot(n);
            const av = avail(n);
            const color = SC_COLOR[g.clusters[n.cluster ?? '']?.sc ?? ''] ?? '#888';
            const cls = ['pyr-node', n.type ?? '', got ? 'got' : av ? 'avail' : 'locked', n.battle ? 'battle' : '', onlyBattle && !n.battle && !got ? 'dim' : '', n.key === g.origin ? 'origin' : ''].join(' ');
            return (
              <button
                key={n.key}
                className={cls}
                style={{ ...pos(n), width: size, height: size, ['--c' as string]: color }}
                onClick={() => (got ? undefined : take(n))}
                onContextMenu={(e) => { e.preventDefault(); if (got && n.key !== g.origin) drop(n); }}
                onMouseEnter={(e) => setHover({ node: n, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHover(null)}
              >
                {n.threshold && !got ? '🔒' : n.battle ? '⚔' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pyr-legend small">
        {clusters.map(([k, c]) => (
          <span key={k} className="pyr-leg" title={c.d}>
            <i style={{ background: SC_COLOR[c.sc ?? ''] ?? '#888' }} /> {c.n}
          </span>
        ))}
      </div>
      <p className="small muted">
        Clic: tomar el nodo (y el camino más corto desde lo que ya tienes) · Clic derecho: quitarlo (y lo que quede desconectado) · ⚔ = bufo de batalla ·
        🔒 = puerta que pide puntos gastados. Los bufos de batalla se suman a las tarjetas como las tecnologías.
      </p>
      <TechUnits nodes={g.nodes.filter((n) => n.key !== g.origin)} have={have} units={units} characters={characters} labels={labels} onResearch={takeMany} armyChars={armyChars} />
      {hover && <NodeTip hover={hover} g={g} />}
    </div>
  );
}

function NodeTip({ hover, g }: { hover: { node: GraphNode; rect: DOMRect }; g: GraphData }) {
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
  const cl = g.clusters[node.cluster ?? ''];
  return (
    <div className="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <h4>{node.name}</h4>
      {cl && <div className="muted small">{cl.n}</div>}
      {node.description && <div className="tt-desc">{node.description}</div>}
      <ul>
        {node.effects.filter((e) => e.text).map((e, i) => (
          <li key={i}>
            <span className={'tag ' + e.kind}>
              {e.kind === 'battle' || e.kind === 'attribute' ? `Batalla · ${TARGET[e.target] ?? ''}` : e.kind === 'magic' ? 'Magia' : 'Campaña'}
            </span>{' '}
            {e.text}
          </li>
        ))}
      </ul>
      {node.threshold ? <div className="small bad">Puerta: necesita {node.threshold} puntos gastados</div> : null}
      {node.cost ? <div className="muted small">Coste: {node.cost} punto{node.cost === 1 ? '' : 's'}</div> : null}
    </div>
  );
}
