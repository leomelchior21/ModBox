import { create } from 'zustand';
import { clearPersisted, loadPersisted, savePersisted, type PersistedState } from './storage';
import type { LanguageId } from '../interpreter/core/adapter';

/* ============================================================================
   MODBOX — PROGRESS STORE
   Mission progress, unlock state, best score and settings, persisted locally.
   ========================================================================== */

export interface Settings {
  sound: boolean;
  debug: boolean;
}

interface ProgressState {
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
}

const initial = loadPersisted();

export const useProgress = create<ProgressState>()((set, get) => ({
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
}));

function initialReset(): Partial<ProgressState> {
  return {
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
    version: 1,
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
