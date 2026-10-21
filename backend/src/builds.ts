import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR } from './data.js';
import type { ComputeRequest } from './types.js';

/** Builds/ejércitos guardados en backend/data/builds.json (se crea solo). */
export interface SavedBuild {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  army: ComputeRequest;
}

const FILE = join(DATA_DIR, 'builds.json');

function load(): SavedBuild[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as SavedBuild[];
  } catch {
    return [];
  }
}

function save(list: SavedBuild[]) {
  writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function listBuilds(): SavedBuild[] {
  return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getBuild(id: string): SavedBuild | undefined {
  return load().find((b) => b.id === id);
}

export function upsertBuild(input: { id?: string; name: string; notes?: string; army: ComputeRequest }): SavedBuild {
  const list = load();
  const now = new Date().toISOString();
  const existing = input.id ? list.find((b) => b.id === input.id) : undefined;
  if (existing) {
    existing.name = input.name;
    existing.notes = input.notes;
    existing.army = input.army;
    existing.updatedAt = now;
    save(list);
    return existing;
  }
  const b: SavedBuild = { id: randomUUID(), name: input.name, notes: input.notes, army: input.army, createdAt: now, updatedAt: now };
  list.push(b);
  save(list);
  return b;
}

export function deleteBuild(id: string): boolean {
  const list = load();
  const next = list.filter((b) => b.id !== id);
  if (next.length === list.length) return false;
  save(next);
  return true;
}
