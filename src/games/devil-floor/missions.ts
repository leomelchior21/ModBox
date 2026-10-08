import type { ProgramResult, Expr } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { FLOOR_DEFAULTS, FLOOR_MODS, FLOOR_RUNTIME_LABELS, type FloorConfig } from './mods';
import type { FloorSnapshot } from './run';

export interface FloorMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const FLOOR_MISSIONS: readonly FloorMission[] = [
  { id: 'm00', order: 0, title: 'SUIT UP', kind: 'mission', message: 'Change suitColor from "amber" to "violet", "cyan", or "lime". Your explorer changes instantly.', targetId: 'suitColor' },
  { id: 'm01', order: 1, title: 'NAME THE FLAME', kind: 'mission', message: 'Add HERO NAME, then EXPEDITION LOG to broadcast your callsign.', targetId: 'heroName' },
  { id: 'm02', order: 2, title: 'RUN THE NUMBERS', kind: 'mission', message: 'Add RUN SPEED and RUN MATH. Use arithmetic to reach moveSpeed 6 or more.', targetId: 'moveSpeed' },
  { id: 'm03', order: 3, title: 'LEAP OF FAITH', kind: 'mission', message: 'Set JUMP HEIGHT to 10 or more. Start the expedition and use SPACE or JUMP to leap.', targetId: 'jumpHeight' },
  { id: 'm04', order: 4, title: 'SECOND CHANCE', kind: 'mission', message: 'Enable DOUBLE JUMP. Jump, release, then jump again before landing.', targetId: 'doubleJump' },
  { id: 'm05', order: 5, title: 'CRYSTAL DEFENSE', kind: 'mission', message: 'Add CRYSTAL DEFENSE. Collect crystals until score reaches 100 and the shield activates.', targetId: 'floor-score' },
  { id: 'm06', order: 6, title: 'THE FLOOR FIGHTS BACK', kind: 'mission', message: 'Add LAST LIFE RULE. With one life left, your rule keeps the platforms stable.', targetId: 'floor-lives' },
  { id: 'final', order: 7, title: 'ESCAPE THE INFERNO', kind: 'final', message: 'Keep your name, suit color, speed, a boolean, a log and a live rule. Reach the far-right exit beacon.' },
  { id: 'free', order: 8, title: 'FREE MOD MODE', kind: 'sandbox', message: 'Every mod is unlocked. Tune the physics, conquer the cavern, and enter the next stage.' },
];
export const FLOOR_STARTER = 'string suitColor = "amber";';
export const FLOOR_SANDBOX = [
  'string suitColor = "violet";', 'string heroName = "Phoenix";', 'int moveSpeed = 6;',
  'int jumpHeight = 10;', 'int gravity = 12;', 'int meltDelay = 3;', 'int crystalValue = 50;', 'int lavaSpeed = 1;',
  'bool doubleJump = true;', 'bool shield = false;', 'bool safeFloor = false;', 'bool checkpoints = true;',
  'Console.WriteLine(heroName);', 'if (score >= 100)', '{', '    shield = true;', '}',
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
    case 'm00': return config.suitColor !== 'amber';
    case 'm01': return declares('heroName') && config.heroName !== 'Ember' && config.heroName.trim().length > 1 && program.comms.some(line => line.text.includes(config.heroName));
    case 'm02': return config.moveSpeed >= 6 && program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'moveSpeed' && s.value.kind === 'binary') || (s.kind === 'varDecl' && s.name === 'moveSpeed' && s.init.kind === 'binary'));
    case 'm03': return config.jumpHeight >= 10 && snapshot.metrics.jumps > 0;
    case 'm04': return config.doubleJump && snapshot.metrics.doubleJumps > 0;
    case 'm05': return liveRule('score', 'shield');
    case 'm06': return snapshot.metrics.minLives <= 1 && liveRule('lives', 'safeFloor');
    case 'final': return declares('heroName') && config.heroName.trim().length > 1 && declares('suitColor') && declares('moveSpeed')
      && program.symbols.some(s => s.type === 'bool') && program.comms.length > 0
      && program.rules.some(r => Object.keys(FLOOR_RUNTIME_LABELS).some(name => reads(r.condition, name))) && snapshot.metrics.exits > 0;
    default: return false;
  }
}
export function floorGuidance(mission: FloorMission, program: ProgramResult<FloorConfig>, snapshot: FloorSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'The exit is yours. Play the full game with every mod unlocked.' : 'Mission complete. Your next floor mod is ready.' };
  const config = { ...FLOOR_DEFAULTS, ...program.config };
  switch (mission.id) {
    case 'm01': if (program.symbols.some(s => s.mod === 'heroName')) return { message: 'Add EXPEDITION LOG to broadcast heroName.', targetId: 'floor-log' }; break;
    case 'm02': if (program.symbols.some(s => s.mod === 'moveSpeed')) return { message: 'Add RUN MATH, or write an expression to reach moveSpeed 6.', targetId: 'floor-math' }; break;
    case 'm03': if (config.jumpHeight >= 10) return { message: 'Start the expedition. Press SPACE or JUMP to test your new jump height.' }; break;
    case 'm04': if (config.doubleJump) return { message: 'Jump once, release the button, then jump again while airborne.' }; break;
    case 'm05': if (program.rules.some(r => reads(r.condition, 'score'))) return { message: 'Jump through crystals above the platforms. At 100 points your shield turns on.' }; break;
    case 'm06': if (program.rules.some(r => reads(r.condition, 'lives'))) return { message: `You have ${snapshot.lives} lives. At one life, your rule stabilizes the floor.` }; break;
  }
  return { message: mission.message, targetId: mission.targetId };
}
