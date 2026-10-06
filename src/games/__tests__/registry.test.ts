import { describe, expect, it } from 'vitest';
import { createGameRegistry } from '../createRegistry';
import { gardenGame } from './fixtures/gardenGame';

describe('game registration', () => {
  it('keeps unfinished games distinct and rejects duplicate IDs', () => {
    const pending = { ...gardenGame, id: 'future-game', status: 'coming-soon' as const };
    const registry = createGameRegistry([gardenGame, pending]);
    expect(registry.get('garden-test')?.status).toBe('play');
    expect(registry.get('future-game')?.status).toBe('coming-soon');
    expect(registry.get('unknown')).toBeUndefined();
    expect(() => createGameRegistry([gardenGame, gardenGame])).toThrow('duplicate');
  });

  it('rejects missing starter missions and empty language support', () => {
    expect(() => createGameRegistry([{ ...gardenGame, starterMissionId: 'missing' }])).toThrow('Invalid');
    expect(() => createGameRegistry([{ ...gardenGame, languages: [] }])).toThrow('Invalid');
  });
});
