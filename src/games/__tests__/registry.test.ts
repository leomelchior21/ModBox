import { describe, expect, it } from 'vitest';
import { createGameRegistry } from '../createRegistry';
import { gardenGame } from './fixtures/gardenGame';

describe('game registration', () => {
  it('keeps unfinished games distinct and rejects duplicate IDs', () => {
    const pending = { ...gardenGame, id: 'future-game', status: 'coming-soon' as const };
    const registry = createGameRegistry([pending, gardenGame]);
    expect(registry.games.map(game => game.id)).toEqual(['garden-test', 'future-game']);
    expect(registry.get('garden-test')?.status).toBe('play');
    expect(registry.get('future-game')?.status).toBe('coming-soon');
    expect(registry.get('unknown')).toBeUndefined();
    expect(() => createGameRegistry([gardenGame, gardenGame])).toThrow('duplicate');
  });

  it('puts playable games first while preserving the order within each availability group', () => {
    const future = { ...gardenGame, id: 'future-one', status: 'coming-soon' as const };
    const second = { ...gardenGame, id: 'second-game' };
    const last = { ...future, id: 'future-two' };
    const definitions = [future, gardenGame, last, second];
    expect(createGameRegistry(definitions).games.map(game => game.id)).toEqual(['garden-test', 'second-game', 'future-one', 'future-two']);
    expect(definitions.map(game => game.id)).toEqual(['future-one', 'garden-test', 'future-two', 'second-game']);
  });

  it('rejects missing starter missions and empty language support', () => {
    expect(() => createGameRegistry([{ ...gardenGame, starterMissionId: 'missing' }])).toThrow('Invalid');
    expect(() => createGameRegistry([{ ...gardenGame, languages: [] }])).toThrow('Invalid');
  });
});
