import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TechSummaryData } from '../types';

/** Efectos acumulados de todo lo investigado (tecnologías y nodos de la Pirámide), sumando los repetidos. */
export function TechSummary({ researched }: { researched: string[] }) {
  const [data, setData] = useState<TechSummaryData | null>(null);
  const [showCampaign, setShowCampaign] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => api.techSummary(researched).then(setData).catch(() => setData(null)), 150);
    return () => clearTimeout(t);
  }, [researched]);
  if (!data) return null;
  const Section = ({ title, list, cls }: { title: string; list: TechSummaryData['battle']; cls: string }) =>
    list.length ? (
      <>
        <h4>{title} <span className="muted small">({list.length})</span></h4>
        <ul className={'tech-sum ' + cls}>
          {list.map((l, i) => (
            <li key={i}>
              {l.text}
              {l.count > 1 && <span className="muted small"> · ×{l.count}</span>}
            </li>
          ))}
        </ul>
      </>
    ) : null;
  return (
    <div className="tech-summary">
      <h3>Efectos acumulados</h3>
      <p className="muted small">
        {data.count} investigadas. Los efectos repetidos se suman (×N = de cuántas vienen). Los de batalla ya están en las tarjetas.
      </p>
      {data.count === 0 && <p className="muted small">Investiga tecnologías (o nodos de la Pirámide) para ver aquí sus efectos sumados.</p>}
      <Section title="⚔ Batalla" list={data.battle} cls="battle" />
      <Section title="✦ Magia" list={data.magic} cls="magic" />
      {data.campaign.length > 0 && (
        <label className="small"><input type="checkbox" checked={showCampaign} onChange={(e) => setShowCampaign(e.target.checked)} /> Mostrar efectos de campaña</label>
      )}
      {showCampaign && <Section title="♜ Campaña" list={data.campaign} cls="campaign" />}
    </div>
  );
}
