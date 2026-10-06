import { create } from 'zustand';
import { clearPersisted, loadPersisted, savePersisted, type PersistedState } from './storage';
import type { LanguageId } from '../interpreter/core/adapter';
import { emptyGameProgress, type GameProgress } from './gameProgress';
import { DEFAULT_GAME_ID } from '../games/types';

/* ============================================================================
   MODBOX — PROGRESS STORE
   Mission progress, unlock state, best score and settings, persisted locally.
   ========================================================================== */

export interface Settings {
  sound: boolean;
  debug: boolean;
}

interface ProgressState {
  activeGameId: string;
  starterMissionId: string;
  games: Record<string, GameProgress>;
  studentName: string;
  currentMissionId: string;
  activeLanguage: LanguageId;
  completed: string[];
  freeModeUnlocked: boolean;
  bestScore: number;
  codes: Record<string, string>;
  settings: Settings;

  setStudentName: (name: string) => void;
  setMission: (missionId: string) => void;
  setLanguage: (language: LanguageId) => void;
  completeMission: (missionId: string, discoverFreeMode?: boolean) => void;
  setCode: (missionId: string, code: string) => void;
  setBestScore: (score: number) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetProgress: () => void;
  resetCurrentGame: () => void;
  selectGame: (gameId: string, starterMissionId: string, defaultLanguage?: LanguageId) => void;
  getGameProgress: (gameId: string, starterMissionId?: string) => GameProgress;
  setGameCode: (gameId: string, key: string, code: string) => void;
}

const initial = loadPersisted();

export const useProgress = create<ProgressState>()((set, get) => ({
  activeGameId: initial.activeGameId,
  starterMissionId: initial.games[initial.activeGameId]?.starterMissionId ?? 'm00',
  games: initial.games,
  studentName: initial.studentName,
  currentMissionId: initial.currentMissionId,
  activeLanguage: initial.activeLanguage,
  completed: initial.completed,
  freeModeUnlocked: initial.freeModeUnlocked,
  bestScore: initial.bestScore,
  codes: initial.codes,
  settings: initial.settings,

  setStudentName: (studentName) => set({ studentName }),

  setMission: (currentMissionId) => {
    set({ currentMissionId, codes: { ...get().codes } });
  },

  setLanguage: (activeLanguage) => set({ activeLanguage }),

  completeMission: (missionId, discoverFreeMode = false) => {
    const completed = get().completed.includes(missionId)
      ? get().completed
      : [...get().completed, missionId];
    const next: Partial<ProgressState> = { completed };
    if (discoverFreeMode) next.freeModeUnlocked = true;
    set(next);
  },

  setCode: (missionId, code) => set({ codes: { ...get().codes, [missionId]: code } }),

  setBestScore: (score) => set({ bestScore: Math.max(get().bestScore, score) }),

  setSetting: (key, value) =>
    set({ settings: { ...get().settings, [key]: value } }),

  resetProgress: () => {
    clearPersisted();
    set({ ...initialReset() });
  },

  selectGame: (activeGameId, starterMissionId, defaultLanguage = 'csharp') => {
    const state = get();
    if (state.activeGameId === activeGameId) {
      if (state.starterMissionId !== starterMissionId) set({ starterMissionId });
      return;
    }
    const games = { ...state.games, [state.activeGameId]: snapshotGame(state) };
    const next = Object.prototype.hasOwnProperty.call(games, activeGameId) ? games[activeGameId] : emptyGameProgress(starterMissionId, defaultLanguage);
    set({ ...next, starterMissionId, activeGameId, games });
  },

  getGameProgress: (gameId, starterMissionId = 'm00') => {
    const state = get();
    return state.activeGameId === gameId ? snapshotGame(state) : Object.prototype.hasOwnProperty.call(state.games, gameId) ? state.games[gameId] : emptyGameProgress(starterMissionId);
  },

  resetCurrentGame: () => {
    const state = get();
    const next = emptyGameProgress(state.starterMissionId, state.activeLanguage);
    set({ ...next, games: { ...state.games, [state.activeGameId]: next } });
  },

  setGameCode: (gameId, key, code) => {
    const state = get();
    const previous = state.getGameProgress(gameId);
    const next = { ...previous, codes: { ...previous.codes, [key]: code } };
    set({ games: { ...state.games, [gameId]: next }, ...(gameId === state.activeGameId ? { codes: next.codes } : {}) });
  },
}));

function snapshotGame(state: ProgressState): GameProgress {
  return { starterMissionId: state.starterMissionId, currentMissionId: state.currentMissionId, activeLanguage: state.activeLanguage,
    completed: state.completed, freeModeUnlocked: state.freeModeUnlocked, bestScore: state.bestScore, codes: state.codes };
}

function initialReset(): Partial<ProgressState> {
  return {
    activeGameId: DEFAULT_GAME_ID,
    starterMissionId: 'm00',
    games: {},
    studentName: '',
    currentMissionId: 'm00',
    activeLanguage: 'csharp',
    completed: [],
    freeModeUnlocked: false,
    bestScore: 0,
    codes: {},
    settings: { sound: true, debug: false },
  };
}

function toPersisted(state: ProgressState): PersistedState {
  return {
    version: 2,
    activeGameId: state.activeGameId,
    games: { ...state.games, [state.activeGameId]: snapshotGame(state) },
    studentName: state.studentName,
    currentMissionId: state.currentMissionId,
    activeLanguage: state.activeLanguage,
    completed: state.completed,
    bestScore: state.bestScore,
    codes: state.codes,
    freeModeCode: state.codes.free ?? '',
    freeModeUnlocked: state.freeModeUnlocked,
    settings: state.settings,
  };
}

// persist on change, debounced so dragging the split handle does not thrash storage
let saveTimer = 0;

useProgress.subscribe((state) => {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => savePersisted(toPersisted(state)), 250);
});
