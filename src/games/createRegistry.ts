import type { GameDefinition } from './types';

export function createGameRegistry(definitions: readonly GameDefinition[]) {
  const byId = new Map<string, GameDefinition>();
  for (const game of definitions) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) || byId.has(game.id)) throw new Error(`Invalid or duplicate game id: ${game.id}`);
    if (game.status === 'play') {
      const ids = new Set(game.missions.map(mission => mission.id));
      if (!game.languages.length || ids.size !== game.missions.length || !ids.has(game.starterMissionId) || (game.sandboxMissionId && !ids.has(game.sandboxMissionId))) {
        throw new Error(`Invalid languages or missions for ${game.id}`);
      }
    }
    byId.set(game.id, game);
  }
  return {
    games: Object.freeze([...definitions]),
    get: (id: string) => byId.get(id),
  };
}

export type GameRegistry = ReturnType<typeof createGameRegistry>;
