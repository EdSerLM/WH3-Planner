import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { CharacterPicker } from './components/CharacterPicker';
import { SkillTree } from './components/SkillTree';
import { ArmySetup } from './components/ArmySetup';
import { ArmoryPanel } from './components/ArmoryPanel';
import { SpellSlotsPanel } from './components/SpellSlotsPanel';
import { InitiativesPanel } from './components/InitiativesPanel';
import { Flag, setGroupIcons } from './gameIcons';
import { AbilitiesPanel } from './components/AbilitiesPanel';
import { ActiveAbilities } from './components/ActiveAbilities';
import { UnitCard } from './components/UnitCard';
import { DpsPanel } from './components/DpsPanel';
import { ArmyDescription } from './components/ArmyDescription';
import { BuildSummary } from './components/BuildSummary';
import { TechTree } from './components/TechTree';
import { PyramidGraph } from './components/PyramidGraph';
import { TechSummary } from './components/TechSummary';
import { UnitBuffSummary } from './components/UnitBuffSummary';
import { ErrorBoundary } from './components/ErrorBoundary';
import { emptyBuild } from './treeLogic';
import { campaignForLord, campaignUnits } from './campaign';
import { CharUnits } from './components/CharUnits';
import type { AbilityState, ArmyState, BuildSelection, CampaignFaction, CharacterSummary, CharacterTree, ComputedCard, ComputeResult, Meta, SavedBuild, UnitData } from './types';

const STORAGE_KEY = 'wh3-planner:army';
const FACTION_KEY = 'wh3-planner:faction';
const DEFAULT_FACTION = 'wh_main_sc_chs_chaos';
const EMPTY: ArmyState = { lord: null, heroes: [], units: [], activeAbilities: [], inAura: true };

/** Por unidad: bufos que recibe con rango 0 y los que gana al subir de rango.
 *  Una línea por habilidad: "Habilidad (Quién): efecto a stats; otro efecto…" */
export type RosterBuffs = Record<string, { now: string[]; r7: string[] }>;

const PCT_STATS = new Set(['resPhysical', 'resMissile', 'resMagic', 'resFlame', 'resWard', 'shield']);

function buffSources(now: ComputeResult, r7: ComputeResult, labels: Record<string, string>): RosterBuffs {
  // habilidad → efecto ("+5%", "+3%/rango"…) → stats que toca
  const effects = (c: ComputeResult['cards'][number]) => {
    const m = new Map<string, Map<string, Set<string>>>();
    const put = (skill: string, eff: string, stat: string) => {
      const e = m.get(skill) ?? new Map<string, Set<string>>();
      m.set(skill, e);
      e.set(eff, (e.get(eff) ?? new Set()).add(stat));
    };
    for (const [stat, line] of Object.entries(c.stats))
      for (const x of line.contributions) {
        const perRank = x.conditional ? /^(-?[\d.]+)(%?) × rango/.exec(x.conditional) : null;
        const eff = perRank
          ? `${Number(perRank[1]) > 0 ? '+' : ''}${perRank[1]}${perRank[2]} por rango`
          : x.how === 'mult'
            ? `×${x.value}`
            : `${x.value > 0 ? '+' : ''}${x.value}${x.how === 'pct' || PCT_STATS.has(stat) ? '%' : ''}`;
        put(`${x.source} (${x.from})`, eff, labels[stat] ?? stat);
      }
    for (const a of c.attributes) if (a.from) put(a.from, 'atributo', a.name);
    return m;
  };
  const text = (eff: string, stats: Set<string>) => (eff === 'atributo' ? [...stats].join(', ') : `${eff} ${[...stats].join(', ')}`);
  const out: RosterBuffs = {};
  const nowMap = new Map(now.cards.filter((c) => c.kind === 'unit').map((c) => [c.id, effects(c)]));
  for (const c of r7.cards) {
    if (c.kind !== 'unit') continue;
    const n = nowMap.get(c.id) ?? new Map();
    const nowLines = [...n].map(([skill, e]) => `${skill}: ${[...e].map(([eff, s]) => text(eff, s)).join('; ')}`);
    // Lo que solo aparece al subir de rango (efectos nuevos de una habilidad, o habilidades nuevas)
    const extra: string[] = [];
    for (const [skill, e] of effects(c)) {
      const before = n.get(skill);
      const fresh = [...e].filter(([eff]) => !before?.has(eff));
      if (fresh.length) extra.push(`${skill}: ${fresh.map(([eff, s]) => text(eff, s)).join('; ')}`);
    }
    if (nowLines.length || extra.length) out[c.id] = { now: nowLines, r7: extra };
  }
  return out;
}

// Un ejército guardado en el navegador por facción
const armyKey = (f: string) => (f === DEFAULT_FACTION ? STORAGE_KEY : `${STORAGE_KEY}:${f}`);

function loadLocal(faction: string): ArmyState {
  try {
    const raw = localStorage.getItem(armyKey(faction));
    return raw ? { ...EMPTY, ...JSON.parse(raw), faction } : { ...EMPTY, faction };
  } catch {
    return { ...EMPTY, faction };
  }
}

function loadFaction(): string {
  try {
    return localStorage.getItem(FACTION_KEY) ?? DEFAULT_FACTION;
  } catch {
    return DEFAULT_FACTION;
  }
}

type Tab = 'lord' | 'techs' | number; // número = índice de héroe

const PAGE_KEY = 'wh3-planner:page';
type Page = 'chars' | 'army' | 'dps';

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [units, setUnits] = useState<UnitData[]>([]);
  const [trees, setTrees] = useState<Record<string, CharacterTree>>({});
  const [faction, setFaction] = useState<string>(loadFaction);
  const [campaigns, setCampaigns] = useState<CampaignFaction[]>([]);
  const [factions, setFactions] = useState<{ key: string; name: string; flag?: string }[]>([]);
  const [army, setArmy] = useState<ArmyState>(() => loadLocal(loadFaction()));
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [tab, setTab] = useState<Tab>('lord');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBuild[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [buildName, setBuildName] = useState('');
  const [view, setView] = useState<'cards' | 'campaign'>('cards');
  // Página: personajes y tecnologías, ejército, o DPS (se recuerda)
  const [page, setPageState] = useState<Page>(() => {
    try {
      const p = localStorage.getItem(PAGE_KEY);
      return p === 'army' || p === 'dps' ? p : 'chars';
    } catch {
      return 'chars';
    }
  });
  const setPage = (p: Page) => {
    setPageState(p);
    try {
      localStorage.setItem(PAGE_KEY, p);
    } catch {
      /* sin almacenamiento */
    }
    window.scrollTo({ top: 0 });
  };
  const [leftView, setLeftView] = useState<'tree' | 'summary' | 'gifts' | 'spells' | 'initiatives'>('tree');
  // Tarjeta elegida abajo para ver sus bufos acumulados ("kind:id")
  const [picked, setPicked] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (picked) summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [picked]);

  // Carga inicial
  useEffect(() => {
    Promise.all([api.meta(), api.characterFactions(), api.builds()])
      .then(([m, f, b]) => {
        setGroupIcons(m.groupIcons);
        setMeta(m);
        setFactions(f.factions);
        setSaved(b);
        // Si la facción guardada no existe en estos datos, volver a la de por defecto
        if (!f.factions.some((x) => x.key === faction)) changeFaction(f.default);
      })
      .catch((e) => setError(`No se pudo conectar con el backend (${e.message}). ¿Está corriendo en el puerto 3001?`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Personajes y roster de la facción elegida
  useEffect(() => {
    try {
      localStorage.setItem(FACTION_KEY, faction);
    } catch {
      /* sin almacenamiento */
    }
    Promise.all([api.characters(faction), api.units(faction), api.campaign(faction).catch(() => [] as CampaignFaction[])])
      .then(([c, u, camp]) => {
        setCharacters(c);
        setUnits(u);
        setCampaigns(camp);
        // Ejércitos guardados con las cartas viejas (twwstats): se cambian por la clave de la unidad del juego
        const ids = new Set(u.map((x) => x.card));
        const byArt = new Map(u.filter((x) => x.cardArt).map((x) => [x.cardArt!, x.card]));
        // Exaltados agregados a mano antes de usar los datos del juego (id con "_exalted")
        for (const x of u) if (/_1$/.test(x.card)) byArt.set(`${x.card}_exalted`, x.card);
        setArmy((a) =>
          a.units.some((x) => !ids.has(x.card) && byArt.has(x.card))
            ? { ...a, units: a.units.map((x) => (!ids.has(x.card) && byArt.has(x.card) ? { ...x, card: byArt.get(x.card)! } : x)) }
            : a,
        );
      })
      .catch((e) => setError(e.message));
  }, [faction]);

  function changeFaction(f: string, next?: ArmyState) {
    setFaction(f);
    setArmy(next ?? loadLocal(f));
    setTab('lord');
    if (!next) {
      setCurrentId(undefined);
      setBuildName('');
    }
  }

  const ensureTree = useCallback(
    async (key: string) => {
      if (trees[key]) return trees[key];
      const t = await api.character(key);
      setTrees((prev) => ({ ...prev, [key]: t }));
      return t;
    },
    [trees],
  );

  // Cargar árboles de lo que ya está en el ejército (p. ej. al abrir un build)
  useEffect(() => {
    const keys = [army.lord?.character, ...army.heroes.map((h) => h.character)].filter(Boolean) as string[];
    keys.filter((k) => !trees[k]).forEach((k) => ensureTree(k).catch(() => {}));
  }, [army.lord, army.heroes, trees, ensureTree]);

  // Guardar en el navegador y recalcular
  useEffect(() => {
    try {
      localStorage.setItem(armyKey(army.faction ?? DEFAULT_FACTION), JSON.stringify(army));
    } catch {
      /* sin almacenamiento */
    }
    const t = setTimeout(() => {
      api
        .compute(army)
        .then((r) => {
          setResult(r);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 120);
    return () => clearTimeout(t);
  }, [army]);

  // Vista previa: qué unidades del roster reciben bufos permanentes del señor, héroes y tecnologías.
  // Se calcula con todo el roster (1 de cada) y sin habilidades activas; una pasada en rango 0 y otra en rango 9.
  const [rosterBuffs, setRosterBuffs] = useState<RosterBuffs>({});
  // Tarjetas del roster con tus bufos (rango 0), para la ficha de cada unidad
  const [rosterCards, setRosterCards] = useState<Record<string, ComputedCard>>({});
  useEffect(() => {
    if (!units.length || (!army.lord && !army.heroes.length && !army.techs?.length)) {
      setRosterBuffs({});
      setRosterCards({});
      return;
    }
    const base: ArmyState = { ...army, activeAbilities: [], units: [] };
    const t = setTimeout(() => {
      Promise.all([
        api.compute({ ...base, units: units.map((u) => ({ card: u.card, count: 1, rank: 0 })) }),
        api.compute({ ...base, units: units.map((u) => ({ card: u.card, count: 1, rank: 9 })) }),
      ])
        .then(([now, r7]) => {
          setRosterBuffs(buffSources(now, r7, meta?.statLabels ?? {}));
          setRosterCards(Object.fromEntries(now.cards.filter((c) => c.kind === 'unit').map((c) => [c.id, c])));
        })
        .catch(() => {
          setRosterBuffs({});
          setRosterCards({});
        });
    }, 300);
    return () => clearTimeout(t);
    // Solo cambia con lo que da bufos, no al agregar o quitar unidades
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, meta, army.lord, army.heroes, army.techs, army.techTree, army.techVariant, army.inAura]);

  const usedSlots = (army.lord ? 1 : 0) + army.heroes.length + army.units.reduce((s, u) => s + u.count, 0);

  const setLord = async (key: string) => {
    const t = await ensureTree(key);
    // Un señor legendario fija su facción de campaña (Festus → Los Fecundos); los genéricos respetan la elegida
    const camp = campaignForLord(campaigns, key);
    setArmy((a) => ({ ...a, lord: emptyBuild(t), ...(camp ? { campaign: camp } : {}) }));
    setTab('lord');
  };
  const setHero = async (i: number, key: string) => {
    const t = await ensureTree(key);
    setArmy((a) => {
      const heroes = [...a.heroes];
      heroes[i] = emptyBuild(t);
      return { ...a, heroes };
    });
  };
  const addHero = () => {
    if (usedSlots >= 20) return;
    const first = characters.find((c) => c.type === 'hero');
    if (!first) return;
    const i = army.heroes.length;
    setHero(i, first.key).then(() => setTab(i));
  };
  const removeHero = (i: number) => {
    setArmy((a) => ({ ...a, heroes: a.heroes.filter((_, j) => j !== i) }));
    setTab('lord');
  };
  const updateSelection = (sel: BuildSelection) => {
    setArmy((a) => {
      if (tab === 'lord') return { ...a, lord: sel };
      if (tab === 'techs') return a;
      const heroes = [...a.heroes];
      heroes[tab] = sel;
      return { ...a, heroes };
    });
  };

  const currentSel = tab === 'lord' ? army.lord : tab === 'techs' ? null : army.heroes[tab];
  const currentTree = currentSel ? trees[currentSel.character] : undefined;
  const currentInfo = result?.builds.find((b) => b.character === currentSel?.character);
  // Roster que puede tener la facción de campaña elegida (todo si no hay filtro)
  const rosterUnits = useMemo(() => {
    const allowed = campaignUnits(campaigns.find((c) => c.key === army.campaign));
    return allowed ? units.filter((u) => allowed.has(u.card)) : units;
  }, [units, campaigns, army.campaign]);

  // Se enciende por personaje ("habilidad@personaje"): la misma habilidad puede estar en el árbol del señor y de un héroe
  const toggleAbility = (ab: AbilityState) =>
    setArmy((a) => ({
      ...a,
      activeAbilities: ab.active
        ? a.activeAbilities.filter((k) => k !== ab.id && k !== ab.key)
        : [...a.activeAbilities.filter((k) => k !== ab.key), ab.id],
    }));
  /** Activables que solo afectan al propio personaje: van dentro de su tarjeta */
  const selfAbilities = (c: { id: string; kind: string }) =>
    c.kind === 'unit' ? [] : (result?.abilities ?? []).filter((a) => !a.passive && a.mode === 'self' && a.hasBattleStats && a.ownerKey === c.id);

  const save = async () => {
    const name = buildName.trim() || 'Ejército sin nombre';
    const b = await api.saveBuild({ id: currentId, name, army: { ...army, faction } });
    setCurrentId(b.id);
    setSaved(await api.builds());
  };
  const open = (b: SavedBuild) => {
    const f = b.army.faction ?? DEFAULT_FACTION;
    const next = { ...EMPTY, ...b.army, faction: f };
    if (f !== faction) changeFaction(f, next);
    else setArmy(next);
    setCurrentId(b.id);
    setBuildName(b.name);
    setTab('lord');
  };
  const remove = async (id: string) => {
    await api.deleteBuild(id);
    if (id === currentId) setCurrentId(undefined);
    setSaved(await api.builds());
  };

  const cards = result?.cards ?? [];
  const charCards = cards.filter((c) => c.kind !== 'unit');
  const unitCards = cards.filter((c) => c.kind === 'unit');
  const cardKey = (c: { kind: string; id: string }) => `${c.kind}:${c.id}`;
  const pickedCard = picked ? cards.find((c) => cardKey(c) === picked) : undefined;
  const togglePick = (c: { kind: string; id: string }) => setPicked((p) => (p === cardKey(c) ? null : cardKey(c)));
  // Tarjeta del personaje que se está editando (en Tecnologías se muestra la del señor)
  const sideSel = tab === 'techs' ? army.lord : currentSel;
  const sideKind = tab === 'lord' || tab === 'techs' ? 'lord' : 'hero';
  const sideCard = sideSel ? cards.find((c) => c.id === sideSel.character && c.kind === sideKind) : undefined;
  const labels = meta?.statLabels ?? ({} as Meta['statLabels']);
  const heroTabName = (h: BuildSelection) => characters.find((c) => c.key === h.character)?.name ?? 'Héroe';

  const campaignGrouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of result?.campaign ?? []) m.set(`${c.owner} — ${c.skill}`, [...(m.get(`${c.owner} — ${c.skill}`) ?? []), c.text]);
    return [...m.entries()];
  }, [result]);

  return (
    <div className="app">
      <header>
        <h1>WH3 Planner</h1>
        <label className="faction-pick">
          <Flag flag={factions.find((f) => f.key === faction)?.flag} size={28} />
          Facción:{' '}
          <select value={faction} onChange={(e) => changeFaction(e.target.value)}>
            {(factions.length ? factions : [{ key: DEFAULT_FACTION, name: 'Guerreros del Caos' }]).map((f) => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
        </label>
        {campaigns.length > 0 && (
          <label className="faction-pick" title="Facción de campaña (datos del juego): limita el roster a lo que puede reclutar o conseguir con mejoras. Se elige sola con el señor legendario.">
            <Flag flag={campaigns.find((c) => c.key === army.campaign)?.flag} size={28} />
            Campaña:{' '}
            <select value={army.campaign ?? ''} onChange={(e) => setArmy((a) => ({ ...a, campaign: e.target.value || undefined }))}>
              <option value="">Sin filtro (todo el roster)</option>
              {campaigns.map((f) => (
                <option key={f.key} value={f.key}>{f.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="saves">
          <input placeholder="Nombre del ejército" value={buildName} onChange={(e) => setBuildName(e.target.value)} />
          <button onClick={save}>{currentId ? 'Guardar cambios' : 'Guardar'}</button>
          <button
            className="ghost"
            onClick={() => {
              setArmy({ ...EMPTY, faction });
              setCurrentId(undefined);
              setBuildName('');
            }}
          >
            Nuevo
          </button>
          {saved.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const b = saved.find((s) => s.id === e.target.value);
                if (b) open(b);
              }}
            >
              <option value="">Abrir guardado…</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {currentId && <button className="ghost danger" onClick={() => remove(currentId)}>Borrar</button>}
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {meta?.sources.missingGameData && (
        <div className="error">
          Faltan los datos del juego en esta computadora. Corre <code>npm run extraer -- "&lt;carpeta data del juego&gt;"</code> en backend, o copia
          {' '}<code>backend/data/raw/wh3_all_skills.json</code>, <code>wh3_all_units.json</code> y <code>backend/data/loc-es/</code> desde tu PC.
        </div>
      )}

      <nav className="page-tabs">
        <button className={page === 'chars' ? 'active' : ''} onClick={() => setPage('chars')}>
          👑 Señor, héroes y tecnologías
          <span className="pt-sub">
            {army.lord ? characters.find((c) => c.key === army.lord!.character)?.name ?? 'Señor' : 'sin señor'}
            {army.heroes.length ? ` · ${army.heroes.length} héroe${army.heroes.length === 1 ? '' : 's'}` : ''}
            {army.techs?.length ? ` · ${army.techs.length} tecnologías` : ''}
          </span>
        </button>
        <button className={page === 'army' ? 'active' : ''} onClick={() => setPage('army')}>
          ⚔️ Ejército y tarjetas
          <span className="pt-sub">{usedSlots} / 20 · {army.units.reduce((n, u) => n + u.count, 0)} unidades</span>
        </button>
        <button className={page === 'dps' ? 'active' : ''} onClick={() => setPage('dps')}>
          📊 DPS
          <span className="pt-sub">tus unidades contra cada objetivo</span>
        </button>
      </nav>

      {page === 'chars' && (
      <ErrorBoundary label="el personaje" resetKey={`${faction}|${String(tab)}|${leftView}|${currentSel?.character}`}>
      <main>
        <section className="left">
          <nav className="tabs">
            <button className={tab === 'lord' ? 'active' : ''} onClick={() => setTab('lord')}>
              Señor{army.lord ? `: ${characters.find((c) => c.key === army.lord!.character)?.name ?? ''}` : ''}
            </button>
            {army.heroes.map((h, i) => (
              <button key={i} className={tab === i ? 'active' : ''} onClick={() => setTab(i)}>
                Héroe: {heroTabName(h)}
              </button>
            ))}
            <button className="ghost" onClick={addHero} disabled={usedSlots >= 20}>+ Héroe</button>
            <button className={tab === 'techs' ? 'active' : ''} onClick={() => setTab('techs')} title="Tecnologías investigadas: sus bufos se suman a las tarjetas">
              Tecnologías{army.techs?.length ? ` (${army.techs.length})` : ''}
            </button>
          </nav>

          {tab === 'techs' ? (
            <>
              <TechTree
                faction={faction}
                treeKey={army.techTree}
                variant={army.techVariant}
                researched={army.techs ?? []}
                onChange={(p) => setArmy((a) => ({ ...a, ...p }))}
                units={units}
                characters={characters}
                campaign={campaigns.find((c) => c.key === army.campaign)}
                labels={labels}
              />
              {/* Pirámide Negra (Legiones No Muertas) y otros grafos del juego: se investigan como tecnologías */}
              <PyramidGraph faction={faction} researched={army.techs ?? []} onChange={(p) => setArmy((a) => ({ ...a, ...p }))} />
            </>
          ) : (
          <>
          <div className="char-bar">
            {tab === 'lord' ? (
              <CharacterPicker characters={characters} type="lord" value={army.lord?.character ?? null} onChange={setLord} />
            ) : (
              <>
                <CharacterPicker characters={characters} type="hero" value={army.heroes[tab]?.character ?? null} onChange={(k) => setHero(tab, k)} />
                <button className="ghost danger" onClick={() => removeHero(tab)}>Quitar héroe</button>
              </>
            )}
          </div>

          {currentSel && currentTree ? (
            <>
              <nav className="tabs sub">
                <button className={leftView === 'tree' ? 'active' : ''} onClick={() => setLeftView('tree')}>Árbol de habilidades</button>
                {currentTree.armory && (
                  <button className={leftView === 'gifts' ? 'active' : ''} onClick={() => setLeftView('gifts')} title="Piezas del Príncipe Demonio: cabeza, torso, brazos, alas, armas...">
                    ✴️ Dones (piezas)
                  </button>
                )}
                {currentTree.spellSlots?.length ? (
                  <button className={leftView === 'spells' ? 'active' : ''} onClick={() => setLeftView('spells')} title="Elige el saber de cada espacio de hechizo">
                    🔮 Hechizos (fragmentos)
                  </button>
                ) : null}
                {currentTree.initiativeSets?.length ? (
                  <button className={leftView === 'initiatives' ? 'active' : ''} onClick={() => setLeftView('initiatives')} title="Regalos del Caos, devociones y otras mecánicas del personaje">
                    🌟 {currentTree.initiativeSets.some((s) => s.category.startsWith('PATH_TO_GLORY')) ? 'Senda a la Gloria' : 'Mecánicas'}
                  </button>
                ) : null}
                <button className={leftView === 'summary' ? 'active' : ''} onClick={() => setLeftView('summary')}>Efectos acumulados</button>
              </nav>
              {leftView === 'gifts' && currentTree.armory ? (
                <ArmoryPanel tree={currentTree} selection={currentSel} onChange={updateSelection} />
              ) : leftView === 'initiatives' && currentTree.initiativeSets?.length ? (
                <InitiativesPanel tree={currentTree} selection={currentSel} onChange={updateSelection} />
              ) : leftView === 'spells' && currentTree.spellSlots?.length ? (
                <SpellSlotsPanel tree={currentTree} selection={currentSel} onChange={updateSelection} />
              ) : leftView !== 'summary' ? (
                <>
                  <SkillTree tree={currentTree} selection={currentSel} onChange={updateSelection} info={currentInfo} />
                  <CharUnits owner={currentTree.name} units={rosterUnits} rosterCards={rosterCards} buffs={rosterBuffs} labels={labels}
                    abilityNames={(result?.abilities ?? []).filter((a) => a.owner === currentTree.name).map((a) => a.name)} />
                </>
              ) : (
                <BuildSummary
                  summary={currentInfo?.summary}
                  card={cards.find((c) => c.id === currentSel.character && c.kind === (tab === 'lord' ? 'lord' : 'hero'))}
                  labels={labels}
                  isHero={tab !== 'lord'}
                />
              )}
            </>
          ) : currentSel ? (
            <p className="muted">Cargando árbol…</p>
          ) : (
            <p className="muted">Elige un personaje para ver su árbol de habilidades.</p>
          )}
          </>
          )}
        </section>

        <aside className="right">
          {tab === 'techs' ? (
            // En Tecnologías: lo que suman las tecnologías / nodos investigados
            <TechSummary researched={army.techs ?? []} />
          ) : (
            <>
              <div className="char-card-box">
                {sideCard ? (
                  <UnitCard card={sideCard} labels={labels} selfAbilities={selfAbilities(sideCard)} onToggleAbility={toggleAbility} />
                ) : (
                  <p className="muted small">
                    {sideSel ? 'Calculando tarjeta…' : `Elige un ${sideKind === 'lord' ? 'señor' : 'héroe'} para ver su tarjeta aquí.`}
                  </p>
                )}
              </div>
              <AbilitiesPanel abilities={result?.abilities ?? []} inAura={army.inAura} />
            </>
          )}
        </aside>
      </main>
      </ErrorBoundary>
      )}

      {page === 'army' && (
      <section className="bottom setup-page">
        <ErrorBoundary label="el roster" resetKey={faction}>
        <ArmySetup
          units={units}
          army={army.units}
          usedSlots={usedSlots}
          buffs={rosterBuffs}
          rosterCards={rosterCards}
          cards={cards}
          campaign={campaigns.find((c) => c.key === army.campaign)}
          compact={false}
          onChange={(u) => setArmy((a) => ({ ...a, units: u }))}
          onEditChar={(t) => { setTab(t); setPage('chars'); }}
        />
        </ErrorBoundary>
        <ErrorBoundary label="la descripción del ejército" resetKey={faction}>
          <ArmyDescription cards={cards} units={units} usedSlots={usedSlots} />
        </ErrorBoundary>
        {/* Tarjetas/DPS a la izquierda y activables fijas a la derecha: se encienden sin subir y bajar */}
        <div className="army-results">
        <aside className="setup-abilities">
          <ErrorBoundary label="las activables" resetKey={faction}>
          <ActiveAbilities
            abilities={result?.abilities ?? []}
            active={army.activeAbilities}
            inAura={army.inAura}
            onToggle={toggleAbility}
            onAura={(v) => setArmy((a) => ({ ...a, inAura: v }))}
            showEnemies={false}
          />
          </ErrorBoundary>
        </aside>
        <div className="bottom-main">
        <nav className="tabs">
          <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>Tarjetas ({cards.length})</button>
          <button className={view === 'campaign' ? 'active' : ''} onClick={() => setView('campaign')}>Campaña y magia</button>
          <button className="ghost" onClick={() => setPage('dps')} title="El DPS tiene su propia pestaña arriba">📊 DPS →</button>
        </nav>

        <ErrorBoundary label={view === 'cards' ? 'las tarjetas' : 'la campaña'} resetKey={`${faction}|${view}`}>
        {view === 'cards' && (
          <>
            <div ref={summaryRef}>
              {pickedCard && <UnitBuffSummary card={pickedCard} labels={labels} onClose={() => setPicked(null)} />}
            </div>
            {charCards.length > 0 && (
              <div className="cards">
                {charCards.map((c) => (
                  <UnitCard key={cardKey(c)} card={c} labels={labels} selected={picked === cardKey(c)} onSelect={() => togglePick(c)} selfAbilities={selfAbilities(c)} onToggleAbility={toggleAbility} />
                ))}
              </div>
            )}
            <div className="cards">
              {unitCards.map((c) => (
                <UnitCard key={cardKey(c)} card={c} labels={labels} selected={picked === cardKey(c)} onSelect={() => togglePick(c)} selfAbilities={selfAbilities(c)} onToggleAbility={toggleAbility} />
              ))}
            </div>
            {!cards.length && <p className="muted">Elige un señor y agrega unidades en el panel de la izquierda para ver sus tarjetas con bufos.</p>}
            <p className="small muted">
              Clic en el nombre de una tarjeta para ver todos sus bufos acumulados por señor, héroe y tecnologías. Clic en una stat para ver de dónde sale ese número. Los efectos de "rango 7+" y los que crecen por rango dependen del rango que elijas en cada unidad.
            </p>
          </>
        )}

        {view === 'campaign' && (
          <div className="campaign">
            <div>
              <h3>Efectos de campaña</h3>
              {campaignGrouped.length === 0 && <p className="muted">Sin efectos de campaña.</p>}
              <ul>
                {campaignGrouped.map(([k, list]) => (
                  <li key={k}>
                    <b>{k}</b>
                    <div className="small">{list.join(' · ')}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Magia (costes, recargas, fallos)</h3>
              <ul>
                {(result?.magic ?? []).map((m, i) => (
                  <li key={i} className="small"><b>{m.skill}</b> ({m.owner}): {m.text}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </ErrorBoundary>
        </div>
        </div>
      </section>
      )}

      {/* DPS en su propia pestaña: toda la anchura para la tabla, con las activables (y debufos al enemigo) al lado */}
      {page === 'dps' && (
      <section className="bottom dps-page">
        <div className="army-results">
        <aside className="setup-abilities">
          <ErrorBoundary label="las activables" resetKey={faction}>
          <ActiveAbilities
            abilities={result?.abilities ?? []}
            active={army.activeAbilities}
            inAura={army.inAura}
            onToggle={toggleAbility}
            onAura={(v) => setArmy((a) => ({ ...a, inAura: v }))}
            showEnemies
          />
          </ErrorBoundary>
        </aside>
        <div className="bottom-main">
          <ErrorBoundary label="el DPS" resetKey={faction}>
            {cards.length ? (
              <DpsPanel army={army} cards={cards} units={units} ownName={factions.find((f) => f.key === faction)?.name ?? 'Mi facción'} campaign={campaigns.find((c) => c.key === army.campaign)} />
            ) : (
              <p className="muted">Elige un señor y agrega unidades en la pestaña Ejército para comparar su DPS.</p>
            )}
          </ErrorBoundary>
        </div>
        </div>
      </section>
      )}

      <footer className="small muted">
        Datos: {meta?.sources.skills} · {meta?.sources.units}
        {meta?.sources.allUnits ? ` · ${meta.sources.allUnits} unidades de todas las facciones` : ''}.
        {!meta?.sources.gameTrees && ' Para las demás facciones corre npm run extraer con la carpeta data del juego.'}
      </footer>
    </div>
  );
}
