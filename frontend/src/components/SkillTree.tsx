import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BuildSelection, CharacterTree, ComputeResult, SkillNode } from '../types';
import { blockedBy, decrement, increment, isAvailable, levelOf, pointsLeft, pointsUsed, rankOf, setRank, whyNotBuy } from '../treeLogic';
import { MAX_RANK, isFreeLevel, pointsAtRank } from '../rankRules';
import { SkillIcon } from './SkillIcon';

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

const TARGET_LABEL: Record<string, string> = { self: 'propio', army: 'ejército', lord: 'al señor', none: '' };

interface Hover {
  node: SkillNode;
  rect: DOMRect;
}

export function SkillTree({ tree, selection, onChange, info }: Props) {
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
  const left = pointsLeft(selection, tree);
  const mounts = tree.rows.flat().filter((n) => n.isMount && levelOf(selection, n) > 0);
  const innates = tree.background.filter((b) => !b.autoActive);
  const innateValue = selection.innate === undefined ? tree.defaultInnate : selection.innate;

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
          <label>
            Rango <b className="rank-num">{rank}</b>
          </label>
          <button className="ghost" onClick={() => onChange(setRank(selection, tree, rank - 1))} disabled={rank <= 1}>−</button>
          <input type="range" min={1} max={MAX_RANK} value={rank} onChange={(e) => onChange(setRank(selection, tree, Number(e.target.value)))} />
          <button className="ghost" onClick={() => onChange(setRank(selection, tree, rank + 1))} disabled={rank >= MAX_RANK}>+</button>
          <span className={left < 0 ? 'bad' : ''}>
            Puntos: <b>{used}</b> / {pointsAtRank(rank)} <span className="muted">({left >= 0 ? `quedan ${left}` : `te pasas por ${-left}`})</span>
          </span>
          <button className="ghost" onClick={() => onChange({ ...selection, levels: {}, mount: null })}>Reiniciar árbol</button>
        </div>
        <div className="tree-options">
          <label>
            Montura:{' '}
            <select value={selection.mount ?? ''} onChange={(e) => onChange({ ...selection, mount: e.target.value || null })}>
              <option value="">A pie</option>
              {mounts.map((m) => (
                <option key={m.key} value={m.key}>{m.name}</option>
              ))}
            </select>
          </label>
          {innates.length > 0 && (
            <label title="En el juego cada personaje recibe un rasgo innato (al azar para los genéricos; fijo para muchos legendarios).">
              Rasgo innato:{' '}
              <select value={innateValue ?? ''} onChange={(e) => onChange({ ...selection, innate: e.target.value || null })}>
                <option value="">Ninguno / no sé</option>
                {innates.map((b) => (
                  <option key={b.key} value={b.key}>{b.name || b.skillKey}</option>
                ))}
              </select>
            </label>
          )}
          <span className="muted small legend">
            <i className="lg bought" /> comprada <i className="lg auto" /> por rango (gratis) <i className="lg rank" /> requiere rango <i className="lg blocked" /> excluida
          </span>
        </div>
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
      {group && (
        <div className="muted small">
          Excluyente ({group.name}): elige {group.max} de {group.nodes.map((k) => all.find((n) => n.key === k)?.name ?? k).join(' / ')}
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
