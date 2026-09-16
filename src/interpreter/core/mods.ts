import type { ConfigKey, VarType } from './types';
import { ENEMY_KINDS, NUMERIC_LIMITS, WEAPON_KINDS } from './limits';

/* ============================================================================
   MODBOX — MODS (the programmable controls of a game)
   A Mod is a named control a student can reach from code. Mission content
   unlocks Mods over time; the interpreter is the only thing that turns a
   variable declaration into a game value.
   ========================================================================== */

export interface ModDefinition {
  id: ConfigKey;
  /** variable name used in student code */
  name: string;
  type: VarType;
  /** UI label */
  label: string;
  /** one-line description for the Mod Library */
  blurb: string;
  /** example line shown in the library */
  example: string;
  /** for string mods: allowed values */
  values?: readonly string[];
  /** for numeric mods: human readable range */
  range?: string;
  /** mission index in which this Mod is discovered */
  unlockAt: number;
}

export const MODS: ModDefinition[] = [
  {
    id: 'enemyType',
    name: 'enemy',
    type: 'string',
    label: 'ENEMY TYPE',
    blurb: 'Which rock the field spawns.',
    example: 'string enemy = "big-rock";',
    values: ENEMY_KINDS,
    unlockAt: 0,
  },
  {
    id: 'shipName',
    name: 'shipName',
    type: 'string',
    label: 'SHIP NAME',
    blurb: 'Name of your machine. Shows on the HUD and in the Flight Log.',
    example: 'string shipName = "Brian\'s ship";',
    unlockAt: 1,
  },
  {
    id: 'enemyCount',
    name: 'enemies',
    type: 'int',
    label: 'ENEMY COUNT',
    blurb: 'How many rocks are in the field.',
    example: 'int enemies = 3;',
    range: NUMERIC_LIMITS.enemyCount.range,
    unlockAt: 2,
  },
  {
    id: 'laserPower',
    name: 'laserPower',
    type: 'int',
    label: 'WEAPON POWER',
    blurb: 'How hard your shots hit. High power pierces small rocks.',
    example: 'int laserPower = 1;',
    range: NUMERIC_LIMITS.laserPower.range,
    unlockAt: 3,
  },
  {
    id: 'enemySpeed',
    name: 'enemySpeed',
    type: 'int',
    label: 'ENEMY SPEED',
    blurb: 'Drift speed of newly spawned rocks.',
    example: 'int enemySpeed = 2;',
    range: NUMERIC_LIMITS.enemySpeed.range,
    unlockAt: 3,
  },
  {
    id: 'shieldEnabled',
    name: 'shield',
    type: 'bool',
    label: 'SHIELD',
    blurb: 'Blocks one impact, then recharges.',
    example: 'bool shield = false;',
    values: ['true', 'false'],
    unlockAt: 4,
  },
  {
    id: 'rapidFireEnabled',
    name: 'rapidFire',
    type: 'bool',
    label: 'RAPID FIRE',
    blurb: 'Faster trigger, shorter cooldown.',
    example: 'bool rapidFire = false;',
    values: ['true', 'false'],
    unlockAt: 4,
  },
  {
    id: 'homingEnabled',
    name: 'homing',
    type: 'bool',
    label: 'HOMING SHOTS',
    blurb: 'Shots curve toward the nearest rock.',
    example: 'bool homing = false;',
    values: ['true', 'false'],
    unlockAt: 6,
  },
  {
    id: 'lives',
    name: 'lives',
    type: 'int',
    label: 'LIVES',
    blurb: 'Ships in reserve.',
    example: 'int lives = 3;',
    range: NUMERIC_LIMITS.lives.range,
    unlockAt: 100,
  },
  {
    id: 'scoreMultiplier',
    name: 'scoreMultiplier',
    type: 'int',
    label: 'SCORE MULTIPLIER',
    blurb: 'Stacks every point you earn.',
    example: 'int scoreMultiplier = 2;',
    range: NUMERIC_LIMITS.scoreMultiplier.range,
    unlockAt: 100,
  },
  {
    id: 'worldGravity',
    name: 'worldGravity',
    type: 'int',
    label: 'WORLD GRAVITY',
    blurb: 'Pulls everything gently toward the bottom of the field.',
    example: 'int worldGravity = 0;',
    range: NUMERIC_LIMITS.worldGravity.range,
    unlockAt: 100,
  },
  {
    id: 'weaponType',
    name: 'weapon',
    type: 'string',
    label: 'WEAPON',
    blurb: 'Which weapon system is fitted.',
    example: 'string weapon = "laser";',
    values: WEAPON_KINDS,
    unlockAt: 100,
  },
];

export const MOD_BY_NAME: Record<string, ModDefinition> = Object.fromEntries(
  MODS.map((mod) => [mod.name, mod]),
);

export const MOD_BY_ID: Record<ConfigKey, ModDefinition> = Object.fromEntries(
  MODS.map((mod) => [mod.id, mod]),
) as Record<ConfigKey, ModDefinition>;

export const RUNTIME_LABELS = {
  score: 'current score',
  health: 'ship integrity (0–100)',
  wave: 'current wave number',
  enemiesRemaining: 'rocks still alive',
} as const;

export type RuntimeName = keyof typeof RUNTIME_LABELS;

export const RUNTIME_MODS = (Object.keys(RUNTIME_LABELS) as RuntimeName[]).map((name) => ({
  name,
  label: RUNTIME_LABELS[name],
}));
