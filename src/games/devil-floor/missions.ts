import type { ProgramResult, Expr } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { FLOOR_DEFAULTS, FLOOR_MODS, FLOOR_RUNTIME_LABELS, type FloorConfig } from './mods';
import type { FloorSnapshot } from './run';

export interface FloorMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const FLOOR_MISSIONS: readonly FloorMission[] = [
  { id: 'm00', order: 0, title: 'BUILD THE WORLD', kind: 'mission', message: 'One island in an empty world. Add BUILD BACKDROP and choose cathedral, volcano or crystal.', targetId: 'background' },
  { id: 'm01', order: 1, title: 'A PATH FORWARD', kind: 'mission', message: 'Add BUILD PLATFORMS. Set platforms to 6 or more and watch a route appear beyond your island.', targetId: 'platforms' },
  { id: 'm02', order: 2, title: 'LIVING PLATFORMS', kind: 'mission', message: 'Set PLATFORM EFFECT to glow or crumble. Glow lights the edges; crumble makes standing still dangerous.', targetId: 'platformEffect' },
  { id: 'm03', order: 3, title: 'LEAP OF FAITH', kind: 'mission', message: 'Set JUMP HEIGHT to 10 or more, then jump across your new route.', targetId: 'jumpHeight' },
  { id: 'm04', order: 4, title: 'RUN THE NUMBERS', kind: 'mission', message: 'Add RUN SPEED and RUN MATH. Use arithmetic to reach moveSpeed 6 or more.', targetId: 'moveSpeed' },
  { id: 'm05', order: 5, title: 'SECOND CHANCE', kind: 'mission', message: 'Enable DOUBLE JUMP. Jump, release, then jump again before landing.', targetId: 'doubleJump' },
  { id: 'm06', order: 6, title: 'CRYSTAL DEFENSE', kind: 'mission', message: 'Add HEAT SHIELD set to false, then CRYSTAL DEFENSE. Collect 100 points to activate the shield.', targetId: 'floor-score' },
  { id: 'final', order: 7, title: 'YOUR INFERNO', kind: 'final', message: 'Build a backdrop and 6+ platforms, choose a platform effect, day or night, and a fireball style. Keep a live rule and reach your exit.' },
  { id: 'free', order: 8, title: 'FREE MOD MODE', kind: 'sandbox', message: 'Build anything. Change the scenery, platform count, physics, lighting and fireballs, then explore the next cavern.' },
];
export const FLOOR_STARTER = 'string background = "none";';
export const FLOOR_SANDBOX = [
  'string background = "cathedral";', 'int platforms = 14;', 'string platformEffect = "glow";',
  'string timeOfDay = "night";', 'string fireballStyle = "fire";',
  'string suitColor = "violet";', 'int moveSpeed = 4 + 2;', 'int jumpHeight = 10;',
  'int gravity = 12;', 'int meltDelay = 3;', 'int crystalValue = 50;', 'int lavaSpeed = 1;',
  'bool doubleJump = true;', 'bool shield = false;', 'bool safeFloor = false;', 'bool checkpoints = true;',
  'if (score >= 100)', '{', '    shield = true;', '}',
  'if (lives <= 1)', '{', '    safeFloor = true;', '}',
].join('\n');
export const getFloorMission = (id?: string) => FLOOR_MISSIONS.find(m => m.id === id) ?? FLOOR_MISSIONS[0];
export function floorUnlocked(mission: FloorMission, completed: readonly string[], free: boolean) {
  const order = Math.max(mission.order, ...FLOOR_MISSIONS.filter(m => completed.includes(m.id)).map(m => m.order));
  return FLOOR_MODS.filter(mod => free || mission.kind === 'sandbox' || mod.unlockAt <= order);
}
export function playableFloorProgram(program: ProgramResult<FloorConfig>, unlocked: readonly (keyof FloorConfig)[]): ProgramResult<FloorConfig> {
  return { ...program, config: Object.fromEntries(Object.entries(program.config).filter(([key]) => unlocked.includes(key as keyof FloorConfig))),
    rules: program.rules.map(rule => ({ ...rule, actions: rule.actions.filter(a => unlocked.includes(a.target)) })).filter(rule => rule.actions.length || rule.writes.length) };
}
function reads(expr: Expr, name: string): boolean {
  if (expr.kind === 'identifier') return expr.name === name;
  if (expr.kind === 'literal') return false;
  if (expr.kind === 'unary') return reads(expr.operand, name);
  return reads(expr.left, name) || reads(expr.right, name);
}
export function floorMissionPassed(mission: FloorMission, program: ProgramResult<FloorConfig>, snapshot: FloorSnapshot): boolean {
  if (!program.ok || mission.kind === 'sandbox') return false;
  const config = { ...FLOOR_DEFAULTS, ...program.config };
  const declares = (id: keyof FloorConfig) => program.symbols.some(s => s.mod === id);
  const liveRule = (name: string, target: keyof FloorConfig) => program.rules.some(r => reads(r.condition, name)
    && r.actions.some(a => a.target === target) && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes(target)));
  switch (mission.id) {
    case 'm00': return config.background !== 'none';
    case 'm01': return declares('platforms') && config.platforms >= 6;
    case 'm02': return declares('platformEffect') && config.platformEffect !== 'none';
    case 'm03': return config.jumpHeight >= 10 && snapshot.metrics.jumps > 0;
    case 'm04': return config.moveSpeed >= 6 && program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'moveSpeed' && s.value.kind === 'binary') || (s.kind === 'varDecl' && s.name === 'moveSpeed' && s.init.kind === 'binary'));
    case 'm05': return config.doubleJump && snapshot.metrics.doubleJumps > 0;
    case 'm06': return liveRule('score', 'shield');
    case 'final': return config.background !== 'none' && config.platforms >= 6 && config.platformEffect !== 'none'
      && declares('timeOfDay') && declares('fireballStyle') && config.fireballStyle !== 'none'
      && program.rules.some(r => Object.keys(FLOOR_RUNTIME_LABELS).some(name => reads(r.condition, name)) && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText))) && snapshot.metrics.exits > 0;
    default: return false;
  }
}
export function floorGuidance(mission: FloorMission, program: ProgramResult<FloorConfig>, snapshot: FloorSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'The exit is yours. Play the full game with every mod unlocked.' : 'Mission complete. Your next floor mod is ready.' };
  if (mission.id === 'm04' && program.symbols.some(s => s.mod === 'moveSpeed')) return { message: 'Add RUN MATH, or use an expression to reach moveSpeed 6.', targetId: 'floor-math' };
  if (mission.id === 'm05' && snapshot.config.doubleJump) return { message: 'Jump once, release, then press JUMP again while airborne.' };
  if (mission.id === 'm06' && !program.symbols.some(s => s.mod === 'shield')) return { message: 'Add HEAT SHIELD set to false, then add CRYSTAL DEFENSE.', targetId: 'shield' };
  if (mission.id === 'm06' && program.rules.some(r => reads(r.condition, 'score'))) return { message: 'Jump through crystals. At 100 points your heat shield turns on.' };
  return { message: mission.message, targetId: mission.targetId };
}
