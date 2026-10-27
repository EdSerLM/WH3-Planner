import { useMemo, useState } from 'react';
import { unitRank, type ArmyUnitSelection, type CampaignFaction, type ComputedCard, type StatKey, type UnitData } from '../types';
import type { RosterBuffs } from '../App';
import { campaignUnits } from '../campaign';
import { groupIndex, groupInfo } from '../unitGroups';
import { BuffMark, SpecialTags } from './ArmyPanel';
import { UnitIcon } from './UnitIcon';
import { attrIcon } from '../attrIcons';
import { AttrImg, useAttrIndex } from '../gameIcons';

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
const MARKS: Record<string, { icon: string; cls: string }> = {
  'Marca de Khorne': { icon: '🩸', cls: 'khorne' }, 'Marca de Nurgle': { icon: '🪰', cls: 'nurgle' },
  'Marca de Slaanesh': { icon: '💜', cls: 'slaanesh' }, 'Marca de Tzeentch': { icon: '🔷', cls: 'tzeentch' },
};
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

/** Iconos de naturaleza (y marca de dios) en la esquina de la carta */
function NatureBadges({ attrs }: { attrs?: string[] }) {
  const n = natureOf(attrs);
  const mark = (attrs ?? []).find((a) => MARKS[a]);
  return (
    <span className="ut-nature">
      <span className={'nat ' + n}><UnitIcon kind={n} size={14} /></span>
      {mark && <span className={'nat mark ' + MARKS[mark].cls} title={mark}>{MARKS[mark].icon}</span>}
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
  const setRank = (card: string, rank: number) => onChange(army.map((a) => (a.card === card ? { card: a.card, count: a.count, rank } : a)));
  const setAllRanks = (rank: number) => onChange(army.map((a) => ({ card: a.card, count: a.count, rank })));

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
            <span className="ut-icon"><UnitIcon kind={c.kind === 'lord' ? 'lord' : 'hero'} /><NatureBadges attrs={c.attributes.map((a) => a.name)} /></span>
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
              <span className="ut-icon"><UnitIcon kind={iconOf(u)} /><NatureBadges attrs={u?.attrs} /></span>
              <span className="ut-name">{u?.name ?? sel.card}</span>
              <AttrIcons attrs={unitCard(sel.card)?.attributes ?? (u?.attrs ?? []).map((name) => ({ name }))} />
              <span className="ut-marks">
                {buffs[sel.card]?.now.length ? <span className="bm-now">▲{buffs[sel.card].now.length}</span> : null}
                {r > 0 && <span className="ut-rank">R{r}</span>}
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
                    <span>{groupInfo(g).icon}</span> {groupInfo(g).es} <span className="muted small">({list.length})</span>
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
                          <span className="ut-icon"><UnitIcon kind={iconOf(u)} /><NatureBadges attrs={u.attrs} /></span>
                          <span className="ut-name">{u.name}</span>
                          <AttrIcons attrs={rosterCards[u.card]?.attributes ?? (u.attrs ?? []).map((name) => ({ name }))} />
                          <span className="ut-marks">
                            <BuffMark b={b} />
                            {/_ror/.test(u.key + u.card) && <span title="Regimiento de Renombre">🏅</span>}
                            {u.campaignOnly && <span title="Solo en campaña">🗺️</span>}
                            {(u.excl?.length ?? 0) > 0 && <span title={`Solo: ${u.excl!.join(', ')}`}>🔒</span>}
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

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
/** Nivel (tier) de la unidad en números romanos, como en el juego */
function Tier({ t }: { t?: number }) {
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

function InfoPanel({ focus, unit, card, inArmy, buffs, upgradeRank }: {
  focus: Focus; unit?: UnitData; card?: ComputedCard; inArmy: boolean; buffs?: RosterBuffs[string]; upgradeRank?: number;
}) {
  const attrIdx = useAttrIndex();
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
  const res: [string, number][] = card
    ? ([['Física', card.stats.resPhysical.final], ['Proyectiles', card.stats.resMissile.final], ['Hechizos', card.stats.resMagic.final], ['Fuego', card.stats.resFlame.final], ['Salvación', card.stats.resWard.final]] as [string, number][])
    : unit?.res
      ? ([['Física', unit.res.physical], ['Proyectiles', unit.res.missile], ['Hechizos', unit.res.magic], ['Fuego', unit.res.flame], ['Salvación', unit.res.ward]] as [string, number][])
      : [];
  const attrs = card ? card.attributes : (unit?.attrs ?? []).map((a) => ({ name: a, from: undefined as string | undefined }));
  const bullets = unit?.bp ?? [];
  const mis = card ? (card.stats.missileDmg.base || card.stats.missileDmg.final ? card : null) : null;
  const missile = unit?.missile;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <aside className="infopanel">
      {(unit?.art ?? card?.art) && <img className="ip-art" src={`/units/${unit?.art ?? card?.art}.png`} alt="" />}
      <div className="ip-name">{name}</div>
      <div className="ip-caste">
        <UnitIcon kind={unit ? iconOf(unit) : card?.kind === 'lord' ? 'lord' : 'hero'} size={16} /> {caste}
        {' · '}
        {(() => {
          const at = unit?.attrs ?? card?.attributes.map((a) => a.name) ?? [];
          const n = natureOf(at);
          const mark = at.find((a) => MARKS[a]);
          return <span className={'ip-nature ' + n}><UnitIcon kind={n} size={14} /> {{ n_daemon: 'Demonio', n_undead: 'No muerto', n_construct: 'Constructo', n_mortal: 'Mortal' }[n]}{mark ? ` · ${MARKS[mark].icon} ${mark}` : ''}</span>;
        })()}
        {unit && <SpecialTags u={unit} upgradeRank={upgradeRank} />}
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
        <b>{fmt(hp.final * models)}</b>
        {hp.final !== hp.base && <span className="up small"> (+{fmt((hp.final - hp.base) * models)})</span>}
      </div>
      <div className="ip-models">
        👤 {models} modelo{models === 1 ? '' : 's'} × {fmt(hp.final)} vida{unit?.cost ? ` · ${unit.cost} MP` : ''}
        {unit?.tier ? <> · <Tier t={unit.tier} /> nivel {unit.tier}</> : null}
      </div>
      <table className="ip-stats">
        <tbody>
          {BARS.map((s) => {
            const v = val(s.k);
            const diff = v.final - v.base;
            return (
              <tr key={s.k}>
                <td>{s.icon} {s.label}</td>
                <td className={'num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '')}>
                  {fmt(v.final)}{diff ? <span className="small"> ({diff > 0 ? '+' : ''}{fmt(diff)})</span> : null}
                </td>
                <td className="ip-bar">
                  <span className="bar-base" style={{ width: `${Math.min(100, (Math.min(v.base, v.final) / s.max) * 100)}%` }} />
                  {diff > 0 && <span className="bar-buff" style={{ width: `${Math.min(100, (diff / s.max) * 100)}%` }} />}
                </td>
              </tr>
            );
          })}
          {(card ? card.stats.bvl.final : (unit as unknown as Record<string, number>)?.bvl) > 0 && (
            <tr><td>🐘 Bonif. contra grandes</td><td className="num">{fmt(card ? card.stats.bvl.final : (unit as unknown as Record<string, number>).bvl)}</td><td /></tr>
          )}
          {(card ? card.stats.bvi.final : (unit as unknown as Record<string, number>)?.bvi) > 0 && (
            <tr><td>🧍 Bonif. contra infantería</td><td className="num">{fmt(card ? card.stats.bvi.final : (unit as unknown as Record<string, number>).bvi)}</td><td /></tr>
          )}
          {(mis || missile) && (
            <>
              <tr><td>🏹 Daño de proyectil</td><td className="num">{fmt(mis ? mis.stats.missileDmg.final : (missile!.dmg + missile!.ap))}</td><td /></tr>
              <tr><td>📏 Alcance</td><td className="num">{fmt(mis ? mis.stats.range.final : missile!.range)}</td><td /></tr>
              <tr><td>🎯 Munición</td><td className="num">{fmt(mis ? mis.stats.ammo.final : missile!.ammo)}</td><td /></tr>
            </>
          )}
        </tbody>
      </table>
      {attrs.length > 0 && (
        <>
          <div className="ip-sub">Habilidades pasivas</div>
          <ul className="ip-attrs">
            {attrs.map((a, i) => (
              <li key={i} className={a.from ? 'buff' : ''} title={a.from ? `Por ${a.from}` : 'Propio de la unidad'}><span className="ip-ai"><AttrImg name={a.name} idx={attrIdx} size={14} /></span>{a.name}{a.from ? ' ▲' : ''}</li>
            ))}
          </ul>
        </>
      )}
      {res.some(([, v]) => v !== 0) && (
        <>
          <div className="ip-sub">Resistencias</div>
          <ul className="ip-attrs">
            {res.filter(([, v]) => v !== 0).map(([n, v]) => (
              <li key={n} className={v < 0 ? 'bad' : ''}>{v < 0 ? 'Debilidad' : 'Resistencia'} {n.toLowerCase()}: {v > 0 ? '' : ''}{v}%</li>
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
