import type { ComputeResult, SummaryLine } from '../types';
import { GameIcon } from '../gameIcons';

/**
 * Efectos "(acompañando a un Señor)": un héroe se los da al señor de su ejército.
 * En la pestaña de un héroe muestra lo que le da a su señor; en la del señor, lo que recibe de sus héroes.
 */
const ACC = /\(acompañando a un Señor\)/i;
const fmt = (l: SummaryLine) => `${l.label}: ${l.value !== undefined && l.value > 0 ? '+' : ''}${l.value ?? ''}${l.pct || l.stat?.startsWith('res') ? '%' : ''}`;

interface Row { text: string; from: string; battle: boolean }

function rowsOf(result: ComputeResult, heroName: string): Row[] {
  const b = result.builds.find((x) => x.name === heroName);
  const battle: Row[] = (b?.summary.lord ?? []).map((l) => ({ text: fmt(l), from: l.sources.join(', '), battle: true }));
  const camp: Row[] = [...result.campaign, ...result.magic]
    .filter((c) => c.owner === heroName && ACC.test(c.text))
    .map((c) => ({ text: c.text.replace(ACC, '').trim(), from: c.skill, battle: false }));
  const seen = new Set<string>();
  return [...battle, ...camp].filter((r) => { const k = r.text + r.from; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function LordLink({ result, kind, name, lordName }: { result: ComputeResult | null; kind: 'lord' | 'hero'; name?: string; lordName?: string }) {
  if (!result || !name) return null;
  if (kind === 'hero') {
    const rows = rowsOf(result, name);
    if (!rows.length) return null;
    return (
      <div className="lord-link">
        <h4><GameIcon path="unitcat/commander" emoji="👑" size={16} /> Le da a su señor{lordName ? ` (${lordName})` : ''}</h4>
        <List rows={rows} />
        <p className="muted small">{lordName ? `Ya está sumado en la tarjeta de ${lordName}.` : 'Sin señor en el ejército no se aplica.'}</p>
      </div>
    );
  }
  const heroes = result.builds.filter((b) => b.name !== name).map((b) => ({ hero: b.name, rows: rowsOf(result, b.name) })).filter((h) => h.rows.length);
  if (!heroes.length) return null;
  return (
    <div className="lord-link">
      <h4><GameIcon path="unitcat/commander" emoji="👑" size={16} /> Recibe de sus héroes</h4>
      {heroes.map((h) => (<div key={h.hero}><div className="small"><b>{h.hero}</b></div><List rows={h.rows} /></div>))}
    </div>
  );
}

function List({ rows }: { rows: Row[] }) {
  return (
    <ul>
      {rows.map((r, i) => (
        <li key={i}>
          <span className={'tag ' + (r.battle ? 'battle' : 'campaign')}>{r.battle ? 'Batalla' : 'Campaña'}</span> {r.text}
          <span className="muted small"> · {r.from}</span>
        </li>
      ))}
    </ul>
  );
}
