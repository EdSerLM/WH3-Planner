import type { BuildSummary as Summary, ComputedCard, StatKey, SummaryLine } from '../types';
import { UnitCard } from './UnitCard';

interface Props {
  summary?: Summary;
  card?: ComputedCard;
  labels: Record<StatKey, string>;
  isHero: boolean;
}

function val(l: SummaryLine) {
  if (l.value === undefined) return '';
  const sign = l.value > 0 ? '+' : '';
  // Las resistencias del juego ya vienen en %, aunque no las marquemos como multiplicador
  const pct = l.pct || l.stat?.startsWith('res') || l.stat === 'shield' ? '%' : '';
  return `${sign}${l.value}${pct}`;
}

function Lines({ lines, showScope, empty, neutral }: { lines: SummaryLine[]; showScope?: boolean; empty: string; neutral?: boolean }) {
  if (!lines.length) return <p className="muted small">{empty}</p>;
  return (
    <table className="summary">
      <tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <td className="num"><b className={neutral ? 'neutral' : l.value !== undefined && l.value < 0 ? 'down' : 'up'}>{val(l)}</b></td>
            <td>
              {l.text ?? l.label}
              {showScope && l.scope ? <span className="muted"> · {l.scope}</span> : null}
              {l.rank7 ? <span className="chip">rango 7+</span> : null}
            </td>
            <td className="muted small src">{l.sources.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BuildSummary({ summary, card, labels, isHero }: Props) {
  if (!summary) return null;
  const active = summary.abilities.filter((a) => !a.passive);
  const passive = summary.abilities.filter((a) => a.passive);
  return (
    <div className="build-summary">
      <h3>Efectos acumulados del build</h3>
      <div className="summary-grid">
        <div>{card && <UnitCard card={card} labels={labels} />}</div>
        <div className="summary-cols">
          <section>
            <h4>Al propio personaje</h4>
            <Lines lines={summary.self} empty="Sin bufos de combate propios todavía." />
            {summary.attributes.filter((a) => a.scope === 'propio').map((a, i) => (
              <span key={i} className="chip buff" title={a.sources.join(', ')}>{a.label}</span>
            ))}
          </section>
          <section>
            <h4>A las tropas del ejército</h4>
            <Lines lines={summary.army} showScope empty="Sin bufos al ejército todavía." />
            {summary.attributes.filter((a) => a.scope !== 'propio').map((a, i) => (
              <span key={i} className="chip buff" title={a.sources.join(', ')}>{a.label} · {a.scope}</span>
            ))}
          </section>
          {isHero && summary.lord.length > 0 && (
            <section>
              <h4>Al señor que acompaña</h4>
              <Lines lines={summary.lord} empty="" />
            </section>
          )}
          <section>
            <h4>Habilidades y hechizos</h4>
            {!summary.abilities.length && <p className="muted small">Sin habilidades activas ni pasivas.</p>}
            <ul className="abil-list">
              {active.map((a, i) => (
                <li key={'a' + i}><b>{a.name}</b> <span className="muted small">({a.source})</span><div className="small muted">{a.detail}</div></li>
              ))}
              {passive.map((a, i) => (
                <li key={'p' + i}><b>{a.name}</b> <span className="chip">pasiva</span> <span className="muted small">({a.source})</span><div className="small muted">{a.detail}</div></li>
              ))}
            </ul>
          </section>
          <section>
            <h4>Campaña</h4>
            <Lines lines={summary.campaign} showScope neutral empty="Sin efectos de campaña." />
          </section>
          {summary.magic.length > 0 && (
            <section>
              <h4>Magia (costes, recargas, fallos)</h4>
              <Lines lines={summary.magic} showScope neutral empty="" />
            </section>
          )}
        </div>
      </div>
      <p className="small muted">Los valores ya están sumados entre habilidades (cada nivel del juego trae el total, no se suman niveles). Las fuentes salen a la derecha.</p>
    </div>
  );
}
