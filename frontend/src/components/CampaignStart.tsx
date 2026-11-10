import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Flag } from '../gameIcons';
import type { CampaignStartRace } from '../types';

/**
 * Elección de raza y campaña como en la pantalla de inicio del juego: razas a la izquierda y, a la derecha,
 * las facciones de campaña con el retrato de sus señores legendarios.
 */
interface Props {
  faction: string;
  campaign?: string;
  /** Elegir: raza, facción de campaña (undefined = todo el roster) y el señor legendario si se eligió uno */
  onPick: (race: string, campaign: string | undefined, leader?: string) => void;
  onClose: () => void;
}

let cache: CampaignStartRace[] | null = null;
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CampaignStart({ faction, campaign, onPick, onClose }: Props) {
  const [races, setRaces] = useState<CampaignStartRace[]>(cache ?? []);
  const [race, setRace] = useState(faction);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!cache) api.campaignStart().then((r) => { cache = r; setRaces(r); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // Que la raza actual se vea en la lista (en el celular la lista es una tira horizontal)
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('.cs-race.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [races.length]);
  const t = norm(q.trim());
  // Con búsqueda: facciones y señores de todas las razas que coinciden
  const shown = useMemo(() => {
    if (!t) return races.filter((r) => r.key === race);
    return races.map((r) => ({
      ...r,
      factions: r.factions.filter((f) => norm(f.name).includes(t) || norm(r.name).includes(t) || f.leaders.some((l) => norm(l.name).includes(t))),
    })).filter((r) => r.factions.length);
  }, [races, race, t]);

  return (
    <div className="cs-overlay" role="dialog" aria-label="Elegir campaña" onClick={onClose}>
      <div className="cs-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cs-head">
          <h2>Elige tu campaña</h2>
          <input className="cs-search" value={q} placeholder="Buscar señor o facción…" onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" onClick={onClose} title="Cerrar (Esc)">✕</button>
        </div>
        <div className="cs-body">
          <nav className="cs-races" ref={navRef}>
            {races.map((r) => (
              <button key={r.key} className={'cs-race' + (r.key === race && !t ? ' on' : '')} onClick={() => { setRace(r.key); setQ(''); }}>
                <Flag flag={r.flag} size={34} />
                <span>{r.name}</span>
              </button>
            ))}
            {!races.length && <span className="muted small">Cargando…</span>}
          </nav>
          <div className="cs-main">
            {shown.map((r) => (
              <section key={r.key}>
                <h3><Flag flag={r.flag} size={28} /> {r.name}</h3>
                <div className="cs-grid">
                  {r.factions.flatMap((f) => (f.leaders.length ? f.leaders : [null]).map((l) => (
                    <button
                      key={`${f.key}|${l?.id ?? ''}`}
                      className={'cs-card' + (r.key === faction && f.key === campaign ? ' on' : '')}
                      onClick={() => onPick(r.key, f.key, l?.id)}
                      title={l ? `${l.name} · ${f.name}` : f.name}
                    >
                      <div className="cs-portrait" style={l?.art ? { backgroundImage: `url(/units/${l.art}.png)` } : undefined}>
                        {!l?.art && <Flag flag={f.flag} size={72} />}
                      </div>
                      <div className="cs-names">
                        <b>{l?.name ?? f.name}</b>
                        <span><Flag flag={f.flag} size={18} /> {f.name}</span>
                      </div>
                    </button>
                  )))}
                  {!t && (
                    <button className={'cs-card cs-free' + (r.key === faction && !campaign ? ' on' : '')} onClick={() => onPick(r.key, undefined)} title="Sin facción de campaña: todo el roster de la raza">
                      <div className="cs-portrait"><Flag flag={r.flag} size={72} /></div>
                      <div className="cs-names"><b>Batalla libre</b><span>Todo el roster de {r.name}</span></div>
                    </button>
                  )}
                </div>
              </section>
            ))}
            {t && !shown.length && <p className="muted">Nada coincide con «{q}».</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
