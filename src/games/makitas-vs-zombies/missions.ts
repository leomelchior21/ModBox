import type { Expr, ProgramResult } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { YARD_DEFAULTS, YARD_MODS, YARD_RUNTIME_LABELS, type YardConfig } from './mods';
import type { YardSnapshot } from './run';

export interface YardMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const YARD_MISSIONS: readonly YardMission[] = [
  { id: 'm00', order: 0, title: 'BUILD THE SCENE', kind: 'mission', message: 'Start with an empty canvas. Add BUILD SCENERY and choose sunset or night to create your workshop.', targetId: 'background' },
  { id: 'm01', order: 1, title: 'LAY THE LANES', kind: 'mission', message: 'Add BUILD THE YARD: grass or concrete. Switch WORKSHOP PROPS on to add the finishing layer.', targetId: 'ground' },
  { id: 'm02', order: 2, title: 'OPEN THE TOOLBOX', kind: 'mission', message: 'Set ADD MACHINES to saws or full. Start building, select a saw, and deploy it on a lane.', targetId: 'toolbox' },
  { id: 'm03', order: 3, title: 'BRING THE INVASION', kind: 'mission', message: 'Set ADD ZOMBIES to worker or another type. Send a wave and defeat your first zombie. Each wave is saved.', targetId: 'zombieType' },
  { id: 'm04', order: 4, title: 'SHARPEN THE MATH', kind: 'mission', message: 'Use BLADE DAMAGE and SHARPEN THE MATH to reach 35 damage with arithmetic.', targetId: 'bladeDamage' },
  { id: 'm05', order: 5, title: 'AUTOMATIC ENERGY', kind: 'mission', message: 'Set POWER SUPPLY to 7 or more and AUTO COLLECT to true. Let a battery bank itself.', targetId: 'autoCollect' },
  { id: 'm06', order: 6, title: 'REACTIVE MACHINES', kind: 'mission', message: 'Add TWIN BLADES and KILL STREAK. Defeat three zombies to switch on twin shots. Try WAVE RESPONSE for overdrive too.', targetId: 'yard-kills' },
  { id: 'final', order: 7, title: 'THE LAST WORKSHOP', kind: 'final', message: 'Keep your scenery, lanes, props, tools, tuned damage and an activated live rule. Survive the third wave; retries resume your saved wave.' },
  { id: 'free', order: 8, title: 'FREE MOD MODE', kind: 'sandbox', message: 'Change the scene, machines and zombie types. Your wave checkpoints survive retries and leaving the game.' },
];
export const YARD_STARTER = 'string background = "none";';
export const YARD_SANDBOX = [
  'string background = "sunset";', 'string ground = "grass";', 'bool decorations = true;',
  'string toolbox = "full";', 'string zombieType = "mixed";',
  'string toolColor = "teal";', 'int bladeDamage = 25 + 10;', 'int chargeRate = 7;',
  'bool autoCollect = true;', 'bool doubleShot = false;', 'bool overdrive = false;', 'int barricadeHealth = 600;',
  'int zombieSpeed = 3;', 'int startingPower = 450;',
  'if (kills >= 3)', '{', '    doubleShot = true;', '}', 'if (wave >= 2)', '{', '    overdrive = true;', '}',
].join('\n');
export const getYardMission = (id?: string) => YARD_MISSIONS.find(m => m.id === id) ?? YARD_MISSIONS[0];
export function yardUnlocked(mission: YardMission, completed: readonly string[], free: boolean) {
  const order = Math.max(mission.order, ...YARD_MISSIONS.filter(m => completed.includes(m.id)).map(m => m.order));
  return YARD_MODS.filter(m => free || mission.kind === 'sandbox' || m.unlockAt <= order);
}
export function playableYardProgram(program: ProgramResult<YardConfig>, unlocked: readonly (keyof YardConfig)[]): ProgramResult<YardConfig> {
  return { ...program, config: Object.fromEntries(Object.entries(program.config).filter(([key]) => unlocked.includes(key as keyof YardConfig))),
    rules: program.rules.map(r => ({ ...r, actions: r.actions.filter(a => unlocked.includes(a.target)) })).filter(r => r.actions.length || r.writes.length) };
}
function reads(expr: Expr, name: string): boolean {
  if (expr.kind === 'identifier') return expr.name === name;
  if (expr.kind === 'literal') return false;
  if (expr.kind === 'unary') return reads(expr.operand, name);
  return reads(expr.left, name) || reads(expr.right, name);
}
export function yardMissionPassed(mission: YardMission, program: ProgramResult<YardConfig>, snapshot: YardSnapshot): boolean {
  if (!program.ok || mission.kind === 'sandbox') return false;
  const c = { ...YARD_DEFAULTS, ...program.config };
  const rule = (name: string, target: keyof YardConfig) => program.rules.some(r => reads(r.condition, name) && r.actions.some(a => a.target === target)
    && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes(target)));
  switch (mission.id) {
    case 'm00': return c.background !== 'none';
    case 'm01': return c.ground !== 'none' && c.decorations;
    case 'm02': return c.toolbox !== 'none' && snapshot.metrics.placed > 0;
    case 'm03': return c.zombieType !== 'none' && snapshot.metrics.kills > 0;
    case 'm04': return c.bladeDamage >= 35 && program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'bladeDamage' && s.value.kind === 'binary') || (s.kind === 'varDecl' && s.name === 'bladeDamage' && s.init.kind === 'binary'));
    case 'm05': return c.chargeRate >= 7 && c.autoCollect && snapshot.metrics.collected > 0;
    case 'm06': return rule('kills', 'doubleShot');
    case 'final': return c.background !== 'none' && c.ground !== 'none' && c.decorations && c.toolbox !== 'none' && c.zombieType !== 'none' && c.bladeDamage >= 35
      && program.rules.some(r => Object.keys(YARD_RUNTIME_LABELS).some(name => reads(r.condition, name)) && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText))) && snapshot.metrics.clears > 0;
    default: return false;
  }
}
export function yardGuidance(mission: YardMission, program: ProgramResult<YardConfig>, snapshot: YardSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'Workshop saved. Play the full game with every mod unlocked.' : 'Mission complete. Your next workshop mod is ready.' };
  if (mission.id === 'm01' && snapshot.config.ground !== 'none' && !snapshot.config.decorations) return { message: 'Switch WORKSHOP PROPS on to add your final scenery layer.', targetId: 'decorations' };
  if (mission.id === 'm04' && program.symbols.some(s => s.mod === 'bladeDamage')) return { message: 'Add SHARPEN THE MATH, or write an expression that reaches 35 damage.', targetId: 'yard-math' };
  if (mission.id === 'm06' && !program.symbols.some(s => s.mod === 'doubleShot')) return { message: 'Add TWIN BLADES set to false, then KILL STREAK can switch them on.', targetId: 'doubleShot' };
  if (mission.id === 'm06' && program.rules.some(r => reads(r.condition, 'kills'))) return { message: `Defend your lanes. ${snapshot.metrics.kills}/3 zombies defeated; your twin-blade rule activates at three.` };
  return { message: mission.message, targetId: mission.targetId };
}
