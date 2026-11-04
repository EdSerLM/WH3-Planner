import { useMemo, useState } from 'react';
import type { AbilityState, ComputedCard, UnitData } from '../types';
import { groupIndex, groupInfo } from '../unitGroups';
import { openFor, pick, voiceOf } from '../armyLore';

/**
 * Descripción del ejército armado, generada con código a partir de las tarjetas (stats con tus bufos) y de los datos
 * del roster. Solo dice lo que se puede contar en los datos; lo que no cuenta va al final.
 */
interface Props {
  cards: ComputedCard[];
  units: UnitData[];
  usedSlots: number;
  /** Subcultura del ejército: elige la voz de la crónica */
  subculture?: string;
  /** Habilidades del ejército: para saber si el señor o los héroes lanzan hechizos */
  abilities?: AbilityState[];
  /** Claves de los personajes legendarios (los genéricos se nombran con artículo: "un Señor de los Vampiros") */
  legendary?: string[];
  /** Títulos de cada personaje (clave del personaje): cargo de la corte, Nombres de poder, voto cumplido */
  titles?: Record<string, CharTitles>;
}
export interface CharTitles { court?: { role: string; court: string }[]; names?: string[]; vow?: string }

/** Saber de magia entre paréntesis en el nombre ("Aeda Mágico (Oscura)") dicho en prosa */
const LORE: Record<string, string> = {
  Muerte: 'el Saber de la Muerte', Luz: 'el Saber de la Luz', Sombras: 'el Saber de las Sombras', Bestias: 'el Saber de las Bestias',
  Oscura: 'la Magia Oscura', Fuego: 'el Saber del Fuego', Cielos: 'el Saber de los Cielos', Vida: 'el Saber de la Vida', Metal: 'el Saber del Metal',
  Alta: 'la Alta Magia', Salvaje: 'la magia salvaje del bosque', Vampiros: 'el Saber de los Vampiros', Profundidades: 'el Saber de las Profundidades',
  Nehekhara: 'el Saber de Nehekhara', Oscuridad: 'el Saber de la Oscuridad', Plaga: 'el Saber de la Plaga', Ruina: 'el Saber de la Ruina',
  Nurgle: 'el Saber de Nurgle', Tzeentch: 'el Saber de Tzeentch', Slaanesh: 'el Saber de Slaanesh', 'Caos Absoluto': 'el Caos Absoluto',
  Hashut: 'el Saber de Hashut', Yang: 'el poder del Yang', Yin: 'el poder del Yin', Brujas: 'el Saber de las Brujas', 'No Muerte': 'el Saber de la No Muerte',
  Hielo: 'el Saber del Hielo', Tempestad: 'el Saber de la Tempestad', 'Grandes Fauces': 'el Saber de las Grandes Fauces',
};
const FEM = /\b(Señora|Reina|Bruja|Doncella|Capitana|Gloriosa|Hechicera|Sacerdotisa|Profetisa|Damisela|Hada|Sirena|Vampiresa|Matriarca|Hermanas|Tejedora|Cantora)\b/;
/** "del Consejo de los Elfos", "de la Congregación…", "de los Hablantes…" */
const ofCourt = (c: string) => (/^Cargos de la corte/i.test(c) ? '' : /^(Consejo|Cónclave|Círculo)\b/.test(c) ? ` del ${c}` : /^(Hablantes|Señores)\b/.test(c) ? ` de los ${c}` : ` de la ${c}`);

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


const TROOP_OF: Record<string, 'inf' | 'missile' | 'cav' | 'monster' | 'art'> = {
  Infantry: 'inf', 'Missile Infantry': 'missile', 'Cavalry & Chariots': 'cav', 'Missile Cavalry & Chariots': 'cav',
  'Monsters & Beasts': 'monster', 'Missile Monsters & Beasts': 'monster', 'Artillery & War Machines': 'art',
};
const andList = (l: string[]) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);

/** Crónica con la voz de la facción: lo que narra sale de las mismas tarjetas (nada inventado sobre el ejército) */
export function buildChronicle(cards: ComputedCard[], units: UnitData[], subculture?: string, abilities: AbilityState[] = [], legendary: string[] = [], titles: Record<string, CharTitles> = {}): string[] {
  const byCard = new Map(units.map((u) => [u.card, u]));
  const lord = cards.find((c) => c.kind === 'lord');
  const heroes = cards.filter((c) => c.kind === 'hero');
  const unitCards = cards.filter((c) => c.kind === 'unit').map((c) => ({ c, u: byCard.get(c.id) }));
  if (!lord && !heroes.length && !unitCards.length) return [];
  const v = voiceOf(subculture);
  const seed = [lord?.id, ...heroes.map((h) => h.id), ...unitCards.map((x) => x.c.id + x.c.count)].join('|');
  const has = (x: (typeof unitCards)[number], attr: string) => x.c.attributes.some((a) => a.name === attr);
  const count = (pred: (x: (typeof unitCards)[number]) => boolean) => unitCards.filter(pred).reduce((s, x) => s + x.c.count, 0);
  const out: string[] = [];

  // 1. Quién marcha y quién manda
  const host = pick(v.host, seed, 'h');
  // Nombre como en la crónica: sin la traducción tras "·" y con artículo si es genérico ("un Rey Tumulario")
  const who = (c: ComputedCard) => {
    // Sin la montura entre paréntesis: en prosa se dice "montado en Malhandir" (solo legendarios con montura de nombre propio)
    const full = (c.baseName ?? c.name.replace(/\s*\([^)]*\)\s*$/, '')).split(' · ')[0].trim();
    // El saber o la marca entre paréntesis ("Aeda Mágico (Oscura)") se dice en prosa; armas u otras aclaraciones se quitan
    const tag = /\(([^)]*)\)\s*$/.exec(full)?.[1];
    const n = full.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const fem = FEM.test(n);
    const extra: string[] = [];
    if (tag && LORE[tag]) extra.push(`${fem ? 'versada' : 'versado'} en ${LORE[tag]}`);
    const t = titles[c.id];
    if (t?.names?.length) extra.push(`${fem ? 'conocida' : 'conocido'} como ${andList(t.names.map((x) => `«${x}»`))}`);
    // Cargo de la corte con su apodo: "Tejedor Oscuro («Cantor Oscuro»)" -> "Tejedor Oscuro de la Corte…, a quien llaman «Cantor Oscuro»"
    for (const ct of t?.court ?? []) {
      const m = /^(.*?)\s*\((«[^)]*»)\)\s*$/.exec(ct.role);
      extra.push(m ? `${m[1]}${ofCourt(ct.court)}, a quien llaman ${m[2]}` : `${ct.role}${ofCourt(ct.court)}`);
    }
    if (t?.vow) extra.push(`que ha cumplido el ${t.vow}`);
    let base: string;
    // Los señores de linaje y de Guarida vienen marcados como legendarios, pero su nombre es un título genérico
    if (legendary.includes(c.id) && !/^Señora? de (los|las) /.test(n)) {
      const m = c.mountNamed && c.mountName ? c.mountName.replace(/\s*\([^)]*\)/g, '').trim() : '';
      base = m ? `${n}, ${pick(['montado en', 'a lomos de'], seed, 'mt')} ${m}` : n;
    } else base = `${fem ? 'una' : 'un'} ${n}`;
    return extra.length ? `${base}, ${andList(extra)}` : base;
  };
  const lead = lord ? `al mando de ${who(lord)}` : 'sin un señor que la guíe';
  const escort = heroes.length ? `, ${heroes.length === 1 ? 'con' : 'escoltado por'} ${andList(heroes.map(who))}` : '';
  out.push(`${openFor(pick(v.open, seed, 'o'), host)} ${host}, ${lead}${escort}.`);
  if (!unitCards.length) return out;

  // 2. Cómo se ve la hueste: el núcleo, los flancos, lo que se alza sobre ellos y la retaguardia (sin cifras, como en un relato)
  const groups = new Map<string, number>();
  for (const x of unitCards) { const t = TROOP_OF[x.u?.group ?? ''] ?? 'inf'; groups.set(t, (groups.get(t) ?? 0) + x.c.count); }
  const total = [...groups.values()].reduce((a, b) => a + b, 0);
  const noun = (t: string) => v.troops[t as keyof typeof v.troops] ?? GENERIC_T[t];
  // Cuántos, en palabras: la mayoría es una marea; uno solo, un puñado
  const howMuch = (k: number) => (k / total >= 0.5 ? pick(['una marea de', 'un océano de', 'una legión de'], seed, 'm') : k <= 1 ? 'un puñado de' : '');
  const core = [...groups].sort((a, b) => b[1] - a[1])[0][0];
  const ROLE: Record<string, (t: string, q: string) => string> = {
    inf: (t, q) => pick([`al frente avanza ${q || 'una muralla de'} ${t}`, `su corazón lo forman ${q || 'apretadas filas de'} ${t}`], seed, 'i'),
    missile: (t, q) => pick([`tras ellos, ${q ? q + ' ' : ''}${t} preparan sus armas`, `desde atrás, ${q ? q + ' ' : ''}${t} esperan su momento`], seed, 'r'),
    cav: (t, q) => pick([`en los flancos aguardan ${q ? q + ' ' : ''}${t}`, `${q ? q + ' ' : ''}${t} esperan impacientes en las alas, listos para cargar`], seed, 'k'),
    monster: (t, q) => pick([`sobre todos ellos se alzan ${q ? q + ' ' : ''}${t}`, `${q ? q + ' ' : ''}${t} hacen temblar la tierra a su paso`], seed, 'b'),
    art: (t, q) => pick([`y en la retaguardia ${q ? q + ' ' : ''}${t} esperan la orden de fuego`, `mientras ${q ? q + ' ' : ''}${t} apuntan desde lo alto`], seed, 'a'),
  };
  const ORDER = ['inf', 'missile', 'cav', 'monster', 'art'];
  const phrases = [core, ...ORDER.filter((t) => t !== core)].filter((t) => groups.has(t)).map((t) => ROLE[t](noun(t), howMuch(groups.get(t)!)));
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const body = phrases.length > 1 ? `${phrases.slice(0, -1).join('; ')}; ${phrases[phrases.length - 1]}` : phrases[0];
  // En prosa sin la aclaración entre paréntesis: "Caballeros Negros (lanzas y bardas)" -> "Caballeros Negros"
  const prose = (n: string) => n.replace(/\s*\([^)]*\)/g, '').split(' · ')[0].trim();
  const elite = [...new Set([...unitCards].sort((a, b) => (b.u?.cost ?? 0) - (a.u?.cost ?? 0)).map((x) => prose(x.c.name)))].slice(0, 2);
  const pride = elite.length ? ` ${pick([`Entre todos destacan, temidos y respetados, ${andList(elite)}.`, `Nadie olvida a ${andList(elite)}, el orgullo de la hueste.`], seed, 'e')}` : '';
  out.push(`${cap(body).replace(/^Y en la/, 'En la').replace(/^Mientras /, 'Desde lo alto, ')}.${pride}`);

  // 3. Lo que los hace temibles
  const strong: string[] = [];
  // Magia: si el señor o algún héroe lanza hechizos (con coste de maná)
  const chars = new Set([lord?.id, ...heroes.map((h) => h.id)].filter(Boolean));
  const casters = abilities.some((a) => chars.has(a.ownerKey) && ((a.mana ?? 0) > 0 || a.spell));
  const magicHits = casters || lord?.magicalAttacks || heroes.some((h) => h.magicalAttacks) || count((x) => x.c.magicalAttacks) > 0;
  if (casters && v.magic) strong.push(v.magic);
  if (count((x) => x.c.stats.armour.final >= 100) >= 2 && v.armour) strong.push(v.armour);
  if (count((x) => has(x, 'Causa miedo') || has(x, 'Causa terror')) && v.fear) strong.push(v.fear);
  if (count((x) => has(x, 'Puede volar')) && v.fly) strong.push(v.fly);
  const antiLarge = unitCards.filter((x) => x.c.stats.bvl.final > 0).map((x) => x.c.name.replace(/\s*\([^)]*\)/g, '').split(' · ')[0].trim());
  if (antiLarge.length) strong.push(`${andList([...new Set(antiLarge)].slice(0, 2))} aguardan a los monstruos y a la caballería enemiga.`);
  if (strong.length) out.push(strong.join(' '));

  // 4. Su punto débil, dicho como lo diría la facción
  const weak: string[] = [];
  if (!count((x) => x.c.stats.bvl.final > 0)) weak.push('nada en sus filas está hecho para abatir monstruos ni caballería pesada');
  if (!count((x) => x.c.stats.missileDmg.final > 0 || !!x.u?.missile)) weak.push('no tiene con qué responder a distancia');
  if (!magicHits) weak.push('sus armas no hieren de verdad a espectros ni a seres etéreos');
  if (!count((x) => x.c.stats.ap.final > 0 && x.c.stats.ap.final >= x.c.stats.dmg.final)) weak.push('la armadura pesada del enemigo le costará cara');
  if (weak.length) out.push(`${v.dread ?? 'Pero conviene recordar que'} ${andList(weak.slice(0, 2))}.`);

  // 5. Grito de guerra
  out.push(`«${pick(v.cry, seed, 'c')}»`);
  return out;
}
const GENERIC_T: Record<string, string> = { inf: 'infantería', missile: 'tiradores', cav: 'caballería', monster: 'monstruos', art: 'máquinas de guerra' };

export function ArmyDescription({ cards, units, usedSlots, subculture, abilities, legendary, titles }: Props) {
  const parts = useMemo(() => buildDescription(cards, units, usedSlots), [cards, units, usedSlots]);
  const chronicle = useMemo(() => buildChronicle(cards, units, subculture, abilities, legendary, titles), [cards, units, subculture, abilities, legendary, titles]);
  const [copied, setCopied] = useState(false);
  if (!parts.length) return null;
  const data = parts.map((p) => `${p.title}\n${p.lines.map((l) => `- ${l}`).join('\n')}`).join('\n\n');
  const text = chronicle.length ? `${chronicle.join('\n\n')}\n\n— Datos del ejército —\n\n${data}` : data;
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <details className="army-desc" open>
      <summary>📜 Crónica del ejército</summary>
      <button className="ghost small" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar texto'}</button>
      {chronicle.length > 0 && (
        <div className="ad-chronicle">
          {chronicle.map((p, i) => <p key={i} className={p.startsWith('«') ? 'ad-cry' : ''}>{p}</p>)}
        </div>
      )}
      <details className="ad-data">
        <summary>Datos del ejército (números, carencias y lo que no cuenta)</summary>
        {parts.filter((p) => p.lines.length).map((p) => (
          <div key={p.title} className="ad-part">
            <b>{p.title}</b>
            <ul>
              {p.lines.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        ))}
      </details>
    </details>
  );
}
