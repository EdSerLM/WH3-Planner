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
const EXTRA: StatKey[] = ['bvl', 'bvi', 'resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'missileDmg', 'ammo', 'reload', 'range', 'barrier', 'shield'];
const PCT_DISPLAY = new Set<StatKey>(['resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'shield']);

const KIND_ES = { unit: '', lord: 'Señor', hero: 'Héroe' } as const;

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function contribText(c: Contribution) {
  const v = c.how === 'mult' ? `×${c.value}` : c.how === 'pct' ? `${c.value > 0 ? '+' : ''}${c.value}%` : `${c.value > 0 ? '+' : ''}${c.value}`;
  return `${v} ${c.source}${c.conditional ? ` [${c.conditional}]` : ''} — ${c.from}`;
}

export function UnitCard({ card, labels, onSelect, selected, selfAbilities = [], onToggleAbility }: Props) {
  const [open, setOpen] = useState<StatKey | null>(null);
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
      <table className="stats">
        <tbody>
          {stats.map((s) => {
            const l = card.stats[s];
            const diff = l.final - l.base;
            const has = l.contributions.length > 0;
            return (
              <FragmentRow key={s}>
                <tr className={has ? 'has' : ''} onClick={() => has && setOpen(open === s ? null : s)}>
                  <td><StatImg stat={s} emoji="" size={14} /> {labels[s] ?? s}</td>
                  <td className="num muted">{fmt(l.base)}{PCT_DISPLAY.has(s) ? '%' : ''}</td>
                  <td className="num">{has ? '→' : ''}</td>
                  <td className={'num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>
                    <b>{fmt(l.final)}{PCT_DISPLAY.has(s) ? '%' : ''}</b>
                  </td>
                  <td className={'num small ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>{diff ? `${diff > 0 ? '+' : ''}${fmt(diff)}` : ''}</td>
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
        </tbody>
      </table>
      <div className="small">
        <span className="muted">Intervalo de ataque: {card.interval}s{card.splash && card.splash > 1 ? ` · splash ${card.splash}` : ''}</span>
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
