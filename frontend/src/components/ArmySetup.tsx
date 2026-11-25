import { fmtStat, statDiff } from '../statFormat';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { unitRank, type AbilityInfo, type ArmyUnitSelection, type BannerOption, type CampaignFaction, type ComputedCard, type StatKey, type UnitData } from '../types';
import type { RosterBuffs } from '../App';
import { campaignUnits } from '../campaign';
import { groupIndex, groupInfo, isRoR, isMA, isMABoss } from '../unitGroups';
import { BuffMark, SpecialTags } from './ArmyPanel';
import { BannerPick } from './BannerPick';
import { UnitIcon } from './UnitIcon';
import { attrIcon } from '../attrIcons';
import { AbilityImg, AttrImg, GameIcon, GroupIcon, OfficialImg, StatImg, useAttrIndex } from '../gameIcons';

// Icono genérico: el del juego (extractor) o, si no viene, según el grupo
const ICON_BY_GROUP: Record<string, string> = {
  Infantry: 'sword', 'Missile Infantry': 'bow', 'Cavalry & Chariots': 'cav', 'Missile Cavalry & Chariots': 'cav_missile',
  'Monsters & Beasts': 'monster', 'Missile Monsters & Beasts': 'monster', 'Artillery & War Machines': 'artillery', Lords: 'lord', Heroes: 'hero',
};
/** Arte de la carta del juego como fondo (si npm run extraer lo copió) */
const artStyle = (u?: UnitData) => (u?.art ? { backgroundImage: `url(/units/${u.art}.png)` } : undefined);
const iconOf = (u?: UnitData) => u?.icon ?? ICON_BY_GROUP[u?.group ?? ''] ?? '';

/** Naturaleza de la unidad según sus atributos del juego: Demonio, No muertos, Constructo o mortal */
export function natureOf(attrs: string[] = []): 'n_daemon' | 'n_undead' | 'n_construct' | 'n_mortal' {
  if (attrs.some((a) => /^Demonio/.test(a))) return 'n_daemon';
  if (attrs.includes('No Muertos')) return 'n_undead';
  if (attrs.includes('Constructo')) return 'n_construct';
  return 'n_mortal';
}
// Marcas de dios: icono de atributo del juego (public/attrs/mark_<dios>.png); el emoji si aún no se extrajo
const MARKS: Record<string, { icon: string; cls: string }> = {
  'Marca de Khorne': { icon: '🩸', cls: 'khorne' }, 'Marca de Nurgle': { icon: '🪰', cls: 'nurgle' },
  'Marca de Slaanesh': { icon: '💜', cls: 'slaanesh' }, 'Marca de Tzeentch': { icon: '🔷', cls: 'tzeentch' },
};
function MarkIcon({ mark, size = 14 }: { mark: string; size?: number }) {
  const m = MARKS[mark];
  return <OfficialImg src={`/attrs/mark_${m.cls}.png`} size={size} title={mark} fallback={<span title={mark}>{m.icon}</span>} />;
}
/** Atributos de la unidad como iconitos (máx. 6; el resto en "+n") */
function AttrIcons({ attrs, max = 7 }: { attrs: { name: string; from?: string }[]; max?: number }) {
  const idx = useAttrIndex();
  const NATURE = /^(Demonio|No Muertos|Constructo|Marca de )/;
  const list = [...new Map(attrs.filter((a) => !NATURE.test(a.name)).map((a) => [a.name, a])).values()];
  const withIcon = list.filter((a) => idx[a.name] || attrIcon(a.name));
  const other = list.filter((a) => !withIcon.includes(a));
  if (!list.length) return null;
  const extra = [...withIcon.slice(max), ...other].map((a) => a.name);
  return (
    <span className="ut-attrs">
      {withIcon.slice(0, max).map((a) => (
        <span key={a.name} className={a.from ? 'buff' : ''} title={a.name + (a.from ? `\nPor ${a.from}` : '')}>
          <AttrImg name={a.name} idx={idx} size={13} />
        </span>
      ))}
      {extra.length > 0 && <span className="more" title={extra.join('\n')}>+{extra.length}</span>}
    </span>
  );
}

/**
 * Iconos en la esquina de la carta: la categoría del juego (caballería, monstruo...) en todas, como en la batalla
 * personalizada; debajo la naturaleza si no es mortal (Demonio, No muertos, Constructo) y la marca de dios.
 */
function NatureBadges({ attrs, kind, cat }: { attrs?: string[]; kind?: string; cat?: string }) {
  const n = natureOf(attrs);
  const mark = (attrs ?? []).find((a) => MARKS[a]);
  return (
    <span className="ut-nature">
      <span className="nat n_mortal"><UnitIcon kind={kind} cat={cat} size={14} /></span>
      {n !== 'n_mortal' && <span className={'nat ' + n}><UnitIcon kind={n} size={14} /></span>}
      {mark && <span className={'nat mark ' + MARKS[mark].cls} title={mark}><MarkIcon mark={mark} /></span>}
    </span>
  );
}

/**
 * Pantalla de "Preparar ejército" al estilo de la batalla personalizada del juego:
 * franja con el ejército (20 espacios), ficha de la unidad a la izquierda y el roster en paneles por tipo.
 * Mejora: cada carta marca si recibe bufos de tu señor, héroes y tecnologías, y la ficha muestra los valores con bufos.
 */

const RANKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const GROUP_CLASS: Record<string, string> = {
  Lords: 'g-lord', Heroes: 'g-hero', Infantry: 'g-inf', 'Missile Infantry': 'g-mis', 'Cavalry & Chariots': 'g-cav',
  'Missile Cavalry & Chariots': 'g-mcav', 'Monsters & Beasts': 'g-mon', 'Missile Monsters & Beasts': 'g-mmon',
  'Artillery & War Machines': 'g-art',
};

interface Props {
  /** Estandartes que puede llevar cada unidad (de los personajes del ejército) */
  bannerOptions?: Record<string, BannerOption[]>;
  units: UnitData[];
  army: ArmyUnitSelection[];
  usedSlots: number;
  buffs: RosterBuffs;
  /** Tarjetas del roster calculadas con tus bufos (rango 0), para la ficha */
  rosterCards: Record<string, ComputedCard>;
  /** Tarjetas calculadas del ejército (unidades al rango elegido, señor y héroes) */
  cards: ComputedCard[];
  campaign?: CampaignFaction;
  /** Ocultar el roster (p. ej. en DPS) */
  compact?: boolean;
  onChange: (army: ArmyUnitSelection[]) => void;
  /** Ir a editar al señor o a un héroe (índice) */
  onEditChar: (tab: 'lord' | number) => void;
}

type Focus = { kind: 'unit'; card: string } | { kind: 'char'; id: string } | null;

/**
 * Cuánto mejoran tus bufos (señor, héroes, tecnologías) a una unidad: suma de los % que suben sus stats
 * (los puntos de resistencia cuentan como %). No es su fuerza total: es cuánto aprovecha los bufos.
 */
interface Gain {
  total: number; parts: { label: string; pct: number; from: number; to: number }[]; rank: number; of: number; verdict: 'hi' | 'mid' | 'lo' | 'none';
  /** Fuerza real (DPS contra un objetivo de referencia) sin y con tus bufos, y su puesto entre las de su tipo */
  metric: string; before: number; after: number; posBefore: number; posAfter: number;
  /** Especialidad con la que se compara (vacío = todo el tipo) */
  scope: string;
  board: { card: string; name: string; before: number; after: number }[];
}
/** Objetivos de referencia para comparar unidades: la bonificación contra grandes o contra infantería cuenta según el objetivo */
const TARGETS = {
  inf: { label: 'Infantería (defensa 30, armadura 50)', md: 30, armour: 50, large: false },
  armored: { label: 'Infantería blindada (defensa 40, armadura 100)', md: 40, armour: 100, large: false },
  cav: { label: 'Caballería (defensa 30, armadura 60, grande)', md: 30, armour: 60, large: true },
  monster: { label: 'Monstruo grande (defensa 30, armadura 30, grande)', md: 30, armour: 30, large: true },
} as const;
type TargetKey = keyof typeof TARGETS;
/** Especialidad dentro del tipo (icono de categoría del juego): lanzas, armas a dos manos, armas dobles… */
function roleOf(u: UnitData): string {
  const c = (u.catIcon ?? '').toLowerCase();
  if (/spear|halberd|pike/.test(c)) return 'Lanzas y alabardas';
  if (/great|two_hand|2h/.test(c)) return 'Armas a dos manos';
  if (/dual/.test(c)) return 'Armas dobles';
  if (/monstrous_infantry|ogre|troll/.test(c)) return 'Infantería monstruosa';
  if (/crossbow/.test(c)) return 'Ballestas';
  if (/bow/.test(c)) return 'Arcos';
  if (/gun|handgun|pistol|blunderbuss|fire/.test(c)) return 'Armas de fuego';
  if (/shock_cavalry|heavy/.test(c)) return 'Caballería de choque';
  if (/chariot/.test(c)) return 'Carros';
  if (/cavalry/.test(c)) return 'Caballería';
  return c.replace(/^wh\d?_(main|dlc\d+|pro\d+)_/, '') || u.group;
}
/** DPS de la unidad completa contra el objetivo (c. a c. o a distancia, según su tipo), sin o con bufos.
 *  La bonificación contra grandes/infantería suma al ataque y al daño (repartida entre base y perforante, como en el juego) */
function powerOf(c: ComputedCard | undefined, ranged: boolean, buffed: boolean, t: (typeof TARGETS)[TargetKey]): number {
  if (!c) return 0;
  const v = (k: StatKey) => (buffed ? c.stats[k]?.final : c.stats[k]?.base) ?? 0;
  const arm = 1 - 0.75 * Math.min(100, t.armour) / 100;
  if (ranged && c.missile && v('reload') > 0) {
    const base = c.missile.dmg + c.missile.ap, scale = base > 0 ? v('missileDmg') / base : 1;
    const bonus = (t.large ? c.missile.bvl : c.missile.bvi) ?? 0;
    const d = c.missile.dmg * scale, ap = c.missile.ap * scale, tot = d + ap || 1;
    return (c.models * (c.missile.shots || 1) * ((d + bonus * d / tot) * arm + ap + bonus * ap / tot)) / v('reload');
  }
  const bonus = t.large ? v('bvl') : v('bvi');
  const d = v('dmg'), ap = v('ap'), tot = d + ap || 1;
  const hit = Math.min(90, Math.max(8, 35 + v('ma') + bonus - t.md)) / 100;
  return (c.models * hit * ((d + bonus * d / tot) * arm + ap + bonus * ap / tot)) / Math.max(c.interval || 4, 1);
}
/** «×1.5 (50% más)»: el multiplicador se entiende mejor que la suma de porcentajes */
const times = (a: number, b: number) => (a > 0 ? b / a : 1);
const fmtX = (x: number) => (x >= 1.995 ? `×${x.toFixed(1)}` : `×${x.toFixed(2)}`);
const GAIN_STATS: [StatKey, string][] = [
  ['ma', 'Ataque'], ['md', 'Defensa'], ['armour', 'Armadura'], ['charge', 'Carga'], ['dmg', 'Daño base'], ['ap', 'Daño perforante'],
  ['hp', 'Salud'], ['speed', 'Velocidad'], ['ld', 'Liderazgo'], ['missileDmg', 'Proyectiles'], ['ammo', 'Munición'], ['range', 'Alcance'],
];
const GAIN_RES: [StatKey, string][] = [['resPhysical', 'Res. física'], ['resMissile', 'Res. proyectiles'], ['resMagic', 'Res. hechizos'], ['resFlame', 'Res. fuego'], ['resWard', 'Salvación']];
function buffGain(c?: ComputedCard): { total: number; parts: Gain['parts'] } | null {
  if (!c) return null;
  const parts: { label: string; pct: number }[] = [];
  for (const [k, label] of GAIN_STATS) {
    const l = c.stats[k];
    if (l && l.base > 0 && l.final !== l.base) parts.push({ label, pct: ((l.final - l.base) / l.base) * 100, from: l.base, to: l.final });
  }
  const r = c.stats.reload; // la recarga baja = mejor
  if (r && r.base > 0 && r.final !== r.base) parts.push({ label: 'Recarga', pct: ((r.base - r.final) / r.base) * 100, from: r.base, to: r.final });
  for (const [k, label] of GAIN_RES) {
    const l = c.stats[k];
    if (l && l.final !== l.base) parts.push({ label, pct: l.final - l.base, from: l.base, to: l.final });
  }
  return { total: parts.reduce((s, p) => s + p.pct, 0), parts: parts.sort((a, b) => b.pct - a.pct) };
}
const GAIN_MARK = { hi: '▲', mid: '■', lo: '▼', none: '·' } as const;
const fmtNum = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));
const GAIN_TEXT = {
  hi: 'Aprovecha tus bufos más que la mayoría de su tipo (no quiere decir que sea la más fuerte)',
  mid: 'Aprovecha tus bufos como otras de su tipo',
  lo: 'Otras de su tipo aprovechan más tus bufos',
  none: 'No vale la pena por bufos: no le llega ninguno',
} as const;
function gainTitle(g: Gain, group: string) {
  return `${GAIN_TEXT[g.verdict]}\nSu ${g.metric}: ${fmtX(times(g.before, g.after))} con tus bufos · ${g.posAfter}.ª más fuerte de ${g.of} (${group}; sin bufos ${g.posBefore}.ª)` +
    (g.parts.length ? '\n' + g.parts.map((p) => `${p.label} ${fmtNum(p.from)} → ${fmtNum(p.to)}`).join(', ') : '');
}

export function ArmySetup({ units, army, usedSlots, buffs, rosterCards, cards, campaign, compact, onChange, onEditChar, bannerOptions }: Props) {
  const [q, setQ] = useState('');
  const [showRoR, setShowRoR] = useState(false);
  const [showMA, setShowMA] = useState(true);
  const [onlyBuffed, setOnlyBuffed] = useState(false);
  // Orden del roster: como el juego (nivel y coste), por bufos o por bufos por cada 1000 de coste
  const [sortBy, setSortBy] = useState<'tier' | 'buff' | 'value'>('tier');
  const [target, setTarget] = useState<TargetKey>('inf');
  const [byRole, setByRole] = useState(true);
  const [showRoster, setShowRoster] = useState(true);
  const [selected, setSelected] = useState<Focus>(null);
  const [hover, setHover] = useState<Focus>(null);
  const allowed = useMemo(() => campaignUnits(campaign), [campaign]);
  const byCard = useMemo(() => new Map(units.map((u) => [u.card, u])), [units]);
  const anyBuffs = Object.keys(buffs).length > 0;
  // Rentabilidad de tus bufos: cada unidad contra las de su mismo tipo (grupo) que puedes reclutar
  const gains = useMemo(() => {
    const out = new Map<string, Gain>();
    if (!anyBuffs) return out;
    const byGroup = new Map<string, { card: string; total: number; parts: Gain['parts'] }[]>();
    // Solo compiten las que se ven en el roster: sin Renombre ni Monstrous Arcanum si sus casillas están apagadas
    for (const u of units) {
      if (allowed && !allowed.has(u.card)) continue;
      if ((!showRoR && isRoR(u)) || isMABoss(u) || (!showMA && isMA(u))) continue;
      const c = rosterCards[u.card];
      const g = buffGain(c) ?? { total: 0, parts: [] };
      // A distancia: los tipos de proyectiles y artillería; el resto se compara en cuerpo a cuerpo
      const ranged = /missile|artillery|ranged|war_machine/i.test(u.group) && !!c?.missile;
      const t = TARGETS[target];
      byGroup.set(u.group, [...(byGroup.get(u.group) ?? []), { card: u.card, name: u.name, cost: u.cost, ranged, role: roleOf(u), before: powerOf(c, ranged, false, t), after: powerOf(c, ranged, true, t), ...g }]);
    }
    // Comparar con la misma especialidad (lanzas con lanzas…) si hay al menos 3; si no, con todo el tipo
    if (byRole) {
      for (const [gk, list] of [...byGroup.entries()]) {
        const roles = new Map<string, typeof list>();
        for (const x of list) roles.set(x.role, [...(roles.get(x.role) ?? []), x]);
        const rest: typeof list = [];
        for (const [r, l] of roles) { if (l.length >= 3) byGroup.set(`${gk}|${r}`, l); else rest.push(...l); }
        if (rest.length) byGroup.set(gk, rest); else byGroup.delete(gk);
      }
    }
    for (const [gk, list] of byGroup.entries()) {
      const scopeName = gk.includes('|') ? gk.split('|')[1] : '';
      // Rentable: cuánto la mejoran tus bufos (multiplicador), comparado con las de su tipo
      const byGain = [...list].sort((a, b) => times(b.before, b.after) - times(a.before, a.after));
      const byBefore = [...list].sort((a, b) => b.before - a.before);
      const byAfter = [...list].sort((a, b) => b.after - a.after);
      const board = byAfter.map((x) => ({ card: x.card, name: x.name, before: x.before, after: x.after }));
      byGain.forEach((x, i) => {
        const third = list.length / 3;
        const verdict: Gain['verdict'] = x.total <= 0 ? 'none' : list.length < 3 ? 'mid' : i < third ? 'hi' : i >= list.length - third ? 'lo' : 'mid';
        out.set(x.card, {
          total: x.total, parts: x.parts, rank: i + 1, of: list.length, verdict, board,
          metric: x.ranged ? 'daño a distancia' : 'daño cuerpo a cuerpo', before: x.before, after: x.after, scope: scopeName,
          posBefore: byBefore.indexOf(x) + 1, posAfter: byAfter.indexOf(x) + 1,
        });
      });
    }
    return out;
  }, [units, rosterCards, allowed, anyBuffs, showRoR, showMA, target, byRole]);

  const roster = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = units
      .filter((u) => showRoR || !isRoR(u))
      .filter((u) => !isMABoss(u) && (showMA || !isMA(u))) // Monstrous Arcanum: los jefes de cacería no se reclutan
      .filter((u) => !allowed || allowed.has(u.card))
      .filter((u) => !qq || u.name.toLowerCase().includes(qq))
      .filter((u) => !onlyBuffed || !!buffs[u.card])
      // Como en el juego: por nivel (tier) y, dentro del nivel, por coste; o por lo que aprovechan tus bufos
      .sort((a, b) => {
        if (sortBy !== 'tier') {
          const ga = gains.get(a.card), gb = gains.get(b.card);
          const d = sortBy === 'buff' ? (gb?.after ?? 0) - (ga?.after ?? 0) : (gb?.after ?? 0) / Math.max(b.cost, 1) - (ga?.after ?? 0) / Math.max(a.cost, 1);
          if (d) return d;
        }
        return (a.tier ?? 0) - (b.tier ?? 0) || a.cost - b.cost;
      });
    const m = new Map<string, UnitData[]>();
    for (const u of list) m.set(u.group, [...(m.get(u.group) ?? []), u]);
    return [...m.entries()].sort((a, b) => groupIndex(a[0]) - groupIndex(b[0]));
  }, [units, q, showRoR, showMA, onlyBuffed, buffs, allowed, sortBy, gains]);

  const add = (card: string) => {
    if (usedSlots >= 20) return;
    const ex = army.find((a) => a.card === card);
    onChange(ex ? army.map((a) => (a.card === card ? { ...a, count: a.count + 1 } : a)) : [...army, { card, count: 1 }]);
  };
  const removeOne = (card: string) =>
    onChange(army.flatMap((a) => (a.card !== card ? [a] : a.count > 1 ? [{ ...a, count: a.count - 1 }] : [])));
  const removeAll = (card: string) => onChange(army.filter((a) => a.card !== card));
  const setRank = (card: string, rank: number) => onChange(army.map((a) => (a.card === card ? { ...a, rank7: undefined, rank } : a)));
  const setAllRanks = (rank: number) => onChange(army.map((a) => ({ ...a, rank7: undefined, rank })));
  /** Mejora de unidad de un grupo (los aspectos de Dríades/Árboles se excluyen entre sí; en lo demás, una por categoría) */
  const upgradeGroup = (cat: string) => (cat.endsWith('_aspect') ? 'aspect' : cat);
  const setUpgrade = (card: string, group: string, key: string) => onChange(army.map((a) => {
    if (a.card !== card) return a;
    const opts = byCard.get(card)?.upgrades ?? [];
    const keep = (a.upgrades ?? []).filter((k) => upgradeGroup(opts.find((o) => o.key === k)?.category ?? '') !== group);
    return { ...a, upgrades: key ? [...keep, key] : keep };
  }));

  const chars = cards.filter((c) => c.kind !== 'unit');
  const unitCard = (id: string) => cards.find((c) => c.kind === 'unit' && c.id === id);
  const cost = army.reduce((s, a) => s + (byCard.get(a.card)?.cost ?? 0) * a.count, 0);
  // Cartas del ejército: una por unidad (como en el juego), en orden de tipo
  const strip = [...army]
    .sort((a, b) => groupIndex(byCard.get(a.card)?.group) - groupIndex(byCard.get(b.card)?.group) || (byCard.get(a.card)?.tier ?? 0) - (byCard.get(b.card)?.tier ?? 0))
    .flatMap((a) => Array.from({ length: a.count }, (_, i) => ({ sel: a, i })));
  const empty = Math.max(0, 20 - usedSlots);

  const focus = hover ?? selected;
  const selUnit = selected?.kind === 'unit' ? army.find((a) => a.card === selected.card) : undefined;

  return (
    <div className="setup">
      <div className="setup-head">
        <h3>Ejército</h3>
        <span className={'slots' + (usedSlots > 20 ? ' bad' : '')}>{usedSlots} / 20</span>
        <span className="muted">Coste unidades: <b>{cost.toLocaleString('es-MX')}</b> MP</span>
        {campaign && <span className="muted small">Roster de campaña: {campaign.name}</span>}
        {army.length > 1 && (
          <label className="small" title="Pone el mismo rango a todas las unidades">
            Rango de todas:{' '}
            <select value="" onChange={(e) => e.target.value !== '' && setAllRanks(Number(e.target.value))}>
              <option value="">—</option>
              {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        {!compact && (
          <button className="ghost small" onClick={() => setShowRoster((v) => !v)}>{showRoster ? 'Ocultar roster ▴' : 'Mostrar roster ▾'}</button>
        )}
      </div>

      {/* Franja del ejército */}
      <div className="army-strip">
        {chars.map((c, i) => (
          <button
            key={c.kind + c.id}
            className={'utile ' + (c.kind === 'lord' ? 'g-lord' : 'g-hero') + (c.art ? ' has-art' : '') + (selected?.kind === 'char' && selected.id === c.id ? ' sel' : '')}
            style={c.art ? { backgroundImage: `url(/units/${c.art}.png)` } : undefined}
            onMouseEnter={() => setHover({ kind: 'char', id: c.id })}
            onMouseLeave={() => setHover(null)}
            onClick={() => setSelected({ kind: 'char', id: c.id })}
            onDoubleClick={() => onEditChar(c.kind === 'lord' ? 'lord' : i - (chars[0]?.kind === 'lord' ? 1 : 0))}
            title={`${c.name}\nDoble clic para editar su árbol`}
          >
            <span className="ut-cost">{c.kind === 'lord' ? 'Señor' : 'Héroe'}</span>
            <span className="ut-icon"><UnitIcon kind={c.kind === 'lord' ? 'lord' : 'hero'} cat={c.kind === 'lord' ? 'commander' : 'hero'} /><NatureBadges kind={c.kind === 'lord' ? 'lord' : 'hero'} cat={c.kind === 'lord' ? 'commander' : 'hero'} attrs={c.attributes.map((a) => a.name)} /></span>
            <span className="ut-name">{c.name}</span>
            <AttrIcons attrs={c.attributes} />
          </button>
        ))}
        {strip.map(({ sel, i }) => {
          const u = byCard.get(sel.card);
          const g = u?.group ?? '';
          const r = unitRank(sel);
          return (
            <button
              key={sel.card + i}
              className={'utile ' + (GROUP_CLASS[g] ?? '') + (u?.art ? ' has-art' : '') + (selected?.kind === 'unit' && selected.card === sel.card ? ' sel' : '') + (isRoR(u) ? ' is-ror' : '') + (isMA(u) ? ' is-ma' : '')}
              style={artStyle(u)}
              onMouseEnter={() => setHover({ kind: 'unit', card: sel.card })}
              onMouseLeave={() => setHover(null)}
              onClick={() => setSelected({ kind: 'unit', card: sel.card })}
              onContextMenu={(e) => { e.preventDefault(); removeOne(sel.card); }}
              title={`${u?.name ?? sel.card}\nClic: ver y cambiar rango · clic derecho: quitar`}
            >
              <span className="ut-cost"><Tier t={u?.tier} />{u?.cost ?? ''}</span>
              <span className="ut-icon"><UnitIcon kind={iconOf(u)} cat={u?.catIcon} /><NatureBadges kind={iconOf(u)} cat={u?.catIcon} attrs={u?.attrs} /></span>
              <span className="ut-name">{u?.name ?? sel.card}</span>
              <AttrIcons attrs={unitCard(sel.card)?.attributes ?? (u?.attrs ?? []).map((name) => ({ name }))} />
              <span className="ut-marks">
                {buffs[sel.card]?.now.length ? <span className="bm-now">▲{buffs[sel.card].now.length}</span> : null}
                {r > 0 && <span className="ut-rank">R{r}</span>}
                {sel.banner && <span className="ut-rank ut-banner" title={`Estandarte: ${bannerOptions?.[sel.card]?.find((o) => o.key === sel.banner)?.name ?? sel.banner}`}>⚑</span>}
                {(sel.upgrades?.length ?? 0) > 0 && <span className="ut-rank" title={`Mejoras: ${sel.upgrades!.map((k) => u?.upgrades?.find((o) => o.key === k)?.name ?? k).join(', ')}`}>✦{sel.upgrades!.length}</span>}
              </span>
            </button>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <span key={'e' + i} className="utile empty" />
        ))}
      </div>

      {selUnit && (
        <div className="strip-tools">
          <b>{byCard.get(selUnit.card)?.name}</b>
          <span className="counter">
            <button onClick={() => removeOne(selUnit.card)}>−</button>
            <b>{selUnit.count}</b>
            <button onClick={() => add(selUnit.card)} disabled={usedSlots >= 20}>+</button>
          </span>
          <label title="Rango de veteranía: activa los bufos de rango 7+ y los que crecen por rango">
            Rango{' '}
            <select value={unitRank(selUnit)} onChange={(e) => setRank(selUnit.card, Number(e.target.value))}>
              {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {(() => {
            // Mejoras de campaña (aspectos del Abedul/Roble/Sauce de Drycha y Durthu, mejoras de Ogros, genes de Moulder...)
            const opts = (byCard.get(selUnit.card)?.upgrades ?? []).filter((o) => !campaign || !o.banned?.includes(campaign.key));
            if (!opts.length) return null;
            const groups = [...new Map(opts.map((o) => [upgradeGroup(o.category), o.category.endsWith('_aspect') ? 'Aspecto' : o.categoryName])).entries()];
            return groups.map(([g, label]) => {
              const cur = (selUnit.upgrades ?? []).find((k) => upgradeGroup(opts.find((o) => o.key === k)?.category ?? '') === g) ?? '';
              return (
                <label key={g} className="upg-pick" title="Mejora de unidad comprada en campaña">
                  {label}{' '}
                  <select value={cur} onChange={(e) => setUpgrade(selUnit.card, g, e.target.value)}>
                    <option value="">—</option>
                    {opts.filter((o) => upgradeGroup(o.category) === g).map((o) => (
                      <option key={o.key} value={o.key} title={o.texts.join('\n')}>{o.name}</option>
                    ))}
                  </select>
                </label>
              );
            });
          })()}
          <BannerPick compact options={bannerOptions?.[selUnit.card]} value={selUnit.banner}
            onChange={(k) => onChange(army.map((a) => (a.card === selUnit.card ? { ...a, banner: k } : k && a.banner === k ? { ...a, banner: null } : a)))} />
          <button className="ghost danger" onClick={() => { removeAll(selUnit.card); setSelected(null); }}>Quitar todas</button>
          {campaign && byCard.get(selUnit.card) && allowed && !allowed.has(selUnit.card) && (
            <span className="camp-warn">⚠ {campaign.name} no puede tener esta unidad</span>
          )}
        </div>
      )}

      {!compact && showRoster && (
        <div className="setup-body">
          <InfoPanel
            focus={focus}
            unit={focus?.kind === 'unit' ? byCard.get(focus.card) : undefined}
            card={focus?.kind === 'unit' ? unitCard(focus.card) ?? rosterCards[focus.card] : focus?.kind === 'char' ? chars.find((c) => c.id === focus.id) : undefined}
            inArmy={focus?.kind === 'unit' ? !!unitCard(focus.card) : true}
            buffs={focus?.kind === 'unit' ? buffs[focus.card] : undefined}
            upgradeRank={focus?.kind === 'unit' ? campaign?.upgrades[focus.card] : undefined}
            building={focus?.kind === 'unit' ? campaign?.buildings?.[focus.card] : undefined}
            gain={focus?.kind === 'unit' ? gains.get(focus.card) : undefined}
          />
          <div className="roster-area">
            <div className="roster-tools">
              <input placeholder="Buscar unidad…" value={q} onChange={(e) => setQ(e.target.value)} />
              <label><input type="checkbox" checked={showRoR} onChange={(e) => setShowRoR(e.target.checked)} /> Regimientos de Renombre</label>
              <label title="Monstruos de las cacerías del Monstrous Arcanum (Norsca): recompensas y jefes"><input type="checkbox" checked={showMA} onChange={(e) => setShowMA(e.target.checked)} /> 📖 Monstrous Arcanum</label>
              <label title="Solo las unidades que reciben bufos de tu señor, héroes o tecnologías">
                <input type="checkbox" checked={onlyBuffed} disabled={!anyBuffs} onChange={(e) => setOnlyBuffed(e.target.checked)} /> Solo con bufos
              </label>
              <label title="Contra qué objetivo se mide la fuerza: la bonificación contra grandes o contra infantería cuenta según el objetivo">Objetivo{' '}
                <select value={target} onChange={(e) => setTarget(e.target.value as TargetKey)}>
                  {Object.entries(TARGETS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                </select>
              </label>
              <label title="Comparar solo con unidades de la misma especialidad (lanzas con lanzas, armas a dos manos con armas a dos manos…)">
                <input type="checkbox" checked={byRole} onChange={(e) => setByRole(e.target.checked)} /> Misma especialidad
              </label>
              <label title="Cómo ordenar las unidades dentro de cada tipo">Orden{' '}
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                  <option value="tier">Nivel y coste (como el juego)</option>
                  <option value="buff" disabled={!anyBuffs}>Más fuertes con tus bufos</option>
                  <option value="value" disabled={!anyBuffs}>Fuerza con bufos por coste</option>
                </select>
              </label>
              <span className="small muted">Clic para agregar · clic derecho en el ejército para quitar · pasa el ratón para ver la ficha</span>
            </div>
            <div className="roster-panels">
              {roster.map(([g, list]) => (
                <div key={g} className="rpanel">
                  <div className="rpanel-head">
                    <GroupIcon g={g} /> {groupInfo(g).es} <span className="muted small">({list.length})</span>
                  </div>
                  <div className="rpanel-tiles">
                    {list.map((u) => {
                      const n = army.find((a) => a.card === u.card)?.count ?? 0;
                      const b = buffs[u.card];
                      return (
                        <button
                          key={u.card}
                          className={'utile ' + (GROUP_CLASS[g] ?? '') + (u.art ? ' has-art' : '') + (b ? ' buffed' : '') + (n ? ' in-army' : '') + (isRoR(u) ? ' is-ror' : '') + (isMA(u) ? ' is-ma' : '')}
                          style={artStyle(u)}
                          onClick={() => add(u.card)}
                          onMouseEnter={() => setHover({ kind: 'unit', card: u.card })}
                          onMouseLeave={() => setHover(null)}
                          disabled={usedSlots >= 20}
                        >
                          <span className="ut-cost"><Tier t={u.tier} />{u.cost}</span>
                          <span className="ut-icon"><UnitIcon kind={iconOf(u)} cat={u.catIcon} /><NatureBadges kind={iconOf(u)} cat={u.catIcon} attrs={u.attrs} /></span>
                          <span className="ut-name">{u.name}</span>
                          <AttrIcons attrs={rosterCards[u.card]?.attributes ?? (u.attrs ?? []).map((name) => ({ name }))} />
                          <span className="ut-marks">
                            <BuffMark b={b} />
                            {gains.get(u.card) && (
                              <span className={'gain gain-' + gains.get(u.card)!.verdict} title={gainTitle(gains.get(u.card)!, groupInfo(g).es)}>
                                {GAIN_MARK[gains.get(u.card)!.verdict]}
                              </span>
                            )}
                            {isRoR(u) && <span title="Regimiento de Renombre"><GameIcon path="skills/battle_experience" emoji="🏅" size={14} title="Regimiento de Renombre" /></span>}
                            {u.campaignOnly && <span title="Solo en campaña"><GameIcon path="skills/campaign_movement" emoji="🗺️" size={14} title="Solo en campaña" /></span>}
                            {(u.excl?.length ?? 0) > 0 && <span title={`Solo: ${u.excl!.join(', ')}`}>🔒</span>}
                            {campaign?.buildings?.[u.card] && <span title={`Solo con edificio: ${campaign.buildings[u.card].join(', ')}`}><GameIcon path="skills/character_construction" emoji="🏛️" size={14} /></span>}
                            {campaign?.upgrades[u.card] !== undefined && <span className="ut-rank" title="Se consigue mejorando otra unidad">M{campaign.upgrades[u.card]}</span>}
                          </span>
                          {n > 0 && <span className="ut-count">×{n}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!roster.length && <p className="muted">Ninguna unidad coincide.</p>}
            </div>
            <div className="small muted roster-legend">
              <span className="bm-now">▲n</span> recibe bufos de tu señor, héroes o tecnologías · <span className="bm-r7">R+</span> más bufos al subir de rango ·
              <GameIcon path="skills/battle_experience" emoji="🏅" size={13} /> Renombre · <GameIcon path="skills/campaign_movement" emoji="🗺️" size={13} /> solo campaña · 🔒 exclusiva de algunas facciones · M4 = se consigue mejorando otra unidad desde rango 4
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface MatchupCount { win: number; even: number; lose: number }

/**
 * Franja del ejército para elegir con un clic (p. ej. el atacante del DPS): una carta por tarjeta, como en "Preparar
 * ejército". Con `matchups` cada carta muestra cuántos duelos gana/empata/pierde y ★ marca las que mejor salen.
 */
/** Duelos ganados · parejos · perdidos de una carta contra los objetivos de la tabla del DPS */
function DuelMarks({ m }: { m?: MatchupCount }) {
  if (!m) return null;
  return (
    <span className="ut-duels" title={`Contra los objetivos de la tabla:\n✅ gana ${m.win} · ⚖️ parejo ${m.even} · ❌ pierde ${m.lose}`}>
      <span className="w">{m.win}</span>·<span className="e">{m.even}</span>·<span className="l">{m.lose}</span>
    </span>
  );
}
const BestStar = ({ title = 'La que mejor sale contra los objetivos de la tabla (más duelos ganados menos perdidos)' }: { title?: string }) =>
  <span className="ut-best" title={title}>★</span>;

/**
 * Unidades del roster que no están en el ejército, con sus duelos contra los mismos objetivos (rango 0, con los bufos
 * del ejército). Solo informa: para elegirla como atacante hay que agregarla al ejército.
 */
export function RosterDuelStrip({ units, matchups, best }: { units: UnitData[]; matchups: Record<string, MatchupCount>; best: Set<string> }) {
  const list = [...units].sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || (a.tier ?? 0) - (b.tier ?? 0) || a.cost - b.cost);
  return (
    <div className="army-strip pick-strip roster-duels">
      {list.map((u) => (
        <div
          key={u.card}
          className={'utile ' + (GROUP_CLASS[u.group] ?? '') + (u.art ? ' has-art' : '') + (best.has(u.card) ? ' best' : '') + (isRoR(u) ? ' is-ror' : '') + (isMA(u) ? ' is-ma' : '')}
          style={artStyle(u)}
          title={`${u.name}\nNo está en tu ejército: agrégala en la pestaña Ejército para elegirla como atacante`}
        >
          <span className="ut-cost"><Tier t={u.tier} />{u.cost}</span>
          {best.has(u.card) && <BestStar title="La del resto del roster que mejor sale contra los objetivos de la tabla" />}
          <span className="ut-icon"><UnitIcon kind={iconOf(u)} cat={u.catIcon} /><NatureBadges kind={iconOf(u)} cat={u.catIcon} attrs={u.attrs} /></span>
          <span className="ut-name">{u.name}</span>
          <DuelMarks m={matchups[u.card]} />
        </div>
      ))}
    </div>
  );
}

/** Tarjeta pequeña de una unidad del roster (para listas como "a quién afecta esta habilidad") */
export function UnitTile({ u, selected, dim, title, badge, onClick }: { u: UnitData; selected?: boolean; dim?: boolean; title?: string; badge?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={'utile ' + (GROUP_CLASS[u.group] ?? '') + (u.art ? ' has-art' : '') + (selected ? ' sel' : '') + (dim ? ' dim' : '') + (isRoR(u) ? ' is-ror' : '') + (isMA(u) ? ' is-ma' : '')}
      style={artStyle(u)}
      title={title ?? u.name}
      onClick={onClick}
    >
      <span className="ut-cost"><Tier t={u.tier} />{u.cost}</span>
      <span className="ut-icon"><UnitIcon kind={iconOf(u)} cat={u.catIcon} /><NatureBadges kind={iconOf(u)} cat={u.catIcon} attrs={u.attrs} /></span>
      <span className="ut-name">{u.name}</span>
      {badge && <span className="ut-duels ut-techs">{badge}</span>}
    </button>
  );
}

/** Tira de señores, héroes y unidades para elegir una (Tecnologías; unidades que reciben bufos de un personaje) */
const BADGE_VIEW = 'wh3-planner:badge-strip-view';
type BadgeGroup = '' | 'type' | 'tier';
const ROMAN_T = ['', 'I', 'II', 'III', 'IV', 'V'];

export function UnitBadgeStrip({ units, chars = [], badge, tip, dim, selected, onPick }: {
  units: UnitData[];
  /** Personajes: `id` es "lord:<clave>" o "hero:<clave>" */
  chars?: { id: string; name: string; kind: 'lord' | 'hero'; art?: string }[];
  /** Texto abajo de cada tarjeta; full = en verde */
  badge: (id: string) => { text: string; full?: boolean };
  /** Lo que dice el título al pasar el ratón, después del nombre */
  tip: (id: string) => string;
  /** En gris (p. ej. todavía no recibe nada) */
  dim?: (id: string) => boolean;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  // Agrupar por tipo o por nivel, y ocultar las que no reciben nada (se recuerda en este navegador)
  const [view, setView] = useState<{ group: BadgeGroup; onlyLit: boolean }>(() => {
    try { return { group: 'type', onlyLit: false, ...JSON.parse(localStorage.getItem(BADGE_VIEW) ?? '{}') }; } catch { return { group: 'type', onlyLit: false }; }
  });
  useEffect(() => { try { localStorage.setItem(BADGE_VIEW, JSON.stringify(view)); } catch { /* sin almacenamiento */ } }, [view]);
  const list = [...units]
    .filter((u) => !view.onlyLit || !dim?.(u.card))
    .sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || (a.tier ?? 0) - (b.tier ?? 0) || a.cost - b.cost);
  const hiddenCount = units.length - list.length;
  const mark = (id: string) => {
    const b = badge(id);
    return <span className={'ut-duels ut-techs' + (b.full ? ' full' : '')}>{b.text}</span>;
  };
  const unitTile = (u: UnitData) => (
    <button
      key={u.card}
      className={'utile ' + (GROUP_CLASS[u.group] ?? '') + (u.art ? ' has-art' : '') + (selected === u.card ? ' sel' : '') + (dim?.(u.card) ? ' dim' : '') + (isRoR(u) ? ' is-ror' : '') + (isMA(u) ? ' is-ma' : '')}
      style={artStyle(u)}
      title={`${u.name}\n${tip(u.card)}`}
      onClick={() => onPick(u.card)}
    >
      <span className="ut-cost"><Tier t={u.tier} />{u.cost}</span>
      <span className="ut-icon"><UnitIcon kind={iconOf(u)} cat={u.catIcon} /><NatureBadges kind={iconOf(u)} cat={u.catIcon} attrs={u.attrs} /></span>
      <span className="ut-name">{u.name}</span>
      {mark(u.card)}
    </button>
  );
  const charTiles = chars.map((c) => {
    const k = c.kind === 'lord' ? 'lord' : 'hero';
    const cat = c.kind === 'lord' ? 'commander' : 'hero';
    return (
      <button
        key={c.id}
        className={'utile g-' + k + (c.art ? ' has-art' : '') + (selected === c.id ? ' sel' : '')}
        style={c.art ? { backgroundImage: `url(/units/${c.art}.png)` } : undefined}
        title={`${c.name}\n${tip(c.id)}`}
        onClick={() => onPick(c.id)}
      >
        <span className="ut-cost">{c.kind === 'lord' ? 'Señor' : 'Héroe'}</span>
        <span className="ut-icon"><UnitIcon kind={k} cat={cat} /><NatureBadges kind={k} cat={cat} /></span>
        <span className="ut-name">{c.name}</span>
        {mark(c.id)}
      </button>
    );
  });
  // Secciones: por tipo (orden del juego) o por nivel (de élite a básicas)
  const sections: { key: string; title: React.ReactNode; units: UnitData[] }[] = [];
  if (!view.group) sections.push({ key: 'all', title: null, units: list });
  else {
    const m = new Map<string, UnitData[]>();
    const keyOf = (u: UnitData) => (view.group === 'tier' ? String(u.tier ?? 0) : u.group ?? '');
    for (const u of list) m.set(keyOf(u), [...(m.get(keyOf(u)) ?? []), u]);
    const order = (k: string) => (view.group === 'tier' ? -Number(k) : groupIndex(k));
    for (const [k, us] of [...m.entries()].sort((a, b) => order(a[0]) - order(b[0]))) {
      const lit = us.filter((u) => !dim?.(u.card)).length;
      sections.push({
        key: k, units: us,
        title: (
          <>
            {view.group === 'tier' ? <><Tier t={Number(k) || undefined} /> <b>{Number(k) ? `Nivel ${ROMAN_T[Number(k)] ?? k}` : 'Sin nivel'}</b></> : <><GroupIcon g={k} size={16} /> <b>{groupInfo(k).es}</b></>}
            <span className="muted small"> · {us.length} unidad{us.length === 1 ? '' : 'es'}{dim ? ` · ${lit} con bufos` : ''}</span>
          </>
        ),
      });
    }
  }
  return (
    <div className="badge-strip">
      <div className="badge-strip-tools small">
        <span className="seg">
          {([['', 'Sin agrupar'], ['type', 'Por tipo'], ['tier', 'Por nivel']] as [BadgeGroup, string][]).map(([k, l]) => (
            <button key={k || 'none'} type="button" className={view.group === k ? 'on' : ''} onClick={() => setView((v) => ({ ...v, group: k }))}>{l}</button>
          ))}
        </span>
        {dim && (
          <label title="Oculta las unidades en gris (las que todavía no reciben nada)">
            <input type="checkbox" checked={view.onlyLit} onChange={(e) => setView((v) => ({ ...v, onlyLit: e.target.checked }))} /> Solo las que reciben algo{view.onlyLit && hiddenCount ? ` (${hiddenCount} ocultas)` : ''}
          </label>
        )}
      </div>
      {charTiles.length > 0 && <div className="army-strip pick-strip">{charTiles}</div>}
      {sections.map((sec) => (
        <div key={sec.key} className="badge-sec">
          {sec.title && <div className="badge-sec-head">{sec.title}</div>}
          <div className="army-strip pick-strip">{sec.units.map(unitTile)}</div>
        </div>
      ))}
    </div>
  );
}

export function PickStrip({ cards, units, selected, onPick, matchups, best }: {
  cards: ComputedCard[];
  units: UnitData[];
  selected: string;
  onPick: (id: string) => void;
  matchups?: Record<string, MatchupCount>;
  best?: Set<string>;
}) {
  const byCard = useMemo(() => new Map(units.map((u) => [u.card, u])), [units]);
  const chars = cards.filter((c) => c.kind !== 'unit');
  const list = cards
    .filter((c) => c.kind === 'unit')
    .sort((a, b) => groupIndex(byCard.get(a.id)?.group) - groupIndex(byCard.get(b.id)?.group) || (byCard.get(a.id)?.tier ?? 0) - (byCard.get(b.id)?.tier ?? 0));
  const marks = (id: string) => <DuelMarks m={matchups?.[id]} />;
  const star = (id: string) => best?.has(id) && <BestStar />;
  return (
    <div className="army-strip pick-strip">
      {chars.map((c) => (
        <button
          key={c.kind + c.id}
          className={'utile ' + (c.kind === 'lord' ? 'g-lord' : 'g-hero') + (c.art ? ' has-art' : '') + (selected === c.id ? ' sel' : '') + (best?.has(c.id) ? ' best' : '')}
          style={c.art ? { backgroundImage: `url(/units/${c.art}.png)` } : undefined}
          onClick={() => onPick(c.id)}
          title={c.name}
        >
          <span className="ut-cost">{c.kind === 'lord' ? 'Señor' : 'Héroe'}</span>
          {star(c.id)}
          <span className="ut-icon"><UnitIcon kind={c.kind === 'lord' ? 'lord' : 'hero'} cat={c.kind === 'lord' ? 'commander' : 'hero'} /><NatureBadges kind={c.kind === 'lord' ? 'lord' : 'hero'} cat={c.kind === 'lord' ? 'commander' : 'hero'} attrs={c.attributes.map((a) => a.name)} /></span>
          <span className="ut-name">{c.name}</span>
          {marks(c.id)}
        </button>
      ))}
      {list.map((c) => {
        const u = byCard.get(c.id);
        return (
          <button
            key={c.id}
            className={'utile ' + (GROUP_CLASS[u?.group ?? ''] ?? '') + (u?.art ? ' has-art' : '') + (selected === c.id ? ' sel' : '') + (best?.has(c.id) ? ' best' : '') + (isRoR(u) ? ' is-ror' : '') + (isMA(u) ? ' is-ma' : '')}
            style={artStyle(u)}
            onClick={() => onPick(c.id)}
            title={c.name}
          >
            <span className="ut-cost"><Tier t={u?.tier} />{u?.cost ?? ''}</span>
            {star(c.id)}
            <span className="ut-icon"><UnitIcon kind={iconOf(u)} cat={u?.catIcon} /><NatureBadges kind={iconOf(u)} cat={u?.catIcon} attrs={u?.attrs} /></span>
            <span className="ut-name">{c.name}</span>
            {c.count > 1 && <span className="ut-count">×{c.count}</span>}
            {marks(c.id)}
          </button>
        );
      })}
    </div>
  );
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
/** Nivel (tier) de la unidad en números romanos, como en el juego */
export function Tier({ t }: { t?: number }) {
  if (!t) return null;
  return <span className={'ut-tier t' + t} title={`Nivel ${t} (tier): 1 = básicas, 5 = de élite`}>{ROMAN[t] ?? t}</span>;
}

// ---------------------------------------------------------------- ficha (panel izquierdo)
const BARS: { k: StatKey | 'ws'; label: string; icon: string; max: number; unitKey?: keyof UnitData }[] = [
  { k: 'armour', label: 'Armadura', icon: '⛓️', max: 200, unitKey: 'armour' as keyof UnitData },
  { k: 'ld', label: 'Liderazgo', icon: '🚩', max: 100 },
  { k: 'speed', label: 'Velocidad', icon: '👟', max: 100 },
  { k: 'ma', label: 'Ataque melee', icon: '⚔️', max: 100 },
  { k: 'md', label: 'Defensa melee', icon: '🛡️', max: 100 },
  { k: 'ws', label: 'Fuerza del arma', icon: '💥', max: 500 },
  { k: 'charge', label: 'Bonif. de carga', icon: '🐗', max: 100 },
];

function baseOf(u: UnitData | undefined, k: StatKey | 'ws'): number | undefined {
  if (!u) return undefined;
  const x = u as unknown as Record<string, number>;
  if (k === 'ws') return (x.dmg ?? 0) + (x.ap ?? 0);
  if (k === 'ld') return x.leadership;
  return x[k];
}

function InfoPanel({ focus, unit, card, inArmy, buffs, upgradeRank, building, gain }: {
  focus: Focus; unit?: UnitData; card?: ComputedCard; inArmy: boolean; buffs?: RosterBuffs[string]; upgradeRank?: number; building?: string[]; gain?: Gain;
}) {
  const attrIdx = useAttrIndex();
  const info = useUnitAbilities(unit?.key, (card ? card.attributes.map((a) => a.name) : unit?.attrs) ?? []);
  if (!focus || (!unit && !card)) {
    return (
      <aside className="infopanel">
        <p className="muted small">Pasa el ratón por una unidad para ver su ficha: stats (con tus bufos), puntos fuertes, habilidades pasivas y resistencias.</p>
      </aside>
    );
  }
  const val = (k: StatKey | 'ws') => {
    if (card) {
      if (k === 'ws') return { base: card.stats.dmg.base + card.stats.ap.base, final: card.stats.dmg.final + card.stats.ap.final };
      return { base: card.stats[k].base, final: card.stats[k].final };
    }
    const b = baseOf(unit, k) ?? 0;
    return { base: b, final: b };
  };
  const name = card?.name ?? unit?.name ?? '';
  const caste = unit?.casteEs ?? card?.caste ?? (card?.kind === 'lord' ? 'Señor' : card?.kind === 'hero' ? 'Héroe' : '');
  const models = card?.models ?? unit?.models ?? 0;
  const hp = val('hp');
  // [nombre, valor, clave del icono]
  const res: [string, number, string][] = card
    ? ([['Física', card.stats.resPhysical.final, 'resPhysical'], ['Proyectiles', card.stats.resMissile.final, 'resMissile'], ['Hechizos', card.stats.resMagic.final, 'resMagic'], ['Fuego', card.stats.resFlame.final, 'resFlame'], ['Salvación', card.stats.resWard.final, 'resWard']] as [string, number, string][])
    : unit?.res
      ? ([['Física', unit.res.physical, 'resPhysical'], ['Proyectiles', unit.res.missile, 'resMissile'], ['Hechizos', unit.res.magic, 'resMagic'], ['Fuego', unit.res.flame, 'resFlame'], ['Salvación', unit.res.ward, 'resWard']] as [string, number, string][])
      : [];
  const attrs = card ? card.attributes : (unit?.attrs ?? []).map((a) => ({ name: a, from: undefined as string | undefined }));
  const bullets = unit?.bp ?? [];
  // Las tarjetas de señor y héroe no traen todas las stats (p. ej. bonificaciones contra grandes)
  const stat = (k: string) => (card?.stats as Record<string, { base: number; final: number } | undefined> | undefined)?.[k] ?? null;
  const raw = (k: string) => Number((unit as unknown as Record<string, number> | undefined)?.[k] ?? 0);
  const mis = stat('missileDmg')?.base || stat('missileDmg')?.final ? card : null;
  const missile = unit?.missile;
  /** Fila sin barra; con bufos muestra la diferencia como las de arriba */
  const extraRow = (k: string, emoji: string, label: string, st: { base: number; final: number } | null, plain: number) => {
    const v = (st ? st.final : plain) ?? 0;
    const diff = st ? statDiff(st.final, st.base) : 0;
    return (
      <tr key={k}>
        <td><StatImg stat={k} emoji={emoji} /> {label}</td>
        <td className={'num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>
          {fmtStat(v)}{diff ? <span className="small"> ({diff > 0 ? '+' : ''}{fmtStat(diff)})</span> : null}
        </td>
        <td />
      </tr>
    );
  };

  return (
    <aside className="infopanel">
      {(unit?.art ?? card?.art) && <img className="ip-art" src={`/units/${unit?.art ?? card?.art}.png`} alt="" />}
      <div className="ip-name">{name}</div>
      {gain && unit && (
        <div className={'ip-gain gain-' + gain.verdict} title={gainTitle(gain, gain.scope || groupInfo(unit.group).es)}>
          {gain.verdict === 'none' ? <>{GAIN_MARK.none} No le llega ningún bufo</> : (
            <>
              <div><b>{fmtX(times(gain.before, gain.after))}</b> de {gain.metric} con tus bufos
                <span className="small muted"> ({fmtNum(gain.before)} → {fmtNum(gain.after)} por segundo)</span></div>
              <div className="small">
                {gain.posAfter}.ª más fuerte de {gain.of} en {gain.scope || groupInfo(unit.group).es}
                {gain.posBefore !== gain.posAfter && <span className="muted"> (sin bufos {gain.posBefore}.ª)</span>}
              </div>
              <div className="small muted">{GAIN_MARK[gain.verdict]} {GAIN_TEXT[gain.verdict]}</div>
            </>
          )}
          {gain.board.length > 1 && (() => {
            const max = Math.max(...gain.board.map((b) => b.after), 1);
            const idx = gain.board.findIndex((b) => b.card === unit.card);
            const show = gain.board.filter((b, i) => i < 5 || i === idx);
            return (
              <div className="gain-board" title="Daño por segundo de la unidad completa contra el objetivo elegido arriba del roster; la parte verde es lo que suman tus bufos">
                <div className="small muted">Las más fuertes {gain.scope ? `(${gain.scope})` : 'de su tipo'} con tus bufos</div>
                {show.map((b) => {
                  const i = gain.board.indexOf(b);
                  return (
                    <div key={b.card} className={'gb-row' + (b.card === unit.card ? ' me' : '')} title={`${b.name}: ${fmtNum(b.before)} → ${fmtNum(b.after)} (${fmtX(times(b.before, b.after))})`}>
                      <span className="gb-pos">{i + 1}.</span>
                      <span className="gb-name">{b.name}</span>
                      <span className="gb-bar"><i className="base" style={{ width: `${(b.before / max) * 100}%` }} /><i className="buff" style={{ width: `${(Math.max(0, b.after - b.before) / max) * 100}%` }} /></span>
                      <span className="gb-val">{fmtX(times(b.before, b.after))}</span>
                    </div>
                  );
                })}
                {idx > 5 && <div className="small muted">…</div>}
              </div>
            );
          })()}
          {gain.parts.length > 0 && (
            <div className="gain-parts">
              {gain.parts.slice(0, 6).map((p) => <span key={p.label} className="gp-chip">{p.label} <b>{fmtNum(p.from)} → {fmtNum(p.to)}</b></span>)}
            </div>
          )}
        </div>
      )}
      <div className="ip-caste">
        <UnitIcon kind={unit ? iconOf(unit) : card?.kind === 'lord' ? 'lord' : 'hero'} cat={unit ? unit.catIcon : card?.kind === 'lord' ? 'commander' : 'hero'} size={16} /> {caste}
        {' · '}
        {(() => {
          const at = unit?.attrs ?? card?.attributes.map((a) => a.name) ?? [];
          const n = natureOf(at);
          const mark = at.find((a) => MARKS[a]);
          return <span className={'ip-nature ' + n}>{n !== 'n_mortal' && <UnitIcon kind={n} size={14} />} {{ n_daemon: 'Demonio', n_undead: 'No muerto', n_construct: 'Constructo', n_mortal: 'Mortal' }[n]}{mark && <> · <MarkIcon mark={mark} /> {mark}</>}</span>;
        })()}
        {unit && <SpecialTags u={unit} upgradeRank={upgradeRank} building={building} />}
      </div>
      {bullets.length > 0 && (
        <ul className="ip-bullets">
          {bullets.map((b) => (
            <li key={b.name} className={b.good ? 'good' : 'bad'} title={b.tip}>{b.good ? '▲' : '▼'} {b.name}</li>
          ))}
        </ul>
      )}
      <div className="ip-hp" title="Vida total = modelos × vida por modelo">
        <span className="ip-hpbar"><span style={{ width: '100%' }} /></span>
        <b>{fmtStat(hp.final * models)}</b>
        {statDiff(hp.final * models, hp.base * models) > 0 && <span className="up small"> (+{statDiff(hp.final * models, hp.base * models)})</span>}
      </div>
      <div className="ip-models">
        👤 {models} modelo{models === 1 ? '' : 's'} × {fmtStat(hp.final)} vida{unit?.cost ? ` · ${unit.cost} MP` : ''}
        {unit?.tier ? <> · <Tier t={unit.tier} /> nivel {unit.tier}</> : null}
      </div>
      <table className="ip-stats">
        <tbody>
          {BARS.map((s) => {
            const v = val(s.k);
            const diff = statDiff(v.final, v.base);
            return (
              <tr key={s.k}>
                <td><StatImg stat={s.k} emoji={s.icon} /> {s.label}</td>
                <td className={'num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>
                  {fmtStat(v.final)}{diff ? <span className="small"> ({diff > 0 ? '+' : ''}{fmtStat(diff)})</span> : null}
                </td>
                <td className="ip-bar">
                  <span className="bar-base" style={{ width: `${Math.min(100, (Math.min(v.base, v.final) / s.max) * 100)}%` }} />
                  {diff > 0 && <span className="bar-buff" style={{ width: `${Math.min(100, (diff / s.max) * 100)}%` }} />}
                </td>
              </tr>
            );
          })}
          {(stat('bvl')?.final ?? raw('bvl')) > 0 && extraRow('bvl', '🐘', 'Bonif. contra grandes', stat('bvl'), raw('bvl'))}
          {(stat('bvi')?.final ?? raw('bvi')) > 0 && extraRow('bvi', '🧍', 'Bonif. contra infantería', stat('bvi'), raw('bvi'))}
          {(mis || missile) && (
            <>
              {extraRow('missileDmg', '🏹', 'Daño de proyectil', mis ? stat('missileDmg') : null, mis ? 0 : missile!.dmg + missile!.ap)}
              {extraRow('range', '📏', 'Alcance', mis ? stat('range') : null, mis ? 0 : missile!.range)}
              {extraRow('ammo', '🎯', 'Munición', mis ? stat('ammo') : null, mis ? 0 : missile!.ammo)}
              {(missile?.bvl ?? 0) > 0 && <Fragment key="mbvl">{extraRow('bvl', '🐘', 'Proyectil contra grandes', null, missile!.bvl!)}</Fragment>}
              {(missile?.bvi ?? 0) > 0 && <Fragment key="mbvi">{extraRow('bvi', '🧍', 'Proyectil contra infantería', null, missile!.bvi!)}</Fragment>}
            </>
          )}
        </tbody>
      </table>
      {attrs.length > 0 && (
        <>
          <div className="ip-sub">Habilidades pasivas</div>
          <ul className="ip-attrs">
            {attrs.map((a, i) => (
              <li key={i} className={a.from ? 'buff' : ''} title={a.from ? `Por ${a.from}` : 'Propio de la unidad'}>
                <span className="ip-ai"><AttrImg name={a.name} idx={attrIdx} size={14} /></span>{a.name}{a.from ? ' ▲' : ''}
                {info.attrs[a.name] && <div className="ip-attr-desc">{info.attrs[a.name]}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
      {unit?.contact && (unit.contact.melee || unit.contact.missile) && (
        <>
          <div className="ip-sub">Al golpear (efecto de contacto)</div>
          <ul className="ip-abil">
            {([['melee', 'Cuerpo a cuerpo'], ['missile', 'A distancia']] as const).map(([k, label]) => {
              const c = unit.contact?.[k];
              if (!c) return null;
              return (
                <li key={k}>
                  <div className="ip-abil-head"><b>🧪 {c.n}</b><span className="muted small">{label}{c.dur > 0 ? ` · ${c.dur} s` : ''}</span></div>
                  <ul><li>{c.stats.map((x) => x.d).join(', ')}</li><li className="muted">No afecta a quien es inmune a los efectos de contacto; el mismo efecto no se acumula.</li></ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {info.abilities.length > 0 && (
        <>
          <div className="ip-sub">Qué hacen sus habilidades</div>
          <ul className="ip-abil">
            {info.abilities.map((ab) => (
              <li key={ab.key}>
                <div className="ip-abil-head">
                  <AbilityImg icon={ab.icon} size={22} />
                  <b>{ab.name}</b>
                  <span className="muted small">{abilityMeta(ab)}</span>
                </div>
                <ul>
                  {ab.stats.map((s, i) => <li key={i}>{s.d}</li>)}
                  {ab.attributes.map((x) => <li key={x}>Otorga: {x}{info.attrs[x] ? <span className="muted"> — {info.attrs[x]}</span> : null}</li>)}
                  {ab.magicalAttacks && <li>Ataques mágicos</li>}
                  {ab.flamingAttacks && <li>Ataques flamígeros</li>}
                  {!ab.stats.length && !ab.attributes.length && <li className="muted">Efecto especial (sin cambios de stats que el juego detalle)</li>}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
      {res.some(([, v]) => v !== 0) && (
        <>
          <div className="ip-sub">Resistencias</div>
          <ul className="ip-attrs">
            {res.filter(([, v]) => v !== 0).map(([n, v, k]) => (
              <li key={n} className={v < 0 ? 'bad' : ''}><span className="ip-ai"><StatImg stat={k} emoji="✨" size={14} /></span>{v < 0 ? 'Debilidad' : 'Resistencia'} {n.toLowerCase()}: {v > 0 ? '' : ''}{v}%</li>
            ))}
          </ul>
        </>
      )}
      {buffs && (buffs.now.length > 0 || buffs.r7.length > 0) && (
        <>
          <div className="ip-sub">Bufos de tu ejército{!inArmy ? ' (rango 0)' : ''}</div>
          <ul className="ip-buffs">
            {buffs.now.map((l) => <li key={l}>{l}</li>)}
            {buffs.r7.map((l) => <li key={l} className="r7">Al subir de rango: {l}</li>)}
          </ul>
        </>
      )}
      {unit?.desc && <p className="ip-desc">{unit.desc}</p>}
      {unit?.history && (
        <details className="ip-history">
          <summary>Historia</summary>
          <p className="ci-text">{unit.history}</p>
        </details>
      )}
    </aside>
  );
}

const MODE_ES: Record<AbilityInfo['mode'], string> = { self: 'a sí misma', allies: 'a aliados', enemies: 'a enemigos', none: '' };
/** Tipo, si es pasiva o cuánto dura, recarga y alcance */
function abilityMeta(a: AbilityInfo) {
  return [
    a.type, a.passive ? 'pasiva' : a.duration > 0 ? `${a.duration} s` : '', MODE_ES[a.mode],
    !a.passive && a.cooldown && a.cooldown > 0 ? `recarga ${a.cooldown} s` : '', a.range ? `alcance ${a.range}` : '', a.mana ? `${a.mana} maná` : '',
  ].filter(Boolean).join(' · ');
}

const abilCache = new Map<string, { abilities: AbilityInfo[]; attrs: Record<string, string> }>();
/** Habilidades y descripción de atributos de la unidad de la ficha (se piden al backend y se guardan) */
function useUnitAbilities(unitKey: string | undefined, names: string[]) {
  const id = unitKey ? `${unitKey}#${[...names].sort().join('|')}` : '';
  const [, force] = useState(0);
  useEffect(() => {
    if (!id || abilCache.has(id)) return;
    let alive = true;
    api.unitAbilities(unitKey!, names).then((r) => { abilCache.set(id, r); if (alive) force((n) => n + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  return abilCache.get(id) ?? { abilities: [], attrs: {} };
}
