import type { ProgramResult, Expr } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { MAZE_DEFAULTS, MAZE_MODS, MAZE_RUNTIME_LABELS, type MazeConfig } from './mods';
import type { MazeSnapshot } from './run';

export interface MazeMission {
  id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox';
  message: string; targetId?: string;
}
export const MAZE_MISSIONS: readonly MazeMission[] = [
  { id: 'm00', order: 0, title: 'LIGHT THE GRID', kind: 'mission', message: 'Change wallColor from "cyan" to "violet", "lime", or "amber". Your maze changes instantly.', targetId: 'wallColor' },
  { id: 'm01', order: 1, title: 'YOUR SIGNAL', kind: 'mission', message: 'Add a RUNNER NAME, then SIGNAL LOG to broadcast it.', targetId: 'runnerName' },
  { id: 'm02', order: 2, title: 'OVERCLOCK', kind: 'mission', message: 'Add MOVE SPEED, then SPEED MATH. Reach speed 6 or more with an arithmetic expression.', targetId: 'moveSpeed' },
  { id: 'm03', order: 3, title: 'THE HUNT', kind: 'mission', message: 'Add at least 3 SENTINELS. Enter the maze and collect one amber core.', targetId: 'sentinelCount' },
  { id: 'm04', order: 4, title: 'PHASE SHIFT', kind: 'mission', message: 'Add SHIELD and set it to true. Use SPACE or PHASE to jump along a corridor or through a wall.', targetId: 'shield' },
  { id: 'm05', order: 5, title: 'AUTOMATIC DEFENSE', kind: 'mission', message: 'Add CORE RULE. Collect cores until your score reaches 100 and your rule activates.', targetId: 'maze-score' },
  { id: 'm06', order: 6, title: 'EMERGENCY ROUTE', kind: 'mission', message: 'Add ESCAPE RULE. Let a sentinel reduce energy to 40 or less; your phase jump becomes stronger.', targetId: 'maze-energy' },
  { id: 'final', order: 7, title: 'BUILD YOUR LABYRINTH', kind: 'final', message: 'Keep your name, color, tuned speed, a boolean switch, a signal log and a live rule. Collect all 3 cores and reach the glowing exit.' },
  { id: 'free', order: 8, title: 'FREE MOD MODE', kind: 'sandbox', message: 'All mods unlocked. Build your maze, find the exit, and explore the next sector.' },
];
export const MAZE_STARTER = 'string wallColor = "cyan";';
export const MAZE_SANDBOX = [
  'string wallColor = "violet";', 'string runnerName = "Aurora";',
  'int moveSpeed = 6;', 'int sentinels = 2;', 'int sentinelSpeed = 1;',
  'int phaseLength = 3;', 'int coreValue = 50;', 'int mazeSize = 7;',
  'bool shield = false;', 'bool trail = true;', 'bool revealMap = true;',
  'Console.WriteLine(runnerName);',
  'if (score >= 100)', '{', '    shield = true;', '}',
  'if (energy <= 40)', '{', '    phaseLength = 4;', '}',
].join('\n');
export const getMazeMission = (id?: string) => MAZE_MISSIONS.find(m => m.id === id) ?? MAZE_MISSIONS[0];
export function mazeUnlocked(mission: MazeMission, completed: readonly string[], free: boolean) {
  const order = Math.max(mission.order, ...MAZE_MISSIONS.filter(m => completed.includes(m.id)).map(m => m.order));
  return MAZE_MODS.filter(mod => free || mission.kind === 'sandbox' || mod.unlockAt <= order);
}
export function playableMazeProgram(program: ProgramResult<MazeConfig>, unlocked: readonly (keyof MazeConfig)[]): ProgramResult<MazeConfig> {
  return { ...program, config: Object.fromEntries(Object.entries(program.config).filter(([key]) => unlocked.includes(key as keyof MazeConfig))),
    rules: program.rules.map(rule => ({ ...rule, actions: rule.actions.filter(a => unlocked.includes(a.target)) })).filter(rule => rule.actions.length || rule.writes.length) };
}
function arithmetic(expr: Expr): boolean {
  if (expr.kind === 'binary') return true;
  if (expr.kind === 'unary') return arithmetic(expr.operand);
  if (expr.kind === 'logical' || expr.kind === 'compare') return arithmetic(expr.left) || arithmetic(expr.right);
  return false;
}
function reads(expr: Expr, name: string): boolean {
  if (expr.kind === 'identifier') return expr.name === name;
  if (expr.kind === 'literal') return false;
  if (expr.kind === 'unary') return reads(expr.operand, name);
  return reads(expr.left, name) || reads(expr.right, name);
}
export function mazeMissionPassed(mission: MazeMission, program: ProgramResult<MazeConfig>, snapshot: MazeSnapshot): boolean {
  if (!program.ok || mission.kind === 'sandbox') return false;
  const config = { ...MAZE_DEFAULTS, ...program.config };
  const declares = (id: keyof MazeConfig) => program.symbols.some(s => s.mod === id);
  switch (mission.id) {
    case 'm00': return config.wallColor !== 'cyan';
    case 'm01': return declares('runnerName') && config.runnerName !== 'Echo' && config.runnerName.trim().length > 1 && program.comms.some(line => line.text.includes(config.runnerName));
    case 'm02': return config.moveSpeed >= 6 && program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'moveSpeed' && arithmetic(s.value)) || (s.kind === 'varDecl' && s.name === 'moveSpeed' && arithmetic(s.init)));
    case 'm03': return config.sentinelCount >= 3 && snapshot.metrics.cores >= 1;
    case 'm04': return config.shield && snapshot.metrics.phases >= 1;
    case 'm05': return program.rules.some(r => reads(r.condition, 'score') && r.actions.some(a => a.target === 'shield') && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes('shield')));
    case 'm06': return snapshot.metrics.minEnergy <= 40 && program.rules.some(r => reads(r.condition, 'energy') && r.actions.some(a => a.target === 'phaseLength') && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes('phaseLength')));
    case 'final': return declares('runnerName') && config.runnerName.trim().length > 1 && declares('wallColor') && declares('moveSpeed') && program.symbols.some(s => s.type === 'bool') && program.comms.length > 0 && program.rules.some(r => Object.keys(MAZE_RUNTIME_LABELS).some(name => reads(r.condition, name))) && snapshot.metrics.exits >= 1;
    default: return false;
  }
}
export function mazeGuidance(mission: MazeMission, program: ProgramResult<MazeConfig>, snapshot: MazeSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'Your maze is ready. Play the full game and mod anything.' : 'Mission complete. Your next maze mod is ready.' };
  const config = { ...MAZE_DEFAULTS, ...program.config };
  switch (mission.id) {
    case 'm01': if (program.symbols.some(s => s.mod === 'runnerName')) return { message: 'Add SIGNAL LOG to broadcast your runnerName.', targetId: 'maze-log' }; break;
    case 'm02': if (program.symbols.some(s => s.mod === 'moveSpeed')) return { message: 'Add SPEED MATH, or write your own expression to reach moveSpeed 6.', targetId: 'maze-math' }; break;
    case 'm03': if (config.sentinelCount >= 3) return { message: 'Steer through the maze. Collect one amber core while avoiding the sentinel squad.' }; break;
    case 'm04': if (config.shield) return { message: 'Use SPACE or PHASE to jump. Aim along a corridor or across a single wall.' }; break;
    case 'm05': if (program.rules.some(r => r.conditionText.includes('score'))) return { message: 'Collect two amber cores. Watch your shield switch on when score reaches 100.' }; break;
    case 'm06': if (program.rules.some(r => r.conditionText.includes('energy'))) return { message: `Energy is ${snapshot.energy}%. Cross a sentinel’s path; at 40 or less, your escape rule boosts PHASE.` }; break;
  }
  return { message: mission.message, targetId: mission.targetId };
}
