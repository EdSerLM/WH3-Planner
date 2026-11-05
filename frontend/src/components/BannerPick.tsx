import type { BannerOption } from '../types';
import { GameIcon } from '../gameIcons';

/**
 * Estandarte que lleva una unidad o un personaje: los desbloquean personajes del ejército (Elspeth, Oxyotl, Throgg,
 * Morghur, Magistrados de Catai, Ikit…). Cada estandarte lo lleva una sola unidad.
 */
export function BannerPick({ options, value, onChange, compact }: { options?: BannerOption[]; value?: string | null; onChange: (k: string | null) => void; compact?: boolean }) {
  if (!options?.length && !value) return null;
  const cur = options?.find((o) => o.key === value);
  return (
    <label className={'banner-pick' + (compact ? ' compact' : '')} title={cur ? [cur.description, ...cur.effects].filter(Boolean).join('\n') : 'Estandarte que desbloquea un personaje del ejército'}>
      <GameIcon path="unitcat/commander" emoji="⚑" size={14} /> Estandarte{' '}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {(options ?? []).map((o) => (
          <option key={o.key} value={o.key} title={o.effects.join('\n')}>
            {o.name} · {o.from}{o.skillName ? ` (${o.skillName})` : ''}
          </option>
        ))}
        {value && !cur && <option value={value}>(no disponible)</option>}
      </select>
      {!compact && cur && <span className="muted small banner-eff">{cur.effects.join(' · ')}</span>}
    </label>
  );
}
