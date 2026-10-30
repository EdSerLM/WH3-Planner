import type { AbilityInfo, TechTreeData, TechTreeSummary, ArmyState, CampaignFaction, GraphData, TechSummaryData, CharacterSummary, CharacterTree, ComputeResult, DpsRow, Meta, SavedBuild, UnitData } from './types';

// Web estática (celular, GitHub Pages): no hay servidor, el backend corre en el navegador con los mismos datos
const STATIC = import.meta.env.VITE_STATIC === '1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (STATIC) {
    const { handle } = await import('@local');
    return (await handle(init?.method ?? 'GET', path, init?.body ? JSON.parse(String(init.body)) : undefined)) as T;
  }
  const r = await fetch(path, { headers: { 'content-type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${r.status} en ${path}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  meta: () => req<Meta>('/api/meta'),
  characterFactions: () => req<{ default: string; factions: { key: string; name: string; flag?: string }[] }>('/api/character-factions'),
  characters: (faction?: string) => req<CharacterSummary[]>(`/api/characters${faction ? `?faction=${encodeURIComponent(faction)}` : ''}`),
  character: (key: string) => req<CharacterTree>(`/api/characters/${encodeURIComponent(key)}`),
  unitAbilities: (unit: string, names: string[]) =>
    req<{ abilities: AbilityInfo[]; attrs: Record<string, string> }>(`/api/unit-abilities?unit=${encodeURIComponent(unit)}&names=${encodeURIComponent(names.join('|'))}`),
  units: (faction?: string) => req<UnitData[]>(`/api/units${faction ? `?faction=${encodeURIComponent(faction)}` : ''}`),
  campaign: (faction: string) => req<CampaignFaction[]>(`/api/campaign?faction=${encodeURIComponent(faction)}`),
  compute: (army: ArmyState) => req<ComputeResult>('/api/compute', { method: 'POST', body: JSON.stringify(army) }),
  dps: (army: ArmyState, attacker: string, targets: string[], dir: 'front' | 'flank' | 'rear' = 'front', mode: 'melee' | 'ranged' = 'melee') =>
    req<{ attacker: string; rows: DpsRow[]; disclaimer: string; debuffs: string[] }>('/api/dps', {
      method: 'POST',
      body: JSON.stringify({ army, attacker, targets, dir, mode }),
    }),
  matchups: (army: ArmyState, targets: string[], dir: 'front' | 'flank' | 'rear' = 'front', mode: 'melee' | 'ranged' = 'melee') =>
    req<{ cards: Record<string, Record<string, 'win' | 'even' | 'lose'>> }>('/api/dps/matchups', {
      method: 'POST',
      body: JSON.stringify({ army, targets, dir, mode }),
    }),
  factions: () => req<{ key: string; name: string }[]>('/api/factions'),
  targets: (faction: string) =>
    req<{ key: string; name: string; caste: string; group?: string; cost?: number; models?: number; tier?: number }[]>(`/api/targets?faction=${encodeURIComponent(faction)}`),
  graphs: (faction: string) => req<{ key: string; name: string }[]>(`/api/graphs?faction=${encodeURIComponent(faction)}`),
  graph: (key: string) => req<GraphData>(`/api/graphs/${encodeURIComponent(key)}`),
  techSummary: (techs: string[]) => req<TechSummaryData>('/api/tech-summary', { method: 'POST', body: JSON.stringify({ techs }) }),
  techUnits: (techs: string[], units: string[], chars: { key: string; type: string }[] = []) =>
    req<{ hits: Record<string, string[]>; art: Record<string, string> }>('/api/techs/units', { method: 'POST', body: JSON.stringify({ techs, units, chars }) }),
  charPotential: (character: string, kind: 'lord' | 'hero', units: string[]) =>
    req<Record<string, { now: string[]; r7: string[] }>>('/api/characters/potential', { method: 'POST', body: JSON.stringify({ character, kind, units }) }),
  techTrees: (faction: string) => req<TechTreeSummary[]>(`/api/techs?faction=${encodeURIComponent(faction)}`),
  techTree: (key: string, variant?: string) =>
    req<TechTreeData>(`/api/techs/${encodeURIComponent(key)}${variant ? `?variant=${encodeURIComponent(variant)}` : ''}`),
  builds: () => req<SavedBuild[]>('/api/builds'),
  saveBuild: (b: { id?: string; name: string; notes?: string; army: ArmyState }) =>
    req<SavedBuild>('/api/builds', { method: 'POST', body: JSON.stringify(b) }),
  deleteBuild: (id: string) => req<{ deleted: boolean }>(`/api/builds/${id}`, { method: 'DELETE' }),
};
