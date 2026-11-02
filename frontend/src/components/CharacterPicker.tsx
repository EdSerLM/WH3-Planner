import { useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterSummary } from '../types';

interface Props {
  characters: CharacterSummary[];
  type: 'lord' | 'hero';
  value: string | null;
  onChange: (key: string) => void;
  /** Facción de campaña elegida: oculta los héroes legendarios que esa facción no consigue */
  campaign?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Retrato de la carta del personaje; si no hay arte, la inicial */
function Portrait({ c, big }: { c?: CharacterSummary; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={'cp-art' + (big ? ' big' : '')}>
      {c?.art && !broken ? <img src={`/units/${c.art}.png`} alt="" loading="lazy" onError={() => setBroken(true)} /> : <b>{c?.name.charAt(0) ?? '?'}</b>}
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
  const generic = shown.filter((c) => !c.legendary);

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
        <button key={c.key} className={'cp-tile' + (c.key === value ? ' on' : '') + (c.legendary ? ' leg' : '')} onClick={() => pick(c.key)} title={c.name}>
          <Portrait c={c} />
          <span className="cp-name">{c.name}</span>
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
              {tiles(legendary)}
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
