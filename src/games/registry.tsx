import { createGameRegistry } from './createRegistry';
import { vectorZero } from './vector-zero/definition';
import { neonMaze } from './neon-maze/definition';
import { devilFloor } from './devil-floor/definition';
import { makitasVsZombies } from './makitas-vs-zombies/definition';
import { blockForge } from './block-forge/definition';
import { makitaSlingers } from './makita-slingers/definition';
import { najaRun } from './naja-run/definition';
import { pinballerz } from './pinballerz/definition';
import { speedStack } from './speed-stack/definition';

/** Register a finished game's definition here to expose it in both libraries. */
export const gameRegistry = createGameRegistry([
  vectorZero,
  neonMaze,
  devilFloor,
  makitasVsZombies,
  blockForge,
  makitaSlingers,
  najaRun,
  pinballerz,
  speedStack,
]);
