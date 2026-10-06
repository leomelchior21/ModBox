// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProgress } from '../progressStore';
import { loadPersisted } from '../storage';

beforeEach(() => { useProgress.getState().resetProgress(); localStorage.clear(); });

describe('game progress isolation', () => {
  it('keeps code, language, scores, unlocks and missions separate when games share mission IDs', () => {
    const store = useProgress.getState();
    store.setCode('csharp:m00', 'string enemy = "big-rock";');
    store.completeMission('m00', true); store.setBestScore(200);
    store.selectGame('garden-test', 'm00', 'python');
    expect(useProgress.getState().completed).toEqual([]);
    expect(useProgress.getState().activeLanguage).toBe('python');
    expect(useProgress.getState().codes).toEqual({});
    store.setCode('python:m00', 'tiles = 6'); store.completeMission('m00'); store.setBestScore(10);
    store.selectGame('vector-zero', 'm00');
    expect(useProgress.getState().codes['csharp:m00']).toContain('big-rock');
    expect(useProgress.getState().activeLanguage).toBe('csharp');
    expect(useProgress.getState().freeModeUnlocked).toBe(true);
    expect(useProgress.getState().bestScore).toBe(200);
    expect(store.getGameProgress('garden-test').bestScore).toBe(10);
  });

  it('keeps a late edit attached to its game and resets only the current game', () => {
    const store = useProgress.getState();
    store.setCode('csharp:m00', 'original');
    store.selectGame('garden-test', 'intro');
    store.setGameCode('vector-zero', 'csharp:m00', 'late edit');
    expect(useProgress.getState().codes).toEqual({});
    store.setCode('csharp:intro', 'tiles'); store.resetCurrentGame();
    expect(useProgress.getState().currentMissionId).toBe('intro');
    expect(store.getGameProgress('vector-zero').codes['csharp:m00']).toBe('late edit');
  });

  it('migrates existing Vector Zero saves into their own game entry', () => {
    localStorage.setItem('modbox:v1', JSON.stringify({ version: 1, currentMissionId: 'm02', activeLanguage: 'swift', codes: { 'swift:m02': 'var enemies: Int = 8' }, completed: ['m00', 'm01'], bestScore: 123 }));
    const saved = loadPersisted();
    expect(saved.activeGameId).toBe('vector-zero');
    expect(saved.games['vector-zero'].codes['swift:m02']).toContain('enemies');
    expect(saved.currentMissionId).toBe('m02');
    expect(saved.completed).toEqual(['m00', 'm01']);
  });

  it('persists and reloads every game’s progress', async () => {
    vi.useFakeTimers();
    try {
      const store = useProgress.getState();
      store.setCode('csharp:m00', 'vector'); store.selectGame('garden-test', 'intro', 'python'); store.setCode('python:intro', 'garden');
      await vi.advanceTimersByTimeAsync(300);
      const saved = loadPersisted();
      expect(saved.games['vector-zero'].codes['csharp:m00']).toBe('vector');
      expect(saved.games['garden-test'].codes['python:intro']).toBe('garden');
      expect(saved.currentMissionId).toBe('intro');
    } finally { vi.useRealTimers(); }
  });
});
