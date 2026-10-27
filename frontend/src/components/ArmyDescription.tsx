import { useMemo, useState } from 'react';
import type { ComputedCard, UnitData } from '../types';
import { groupIndex, groupInfo } from '../unitGroups';

/**
 * Descripción del ejército armado, generada con código a partir de las tarjetas (stats con tus bufos) y de los datos
 * del roster. Solo dice lo que se puede contar en los datos; lo que no cuenta va al final.
 */
interface Props {
  cards: ComputedCard[];
  units: UnitData[];
  usedSlots: number;
}

const SMALL = new Set(['small', 'very_small', '']);
const fmt = (v: number) => Math.round(v).toLocaleString('es-MX');

export function buildDescription(cards: ComputedCard[], units: UnitData[], usedSlots: number): { title: string; lines: string[] }[] {
  const byCard = new Map(units.map((u) => [u.card, u]));
  const lord = cards.find((c) => c.kind === 'lord');
  const heroes = cards.filter((c) => c.kind === 'hero');
  const unitCards = cards.filter((c) => c.kind === 'unit').map((c) => ({ c, u: byCard.get(c.id) }));
  const n = unitCards.reduce((s, x) => s + x.c.count, 0);
  if (!lord && !heroes.length && !n) return [];

  // Lista "Nombre ×2, Otro" de las unidades que cumplen algo
  const names = (pred: (x: (typeof unitCards)[number]) => boolean) =>
    unitCards.filter(pred).map((x) => `${x.c.name}${x.c.count > 1 ? ` ×${x.c.count}` : ''}`);
  const howMany = (pred: (x: (typeof unitCards)[number]) => boolean) => unitCards.filter(pred).reduce((s, x) => s + x.c.count, 0);
  const has = (x: (typeof unitCards)[number], attr: string) => x.c.attributes.some((a) => a.name === attr);

  const out: { title: string; lines: string[] }[] = [];

  // Mando y tamaño
  const cost = unitCards.reduce((s, x) => s + (x.u?.cost ?? x.c.cost ?? 0) * x.c.count, 0);
  const hp = unitCards.reduce((s, x) => s + x.c.stats.hp.final * x.c.models * x.c.count, 0);
  const tiers = unitCards.filter((x) => x.u?.tier).map((x) => [x.u!.tier, x.c.count] as const);
  const tierAvg = tiers.length ? tiers.reduce((s, [t, k]) => s + t * k, 0) / tiers.reduce((s, [, k]) => s + k, 0) : 0;
  const mando: string[] = [];
  mando.push(lord ? `Lo dirige ${lord.name}${heroes.length ? `, con ${heroes.map((h) => h.name).join(', ')}` : ''}.` : 'Sin señor elegido.');
  if (n) mando.push(`${n} unidad${n === 1 ? '' : 'es'} (${usedSlots} de 20 espacios) · coste de unidades ${fmt(cost)} MP · vida total ${fmt(hp)}${tierAvg ? ` · nivel medio ${tierAvg.toFixed(1)}` : ''}.`);
  out.push({ title: 'Mando y tamaño', lines: mando });
  if (!n) return out;

  // Composición por tipo (como los grupos del roster), con su parte del coste
  const groups = new Map<string, { k: number; cost: number }>();
  for (const x of unitCards) {
    const g = x.u?.group ?? 'Otros';
    const cur = groups.get(g) ?? { k: 0, cost: 0 };
    groups.set(g, { k: cur.k + x.c.count, cost: cur.cost + (x.u?.cost ?? x.c.cost ?? 0) * x.c.count });
  }
  out.push({
    title: 'Composición',
    lines: [...groups].sort((a, b) => groupIndex(a[0]) - groupIndex(b[0]))
      .map(([g, v]) => `${groupInfo(g).icon} ${groupInfo(g).es}: ${v.k}${cost ? ` (${Math.round((v.cost / cost) * 100)}% del coste)` : ''}`),
  });

  // Rasgos que se pueden contar en las tarjetas
  const rasgos: [string, string[]][] = [
    ['Contra grandes (bonificación contra grandes)', names((x) => x.c.stats.bvl.final > 0)],
    ['Contra infantería (bonificación contra infantería)', names((x) => x.c.stats.bvi.final > 0)],
    ['Proyectiles', names((x) => x.c.stats.missileDmg.final > 0 || !!x.u?.missile)],
    ['Daño perforante dominante (perforante ≥ base)', names((x) => x.c.stats.ap.final > 0 && x.c.stats.ap.final >= x.c.stats.dmg.final)],
    ['Blindadas (armadura 100 o más)', names((x) => x.c.stats.armour.final >= 100)],
    ['Ataques mágicos', names((x) => x.c.magicalAttacks)],
    ['Ataques flamígeros', names((x) => x.c.flamingAttacks)],
    ['Vuelan', names((x) => has(x, 'Puede volar'))],
    ['Grandes (les afecta la bonificación contra grandes)', names((x) => !SMALL.has(x.c.size ?? x.u?.size ?? ''))],
    ['Causan miedo o terror', names((x) => has(x, 'Causa miedo') || has(x, 'Causa terror'))],
    ['Indesmoralizables', names((x) => has(x, 'Indesmoralizable'))],
  ];
  out.push({ title: 'Qué tiene', lines: rasgos.filter(([, l]) => l.length).map(([t, l]) => `${t}: ${l.join(', ')}`) });

  // Lo que le falta (solo ausencias que se ven en los datos)
  const falta: string[] = [];
  if (!howMany((x) => x.c.stats.bvl.final > 0)) falta.push('Ninguna unidad con bonificación contra grandes.');
  if (!howMany((x) => x.c.stats.missileDmg.final > 0 || !!x.u?.missile)) falta.push('Sin proyectiles.');
  if (!howMany((x) => x.c.magicalAttacks) && !lord?.magicalAttacks && !heroes.some((h) => h.magicalAttacks)) falta.push('Nadie con ataques mágicos (importa contra unidades etéreas y resistencia física).');
  if (!howMany((x) => x.c.stats.ap.final > 0 && x.c.stats.ap.final >= x.c.stats.dmg.final)) falta.push('Ninguna unidad con daño perforante dominante (contra armadura alta).');
  // Liderazgo más bajo del ejército
  const lowLd = [...unitCards].sort((a, b) => a.c.stats.ld.final - b.c.stats.ld.final)[0];
  if (lowLd) falta.push(`Liderazgo más bajo: ${lowLd.c.name} (${fmt(lowLd.c.stats.ld.final)}).`);
  out.push({ title: 'Qué le falta o vigilar', lines: falta });

  // Cuánto aportan tus bufos (señor, héroes y tecnologías) a las unidades
  const buffed = unitCards.filter((x) => Object.values(x.c.stats).some((l) => l.contributions.length > 0));
  out.push({
    title: 'Bufos',
    lines: [`${buffed.reduce((s, x) => s + x.c.count, 0)} de ${n} unidad${n === 1 ? '' : 'es'} reciben bufos de tu señor, héroes o tecnologías (sin contar habilidades activables encendidas aparte).`],
  });

  out.push({
    title: 'Lo que esta descripción no cuenta',
    lines: ['Habilidades activables, hechizos, terreno, posición, fatiga, carga y el ejército enemigo: solo describe la lista y sus stats.'],
  });
  return out;
}

export function ArmyDescription({ cards, units, usedSlots }: Props) {
  const parts = useMemo(() => buildDescription(cards, units, usedSlots), [cards, units, usedSlots]);
  const [copied, setCopied] = useState(false);
  if (!parts.length) return null;
  const text = parts.map((p) => `${p.title}\n${p.lines.map((l) => `- ${l}`).join('\n')}`).join('\n\n');
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <details className="army-desc">
      <summary>📝 Descripción del ejército</summary>
      <button className="ghost small" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar texto'}</button>
      {parts.filter((p) => p.lines.length).map((p) => (
        <div key={p.title} className="ad-part">
          <b>{p.title}</b>
          <ul>
            {p.lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      ))}
    </details>
  );
}
