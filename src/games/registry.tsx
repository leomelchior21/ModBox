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

import { templeRace } from './temple-race/definition';

import { subwayRunnerz } from './subway-runnerz/definition';

import { teamCounters } from './team-counters/definition';

import { monsterStrider } from './monster-strider/definition';

import { roombaRun } from './roomba-run/definition';

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
  templeRace,
  subwayRunnerz,
  teamCounters,
  monsterStrider,
  roombaRun,
]);
