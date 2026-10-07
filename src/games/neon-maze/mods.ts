import type { ModDefinition, CodeToolDefinition } from '../../mods/types';
import { createModSchema } from '../../interpreter/core/schema';

export interface MazeConfig {
  wallColor: string; runnerName: string; moveSpeed: number; sentinelCount: number;
  sentinelSpeed: number; shield: boolean; phaseLength: number; trail: boolean;
  coreValue: number; mazeSize: number; revealMap: boolean;
}
export const MAZE_DEFAULTS: MazeConfig = {
  wallColor: 'cyan', runnerName: 'Echo', moveSpeed: 4, sentinelCount: 1,
  sentinelSpeed: 1, shield: false, phaseLength: 2, trail: true,
  coreValue: 50, mazeSize: 7, revealMap: false,
};
export const MAZE_MODS: readonly ModDefinition<keyof MazeConfig>[] = [
  { id: 'wallColor', name: 'wallColor', type: 'string', label: 'NEON COLOR', blurb: 'Rewire the color of every maze wall.', example: 'string wallColor = "violet";', values: ['cyan', 'violet', 'lime', 'amber'], defaultValue: 'cyan', glyph: '◈', unlockAt: 0 },
  { id: 'runnerName', name: 'runnerName', type: 'string', label: 'RUNNER NAME', blurb: 'Your callsign on the signal feed.', example: 'string runnerName = "Aurora";', maxLength: 18, defaultValue: 'Echo', glyph: '✦', unlockAt: 1 },
  { id: 'moveSpeed', name: 'moveSpeed', type: 'int', label: 'MOVE SPEED', blurb: 'How quickly your runner crosses a corridor.', example: 'int moveSpeed = 4;', limits: { min: 1, max: 8 }, range: '1–8', defaultValue: 4, glyph: '»', unlockAt: 2 },
  { id: 'sentinelCount', name: 'sentinels', type: 'int', label: 'SENTINELS', blurb: 'How many hunters patrol the maze.', example: 'int sentinels = 3;', limits: { min: 0, max: 5 }, range: '0–5', defaultValue: 1, glyph: '◇', unlockAt: 3 },
  { id: 'sentinelSpeed', name: 'sentinelSpeed', type: 'int', label: 'HUNTER SPEED', blurb: 'The pace of the sentinel patrols.', example: 'int sentinelSpeed = 2;', limits: { min: 1, max: 4 }, range: '1–4', defaultValue: 1, glyph: '↝', unlockAt: 3 },
  { id: 'shield', name: 'shield', type: 'bool', label: 'SHIELD', blurb: 'Absorbs a hit, then recharges in eight seconds.', example: 'bool shield = true;', defaultValue: false, glyph: '⬡', unlockAt: 4 },
  { id: 'phaseLength', name: 'phaseLength', type: 'int', label: 'PHASE JUMP', blurb: 'Jump across up to this many tiles, even through walls.', example: 'int phaseLength = 2;', limits: { min: 1, max: 4 }, range: '1–4', defaultValue: 2, glyph: '↠', unlockAt: 4 },
  { id: 'trail', name: 'trail', type: 'bool', label: 'LIGHT TRAIL', blurb: 'Leave a glowing route behind your runner.', example: 'bool trail = true;', defaultValue: true, glyph: '⌁', unlockAt: 4 },
  { id: 'coreValue', name: 'coreValue', type: 'int', label: 'CORE VALUE', blurb: 'The points earned from each energy core.', example: 'int coreValue = 50;', limits: { min: 25, max: 100 }, range: '25–100', defaultValue: 50, glyph: '◆', unlockAt: 5 },
  { id: 'mazeSize', name: 'mazeSize', type: 'int', label: 'MAZE SIZE', blurb: 'The maze width. Applies when you restart or enter a new sector.', example: 'int mazeSize = 8;', limits: { min: 5, max: 9 }, range: '5–9', defaultValue: 7, glyph: '▦', unlockAt: 7 },
  { id: 'revealMap', name: 'revealMap', type: 'bool', label: 'REVEAL MAP', blurb: 'Light every corridor, including the unexplored ones.', example: 'bool revealMap = true;', defaultValue: false, glyph: '◉', unlockAt: 7 },
];
export const MAZE_RUNTIME_LABELS = {
  score: 'points collected', energy: 'runner integrity, 0–100', cores: 'cores collected in this sector',
  level: 'current sector', steps: 'tiles travelled',
};
export const mazeSchema = createModSchema(MAZE_MODS, Object.keys(MAZE_RUNTIME_LABELS));
export const MAZE_TOOLS: readonly CodeToolDefinition[] = [
  { id: 'maze-log', name: 'WriteLine', label: 'SIGNAL LOG', type: 'write', blurb: 'Send your callsign to the signal feed.', example: 'Console.WriteLine(runnerName);', glyph: '⌁', unlockAt: 1 },
  { id: 'maze-math', name: 'speedMath', label: 'SPEED MATH', type: 'int', blurb: 'Add two to your movement speed.', example: 'moveSpeed = moveSpeed + 2;', glyph: '+', unlockAt: 2 },
  { id: 'maze-score', name: 'scoreRule', label: 'CORE RULE', type: 'condition', blurb: 'Activate a shield after earning 100 points.', example: 'if (score >= 100)\n{\n    shield = true;\n}', glyph: '?', unlockAt: 5 },
  { id: 'maze-energy', name: 'energyRule', label: 'ESCAPE RULE', type: 'condition', blurb: 'Lengthen your phase jump when energy falls to 40.', example: 'if (energy <= 40)\n{\n    phaseLength = 4;\n}', glyph: '≤', unlockAt: 6 },
];
