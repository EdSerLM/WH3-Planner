import { fmtStat, statDiff } from '../statFormat';
import type { ComputedCard, Contribution, StatKey } from '../types';
import { UnitCard } from './UnitCard';

interface Props {
  card: ComputedCard;
  labels: Record<StatKey, string>;
  onClose: () => void;
}

const PCT_STATS = new Set<StatKey>(['resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'shield']);
const KIND_ES = { unit: 'Unidad', lord: 'Señor', hero: 'Héroe' } as const;

interface Line {
  skill: string;
  value: number;
  how: Contribution['how'];
  conditional?: string;
  stats: StatKey[];
}

function valueText(l: Line) {
  if (l.how === 'mult') return `×${l.value}`;
  const sign = l.value > 0 ? '+' : '';
  const pct = l.how === 'pct' || l.stats.every((s) => PCT_STATS.has(s)) ? '%' : '';
  return `${sign}${l.value}${pct}`;
}

/** Agrupa los bufos de una tarjeta por quién los da (señor, héroe, tecnologías…) y por habilidad. */
function groupContributions(card: ComputedCard) {
  const owners = new Map<string, Map<string, Line>>();
  for (const [stat, line] of Object.entries(card.stats) as [StatKey, ComputedCard['stats'][StatKey]][]) {
    for (const c of line.contributions) {
      const byLine = owners.get(c.from) ?? new Map<string, Line>();
      owners.set(c.from, byLine);
      // La misma habilidad con el mismo valor sobre varias stats sale en una sola línea (p. ej. fuerza del arma → daño base y perforante)
      const k = `${c.source}|${c.how}|${c.value}|${c.conditional ?? ''}`;
      const l = byLine.get(k) ?? { skill: c.source, value: c.value, how: c.how, conditional: c.conditional, stats: [] };
      if (!l.stats.includes(stat)) l.stats.push(stat);
      byLine.set(k, l);
    }
  }
  // Atributos que vienen de bufos: "Habilidad (Dueño)"
  const attrs = new Map<string, { name: string; skill: string }[]>();
  for (const a of card.attributes) {
    if (!a.from) continue;
    const m = /^(.*) \(([^()]*)\)$/.exec(a.from);
    const owner = m ? m[2] : a.from;
    const skill = m ? m[1] : '';
    attrs.set(owner, [...(attrs.get(owner) ?? []), { name: a.name, skill }]);
  }
  const names = [...new Set([...owners.keys(), ...attrs.keys()])];
  return names.map((owner) => ({
    owner,
    lines: [...(owners.get(owner)?.values() ?? [])],
    attrs: attrs.get(owner) ?? [],
  }));
}

export function UnitBuffSummary({ card, labels, onClose }: Props) {
  const groups = groupContributions(card);
  const changed = (Object.entries(card.stats) as [StatKey, ComputedCard['stats'][StatKey]][]).filter(([s, l]) => statDiff(l.final, l.base, s) !== 0);

  return (
    <div className="unit-summary">
      <div className="unit-summary-head">
        <h3>Bufos acumulados · {card.name} <span className="muted small">({KIND_ES[card.kind]})</span></h3>
        <button className="ghost" onClick={onClose}>Cerrar</button>
      </div>
      <div className="summary-grid">
        <div><UnitCard card={card} labels={labels} /></div>
        <div className="summary-cols">
          {groups.length === 0 && <p className="muted small">Esta unidad no recibe bufos con el ejército actual.</p>}
          {groups.map((g) => (
            <section key={g.owner}>
              <h4>{g.owner}</h4>
              {g.lines.length > 0 && (
                <table className="summary">
                  <tbody>
                    {g.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="num"><b className={l.value < 0 && l.how !== 'mult' ? 'down' : 'up'}>{valueText(l)}</b></td>
                        <td>
                          {l.stats.map((s) => labels[s] ?? s).join(', ')}
                          {l.conditional ? <span className="chip">{l.conditional}</span> : null}
                        </td>
                        <td className="muted small src">{l.skill}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {g.attrs.map((a, i) => (
                <span key={i} className="chip buff" title={a.skill}>{a.name}</span>
              ))}
            </section>
          ))}
          {changed.length > 0 && (
            <section>
              <h4>Total</h4>
              <table className="summary">
                <tbody>
                  {changed.map(([s, l]) => {
                    const d = statDiff(l.final, l.base, s);
                    const pct = PCT_STATS.has(s) ? '%' : '';
                    const f = (v: number) => fmtStat(v, s);
                    return (
                      <tr key={s}>
                        <td className="num"><b className={d > 0 ? 'up' : 'down'}>{d > 0 ? '+' : ''}{f(d)}{pct}</b></td>
                        <td>{labels[s] ?? s}</td>
                        <td className="muted small src">{f(l.base)}{pct} → {f(l.final)}{pct}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
      <p className="small muted">Agrupado por quién da cada bufo. Los de "rango 7+" y los que crecen por rango dependen del rango que elijas para la unidad; las habilidades activas solo si las enciendes.</p>
    </div>
  );
}
