import type { Expr, ProgramResult } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { YARD_DEFAULTS, YARD_MODS, YARD_RUNTIME_LABELS, type YardConfig } from './mods';
import type { YardSnapshot } from './run';

export interface YardMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const YARD_MISSIONS: readonly YardMission[] = [
  { id: 'm00', order: 0, title: 'BUILD YOUR WORLD', kind: 'mission', message: 'Your yard is ready to defend. Change worldTheme to "graveyard", "beach" or "winter" and watch the yard rebuild.', targetId: 'worldTheme' },
  { id: 'm01', order: 1, title: 'NAME YOUR WORKSHOP', kind: 'mission', message: 'Add WORKSHOP NAME and give your workshop a name of your own.', targetId: 'workshopName' },
  { id: 'm02', order: 2, title: 'SHARPEN THE MATH', kind: 'mission', message: 'Use BLADE DAMAGE and SHARPEN THE MATH to reach 30 damage with arithmetic.', targetId: 'bladeDamage' },
  { id: 'm03', order: 3, title: 'AUTOMATIC ENERGY', kind: 'mission', message: 'Add AUTO COLLECT set to true and let a battery bank itself.', targetId: 'autoCollect' },
  { id: 'm04', order: 4, title: 'STEEL TOOLBOXES', kind: 'mission', message: 'Set STEEL TOOLBOX to 2400 or more, then place a toolbox wall.', targetId: 'wallHealth' },
  { id: 'm05', order: 5, title: 'KILL STREAK', kind: 'mission', message: 'Add KILL STREAK. Defeat three zombies to switch on twin blades automatically.', targetId: 'yard-kills' },
  { id: 'm06', order: 6, title: 'WAVE RESPONSE', kind: 'mission', message: 'Add WAVE RESPONSE so overdrive kicks in from wave two.', targetId: 'yard-wave' },
  { id: 'final', order: 7, title: 'THE LAST WORKSHOP', kind: 'final', message: 'Keep your world, name, sharpened blades and a live rule, then clear a level.' },
  { id: 'free', order: 8, title: 'FREE PLAY', kind: 'sandbox', message: 'Your defense is ready to play. Add any mod from the library and feel the difference. Challenges are optional.' },
];
/** Students start with the three world remixes; every other mod is theirs to add. */
export const YARD_STARTER = YARD_MODS.slice(0, 3).map(m => `${m.type} ${m.name} = ${JSON.stringify(m.defaultValue)};`).join('\n');
export const YARD_SANDBOX = YARD_STARTER;
/** Example remix used to exercise advanced settings and live rules. */
export const YARD_REMIX = [
  'string worldTheme = "graveyard";', 'string workshopName = "Saw Society";', 'int bladeDamage = 20 + 10;', 'int chargeRate = 7;',
  'bool autoCollect = true;', 'bool doubleShot = false;', 'bool overdrive = false;', 'int wallHealth = 2400;', 'int zombieSpeed = 3;', 'int startingPower = 300;', 'bool quickHands = true;',
  'if (kills >= 3)', '{', '    doubleShot = true;', '}', 'if (wave >= 2)', '{', '    overdrive = true;', '}',
].join('\n');
export const getYardMission = (id?: string) => YARD_MISSIONS.find(m => m.id === id) ?? YARD_MISSIONS[0];
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
  const math = program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'bladeDamage' && s.value.kind === 'binary') || (s.kind === 'varDecl' && s.name === 'bladeDamage' && s.init.kind === 'binary'));
  const sharp = snapshot.config.bladeDamage >= 30 && math;
  switch (mission.id) {
    case 'm00': return c.worldTheme !== YARD_DEFAULTS.worldTheme;
    case 'm01': return c.workshopName.trim().length > 0 && c.workshopName !== YARD_DEFAULTS.workshopName;
    case 'm02': return sharp;
    case 'm03': return c.autoCollect && snapshot.metrics.collected > 0;
    case 'm04': return c.wallHealth >= 2400 && snapshot.metrics.walls > 0;
    case 'm05': return rule('kills', 'doubleShot');
    case 'm06': return rule('wave', 'overdrive');
    case 'final': return c.worldTheme !== YARD_DEFAULTS.worldTheme && c.workshopName !== YARD_DEFAULTS.workshopName && sharp
      && program.rules.some(r => Object.keys(YARD_RUNTIME_LABELS).some(name => reads(r.condition, name)) && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText))) && snapshot.metrics.clears > 0;
    default: return false;
  }
}
export function yardGuidance(mission: YardMission, program: ProgramResult<YardConfig>, snapshot: YardSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'Workshop saved. Keep remixing your defense.' : 'Challenge complete. Keep experimenting or try the next challenge.' };
  if (mission.id === 'm02' && program.symbols.some(s => s.mod === 'bladeDamage')) return { message: 'Add SHARPEN THE MATH, or write an expression that reaches 30 damage.', targetId: 'yard-math' };
  if (mission.id === 'm05' && program.rules.some(r => reads(r.condition, 'kills'))) return { message: `Defend your lanes. ${snapshot.metrics.kills}/3 zombies defeated; your twin-blade rule activates at three.` };
  return { message: mission.message, targetId: mission.targetId };
}
