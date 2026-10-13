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
  { id: 'm01', order: 1, title: 'BUILD THE CHASE', kind: 'mission', message: 'Add SENTINELS and set the number to 3 or more. Start rolling: your new hunters follow you through the corridors.', targetId: 'sentinelCount' },
  { id: 'm02', order: 2, title: 'OVERCLOCK', kind: 'mission', message: 'Add MOVE SPEED, then SPEED MATH. Reach speed 6 or more with an arithmetic expression.', targetId: 'moveSpeed' },
  { id: 'm03', order: 3, title: 'THE HUNT', kind: 'mission', message: 'Collect an amber gem, then touch a stunned sentinel to catch it for 100 points. GEM STUN gives you more time.', targetId: 'gemDuration' },
  { id: 'm04', order: 4, title: 'PHASE SHIFT', kind: 'mission', message: 'Set PHASE JUMP to 3 or more. Use SPACE or PHASE and watch your ball leap through the wall.', targetId: 'phaseLength' },
  { id: 'm05', order: 5, title: 'LIGHT UP THE ROOM', kind: 'mission', message: 'Set ROOM LIGHTS (revealMap) to true. The dark radius disappears and the whole room becomes visible.', targetId: 'revealMap' },
  { id: 'm06', order: 6, title: 'AUTOMATIC DEFENSE', kind: 'mission', message: 'Keep shield false, then add GEM RULE. Reach 100 points to turn the shield on automatically.', targetId: 'maze-score' },
  { id: 'final', order: 7, title: 'BUILD YOUR LABYRINTH', kind: 'final', message: 'Keep your color, tuned speed, sentinels, room lights and a live rule. Collect all 3 gems and roll through the glowing exit.' },
  { id: 'free', order: 8, title: 'FREE MOD MODE', kind: 'sandbox', message: 'All mods unlocked. Tune your maze, collect dots and stun gems, and keep rolling into new sectors.' },
];
export const MAZE_STARTER = 'string wallColor = "cyan";';
export const MAZE_SANDBOX = [
  'string wallColor = "violet";', 'string runnerName = "Aurora";',
  'int moveSpeed = 6;', 'int sentinels = 2;', 'int sentinelSpeed = 1;',
  'int phaseLength = 3;', 'int coreValue = 50;', 'int gemDuration = 6;', 'int mazeSize = 7;',
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
    case 'm01': return declares('sentinelCount') && config.sentinelCount >= 3 && snapshot.metrics.steps > 0;
    case 'm02': return config.moveSpeed >= 6 && program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'moveSpeed' && arithmetic(s.value)) || (s.kind === 'varDecl' && s.name === 'moveSpeed' && arithmetic(s.init)));
    case 'm03': return config.sentinelCount >= 1 && snapshot.metrics.cores >= 1 && snapshot.metrics.catches >= 1;
    case 'm04': return config.phaseLength >= 3 && snapshot.metrics.phases >= 1;
    case 'm06': return program.rules.some(r => reads(r.condition, 'score') && r.actions.some(a => a.target === 'shield') && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes('shield')));
    case 'm05': return declares('revealMap') && config.revealMap;
    case 'final': return declares('wallColor') && declares('moveSpeed') && config.sentinelCount >= 1 && config.revealMap && program.rules.some(r => Object.keys(MAZE_RUNTIME_LABELS).some(name => reads(r.condition, name)) && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText))) && snapshot.metrics.exits >= 1;
    default: return false;
  }
}
export function mazeGuidance(mission: MazeMission, program: ProgramResult<MazeConfig>, snapshot: MazeSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'Your maze is ready. Play the full game and mod anything.' : 'Mission complete. Your next maze mod is ready.' };
  if (mission.id === 'm02' && program.symbols.some(s => s.mod === 'moveSpeed')) return { message: 'Add SPEED MATH, or write an expression to reach moveSpeed 6.', targetId: 'maze-math' };
  if (mission.id === 'm03' && snapshot.stunRemaining > 0) return { message: 'Chase the pale sentinels now! Touch one before the stun timer runs out.' };
  if (mission.id === 'm06' && !program.symbols.some(s => s.mod === 'shield')) return { message: 'Add SHIELD set to false. Then GEM RULE can switch it on for you.', targetId: 'shield' };
  if (mission.id === 'm06' && program.rules.some(r => reads(r.condition, 'score'))) return { message: 'Collect dots and gems. At 100 points, your shield switches on.' };
  return { message: mission.message, targetId: mission.targetId };
}
