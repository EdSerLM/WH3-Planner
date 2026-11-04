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
export interface CharTitles { court?: { role: string; court: string }[]; names?: string[]; vow?: string; trait?: { name: string; desc?: string } }

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
const FEM = /\b(Señora|Reina|Zarina|Bruja|Doncella|Capitana|Caballera|Gloriosa|Hechicera|Sacerdotisa|Profetisa|Damisela|Hada|Sirena|Vampiresa|Matriarca|Hermanas|Tejedora|Cantora|Katarin|Alarielle|Morathi|Neferata|Isabella|Khalida|Elspeth|Hellebron|Ostankya|Naryska|Ulrika|Miao Ying|Valkia|Repanse|Drycha|Crone)\b/;
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
  const escort = heroes.length ? `, ${heroes.length === 1 ? 'con' : lord && FEM.test(lord.baseName ?? lord.name) ? 'escoltada por' : 'escoltado por'} ${andList(heroes.map(who))}` : '';
  out.push(`${openFor(pick(v.open, seed, 'o'), host)} ${host}, ${lead}${escort}.`);

  // 1b. Quiénes son los legendarios que la guían, con el texto del propio juego (su primera frase)
  const loreOf = (c: ComputedCard) => {
    const nm = (c.baseName ?? c.name).split(' · ')[0];
    // Solo legendarios con historia propia: los señores de linaje ("Señor de los Vampiros…") son títulos genéricos
    if (!legendary.includes(c.id) || !c.lore || /^Señora? de (los|las) /.test(nm)) return '';
    const t = c.lore.replace(/\s+/g, ' ').trim();
    if (/^["«“]/.test(t)) return `${nm.replace(/\s*\([^)]*\)\s*$/, '').replace(/^(Emperador|Rey|Reina|Zarina|Señor|Señora) /, '')} lo proclama: ${t.replace(/^["“]|["”]$/g, '«').replace(/«([^«]*)«$/, '«$1»')}`;
    const first = /^(.*?[.!?])(\s|$)/.exec(t)?.[1] ?? t;
    return first;
  };
  // Rasgo innato de cada personaje contado en prosa (sin el nombre del rasgo): "Se cuenta del Astromante que…",
  // "Katarin suele repetir: «…»". Los que comparten rasgo van juntos.
  const subjOf = (c: ComputedCard) => {
    const full = (c.baseName ?? c.name).split(' · ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
    const isLegend = legendary.includes(c.id) && !/^Señora? de (los|las) /.test(full);
    if (isLegend) { const n = full.split(',')[0].replace(/^(Emperador|Rey|Reina|Zarina|Señor|Señora) /, ''); return { legend: true, subj: n, de: `de ${n}` }; }
    const fem = FEM.test(full);
    return { legend: false, subj: `${fem ? 'la' : 'el'} ${full}`, de: `${fem ? 'de la' : 'del'} ${full}` };
  };
  const traitText = (c: ComputedCard) => {
    const d = (titles[c.id]?.trait?.desc ?? '').replace(/\s+/g, ' ').trim();
    if (!d) return null;
    const quote = /^["«“]/.test(d);
    const body = quote ? d.replace(/^["«“]+/, '').replace(/["»”]+\.?$/, '').trim() : (/^(.*?[.!?])(\s|$)/.exec(d)?.[1] ?? d).replace(/\.$/, '');
    return { quote, body };
  };
  const capS = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const traitSentence = (cs: ComputedCard[], tt: { quote: boolean; body: string }, salt: string) => {
    const ss = cs.map(subjOf);
    if (tt.quote) return `${capS(andList(ss.map((x) => x.subj)))} ${cs.length > 1 ? 'suelen' : 'suele'} repetir: «${tt.body}»`;
    const lower = tt.body.charAt(0).toLowerCase() + tt.body.slice(1);
    // Si el texto ya habla del personaje por su título ("La Caballera Dorada… recorre…"), va tal cual
    const words = cs.flatMap((c) => (c.baseName ?? c.name).split(/[\s,()·]+/)).filter((w) => w.length > 3);
    if (words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(tt.body))) return `${tt.body}.`;
    // Si empieza con verbo ("podría desafiar…"): "Se cuenta del X que…"; si no ("la violencia es…"): "Para el X, …"
    const VERB = /^(es|está|son|podría|puede|sabe|tiene|nunca|siempre|no|ha|hay|lleva|cree|odia|ama|prefiere|disfruta|vive|lucha|parece|suele|jamás|rara|apenas|solo|sólo|nació|fue|era|se|lo|la le)\b/i;
    if (VERB.test(tt.body) || /^\S+(ía|aba|ó)\b/i.test(tt.body)) return pick([`Se cuenta ${andList(ss.map((x) => x.de))} que ${lower}.`, `Dicen ${andList(ss.map((x) => x.de))} que ${lower}.`], seed, salt);
    return `Para ${andList(ss.map((x) => x.subj))}, ${lower}.`;
  };
  const chars2 = [lord, ...heroes].filter((c): c is ComputedCard => !!c);
  const paras: string[] = [];
  // Legendarios: su lore del juego y, en la misma línea, su rasgo
  for (const c of chars2) {
    const lo = loreOf(c);
    if (!lo) continue;
    const tt = traitText(c);
    paras.push([lo, tt ? traitSentence([c], tt, c.id) : ''].filter(Boolean).join(' '));
  }
  // Genéricos (y legendarios sin lore): sus rasgos en un solo párrafo, agrupando los que dicen lo mismo
  const rest = chars2.filter((c) => !loreOf(c));
  const byText = new Map<string, { cs: ComputedCard[]; tt: { quote: boolean; body: string } }>();
  for (const c of rest) { const tt = traitText(c); if (!tt) continue; const g = byText.get(tt.body) ?? { cs: [], tt }; g.cs.push(c); byText.set(tt.body, g); }
  const restText = [...byText.values()].map((g, i) => traitSentence(g.cs, g.tt, `t${i}`)).join(' ');
  if (restText) paras.push(restText);
  out.push(...paras);
  if (!unitCards.length) return out;

  // 2. Cómo se ve la hueste: el núcleo, los flancos, lo que se alza sobre ellos y la retaguardia (sin cifras, como en un relato)
  const groups = new Map<string, number>();
  for (const x of unitCards) { const t = TROOP_OF[x.u?.group ?? ''] ?? 'inf'; groups.set(t, (groups.get(t) ?? 0) + x.c.count); }
  const total = [...groups.values()].reduce((a, b) => a + b, 0);
  // Bestias de guerra y máquinas: se nombran (con artículo según la primera palabra: "el Oso Elemental", "los Caballeros Negros")
  const proseName = (n: string) => n.replace(/\s*\([^)]*\)/g, '').split(' · ')[0].trim();
  const art = (n: string) => {
    const w = n.split(' ')[0];
    return /as$/i.test(w) ? `las ${n}` : /s$/i.test(w) ? `los ${n}` : /a$/i.test(w) ? `la ${n}` : `el ${n}`;
  };
  const namesOf = (t: string) => [...new Set(unitCards.filter((x) => (TROOP_OF[x.u?.group ?? ''] ?? 'inf') === t).map((x) => proseName(x.c.name)))];
  const core = [...groups].sort((a, b) => b[1] - a[1])[0][0];
  const CORE: Record<string, string[]> = {
    inf: ['Su infantería forma el corazón de la hueste', 'La infantería es el corazón de la hueste'],
    missile: ['Sus tiradores son el alma de la hueste', 'La hueste confía ante todo en sus tiradores'],
    cav: ['Su caballería es la punta de lanza de la hueste', 'La hueste vive y muere por la carga de su caballería'],
    monster: ['Las bestias son el corazón de la hueste', 'La hueste es, ante todo, una manada de bestias de guerra'],
    art: ['Su artillería domina el campo de batalla', 'La hueste confía en el fuego de su artillería'],
  };
  // Lo que acompaña al núcleo, en una sola frase: infantería al frente, tiradores detrás, jinetes en las alas
  let comp = pick(CORE[core], seed, 'i');
  if (core !== 'inf' && groups.has('inf')) comp += ', con su infantería al frente';
  if (core !== 'missile' && groups.has('missile')) comp += pick([', con tiradores que la cubren desde atrás', ', protegida por sus tiradores'], seed, 'r');
  if (core !== 'cav' && groups.has('cav')) comp += pick([', mientras su caballería aguarda en las alas', ', mientras sus jinetes esperan en los flancos el momento de cargar'], seed, 'k');
  comp += '.';
  const beasts = core === 'monster' ? [] : namesOf('monster');
  if (beasts.length) comp += ` ${pick(['Con ella marchan sus bestias de guerra', 'Entre sus filas avanzan sus bestias de guerra', 'La tierra tiembla bajo sus bestias de guerra'], seed, 'b')}: ${andList(beasts.slice(0, 3).map(art))}.`;
  const machines = core === 'art' ? [] : namesOf('art');
  if (machines.length) comp += ` En la retaguardia, ${andList(machines.slice(0, 3).map(art))} ${machines.length > 1 || /^(los|las) /.test(art(machines[0])) ? 'esperan' : 'espera'} la orden de fuego.`;
  out.push(comp);

  // Qué clase de ejército es: élite u horda (nivel medio de las unidades) y en qué se especializa (su composición)
  const tiered = unitCards.filter((x) => x.u?.tier);
  const tierAvg = tiered.length ? tiered.reduce((a, x) => a + x.u!.tier! * x.c.count, 0) / tiered.reduce((a, x) => a + x.c.count, 0) : 0;
  const share = (t: string) => (groups.get(t) ?? 0) / total;
  const armoured = count((x) => x.c.stats.armour.final >= 100) / total;
  const kind = tierAvg >= 3.5
    ? pick(['Es una fuerza de élite: pocos guerreros, pero cada uno vale por diez.', 'Es una hueste de élite, formada solo por lo mejor que su señor puede reunir.'], seed, 'q')
    : tierAvg && tierAvg <= 1.6
      ? pick(['Son tropas de leva, no de élite: confían más en su número que en su calidad.', 'No es una fuerza de élite: lo que le falta en calidad lo compensa con número.'], seed, 'q')
      : '';
  let spec = '';
  if (share('cav') >= 0.4) spec = 'Su fuerza está en la carga: un ejército de choque que rompe líneas y persigue a los que huyen.';
  else if (share('missile') + share('art') >= 0.45) spec = 'Es un ejército que pelea a distancia: el enemigo debe caer antes de llegar a sus filas.';
  else if (share('monster') >= 0.4) spec = 'Es una hueste de bestias y monstruos que aplasta todo lo que toca.';
  else if (armoured >= 0.5) spec = 'Es un muro de acero, difícil de quebrar.';
  else if (share('art') >= 0.25) spec = 'Confía en su artillería para destrozar al enemigo desde lejos.';
  else if (share('inf') >= 0.7 && !groups.has('missile')) spec = 'Es una fuerza de línea: aguanta el golpe y no retrocede.';
  else if (groups.size >= 4) spec = 'Es una fuerza equilibrada, preparada para cualquier enemigo.';
  if (kind || spec) out.push([kind, spec].filter(Boolean).join(' '));

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
  if (strong.length) out.push(strong.join(' '));

  // 4. Su punto débil, dicho como lo diría la facción
  const weak: string[] = [];
  if (!count((x) => x.c.stats.bvl.final > 0)) weak.push('nada en sus filas está hecho para abatir monstruos ni caballería pesada');
  if (!count((x) => x.c.stats.missileDmg.final > 0 || !!x.u?.missile)) weak.push('no tiene con qué responder a distancia');
  if (!magicHits) weak.push('sus armas no hieren de verdad a espectros ni a seres etéreos');
  if (!count((x) => x.c.stats.ap.final > 0 && x.c.stats.ap.final >= x.c.stats.dmg.final)) weak.push('la armadura pesada del enemigo le costará cara');
  // "Aunque X sabe que…" no cierra la frase: se dice "Pero X sabe que…"
  if (weak.length) out.push(`${(v.dread ?? 'Pero conviene recordar que').replace(/^Aunque /, 'Pero ')} ${weak.slice(0, 2).join(', y ')}.`);

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
