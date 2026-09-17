import type { Mission, MissionRequirement } from './types';
import { scoreTarget } from '../validation/scoreTarget';

/* ============================================================================
   VECTOR ZERO — LEARNING CAMPAIGN
   Each mission adds ONE concept, ONE example, ONE action, then gets out of
   the way so the student can play (spec §13 / §14).
   ========================================================================== */

const req = (
  id: string,
  label: string,
  test: MissionRequirement['test'],
): MissionRequirement => ({ id, label, test });

export const MISSION_M00: Mission = {
  id: 'm00',
  order: 0,
  code: 'FIRST CONTACT',
  title: 'Sector entry',
  kind: 'mission',
  concept: {
    name: 'STRING',
    tagline: 'Text lives inside quotation marks.',
    explanation:
      'A string is text. The quotes are part of the code — the text is what sits between them.',
    example: 'string enemy = "small-rock";',
  },
  brief: 'ONE ROCK INBOUND. It is listening to your code.',
  action: 'Change "small-rock" to "big-rock".',
  hint: 'Type inside the quotes. Keep the quotes.',
  appliedCopy: 'You changed the world with one line of code.',
  starter: 'string enemy = "small-rock";',
  additions: [{ key: 'decl:enemy', code: 'string enemy = "small-rock";' }],
  quickInsert: ['string', 'decl:enemy'],
  scenario: { enemyCount: 1, enemySpeed: 1, lives: 5 },
  unlocks: ['enemyType'],
  requirements: [
    req('big-rock', 'The field spawns big rocks', (ctx) => ctx.config.enemyType === 'big-rock'),
  ],
  playPrompt: 'PLAY IT',
};

export const MISSION_M01: Mission = {
  id: 'm01',
  order: 1,
  code: 'NAME YOUR MACHINE',
  title: 'Call sign',
  kind: 'mission',
  concept: {
    name: 'STRING + CONSOLE.WRITELINE',
    tagline: 'Give a value a name, then send it to Flight Log.',
    explanation:
      'shipName holds text. Console.WriteLine sends that text to the transmission feed in your HUD.',
    example: 'Console.WriteLine("Pilot: " + shipName);',
  },
  brief: 'The HUD is showing a default call sign. Yours is better.',
  action: 'Rename "Brian\'s ship" and watch the HUD and Flight Log update.',
  hint: 'The + joins two pieces of text into one message.',
  appliedCopy: 'Your machine answers to a name you chose, and Flight Log heard it.',
  starter: [
    'string enemy = "small-rock";',
    'string shipName = "Brian\'s ship";',
    '',
    'Console.WriteLine("Pilot: " + shipName);',
  ].join('\n'),
  additions: [
    { key: 'decl:shipName', code: 'string shipName = "Brian\'s ship";' },
    { key: 'write:"Pilot: " + shipName', code: 'Console.WriteLine("Pilot: " + shipName);' },
  ],
  quickInsert: ['string', 'decl:shipName', 'writeline'],
  scenario: { enemyCount: 3, enemySpeed: 1, lives: 5 },
  unlocks: ['shipName'],
  requirements: [
    req(
      'call-sign',
      'Your call sign is on the hull',
      (ctx) =>
        ctx.summary.declares.string.includes('shipName') &&
        ctx.config.shipName.trim().length > 1 &&
        ctx.config.shipName !== "Brian's ship",
    ),
    req('comms', 'Something was sent to Flight Log', (ctx) => ctx.summary.writesCount >= 1),
  ],
  playPrompt: 'LAUNCH WITH YOUR CALL SIGN',
};

export const MISSION_M02: Mission = {
  id: 'm02',
  order: 2,
  code: 'MAKE SOME TROUBLE',
  title: 'Rock count',
  kind: 'mission',
  concept: {
    name: 'INT',
    tagline: 'Whole numbers are stored as int.',
    explanation: 'An int holds a whole number — no quotes, no decimals. It can count anything.',
    example: 'int enemies = 3;',
  },
  brief: 'Three rocks is a warm-up.',
  action: 'Change the number. Try 8 and see if you can survive it.',
  hint: 'The field re-spawns the moment you stop typing.',
  appliedCopy: 'You decide how crowded this sector gets.',
  starter: '',
  additions: [{ key: 'decl:enemies', code: 'int enemies = 3;' }],
  quickInsert: ['int', 'decl:enemies', 'plus', 'minus'],
  scenario: { enemySpeed: 1, lives: 5 },
  unlocks: ['enemyCount'],
  requirements: [
    req('declared', 'A whole number controls the rock count', (ctx) =>
      ctx.summary.declares.int.includes('enemies'),
    ),
    req('crowded', 'At least 5 rocks are in the field', (ctx) => ctx.config.enemyCount >= 5),
  ],
  playPrompt: 'SURVIVE IT.',
};

export const MISSION_M03: Mission = {
  id: 'm03',
  order: 3,
  code: 'POWER CONTROL',
  title: 'Weapon maths',
  kind: 'mission',
  concept: {
    name: 'OPERATORS',
    tagline: 'Operators build a new value out of an old one.',
    explanation:
      'laserPower = laserPower + 2 means: take the current power, add 2, store the result back.',
    example: 'laserPower = laserPower + 2;',
  },
  brief: 'Your shots are landing like snowballs.',
  action: 'Raise laserPower to 3 or more using + - or *.',
  hint: 'Power 5 or higher pierces small rocks.',
  appliedCopy: 'Maths made the weapon hit harder.',
  starter: '',
  additions: [
    { key: 'decl:laserPower', code: 'int laserPower = 1;' },
    { key: 'assign:laserPower', code: 'laserPower = laserPower + 2;' },
  ],
  quickInsert: ['int', 'decl:laserPower', 'plus', 'minus', 'times'],
  scenario: { enemyCount: 4, enemySpeed: 1, lives: 5 },
  unlocks: ['laserPower', 'enemySpeed'],
  requirements: [
    req('power', 'laserPower is 3 or more', (ctx) => ctx.config.laserPower >= 3),
    req('maths', 'An operator built the new value', (ctx) =>
      ctx.summary.arithmeticOps.some((op) => ['+', '*', '-'].includes(op)),
    ),
  ],
  playPrompt: 'TEST YOUR BUILD',
};

export const MISSION_M04: Mission = {
  id: 'm04',
  order: 4,
  code: 'SWITCHES',
  title: 'Systems online',
  kind: 'mission',
  concept: {
    name: 'BOOL',
    tagline: 'A bool can only ever be true or false.',
    explanation: 'Switches in a game are bools: something is on, or it is off. Nothing in between.',
    example: 'bool shield = false;',
  },
  brief: 'Two systems are offline. The ship can fix that itself.',
  action: 'Flip shield and rapidFire to true.',
  hint: 'No quotes. Just true or false.',
  appliedCopy: 'Two switches, two systems online.',
  starter: '',
  additions: [
    { key: 'decl:shield', code: 'bool shield = false;' },
    { key: 'decl:rapidFire', code: 'bool rapidFire = false;' },
  ],
  quickInsert: ['bool', 'true', 'false', 'decl:shield', 'decl:rapidFire'],
  scenario: { enemyCount: 4, enemySpeed: 2, lives: 5 },
  unlocks: ['shieldEnabled', 'rapidFireEnabled'],
  requirements: [
    req('shield', 'The shield is online', (ctx) => ctx.config.shieldEnabled === true),
    req('rapid', 'Rapid fire is online', (ctx) => ctx.config.rapidFireEnabled === true),
  ],
  playPrompt: 'FLY IT.',
};

export const MISSION_M05: Mission = {
  id: 'm05',
  order: 5,
  code: 'THE GAME CAN THINK',
  title: 'Live rules',
  kind: 'mission',
  concept: {
    name: 'IF',
    tagline: 'If this is true, do this.',
    explanation:
      'This is not a starting value any more — it is a rule. The game checks it while you fly.',
    example: 'if (score >= 300)\n{\n    shield = true;\n}',
  },
  brief: 'Code that runs while you play.',
  action: 'Score 300. Watch your shield switch on.',
  hint: 'score, health, wave and enemiesRemaining can be read while the game runs.',
  appliedCopy: 'Your code reacted to the game while you were flying.',
  starter: '',
  additions: [{ key: 'rule:score >= 300', code: 'if (score >= 300)\n{\n    shield = true;\n}' }],
  quickInsert: ['if', 'ge', 'score', 'decl:shield'],
  scenario: { enemyCount: 5, enemySpeed: 2, lives: 6 },
  unlocks: [],
  requirements: [
    req('rule', 'A rule reads the live score', (ctx) =>
      ctx.summary.rulesCount >= 1 && ctx.summary.runtimeRefs.includes('score'),
    ),
    req('compare', 'A comparison operator decides when it fires', (ctx) =>
      ctx.summary.comparisons.some((op) => ['>', '>='].includes(op)),
    ),
    req('fire', 'The rule fired during a run', (ctx) => ctx.metrics.ruleActivations >= 1),
    req(
      'score',
      'You reached the score you set in your own rule',
      (ctx) => ctx.metrics.maxScore >= scoreTarget(ctx.program),
    ),
  ],
  playPrompt: 'CHASE 300.',
};

export const MISSION_M06: Mission = {
  id: 'm06',
  order: 6,
  code: 'DANGER MODE',
  title: 'Reactive weapon',
  kind: 'mission',
  concept: {
    name: 'COMPARISONS',
    tagline: 'Compare values to build reactions.',
    explanation:
      'health is your ship integrity from 0 to 100. When it drops, your code can respond.',
    example: 'if (health <= 30)\n{\n    laserPower = 5;\n}',
  },
  brief: 'Damage is an input. Turn it into firepower.',
  action: 'Let your integrity fall below 30 and feel the weapon surge.',
  hint: 'Integrity regenerates slowly, so the rule switches back off on its own.',
  appliedCopy: 'Damage now feeds your weapon.',
  starter: '',
  additions: [{ key: 'rule:health <= 30', code: 'if (health <= 30)\n{\n    laserPower = 5;\n}' }],
  quickInsert: ['if', 'le', 'health', 'decl:laserPower'],
  scenario: { enemyCount: 5, enemySpeed: 2, lives: 6 },
  unlocks: ['homingEnabled'],
  requirements: [
    req('rule', 'A rule reads live integrity', (ctx) =>
      ctx.summary.rulesCount >= 1 && ctx.summary.runtimeRefs.includes('health'),
    ),
    req('damage', 'You took a real hit (below 30 integrity)', (ctx) => ctx.metrics.minHealth <= 30),
    req('surge', 'The rule fired and changed the weapon', (ctx) =>
      ctx.metrics.ruleTraces.some((trace) => trace.includes('health')),
    ),
  ],
  playPrompt: 'TAKE A HIT. HIT BACK.',
};

export const MISSION_FINAL: Mission = {
  id: 'final',
  order: 7,
  code: 'FINAL MOD',
  title: 'BUILD THE LEVEL',
  kind: 'final',
  concept: {
    name: 'YOUR SCRIPT',
    tagline: 'Everything you have learned, in one file.',
    explanation:
      'There is no single right answer. Satisfy every requirement your own way, then fly it.',
    example: 'string enemy = "medium-rock";\nint enemies = 7;\nConsole.WriteLine("READY");',
  },
  brief: 'Your sector. Your rules.',
  action:
    'Build a level with 5+ rocks, a custom name, visual style, weapon, bool, rule and transmission.',
  hint: 'Open MOD LIBRARY for every control you can reach.',
  appliedCopy: 'LEVEL BUILT. Your level ships with your rules inside it.',
  starter: '',
  additions: [],
  quickInsert: [
    'decl:shipType',
    'decl:backgroundColor',
    'decl:rockShape',
    'decl:shipName',
    'decl:enemy',
    'decl:enemies',
    'decl:laserPower',
    'decl:lives',
    'decl:shield',
    'decl:rapidFire',
    'decl:homing',
    'decl:scoreMultiplier',
    'decl:worldGravity',
    'writeline',
    'if',
    'score',
    'health',
  ],
  scenario: { lives: 5 },
  unlocks: ['shipType', 'backgroundColor', 'rockShape', 'lives', 'scoreMultiplier', 'worldGravity', 'weaponType'],
  requirements: [
    req('string', 'A custom ship name (string)', (ctx) =>
      ctx.summary.declares.string.length >= 1 && ctx.config.shipName.trim().length > 1,
    ),
    req('int', 'A number you tuned (int)', (ctx) => ctx.summary.declares.int.length >= 1),
    req('bool', 'At least one switch (bool)', (ctx) => ctx.summary.declares.bool.length >= 1),
    req('enemies', 'At least 5 rocks in the field', (ctx) => ctx.config.enemyCount >= 5),
    req('weapon', 'A weapon setting is used', (ctx) =>
      ctx.summary.modsUsed.includes('laserPower') || ctx.summary.modsUsed.includes('weaponType'),
    ),
    req('rule', 'One rule that reacts while playing', (ctx) =>
      ctx.summary.rulesCount >= 1 && ctx.summary.runtimeRefs.length >= 1,
    ),
    req('comms', 'A Console.WriteLine transmission', (ctx) => ctx.summary.writesCount >= 1),
    req('played', 'You flew it and destroyed a rock', (ctx) => ctx.metrics.kills >= 1),
  ],
  playPrompt: 'FLY YOUR LEVEL',
};

export const FREE_MODE_TEMPLATE = [
  '// FREE MOD MODE — every control is unlocked.',
  'string shipName = "Eclipse";',
  'string shipType = "wing";',
  'string backgroundColor = "blue";',
  'string enemy = "big-rock";',
  'string rockShape = "crystal";',
  'string weapon = "laser";',
  '',
  'int enemies = 6;',
  'int enemySpeed = 2;',
  'int laserPower = 2;',
  'int lives = 3;',
  'int scoreMultiplier = 1;',
  'int worldGravity = 0;',
  '',
  'bool shield = false;',
  'bool rapidFire = true;',
  'bool homing = false;',
  '',
  'Console.WriteLine("Pilot: " + shipName);',
  '',
  'if (score >= 300)',
  '{',
  '    enemySpeed = 4;',
  '}',
  '',
  'if (health <= 30)',
  '{',
  '    shield = true;',
  '}',
].join('\n');

export const MISSION_SANDBOX: Mission = {
  id: 'free',
  order: 8,
  code: 'FREE MOD MODE',
  title: 'Sandbox',
  kind: 'sandbox',
  brief: 'Every Mod you have discovered is unlocked. Break it, fix it, break it again.',
  action: 'Edit anything. The world updates as you type.',
  starter: FREE_MODE_TEMPLATE,
  additions: [],
  quickInsert: [
    'decl:shipType',
    'decl:backgroundColor',
    'decl:rockShape',
    'decl:shipName',
    'decl:enemy',
    'decl:enemies',
    'decl:enemySpeed',
    'decl:laserPower',
    'decl:lives',
    'decl:scoreMultiplier',
    'decl:worldGravity',
    'decl:shield',
    'decl:rapidFire',
    'decl:homing',
    'writeline',
    'if',
    'score',
    'health',
    'wave',
    'ge',
    'le',
    'eq',
  ],
  scenario: {},
  unlocks: [],
  requirements: [],
  playPrompt: 'PLAY IT.',
};

export const MISSIONS: Mission[] = [
  MISSION_M00,
  MISSION_M01,
  MISSION_M02,
  MISSION_M03,
  MISSION_M04,
  MISSION_M05,
  MISSION_M06,
  MISSION_FINAL,
  MISSION_SANDBOX,
];

export const LEARNING_MISSIONS = MISSIONS.filter((mission) => mission.kind === 'mission');
export const FREE_MODE_MISSION = MISSION_SANDBOX;
