import type { AbilityState } from '../types';
import { AbilityImg, GameIcon } from '../gameIcons';

/**
 * Magia del ejército: los hechizos de tus personajes con su maná, recarga y duración finales (con lo comprado en sus
 * árboles), cuánto maná cuesta lanzarlos todos una vez y la reserva de Vientos de la Magia según los valores del juego
 * (_kv_winds_of_magic_params y winds_of_magic_battle_thresholds) más tus bonos.
 */
interface Props {
  abilities: AbilityState[];
  /** Efectos de campaña y magia del ejército con su origen (para sumar los bonos de reserva) */
  effects: { owner: string; skill: string; text: string }[];
}

// Valores del juego (db.pack, _kv_winds_of_magic_params): reserva máxima de un ejército en campaña sin bonos,
// reserva inicial en batalla personalizada y parte disponible al empezar
const CAMPAIGN_MAX = 100, CUSTOM_POOL = 80, CUSTOM_START = 0.15;
const CAMPAIGN_RANGES: [string, string][] = [['Vientos bajos', '1–40'], ['Vientos medios', '41–80'], ['Vientos altos', '81–120']];

const num = (v?: number) => (v === undefined ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1));
const CAP_RE = /Capacidad de la reserva energética de Vientos de la Magia: ([+-]?\d+(?:[.,]\d+)?)/i;
const MIN_RE = /Reserva energética mínima de Vientos de la Magia: ([+-]?\d+(?:[.,]\d+)?)/i;
const TURN_RE = /Reserva energética de Vientos de la Magia: ([+-]?\d+(?:[.,]\d+)?) por turno/i;
type Src = { from: string; value: number };
/** Bonos de un tipo con su origen (personaje · habilidad/rasgo/mecánica); los que afectan al enemigo no cuentan */
const bonuses = (effects: Props['effects'], re: RegExp): Src[] => {
  const seen = new Set<string>();
  return effects.flatMap((e) => {
    const m = re.exec(e.text);
    if (!m || /enemig/i.test(e.text)) return [];
    const k = `${e.owner}|${e.skill}|${e.text}`;
    if (seen.has(k)) return [];
    seen.add(k);
    return [{ from: `${e.skill} · ${e.owner.split(' · ')[0]}`, value: parseFloat(m[1].replace(',', '.')) }];
  });
};
const total = (l: Src[]) => l.reduce((s, x) => s + x.value, 0);
const sign = (v: number) => `${v > 0 ? '+' : ''}${num(v)}`;

export function ArmyMagic({ abilities, effects }: Props) {
  const spells = abilities.filter((a) => (a.mana ?? 0) > 0 || a.spell);
  // La misma habilidad en dos personajes cuenta dos veces (cada uno la lanza); repetida en el mismo, una
  const seen = new Set<string>();
  const list = spells.filter((a) => { const k = `${a.ownerKey}|${a.name}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.owner.localeCompare(b.owner) || (a.final?.mana ?? a.mana ?? 0) - (b.final?.mana ?? b.mana ?? 0));
  if (!list.length) return null;
  const mana = (a: AbilityState) => a.final?.mana ?? a.mana ?? 0;
  const cost = list.reduce((s, a) => s + mana(a), 0);
  const cap = bonuses(effects, CAP_RE), min = bonuses(effects, MIN_RE), turn = bonuses(effects, TURN_RE);
  const reserve = CAMPAIGN_MAX + total(cap);
  const casts = cost > 0 ? reserve / cost : 0;
  const rows: [string, Src[]][] = [['Capacidad de reserva', cap], ['Reserva mínima', min], ['Recuperación por turno', turn]];
  return (
    <div className="army-magic">
      <h3><GameIcon path="skills/character_magic" emoji="🔮" size={18} /> Magia del ejército</h3>
      <div className="am-sum">
        <div><b>{num(cost)}</b><span>maná para lanzar todo una vez</span></div>
        <div><b>{num(reserve)}</b><span>reserva máxima en campaña ({CAMPAIGN_MAX} base{cap.length ? ` ${sign(total(cap))} bonos` : ''})</span></div>
        <div><b>{casts ? `×${casts.toFixed(1)}` : '—'}</b><span>veces que alcanza la reserva llena para todo</span></div>
      </div>
      {cap.length + min.length + turn.length > 0 ? (
        <table className="am-table am-bonus">
          <thead><tr><th>Bonos a la reserva</th><th>Valor</th></tr></thead>
          <tbody>
            {rows.flatMap(([label, l]) => l.map((b, i) => (
              <tr key={`${label}${i}`}><td>{label}<br /><span className="muted small">{b.from}</span></td><td className="ok">{sign(b.value)}</td></tr>
            )).concat(l.length > 1 ? [<tr key={`${label}t`}><td className="small"><b>Total {label.toLowerCase()}</b></td><td className="ok"><b>{sign(total(l))}</b></td></tr>] : []))}
          </tbody>
        </table>
      ) : <p className="muted small">Ningún personaje, rasgo o mecánica del ejército sube la reserva.</p>}
      <p className="muted small">
        Sin bonos un ejército guarda hasta {CAMPAIGN_MAX} de maná. La fuerza de los vientos en batalla depende de esa reserva: bajos 1–40, medios 41–80, altos 81–120.
        En batalla personalizada la reserva es {CUSTOM_POOL} ({Math.round(CUSTOM_POOL * CUSTOM_START)} al empezar).
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
