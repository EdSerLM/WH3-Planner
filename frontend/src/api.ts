import type { ArmyState, CharacterSummary, CharacterTree, ComputeResult, DpsRow, Meta, SavedBuild, UnitData } from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { 'content-type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${r.status} en ${path}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  meta: () => req<Meta>('/api/meta'),
  characters: () => req<CharacterSummary[]>('/api/characters'),
  character: (key: string) => req<CharacterTree>(`/api/characters/${encodeURIComponent(key)}`),
  units: () => req<UnitData[]>('/api/units'),
  compute: (army: ArmyState) => req<ComputeResult>('/api/compute', { method: 'POST', body: JSON.stringify(army) }),
  dps: (army: ArmyState, attacker: string, targets: string[]) =>
    req<{ attacker: string; rows: DpsRow[]; disclaimer: string; debuffs: string[] }>('/api/dps', {
      method: 'POST',
      body: JSON.stringify({ army, attacker, targets }),
    }),
  builds: () => req<SavedBuild[]>('/api/builds'),
  saveBuild: (b: { id?: string; name: string; notes?: string; army: ArmyState }) =>
    req<SavedBuild>('/api/builds', { method: 'POST', body: JSON.stringify(b) }),
  deleteBuild: (id: string) => req<{ deleted: boolean }>(`/api/builds/${id}`, { method: 'DELETE' }),
};
