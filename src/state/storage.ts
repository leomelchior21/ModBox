/* ============================================================================
   MODBOX — LOCAL PERSISTENCE
   No accounts, no backend: progress lives in localStorage (spec §22 / §31).
   ========================================================================== */

import type { LanguageId } from '../interpreter/core/adapter';
import { emptyGameProgress, type GameProgress } from './gameProgress';
import { DEFAULT_GAME_ID } from '../games/types';

const KEY = 'modbox:v1';
export interface PersistedState {
  version: 1 | 2;
  activeGameId: string;
  games: Record<string, GameProgress>;
  studentName: string;
  currentMissionId: string;
  activeLanguage: LanguageId;
  completed: string[];
  bestScore: number;
  codes: Record<string, string>;
  freeModeCode: string;
  freeModeUnlocked: boolean;
  settings: {
    sound: boolean;
    debug: boolean;
  };
}

export const DEFAULT_PERSISTED: PersistedState = {
  version: 1,
  activeGameId: DEFAULT_GAME_ID,
  games: {},
  studentName: '',
  currentMissionId: 'm00',
  activeLanguage: 'csharp',
  completed: [],
  bestScore: 0,
  codes: {},
  freeModeCode: '',
  freeModeUnlocked: false,
  settings: { sound: true, debug: false },
};

export function loadPersisted(): PersistedState {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PERSISTED };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PERSISTED };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const legacy: GameProgress = { ...emptyGameProgress(), currentMissionId: parsed.currentMissionId ?? 'm00', activeLanguage: parsed.activeLanguage ?? 'csharp',
      codes: { ...(parsed.codes ?? {}) }, completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      freeModeUnlocked: parsed.freeModeUnlocked ?? false, bestScore: parsed.bestScore ?? 0 };
    const games = parsed.games && typeof parsed.games === 'object' ? parsed.games : { [DEFAULT_GAME_ID]: legacy };
    const activeGameId = typeof parsed.activeGameId === 'string' ? parsed.activeGameId : DEFAULT_GAME_ID;
    const active = Object.prototype.hasOwnProperty.call(games, activeGameId) ? games[activeGameId] : emptyGameProgress();
    return {
      ...DEFAULT_PERSISTED,
      ...parsed,
      ...active,
      activeGameId,
      games,
      settings: { ...DEFAULT_PERSISTED.settings, ...(parsed.settings ?? {}) },
      codes: { ...active.codes },
      completed: Array.isArray(active.completed) ? active.completed : [],
    };
  } catch {
    return { ...DEFAULT_PERSISTED };
  }
}

export function savePersisted(state: PersistedState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — the game still works, progress just is not kept */
  }
}

export function clearPersisted(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
