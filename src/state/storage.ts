/* ============================================================================
   MODBOX — LOCAL PERSISTENCE
   No accounts, no backend: progress lives in localStorage (spec §22 / §31).
   ========================================================================== */

const KEY = 'modbox:v1';
export interface PersistedState {
  version: 1;
  studentName: string;
  currentMissionId: string;
  completed: string[];
  bestScore: number;
  codes: Record<string, string>;
  freeModeCode: string;
  freeModeUnlocked: boolean;
  settings: {
    sound: boolean;
    debug: boolean;
    splitRatio: number;
  };
}

export const DEFAULT_PERSISTED: PersistedState = {
  version: 1,
  studentName: '',
  currentMissionId: 'm00',
  completed: [],
  bestScore: 0,
  codes: {},
  freeModeCode: '',
  freeModeUnlocked: false,
  settings: { sound: true, debug: false, splitRatio: 0.42 },
};

export function loadPersisted(): PersistedState {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PERSISTED };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PERSISTED };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...DEFAULT_PERSISTED,
      ...parsed,
      settings: { ...DEFAULT_PERSISTED.settings, ...(parsed.settings ?? {}) },
      codes: { ...(parsed.codes ?? {}) },
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
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
