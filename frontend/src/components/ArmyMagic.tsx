import type { AbilityState } from '../types';
import { AbilityImg, GameIcon } from '../gameIcons';

/**
 * Magia del ejército: los hechizos de tus personajes con su maná, recarga y duración finales (con lo comprado en sus
 * árboles), cuánto maná cuesta lanzarlos todos una vez y la reserva de Vientos de la Magia según los valores del juego
 * (_kv_winds_of_magic_params y winds_of_magic_battle_thresholds) más tus bonos.
 */
interface Props {
  abilities: AbilityState[];
  /** Textos de efectos de campaña y magia del ejército (para sumar los bonos de reserva) */
  effectTexts: string[];
}

// Valores del juego (db.pack): reserva inicial en batalla personalizada y parte disponible al empezar; reserva en campaña según los vientos de la región
const CUSTOM_POOL = 80, CUSTOM_START = 0.15;
const CAMPAIGN_RANGES: [string, string][] = [['Vientos bajos', '1–40'], ['Vientos medios', '41–80'], ['Vientos altos', '81–120']];

const sumOf = (texts: string[], re: RegExp) => texts.reduce((s, t) => {
  const m = re.exec(t);
  return m && !/enemig/i.test(t) ? s + parseFloat(m[1]) : s;
}, 0);
const num = (v?: number) => (v === undefined ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1));

export function ArmyMagic({ abilities, effectTexts }: Props) {
  const spells = abilities.filter((a) => (a.mana ?? 0) > 0 || a.spell);
  // La misma habilidad en dos personajes cuenta dos veces (cada uno la lanza); repetida en el mismo, una
  const seen = new Set<string>();
  const list = spells.filter((a) => { const k = `${a.ownerKey}|${a.name}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.owner.localeCompare(b.owner) || (a.final?.mana ?? a.mana ?? 0) - (b.final?.mana ?? b.mana ?? 0));
  if (!list.length) return null;
  const mana = (a: AbilityState) => a.final?.mana ?? a.mana ?? 0;
  const total = list.reduce((s, a) => s + mana(a), 0);
  const capBonus = sumOf(effectTexts, /Capacidad de la reserva energética de Vientos de la Magia: ([+-]?\d+(?:[.,]\d+)?)/i);
  const minBonus = sumOf(effectTexts, /Reserva energética mínima de Vientos de la Magia: ([+-]?\d+(?:[.,]\d+)?)/i);
  const perTurn = sumOf(effectTexts, /Reserva energética de Vientos de la Magia: ([+-]?\d+(?:[.,]\d+)?) por turno/i);
  const casts = total > 0 ? CUSTOM_POOL / total : 0;
  return (
    <div className="army-magic">
      <h3><GameIcon path="skills/character_magic" emoji="🔮" size={18} /> Magia del ejército</h3>
      <div className="am-sum">
        <div><b>{num(total)}</b><span>maná para lanzar todo una vez</span></div>
        <div><b>{CUSTOM_POOL}</b><span>reserva en batalla personalizada ({Math.round(CUSTOM_POOL * CUSTOM_START)} al empezar)</span></div>
        <div><b>{casts ? `×${casts.toFixed(1)}` : '—'}</b><span>veces que alcanza la reserva para todo</span></div>
      </div>
      <p className="muted small">
        En campaña la reserva depende de los vientos de la región: {CAMPAIGN_RANGES.map(([n, r]) => `${n.toLowerCase()} ${r}`).join(' · ')}.
        {capBonus ? ` Capacidad de reserva ${capBonus > 0 ? '+' : ''}${capBonus}.` : ''}
        {minBonus ? ` Reserva mínima +${minBonus}.` : ''}
        {perTurn ? ` Recupera +${perTurn} por turno en campaña.` : ''}
      </p>
      <table className="am-table">
        <thead><tr><th>Hechizo</th><th title="Coste en Vientos de la Magia">Maná</th><th title="Tiempo de recarga">Recarga</th><th title="Duración del efecto">Dura</th></tr></thead>
        <tbody>
          {list.map((a) => {
            const cd = a.final?.cooldown ?? a.cooldown, du = a.final?.duration ?? a.duration;
            return (
              <tr key={a.id} title={a.mods?.length ? a.mods.join('\n') : 'Sin cambios del árbol'}>
                <td><AbilityImg icon={a.icon} title={a.name} size={18} /> {a.name} <span className="muted small">· {a.owner.split(' · ')[0]}</span></td>
                <td className={a.final?.mana !== undefined && a.final.mana !== a.mana ? 'ok' : ''}>{num(mana(a))}</td>
                <td className={a.final?.cooldown !== undefined && a.final.cooldown !== a.cooldown ? 'ok' : ''}>{cd ? `${num(cd)} s` : '—'}</td>
                <td>{du > 0 ? `${num(du)} s` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Valores con lo comprado en los árboles (en verde lo que cambió). No cuenta la recarga del maná durante la batalla ni los hechizos potenciados.</p>
    </div>
  );
}
