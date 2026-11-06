import { useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterSummary } from '../types';
import { GameIcon } from '../gameIcons';

interface Props {
  characters: CharacterSummary[];
  type: 'lord' | 'hero';
  value: string | null;
  onChange: (key: string) => void;
  /** Facción de campaña elegida: oculta los héroes legendarios que esa facción no consigue */
  campaign?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Símbolo del saber: el icono de su pasiva de saber; con más de un saber, el de saber combinado */
function LoreBadge({ c }: { c?: CharacterSummary }) {
  if (!c?.lore) return null;
  const { icons, names } = c.lore;
  return (
    <span className={'cp-lore' + (icons.length > 1 ? ' multi' : '')} title={icons.length > 1 ? `Varios saberes: ${names.join(', ')}` : `Saber: ${names[0]}`}>
      {icons.length > 1
        ? <GameIcon path="skills/character_magic" emoji="✦" size={16} />
        : <img src={`${import.meta.env.BASE_URL}abilities/${icons[0]}.png`} alt="" loading="lazy" />}
    </span>
  );
}

/** "Heraldo de Tzeentch (Metal)" -> base y variante (saber, marca...) */
const splitVariant = (n: string) => {
  // "Glorioso Señor de la Transformación (Metal) · Chs": lo que va tras "·" solo distingue copias repetidas
  const m = /^(.*?)\s*\(([^)]+)\)(?:\s*·.*)?$/.exec(n);
  return m ? { base: m[1], variant: m[2] } : { base: n, variant: '' };
};

/** Retrato de la carta del personaje; si no hay arte, la inicial */
function Portrait({ c, big }: { c?: CharacterSummary; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={'cp-art' + (big ? ' big' : '')}>
      {c?.art && !broken ? <img src={`/units/${c.art}.png`} alt="" loading="lazy" onError={() => setBroken(true)} /> : <b>{c?.name.charAt(0) ?? '?'}</b>}
      <LoreBadge c={c} />
    </span>
  );
}

/**
 * Selector de señor o héroe con retratos (como los dones de Daniel o los cargos de la corte):
 * botón con el elegido y una galería con buscador, legendarios arriba y genéricos abajo.
 */
export function CharacterPicker({ characters, type, value, onChange, campaign }: Props) {
  const [open, setOpen] = useState(!value);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const list = useMemo(
    () => characters.filter((c) => c.type === type && (!campaign || !c.factions || c.factions.includes(campaign) || c.key === value)),
    [characters, type, campaign, value],
  );
  const current = characters.find((c) => c.key === value);
  const shown = list.filter((c) => !q || norm(c.name).includes(norm(q)));
  const legendary = shown.filter((c) => c.legendary);
  // Genéricos con variantes (saber o marca entre paréntesis): una sola carta y el saber se elige con botones, como en el juego
  const variantsOf = useMemo(() => {
    const m = new Map<string, CharacterSummary[]>();
    for (const c of list) {
      const { base, variant } = splitVariant(c.name);
      if (!variant) continue;
      const l = m.get(base) ?? [];
      // Una por variante: entre copias repetidas, la elegida o la de nombre más corto
      const same = l.findIndex((x) => splitVariant(x.name).variant === variant);
      if (same < 0) l.push(c);
      else if (c.key === value || (l[same].key !== value && c.name.length < l[same].name.length)) l[same] = c;
      m.set(base, l);
    }
    for (const [k, l] of m) if (l.length < 2) m.delete(k);
    return m;
  }, [list, value]);
  const collapse = (arr: CharacterSummary[]) => {
    const out: CharacterSummary[] = [];
    const done = new Set<string>();
    for (const c of arr) {
      const { base } = splitVariant(c.name);
      const vs = variantsOf.get(base);
      if (!vs) { out.push(c); continue; }
      if (done.has(base)) continue;
      done.add(base);
      // La carta del grupo: la variante elegida si es de este grupo, si no la primera
      out.push(vs.find((x) => x.key === value) ?? vs[0]);
    }
    return out;
  };
  const generic = collapse(shown.filter((c) => !c.legendary));
  const legendaryTiles = collapse(legendary);
  const groupOf = (c?: CharacterSummary) => (c ? variantsOf.get(splitVariant(c.name).base) : undefined);
  const curGroup = groupOf(current);

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (value && box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && value) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    if (window.matchMedia('(min-width: 701px)').matches) search.current?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, value]);
  useEffect(() => { if (!value) setOpen(true); }, [value]);

  const pick = (k: string) => { onChange(k); setOpen(false); setQ(''); };
  const tiles = (arr: CharacterSummary[]) => (
    <div className="cp-grid">
      {arr.map((c) => (
        <button key={c.key} className={'cp-tile' + (c.key === value || (groupOf(c) && groupOf(c) === curGroup) ? ' on' : '') + (c.legendary ? ' leg' : '')} onClick={() => pick(c.key)} title={c.name}>
          <Portrait c={c} />
          <span className="cp-name">{groupOf(c) ? splitVariant(c.name).base : c.name}</span>
          {groupOf(c) && <span className="cp-variants muted">{groupOf(c)!.length} {groupOf(c)!.some((x) => x.lore) ? 'saberes' : 'variantes'}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="cp" ref={box}>
      <button className={'cp-current' + (open ? ' open' : '')} onClick={() => setOpen((o) => !o)}>
        <Portrait c={current} big />
        <span className="cp-cur-text">
          <span className="cp-cur-kind">{type === 'lord' ? 'Señor' : 'Héroe'}{current ? (current.legendary ? ' legendario' : ' genérico') : ''}</span>
          <b>{current?.name ?? (type === 'lord' ? 'Elige un señor' : 'Elige un héroe')}</b>
        </span>
        <span className="cp-caret">{open ? '▴' : '▾'}</span>
      </button>
      {curGroup && (
        <div className="cp-radio" role="radiogroup" aria-label="Saber">
          <span className="muted small">{curGroup.some((x) => x.lore) ? 'Saber:' : 'Variante:'}</span>
          {curGroup.map((v) => (
            <label key={v.key} className={'cp-radio-opt' + (v.key === value ? ' on' : '')} title={v.lore?.names.join(', ')}>
              <input type="radio" name={`variant-${type}`} checked={v.key === value} onChange={() => onChange(v.key)} />
              <LoreBadge c={v} />
              {splitVariant(v.name).variant}
            </label>
          ))}
        </div>
      )}
      {open && (
        <div className="cp-panel">
          <div className="cp-top">
            <input ref={search} className="cp-search" placeholder={type === 'lord' ? 'Buscar señor…' : 'Buscar héroe…'} value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="muted small">{shown.length} de {list.length}</span>
            {value && <button className="ghost" onClick={() => setOpen(false)}>Cerrar</button>}
          </div>
          {legendary.length > 0 && (
            <>
              <h4 className="cp-sec">⭐ {type === 'lord' ? 'Señores legendarios' : 'Héroes legendarios'}</h4>
              {tiles(legendaryTiles)}
            </>
          )}
          {generic.length > 0 && (
            <>
              <h4 className="cp-sec">{type === 'lord' ? 'Señores genéricos' : 'Héroes genéricos'}</h4>
              {tiles(generic)}
            </>
          )}
          {shown.length === 0 && <p className="muted small">Nada coincide con «{q}».</p>}
        </div>
      )}
    </div>
  );
}
