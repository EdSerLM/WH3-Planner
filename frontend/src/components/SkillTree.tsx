import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BuildSelection, CharacterTree, ComputeResult, SkillNode } from '../types';
import { blockedBy, buyHint, decrement, increment, isAvailable, levelOf, normalize, pointsUsed, rankOf, setRank, whyNotBuy } from '../treeLogic';
import { MAX_RANK, isFreeLevel } from '../rankRules';
import { SkillIcon } from './SkillIcon';
import { ItemsPanel } from './ItemsPanel';

interface Props {
  tree: CharacterTree;
  selection: BuildSelection;
  onChange: (sel: BuildSelection) => void;
  info?: ComputeResult['builds'][number];
}

const KIND_LABEL: Record<string, string> = {
  battle: 'Batalla',
  campaign: 'Campaña',
  magic: 'Magia',
  ability: 'Habilidad',
  mount: 'Montura',
  attribute: 'Atributo',
  other: 'Otro',
};

const TARGET_LABEL: Record<string, string> = { self: 'propio', army: 'ejército', lord: 'al señor', chars: 'personajes', none: '' };

interface Hover {
  node: SkillNode;
  rect: DOMRect;
}

export function SkillTree({ tree, selection: rawSelection, onChange, info }: Props) {
  // Siempre trabajamos con el rango ya recalculado
  const selection = useMemo(() => normalize(rawSelection, tree), [rawSelection, tree]);
  const [hover, setHover] = useState<Hover | null>(null);
  const rows = useMemo(
    () =>
      tree.rows
        .map((r, i) => ({ label: tree.rowLabels?.[i] ?? '', nodes: r.filter((n) => n.visible).sort((a, b) => a.col - b.col) }))
        .filter((r) => r.nodes.length),
    [tree],
  );
  const rank = rankOf(selection);
  const used = pointsUsed(selection, tree);
  const floor = selection.rank ?? 1;
  const mounts = tree.rows.flat().filter((n) => n.isMount);
  // Elegir una montura: si no está comprada, se compra (y el rango sube si hace falta)
  const pickMount = (key: string) => {
    if (!key) return onChange({ ...selection, mount: null });
    const node = mounts.find((m) => m.key === key)!;
    let next = selection;
    if (levelOf(selection, node) === 0) next = normalize(increment(selection, node, tree), tree);
    onChange({ ...next, mount: levelOf(next, node) > 0 ? key : next.mount ?? null });
  };
  const mountRank = (n: SkillNode) => n.levels[0]?.autoRank ?? n.levels[0]?.requiredRank;
  const innates = tree.background.filter((b) => !b.autoActive);
  const innateValue = selection.innate === undefined ? tree.defaultInnate : selection.innate;
  const [showInnates, setShowInnates] = useState(false);
  // Textos de efecto de un rasgo (y uno corto para el desplegable)
  const traitLines = (b: SkillNode) => b.levels.flatMap((l) => l.effects).filter((e) => e.text).map((e) => ({ text: e.text, kind: e.kind }));
  const traitShort = (b: SkillNode) => {
    const ls = traitLines(b);
    const main = ls.find((l) => l.kind === 'battle' || l.kind === 'attribute') ?? ls[0];
    if (!main) return '';
    const t = main.text.replace(/\s*\([^)]*\)\s*$/, '');
    return (t.length > 58 ? t.slice(0, 56) + '…' : t) + (ls.length > 1 ? ` (+${ls.length - 1})` : '');
  };
  const innateSel = innates.find((b) => b.key === innateValue);

  const show = (n: SkillNode, el: HTMLElement) => setHover({ node: n, rect: el.getBoundingClientRect() });
  // La ventanita va pegada al nodo: al hacer scroll se cierra
  useEffect(() => {
    const close = () => setHover(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  return (
    <div className="tree" onMouseLeave={() => setHover(null)}>
      <div className="tree-head">
        <div className="rank-bar">
          <label title="El rango sube solo al comprar habilidades (1 punto por rango, o el rango que pida la habilidad).">
            Rango <b className="rank-num">{rank}</b>
          </label>
          <span className="muted small">mínimo</span>
          <button className="ghost" onClick={() => onChange(setRank(selection, tree, Math.min(floor, rank) - 1))} disabled={rank <= 1}>−</button>
          <input
            type="range" min={1} max={MAX_RANK} value={rank}
            title="Fija un rango mínimo (para ver lo que se desbloquea solo). Bajarlo quita lo que ya no cabe."
            onChange={(e) => onChange(setRank(selection, tree, Number(e.target.value)))}
          />
          <button className="ghost" onClick={() => onChange(setRank(selection, tree, rank + 1))} disabled={rank >= MAX_RANK}>+</button>
          <span>
            Puntos gastados: <b>{used}</b> <span className="muted">(1 por rango)</span>
          </span>
          {selection.rankOver ? <span className="bad">No cabe: necesitaría rango {selection.rankOver}</span> : null}
          <button className="ghost" onClick={() => onChange(normalize({ ...selection, levels: {}, mount: null, rank: 1 }, tree))}>Reiniciar árbol</button>
        </div>
        <div className="tree-options">
          <label>
            Montura:{' '}
            <select value={selection.mount ?? ''} onChange={(e) => pickMount(e.target.value)} title="Al elegir una montura se compra en el árbol (y el rango sube si la pide)">
              <option value="">A pie</option>
              {mounts.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}{levelOf(selection, m) > 0 ? '' : mountRank(m) ? ` (rango ${mountRank(m)})` : ' (comprar)'}
                </option>
              ))}
            </select>
          </label>
          {innates.length > 0 && (
            <label title="En el juego cada personaje recibe un rasgo innato (al azar para los genéricos; fijo para muchos legendarios).">
              Rasgo innato:{' '}
              <select value={innateValue ?? ''} onChange={(e) => onChange({ ...selection, innate: e.target.value || null })}>
                <option value="">Ninguno / no sé</option>
                {innates.map((b) => (
                  <option key={b.key} value={b.key} title={traitLines(b).map((l) => l.text).join('\n')}>
                    {b.name || b.skillKey}{traitShort(b) ? ` — ${traitShort(b)}` : ''}
                  </option>
                ))}
              </select>{' '}
              <button type="button" className="ghost small" onClick={(e) => { e.preventDefault(); setShowInnates((v) => !v); }}>
                {showInnates ? 'Ocultar' : `Ver todos (${innates.length})`}
              </button>
            </label>
          )}
          <span className="muted small legend">
            <i className="lg bought" /> comprada <i className="lg auto" /> por rango (gratis) <i className="lg rank" /> requiere rango <i className="lg blocked" /> excluida
          </span>
        </div>
        {innates.length > 0 && !showInnates && innateSel && (
          <div className="trait-info small">
            <b>{innateSel.name}:</b> {traitLines(innateSel).map((l) => l.text).join(' · ') || 'sin efectos de juego'}
          </div>
        )}
        {showInnates && (
          <div className="trait-list">
            {innates.map((b) => (
              <button
                key={b.key}
                type="button"
                className={'trait-card' + (b.key === innateValue ? ' on' : '')}
                onClick={() => onChange({ ...selection, innate: b.key })}
                title="Elegir este rasgo"
              >
                <b>{b.name || b.skillKey}</b>
                {b.description && <span className="muted small trait-desc">{b.description}</span>}
                <ul>
                  {traitLines(b).map((l, i) => (
                    <li key={i} className={l.kind}>{l.text}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}
        <ItemsPanel tree={tree} selection={selection} onChange={onChange} />
        {info?.warnings.length ? <div className="warn">{info.warnings.join(' · ')}</div> : null}
      </div>

      <div className="tree-rows">
        {rows.map((row, i) => (
          <div className="tree-row" key={i}>
            <div className="row-label">{row.label}</div>
            <div className="row-nodes">
              {row.nodes.map((n) => {
                const lvl = levelOf(selection, n);
                const avail = isAvailable(n, selection, tree);
                const blocked = blockedBy(n, selection, tree);
                const reason = whyNotBuy(n, selection, tree);
                const next = n.levels[lvl];
                const autoAll = n.levels.every((l) => l.autoRank);
                const rankLocked = lvl === 0 && !!next && ((next.requiredRank ?? 0) > rank || (!!next.autoRank && next.autoRank > rank));
                const freeNow = lvl > 0 && Array.from({ length: lvl }, (_, j) => isFreeLevel(n, j, rank)).every(Boolean);
                const cls = [
                  'node',
                  lvl > 0 ? (freeNow ? 'auto' : 'bought') : blocked ? 'blocked' : rankLocked ? 'rank-locked' : avail ? 'avail' : 'locked',
                  lvl === n.levels.length && lvl > 0 ? 'max' : '',
                  tree.exclusiveGroups?.some((g) => g.nodes.includes(n.key)) ? 'excl' : '',
                ].join(' ');
                let badge = '';
                if (next?.autoRank && next.autoRank > rank) badge = `auto R${next.autoRank}`;
                else if (next?.requiredRank && next.requiredRank > rank) badge = `R${next.requiredRank}`;
                return (
                  <button
                    key={n.key}
                    className={cls}
                    onClick={() => onChange(increment(selection, n, tree))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onChange(decrement(selection, n, tree));
                    }}
                    onMouseEnter={(e) => show(n, e.currentTarget)}
                    onFocus={(e) => show(n, e.currentTarget)}
                    onBlur={() => setHover(null)}
                  >
                    <SkillIcon node={n} />
                    <span className="node-body">
                      <span className="node-name">{blocked ? '⛓ ' : ''}{n.name}</span>
                      <span className="node-foot">
                        <span className="pips">
                          {n.levels.map((l, j) => (
                            <i key={j} className={(j < lvl ? (isFreeLevel(n, j, rank) ? 'free' : 'on') : '') + (l.autoRank ? ' a' : '')} />
                          ))}
                        </span>
                        {badge && <span className={'rank-badge' + (autoAll ? ' auto' : '')}>{badge}</span>}
                        {!badge && reason && lvl < n.levels.length && lvl === 0 && !blocked && <span className="rank-badge dim">🔒</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Clic: subir · Clic derecho: bajar · Lo que da el rango (monturas, Immortality, Soldiers of Renown…) se activa solo al subir el rango.</p>

      {hover && <Tooltip hover={hover} tree={tree} selection={selection} />}
    </div>
  );
}

function Tooltip({ hover, tree, selection }: { hover: Hover; tree: CharacterTree; selection: BuildSelection }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: 0 });
  const { node, rect } = hover;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right + 10;
    if (left + w > vw - 8) left = rect.left - w - 10; // a la izquierda si no cabe
    if (left < 8) left = Math.max(8, Math.min(vw - w - 8, rect.left)); // pantallas angostas
    let top = rect.top;
    if (left === rect.left || (left > rect.left - w && left < rect.right)) top = rect.bottom + 8;
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos({ left, top });
  }, [rect, node]);

  const level = levelOf(selection, node);
  const rank = rankOf(selection);
  const blocked = blockedBy(node, selection, tree);
  const reason = whyNotBuy(node, selection, tree);
  const group = tree.exclusiveGroups?.find((g) => g.nodes.includes(node.key));
  const all = tree.rows.flat();

  return (
    <div className="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <div className="tt-head">
        <SkillIcon node={node} size={42} />
        <div>
          <h4>{node.name} <span className="muted">({level}/{node.levels.length})</span></h4>
          {node.nameEn && node.nameEn !== node.name && <div className="muted small">{node.nameEn}</div>}
          {node.description && <div className="tt-desc">{node.description}</div>}
        </div>
      </div>
      {blocked && <div className="blocked-msg">⛓ Bloqueada por otra habilidad: {blocked.by.join(', ')}. Quítala (clic derecho) para elegir esta.</div>}
      {!blocked && reason && level < node.levels.length && <div className="reason">{reason}</div>}
      {!reason && buyHint(node, selection) && <div className="hint">{buyHint(node, selection)}</div>}
      {group && (
        <div className="muted small">
          Excluyente{group.name === 'Excluyentes del juego' ? '' : ` (${group.name})`}: elige {group.max} de {group.nodes.map((k) => all.find((n) => n.key === k)?.name ?? k).join(' / ')}
        </div>
      )}
      {node.levels.map((l, i) => (
        <div key={i} className={'lvl' + (i < level ? ' have' : '') + (i + 1 === level ? ' current' : '')}>
          <div className="lvl-head">
            Nivel {i + 1}
            {l.autoRank ? <span className={l.autoRank <= rank ? 'ok' : 'muted'}> · se desbloquea sola en rango {l.autoRank}</span> : null}
            {l.requiredRank ? <span className={l.requiredRank <= rank ? 'ok' : 'bad'}> · requiere rango {l.requiredRank}</span> : null}
            {i < node.pointsOnCreation ? <span className="ok"> · gratis desde el inicio</span> : null}
          </div>
          <ul>
            {l.effects.filter((e) => e.text).map((e, j) => (
              <li key={j} title={e.textEn && e.textEn !== e.text ? `Original: ${e.textEn}` : undefined}>
                <span className={'tag ' + e.kind}>{KIND_LABEL[e.kind]}{e.target !== 'none' && e.kind === 'battle' ? ` · ${TARGET_LABEL[e.target]}` : ''}</span>{' '}
                {e.text}
                {e.units?.length ? <span className="muted"> ({e.units.length} unidades)</span> : null}
              </li>
            ))}
            {l.abilities.map((k) => {
              const a = tree.abilityInfo[k];
              if (!a) return null;
              return (
                <li key={k} className="ability-line">
                  <span className="tag ability">{a.passive ? 'Pasiva' : a.type ?? 'Habilidad'}</span> <b>{a.name}</b>
                  {a.duration > 0 ? ` · ${a.duration} s` : ''}
                  {a.cooldown ? ` · recarga ${a.cooldown} s` : ''}
                  {a.range ? ` · ${a.range} m` : ''}
                  {a.stats.length ? <div className="muted small">{a.stats.map((s) => s.d).join(', ')}</div> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="muted small">Clave: {node.skillKey}</div>
    </div>
  );
}
