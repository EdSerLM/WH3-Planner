import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { CharacterPicker } from './components/CharacterPicker';
import { SkillTree } from './components/SkillTree';
import { ArmyPanel } from './components/ArmyPanel';
import { AbilitiesPanel } from './components/AbilitiesPanel';
import { UnitCard } from './components/UnitCard';
import { DpsPanel } from './components/DpsPanel';
import { BuildSummary } from './components/BuildSummary';
import { emptyBuild } from './treeLogic';
import type { ArmyState, BuildSelection, CharacterSummary, CharacterTree, ComputeResult, Meta, SavedBuild, UnitData } from './types';

const STORAGE_KEY = 'wh3-planner:army';
const EMPTY: ArmyState = { lord: null, heroes: [], units: [], activeAbilities: [], inAura: true };

function loadLocal(): ArmyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

type Tab = 'lord' | number; // número = índice de héroe

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [units, setUnits] = useState<UnitData[]>([]);
  const [trees, setTrees] = useState<Record<string, CharacterTree>>({});
  const [army, setArmy] = useState<ArmyState>(loadLocal);
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [tab, setTab] = useState<Tab>('lord');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBuild[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [buildName, setBuildName] = useState('');
  const [view, setView] = useState<'cards' | 'dps' | 'campaign'>('cards');
  const [leftView, setLeftView] = useState<'tree' | 'summary'>('tree');

  // Carga inicial
  useEffect(() => {
    Promise.all([api.meta(), api.characters(), api.units(), api.builds()])
      .then(([m, c, u, b]) => {
        setMeta(m);
        setCharacters(c);
        setUnits(u);
        setSaved(b);
      })
      .catch((e) => setError(`No se pudo conectar con el backend (${e.message}). ¿Está corriendo en el puerto 3001?`));
  }, []);

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(army));
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

  const usedSlots = (army.lord ? 1 : 0) + army.heroes.length + army.units.reduce((s, u) => s + u.count, 0);

  const setLord = async (key: string) => {
    const t = await ensureTree(key);
    setArmy((a) => ({ ...a, lord: emptyBuild(t) }));
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
      const heroes = [...a.heroes];
      heroes[tab] = sel;
      return { ...a, heroes };
    });
  };

  const currentSel = tab === 'lord' ? army.lord : army.heroes[tab];
  const currentTree = currentSel ? trees[currentSel.character] : undefined;
  const currentInfo = result?.builds.find((b) => b.character === currentSel?.character);

  const toggleAbility = (key: string) =>
    setArmy((a) => ({
      ...a,
      activeAbilities: a.activeAbilities.includes(key) ? a.activeAbilities.filter((k) => k !== key) : [...a.activeAbilities, key],
    }));

  const save = async () => {
    const name = buildName.trim() || 'Ejército sin nombre';
    const b = await api.saveBuild({ id: currentId, name, army });
    setCurrentId(b.id);
    setSaved(await api.builds());
  };
  const open = (b: SavedBuild) => {
    setArmy({ ...EMPTY, ...b.army });
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
        <h1>WH3 Planner <span>· Guerreros del Caos</span></h1>
        <div className="saves">
          <input placeholder="Nombre del ejército" value={buildName} onChange={(e) => setBuildName(e.target.value)} />
          <button onClick={save}>{currentId ? 'Guardar cambios' : 'Guardar'}</button>
          <button
            className="ghost"
            onClick={() => {
              setArmy(EMPTY);
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
          </nav>

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
                <button className={leftView === 'summary' ? 'active' : ''} onClick={() => setLeftView('summary')}>Efectos acumulados</button>
              </nav>
              {leftView === 'tree' ? (
                <SkillTree tree={currentTree} selection={currentSel} onChange={updateSelection} info={currentInfo} />
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
        </section>

        <aside className="right">
          <ArmyPanel units={units} army={army.units} usedSlots={usedSlots} onChange={(u) => setArmy((a) => ({ ...a, units: u }))} />
          <AbilitiesPanel
            abilities={result?.abilities ?? []}
            active={army.activeAbilities}
            inAura={army.inAura}
            onToggle={toggleAbility}
            onAura={(v) => setArmy((a) => ({ ...a, inAura: v }))}
          />
        </aside>
      </main>

      <section className="bottom">
        <nav className="tabs">
          <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>Tarjetas ({cards.length})</button>
          <button className={view === 'dps' ? 'active' : ''} onClick={() => setView('dps')}>DPS</button>
          <button className={view === 'campaign' ? 'active' : ''} onClick={() => setView('campaign')}>Campaña y magia</button>
        </nav>

        {view === 'cards' && (
          <>
            {charCards.length > 0 && <div className="cards">{charCards.map((c) => <UnitCard key={c.id + c.kind} card={c} labels={labels} />)}</div>}
            <div className="cards">{unitCards.map((c) => <UnitCard key={c.id} card={c} labels={labels} />)}</div>
            {!cards.length && <p className="muted">Elige un señor y agrega unidades para ver sus tarjetas con bufos.</p>}
            <p className="small muted">
              Clic en una stat con bufos para ver de dónde sale cada número. Los efectos de "rango 7+" solo cuentan si marcas R7+ en la unidad.
            </p>
          </>
        )}

        {view === 'dps' && <DpsPanel army={army} cards={cards} units={units} />}

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
      </section>

      <footer className="small muted">
        Datos: {meta?.sources.skills} · {meta?.sources.units}. Nombres del juego en inglés; puedes poner los tuyos en backend/data/nombres-es.json.
      </footer>
    </div>
  );
}
