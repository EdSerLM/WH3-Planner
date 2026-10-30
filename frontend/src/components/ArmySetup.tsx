import { fmtStat, statDiff } from '../statFormat';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { unitRank, type AbilityInfo, type ArmyUnitSelection, type CampaignFaction, type ComputedCard, type StatKey, type UnitData } from '../types';
import type { RosterBuffs } from '../App';
import { campaignUnits } from '../campaign';
import { groupIndex, groupInfo } from '../unitGroups';
import { BuffMark, SpecialTags } from './ArmyPanel';
import { UnitIcon } from './UnitIcon';
import { attrIcon } from '../attrIcons';
import { AbilityImg, AttrImg, GroupIcon, OfficialImg, StatImg, useAttrIndex } from '../gameIcons';

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
interface Gain { total: number; parts: { label: string; pct: number }[]; rank: number; of: number; verdict: 'hi' | 'mid' | 'lo' | 'none' }
const GAIN_STATS: [StatKey, string][] = [
  ['ma', 'Ataque'], ['md', 'Defensa'], ['armour', 'Armadura'], ['charge', 'Carga'], ['dmg', 'Daño base'], ['ap', 'Daño perforante'],
  ['hp', 'Salud'], ['speed', 'Velocidad'], ['ld', 'Liderazgo'], ['missileDmg', 'Proyectiles'], ['ammo', 'Munición'], ['range', 'Alcance'],
];
const GAIN_RES: [StatKey, string][] = [['resPhysical', 'Res. física'], ['resMissile', 'Res. proyectiles'], ['resMagic', 'Res. hechizos'], ['resFlame', 'Res. fuego'], ['resWard', 'Salvación']];
function buffGain(c?: ComputedCard): { total: number; parts: { label: string; pct: number }[] } | null {
  if (!c) return null;
  const parts: { label: string; pct: number }[] = [];
  for (const [k, label] of GAIN_STATS) {
    const l = c.stats[k];
    if (l && l.base > 0 && l.final !== l.base) parts.push({ label, pct: ((l.final - l.base) / l.base) * 100 });
  }
  const r = c.stats.reload; // la recarga baja = mejor
  if (r && r.base > 0 && r.final !== r.base) parts.push({ label: 'Recarga', pct: ((r.base - r.final) / r.base) * 100 });
  for (const [k, label] of GAIN_RES) {
    const l = c.stats[k];
    if (l && l.final !== l.base) parts.push({ label, pct: l.final - l.base });
  }
  return { total: parts.reduce((s, p) => s + p.pct, 0), parts: parts.sort((a, b) => b.pct - a.pct) };
}
const GAIN_MARK = { hi: '▲', mid: '■', lo: '▼', none: '·' } as const;
const GAIN_TEXT = {
  hi: 'Rentable: tus bufos la mejoran más que a la mayoría de su tipo',
  mid: 'Normal: tus bufos la mejoran como a otras de su tipo',
  lo: 'Poco: otras de su tipo aprovechan más tus bufos',
  none: 'No vale la pena por bufos: no le llega ninguno',
} as const;
function gainTitle(g: Gain, group: string) {
  return `${GAIN_TEXT[g.verdict]}\nTotal +${Math.round(g.total)}% · puesto ${g.rank} de ${g.of} (${group})` +
    (g.parts.length ? '\n' + g.parts.map((p) => `${p.label} +${Math.round(p.pct)}%`).join(', ') : '');
}

export function ArmySetup({ units, army, usedSlots, buffs, rosterCards, cards, campaign, compact, onChange, onEditChar }: Props) {
  const [q, setQ] = useState('');
  const [showRoR, setShowRoR] = useState(false);
  const [onlyBuffed, setOnlyBuffed] = useState(false);
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
    for (const u of units) {
      if (allowed && !allowed.has(u.card)) continue;
      const g = buffGain(rosterCards[u.card]) ?? { total: 0, parts: [] };
      byGroup.set(u.group, [...(byGroup.get(u.group) ?? []), { card: u.card, ...g }]);
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => b.total - a.total);
      list.forEach((x, i) => {
        const third = list.length / 3;
        const verdict: Gain['verdict'] = x.total <= 0 ? 'none' : list.length < 3 ? 'mid' : i < third ? 'hi' : i >= list.length - third ? 'lo' : 'mid';
        out.set(x.card, { total: x.total, parts: x.parts, rank: list.findIndex((y) => y.total === x.total) + 1, of: list.length, verdict });
      });
    }
    return out;
  }, [units, rosterCards, allowed, anyBuffs]);

  const roster = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = units
      .filter((u) => showRoR || !/_ror/.test(u.key + u.card))
      .filter((u) => !allowed || allowed.has(u.card))
      .filter((u) => !qq || u.name.toLowerCase().includes(qq))
      .filter((u) => !onlyBuffed || !!buffs[u.card])
      // Como en el juego: por nivel (tier) y, dentro del nivel, por coste
      .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.cost - b.cost);
    const m = new Map<string, UnitData[]>();
    for (const u of list) m.set(u.group, [...(m.get(u.group) ?? []), u]);
    return [...m.entries()].sort((a, b) => groupIndex(a[0]) - groupIndex(b[0]));
  }, [units, q, showRoR, onlyBuffed, buffs, allowed]);

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
              className={'utile ' + (GROUP_CLASS[g] ?? '') + (u?.art ? ' has-art' : '') + (selected?.kind === 'unit' && selected.card === sel.card ? ' sel' : '')}
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
              <label title="Solo las unidades que reciben bufos de tu señor, héroes o tecnologías">
                <input type="checkbox" checked={onlyBuffed} disabled={!anyBuffs} onChange={(e) => setOnlyBuffed(e.target.checked)} /> Solo con bufos
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
                          className={'utile ' + (GROUP_CLASS[g] ?? '') + (u.art ? ' has-art' : '') + (b ? ' buffed' : '') + (n ? ' in-army' : '')}
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
                            {/_ror/.test(u.key + u.card) && <span title="Regimiento de Renombre">🏅</span>}
                            {u.campaignOnly && <span title="Solo en campaña">🗺️</span>}
                            {(u.excl?.length ?? 0) > 0 && <span title={`Solo: ${u.excl!.join(', ')}`}>🔒</span>}
                            {campaign?.buildings?.[u.card] && <span title={`Solo con edificio: ${campaign.buildings[u.card].join(', ')}`}>🏛️</span>}
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
              🏅 Renombre · 🗺️ solo campaña · 🔒 exclusiva de algunas facciones · M4 = se consigue mejorando otra unidad desde rango 4
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
          className={'utile ' + (GROUP_CLASS[u.group] ?? '') + (u.art ? ' has-art' : '') + (best.has(u.card) ? ' best' : '')}
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

/** Tira de señores, héroes y unidades para elegir una (Tecnologías; unidades que reciben bufos de un personaje) */
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
  const list = [...units].sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || (a.tier ?? 0) - (b.tier ?? 0) || a.cost - b.cost);
  const mark = (id: string) => {
    const b = badge(id);
    return <span className={'ut-duels ut-techs' + (b.full ? ' full' : '')}>{b.text}</span>;
  };
  return (
    <div className="army-strip pick-strip">
      {chars.map((c) => {
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
      })}
      {list.map((u) => {
        return (
          <button
            key={u.card}
            className={'utile ' + (GROUP_CLASS[u.group] ?? '') + (u.art ? ' has-art' : '') + (selected === u.card ? ' sel' : '') + (dim?.(u.card) ? ' dim' : '')}
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
      })}
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
            className={'utile ' + (GROUP_CLASS[u?.group ?? ''] ?? '') + (u?.art ? ' has-art' : '') + (selected === c.id ? ' sel' : '') + (best?.has(c.id) ? ' best' : '')}
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
        <div className={'ip-gain gain-' + gain.verdict} title={gainTitle(gain, groupInfo(unit.group).es)}>
          {GAIN_MARK[gain.verdict]} {gain.verdict === 'none' ? 'No le llega ningún bufo' : `Bufos: +${Math.round(gain.total)}% · ${gain.rank}.º de ${gain.of} en ${groupInfo(unit.group).es}`}
          <div className="small muted">{GAIN_TEXT[gain.verdict]}</div>
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
