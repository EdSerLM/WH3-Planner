import { fmtStat, statDiff } from '../statFormat';
import { useState } from 'react';
import type { AbilityState, ComputedCard, Contribution, StatKey } from '../types';
import { AbilityIcons } from './AbilityIcons';
import { AbilityImg, StatImg } from '../gameIcons';
import { attrIcon } from '../attrIcons';

interface Props {
  card: ComputedCard;
  labels: Record<StatKey, string>;
  /** Si se pasa, clic en el encabezado selecciona la tarjeta (para ver sus bufos acumulados) */
  onSelect?: () => void;
  selected?: boolean;
  /** Activables que solo afectan a este personaje (se encienden aquí) */
  selfAbilities?: AbilityState[];
  onToggleAbility?: (a: AbilityState) => void;
}

// Stats que se muestran siempre; el resto solo si tienen valor o cambian
const MAIN: StatKey[] = ['ma', 'md', 'armour', 'charge', 'ld', 'dmg', 'ap', 'hp', 'speed'];
const EXTRA: StatKey[] = ['bvl', 'bvi', 'resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'missileDmg', 'ammo', 'reload', 'range', 'barrier', 'barrierRate', 'barrierDelay', 'barrierHeal', 'shield'];
/** Menos es mejor: se colorea al revés */
const LOWER_BETTER = new Set<StatKey>(['barrierDelay']);
const PCT_DISPLAY = new Set<StatKey>(['resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'shield']);

const KIND_ES = { unit: '', lord: 'Señor', hero: 'Héroe' } as const;


function contribText(c: Contribution) {
  const v = c.how === 'mult' ? `×${c.value}` : c.how === 'pct' ? `${c.value > 0 ? '+' : ''}${c.value}%` : `${c.value > 0 ? '+' : ''}${c.value}`;
  return `${v} ${c.source}${c.conditional ? ` [${c.conditional}]` : ''} — ${c.from}`;
}

// Vista como en el juego: barras con los stats principales; lo demás en el tooltip o en "avanzadas"
const ADV_KEY = 'wh3-planner:card-advanced';
type Row = { key: StatKey; label: string; base: number; final: number; max: number; tip: string[]; contribs: Contribution[]; pct?: boolean };

function gameRows(card: ComputedCard, labels: Record<StatKey, string>): Row[] {
  const st = card.stats;
  const r = (k: StatKey, max: number, tip: string[] = [], label?: string): Row => ({ key: k, label: label ?? labels[k] ?? k, base: st[k].base, final: st[k].final, max, tip, contribs: st[k].contributions });
  // 'hp' es la vida por modelo; la barra del juego muestra la de toda la unidad
  const n = Math.max(1, card.models);
  const rows: Row[] = [
    { ...r('hp', 0, [`${card.models} modelo${card.models === 1 ? '' : 's'} × ${fmtStat(st.hp.final, 'hp')} de vida`], 'Vida'), base: st.hp.base * n, final: st.hp.final * n },
    r('armour', 150, [st.shield.final ? `Escudo: ${st.shield.final}% de bloqueo de proyectiles de frente` : 'Sin escudo']),
    r('ld', 100),
    r('speed', 100),
    r('ma', 100, [], 'Ataque c. a c.'),
    r('md', 100, [], 'Defensa c. a c.'),
  ];
  // Fuerza del arma = daño base + perforante (como en el juego); el desglose va en el tooltip
  const ws: Row = {
    key: 'dmg', label: 'Fuerza del arma', base: st.dmg.base + st.ap.base, final: st.dmg.final + st.ap.final, max: 150,
    contribs: [...st.dmg.contributions, ...st.ap.contributions],
    tip: [
      `Daño base: ${fmtStat(st.dmg.final, 'dmg')} · Perforante: ${fmtStat(st.ap.final, 'ap')}`,
      st.bvl.final ? `Bonificación contra grandes: +${fmtStat(st.bvl.final, 'bvl')}` : '',
      st.bvi.final ? `Bonificación contra infantería: +${fmtStat(st.bvi.final, 'bvi')}` : '',
      `Intervalo de ataque: ${card.interval} s${card.splash && card.splash > 1 ? ` · golpea hasta ${card.splash} modelos` : ''}`,
    ].filter(Boolean),
  };
  rows.push(ws, r('charge', 100));
  if (st.missileDmg.base || st.missileDmg.final) {
    const m = card.missile;
    rows.push(
      { ...r('missileDmg', 150, [
        m ? `Daño base: ${m.dmg} · Perforante: ${m.ap} (por proyectil, sin bufos)` : '',
        m?.shots && m.shots > 1 ? `${m.shots} proyectiles por disparo` : '',
        m?.bvl ? `Contra grandes: +${m.bvl}` : '', m?.bvi ? `Contra infantería: +${m.bvi}` : '',
        `Recarga: ${fmtStat(st.reload.final, 'reload')} s`,
      ].filter(Boolean)), label: 'Fuerza de proyectiles' },
      r('range', 500),
      r('ammo', 100),
    );
  }
  return rows;
}

function GameStats({ card, labels }: { card: ComputedCard; labels: Record<StatKey, string> }) {
  const rows = gameRows(card, labels);
  const res = (['resWard', 'resPhysical', 'resMissile', 'resMagic', 'resFlame'] as StatKey[]).filter((k) => card.stats[k].final !== 0);
  return (
    <div className="gstats">
      {rows.map((r) => {
        const diff = Math.round((r.final - r.base) * 10) / 10;
        const tip = [...r.tip, ...(r.contribs.length ? ['', 'Bufos:', ...r.contribs.map(contribText)] : [])].join('\n');
        const w = (v: number) => `${Math.max(0, Math.min(100, (v / r.max) * 100))}%`;
        return (
          <div key={r.label} className={'gs-row' + (r.key === 'hp' ? ' hp' : '')} title={tip}>
            <span className="gs-label"><StatImg stat={r.key} emoji="" size={14} /> {r.label}</span>
            {r.max > 0 ? (
              <span className="gs-bar">
                <i className="base" style={{ width: w(Math.min(r.base, r.final)) }} />
                {diff !== 0 && <i className={diff > 0 ? 'up' : 'down'} style={{ left: w(Math.min(r.base, r.final)), width: w(Math.abs(diff)) }} />}
              </span>
            ) : <span className="gs-bar hpbar"><i className="base" style={{ width: '100%' }} /></span>}
            <span className={'gs-val' + (diff > 0 ? ' up' : diff < 0 ? ' down' : '')}>{fmtStat(r.final, r.key)}{diff ? <small>{diff > 0 ? ' ▲' : ' ▼'}</small> : null}</span>
          </div>
        );
      })}
      <BarrierLine card={card} />
      {res.length > 0 && (
        <div className="gs-res">
          {res.map((k) => (
            <span key={k} className={'gs-resi' + (card.stats[k].final !== card.stats[k].base ? ' up' : '')} title={`${labels[k] ?? k}: ${card.stats[k].final}%${card.stats[k].contributions.length ? '\n' + card.stats[k].contributions.map(contribText).join('\n') : ''}`}>
              <StatImg stat={k} emoji="" size={14} /> {card.stats[k].final}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barrera: puntos, cuánto recupera por segundo y tras cuántos segundos sin recibir daño, con el desglose de bufos */
function BarrierLine({ card }: { card: ComputedCard }) {
  const st = card.stats;
  if (!(st.barrier.final > 0)) return null;
  const rate = st.barrierRate.final, delay = st.barrierDelay.final, heal = st.barrierHeal.final;
  const healPts = (st.barrier.final * heal) / 100;
  const full = rate > 0 ? st.barrier.final / rate : 0;
  const contribs = [...st.barrierRate.contributions, ...st.barrierDelay.contributions, ...st.barrierHeal.contributions];
  const tip = [
    `Barrera: ${fmtStat(st.barrier.final, 'barrier')} puntos`,
    `Se recupera a ${fmtStat(rate, 'barrierRate')} puntos/s (base ${st.barrierRate.base}) cuando lleva ${fmtStat(delay, 'barrierDelay')} s sin recibir daño (base ${st.barrierDelay.base} s)`,
    full ? `De 0 a llena: ${fmtStat(full, 'barrierDelay')} s de recuperación (+ la espera)` : '',
    heal ? `Habilidades: +${fmtStat(heal, 'barrierHeal')}% por segundo (${fmtStat(healPts, 'barrierHeal')} puntos/s) mientras están activas` : '',
    ...(contribs.length ? ['', 'Bufos:', ...contribs.map(contribText)] : []),
  ].filter((x) => x !== '').join('\n');
  const up = st.barrierRate.final > st.barrierRate.base || st.barrierDelay.final < st.barrierDelay.base || heal > 0;
  return (
    <div className={'gs-barrier' + (up ? ' up' : '')} title={tip}>
      <StatImg stat="barrier" emoji="🛡️" size={14} /> Barrera <b>{fmtStat(st.barrier.final, 'barrier')}</b>
      <span> · recupera <b>{fmtStat(rate, 'barrierRate')}</b>/s tras <b>{fmtStat(delay, 'barrierDelay')}</b> s sin daño</span>
      {heal > 0 && <span> · +{fmtStat(healPts, 'barrierHeal')}/s por habilidades</span>}
    </div>
  );
}

export function UnitCard({ card, labels, onSelect, selected, selfAbilities = [], onToggleAbility }: Props) {
  const [open, setOpen] = useState<StatKey | null>(null);
  const [adv, setAdv] = useState<boolean>(() => { try { return localStorage.getItem(ADV_KEY) === '1'; } catch { return false; } });
  const toggleAdv = () => { const v = !adv; setAdv(v); try { localStorage.setItem(ADV_KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  const stats = [...MAIN, ...EXTRA.filter((s) => card.stats[s].base !== 0 || card.stats[s].final !== 0)];
  const buffed = stats.filter((s) => card.stats[s].contributions.length).length;

  return (
    <div className={'card ' + card.kind + (selected ? ' selected' : '')}>
      <div
        className={'card-head' + (onSelect ? ' clickable' : '')}
        onClick={onSelect}
        title={onSelect ? (selected ? 'Clic para cerrar sus bufos acumulados' : 'Clic para ver sus bufos acumulados') : undefined}
      >
        {card.art && <img className="card-art" src={`/units/${card.art}.png`} alt="" />}
        <div className="card-head-text">
          <div className="card-name">{card.name}</div>
          <div className="muted small">
            {KIND_ES[card.kind]} {card.caste ?? ''} · {card.models} modelo{card.models === 1 ? '' : 's'}
            {card.count > 1 ? ` · ×${card.count} unidades` : ''}
            {card.cost ? ` · ${card.cost} MP` : ''}
            {card.kind === 'unit' && (card.rank ?? (card.rank7 ? 7 : 0)) > 0 ? ` · Rango ${card.rank ?? 7}` : ''}
          </div>
        </div>
        <span className="badge">{buffed} bufos</span>
      </div>
      {!adv && <GameStats card={card} labels={labels} />}
      <button className="ghost small adv-toggle" onClick={toggleAdv} title="Muestra u oculta la tabla con todos los stats, base → final y de dónde viene cada bufo">
        {adv ? '▴ Ocultar estadísticas avanzadas' : '▾ Estadísticas avanzadas'}
      </button>
      {adv && (<>
      <table className="stats">
        <tbody>
          {stats.map((s) => {
            const l = card.stats[s];
            const diff = statDiff(l.final, l.base, s) * (LOWER_BETTER.has(s) ? -1 : 1);
            const has = l.contributions.length > 0;
            return (
              <FragmentRow key={s}>
                <tr className={has ? 'has' : ''} onClick={() => has && setOpen(open === s ? null : s)}>
                  <td><StatImg stat={s} emoji="" size={14} /> {labels[s] ?? s}</td>
                  <td className="num muted">{fmtStat(l.base, s)}{PCT_DISPLAY.has(s) ? '%' : ''}</td>
                  <td className="num">{has ? '→' : ''}</td>
                  <td className={'num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>
                    <b>{fmtStat(l.final, s)}{PCT_DISPLAY.has(s) ? '%' : ''}</b>
                  </td>
                  <td className={'num small ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>{diff ? `${l.final - l.base > 0 ? '+' : ''}${fmtStat(l.final - l.base, s)}` : ''}</td>
                </tr>
                {open === s && (
                  <tr className="contribs">
                    <td colSpan={5}>
                      <ul>
                        {l.contributions.map((c, i) => (
                          <li key={i}>{contribText(c)}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </FragmentRow>
            );
          })}
          {/* Bonificación del proyectil (jabalinas, arpones...): va aparte de la de cuerpo a cuerpo */}
          {(card.missile?.bvl ?? 0) > 0 && (
            <tr className="missile-bonus" title="Bonificación del proyectil contra grandes: se suma al daño de cada proyectil contra caballería, carros y monstruos (no la cambian los bufos de cuerpo a cuerpo)">
              <td><StatImg stat="bvl" emoji="" size={14} /> Proyectil contra grandes</td><td /><td /><td className="num"><b>{card.missile!.bvl}</b></td><td />
            </tr>
          )}
          {(card.missile?.bvi ?? 0) > 0 && (
            <tr className="missile-bonus" title="Bonificación del proyectil contra infantería: se suma al daño de cada proyectil contra objetivos pequeños">
              <td><StatImg stat="bvi" emoji="" size={14} /> Proyectil contra infantería</td><td /><td /><td className="num"><b>{card.missile!.bvi}</b></td><td />
            </tr>
          )}
        </tbody>
      </table>
      </>)}
      <div className="small">
        {adv && <span className="muted">Intervalo de ataque: {card.interval}s{card.splash && card.splash > 1 ? ` · splash ${card.splash}` : ''}</span>}
        {card.flamingAttacks && <span className="chip fire">Flamígero</span>}
        {card.magicalAttacks && <span className="chip magic">Mágico</span>}
      </div>
      {card.attributes.length > 0 && (
        <div className="attrs">
          {card.attributes.map((a, i) => (
            <span key={i} className={'chip' + (a.from ? ' buff' : '')} title={a.from ? `Por ${a.from}` : 'Propio de la unidad'}>
              {attrIcon(a.name) ? <span className="chip-ai">{attrIcon(a.name)}</span> : null}{a.name}
            </span>
          ))}
        </div>
      )}
      {selfAbilities.length > 0 && (
        <div className="self-abilities">
          <div className="muted small">Habilidades propias (solo a sí mismo)</div>
          {selfAbilities.map((a) => (
            <label key={a.id} className={'self-ab' + (a.active ? ' on' : '')} title={a.stats.join('\n')}>
              <input type="checkbox" checked={a.active} disabled={!onToggleAbility} onChange={() => onToggleAbility?.(a)} />
              <AbilityImg icon={a.icon} title={a.name} /> <b>{a.name}</b> <AbilityIcons a={a} />
              <span className="muted small">{a.duration > 0 ? ` ${a.duration} s` : ''}{a.cooldown && a.cooldown > 0 ? ` · recarga ${a.cooldown} s` : ''}</span>
            </label>
          ))}
        </div>
      )}
      {card.notes.length > 0 && <div className="warn small">{card.notes.join(' · ')}</div>}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
