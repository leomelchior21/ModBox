import type { ModDefinition, CodeToolDefinition } from '../../mods/types';
import { createModSchema } from '../../interpreter/core/schema';

export interface FloorConfig {
  suitColor: string; heroName: string; moveSpeed: number; jumpHeight: number;
  gravity: number; doubleJump: boolean; shield: boolean; safeFloor: boolean;
  meltDelay: number; crystalValue: number; lavaSpeed: number; checkpoints: boolean;
}
export const FLOOR_DEFAULTS: FloorConfig = {
  suitColor: 'amber', heroName: 'Ember', moveSpeed: 4, jumpHeight: 8,
  gravity: 12, doubleJump: false, shield: false, safeFloor: false,
  meltDelay: 3, crystalValue: 50, lavaSpeed: 1, checkpoints: true,
};
export const FLOOR_MODS: readonly ModDefinition<keyof FloorConfig>[] = [
  { id: 'suitColor', name: 'suitColor', type: 'string', label: 'SUIT COLOR', blurb: 'Color your explorer and their jump trail.', example: 'string suitColor = "violet";', values: ['amber', 'violet', 'cyan', 'lime'], defaultValue: 'amber', glyph: '◈', unlockAt: 0 },
  { id: 'heroName', name: 'heroName', type: 'string', label: 'HERO NAME', blurb: 'Your explorer’s callsign.', example: 'string heroName = "Phoenix";', maxLength: 18, defaultValue: 'Ember', glyph: '✦', unlockAt: 1 },
  { id: 'moveSpeed', name: 'moveSpeed', type: 'int', label: 'RUN SPEED', blurb: 'How fast you run and cross gaps.', example: 'int moveSpeed = 4;', limits: { min: 2, max: 8 }, range: '2–8', defaultValue: 4, glyph: '»', unlockAt: 2 },
  { id: 'jumpHeight', name: 'jumpHeight', type: 'int', label: 'JUMP HEIGHT', blurb: 'Launch higher to reach crystals and clear hazards.', example: 'int jumpHeight = 10;', limits: { min: 6, max: 14 }, range: '6–14', defaultValue: 8, glyph: '↑', unlockAt: 3 },
  { id: 'doubleJump', name: 'doubleJump', type: 'bool', label: 'DOUBLE JUMP', blurb: 'Release JUMP, then press it again in the air.', example: 'bool doubleJump = true;', defaultValue: false, glyph: '⇈', unlockAt: 4 },
  { id: 'shield', name: 'shield', type: 'bool', label: 'HEAT SHIELD', blurb: 'Absorb a spike or fireball hit. Recharges in eight seconds; lava still costs a life.', example: 'bool shield = true;', defaultValue: false, glyph: '⬡', unlockAt: 5 },
  { id: 'crystalValue', name: 'crystalValue', type: 'int', label: 'CRYSTAL VALUE', blurb: 'Points for each crystal you collect.', example: 'int crystalValue = 75;', limits: { min: 25, max: 100 }, range: '25–100', defaultValue: 50, glyph: '◆', unlockAt: 5 },
  { id: 'safeFloor', name: 'safeFloor', type: 'bool', label: 'STABLE FLOOR', blurb: 'Stop platforms from crumbling under your feet.', example: 'bool safeFloor = true;', defaultValue: false, glyph: '▰', unlockAt: 6 },
  { id: 'meltDelay', name: 'meltDelay', type: 'int', label: 'MELT TIMER', blurb: 'Seconds you can stand on a platform before it collapses.', example: 'int meltDelay = 4;', limits: { min: 1, max: 6 }, range: '1–6 seconds', defaultValue: 3, glyph: '◷', unlockAt: 6 },
  { id: 'gravity', name: 'gravity', type: 'int', label: 'GRAVITY', blurb: 'Tune how quickly you fall. Lower values give longer jumps.', example: 'int gravity = 10;', limits: { min: 6, max: 16 }, range: '6–16', defaultValue: 12, glyph: '↓', unlockAt: 7 },
  { id: 'lavaSpeed', name: 'lavaSpeed', type: 'int', label: 'FIREBALL SPEED', blurb: 'The rhythm of fireballs rising out of the lava.', example: 'int lavaSpeed = 2;', limits: { min: 1, max: 4 }, range: '1–4', defaultValue: 1, glyph: '≈', unlockAt: 7 },
  { id: 'checkpoints', name: 'checkpoints', type: 'bool', label: 'CHECKPOINTS', blurb: 'Save your route at illuminated beacons.', example: 'bool checkpoints = true;', defaultValue: true, glyph: '⚑', unlockAt: 7 },
];
export const FLOOR_RUNTIME_LABELS = {
  score: 'points collected', lives: 'lives remaining', gems: 'crystals collected this stage',
  height: 'height above the lava', stage: 'current cavern', jumps: 'jumps made this run',
};
export const floorSchema = createModSchema(FLOOR_MODS, Object.keys(FLOOR_RUNTIME_LABELS));
export const FLOOR_TOOLS: readonly CodeToolDefinition[] = [
  { id: 'floor-log', name: 'WriteLine', label: 'EXPEDITION LOG', type: 'write', blurb: 'Broadcast your hero’s name.', example: 'Console.WriteLine(heroName);', glyph: '⌁', unlockAt: 1 },
  { id: 'floor-math', name: 'speedMath', label: 'RUN MATH', type: 'int', blurb: 'Add two to your running speed.', example: 'moveSpeed = moveSpeed + 2;', glyph: '+', unlockAt: 2 },
  { id: 'floor-score', name: 'scoreRule', label: 'CRYSTAL DEFENSE', type: 'condition', blurb: 'Turn on your shield after collecting 100 points.', example: 'if (score >= 100)\n{\n    shield = true;\n}', glyph: '?', unlockAt: 5 },
  { id: 'floor-lives', name: 'livesRule', label: 'LAST LIFE RULE', type: 'condition', blurb: 'Stabilize the floor when only one life remains.', example: 'if (lives <= 1)\n{\n    safeFloor = true;\n}', glyph: '≤', unlockAt: 6 },
];
