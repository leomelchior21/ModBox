import { createGameRegistry } from './createRegistry';
import { vectorZero } from './vector-zero/definition';
import { neonMaze } from './neon-maze/definition';
import { devilFloor } from './devil-floor/definition';
import { makitasVsZombies } from './makitas-vs-zombies/definition';

/** Register a finished game's definition here to expose it in both libraries. */
export const gameRegistry = createGameRegistry([
  vectorZero,
  neonMaze,
  devilFloor,
  makitasVsZombies,
]);
