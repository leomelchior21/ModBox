import type { Expr, ProgramResult } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { YARD_DEFAULTS, YARD_MODS, YARD_RUNTIME_LABELS, type YardConfig } from './mods';
import type { YardSnapshot } from './run';

export interface YardMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const YARD_MISSIONS: readonly YardMission[] = [
  { id: 'm00', order: 0, title: 'BUILD THE SCENE', kind: 'mission', message: 'Your workshop is ready. Try changing BUILD SCENERY from sunset to night to see the difference.', targetId: 'background' },
  { id: 'm01', order: 1, title: 'LAY THE LANES', kind: 'mission', message: 'Change BUILD THE YARD to concrete and keep WORKSHOP PROPS on.', targetId: 'ground' },
  { id: 'm02', order: 2, title: 'OPEN THE TOOLBOX', kind: 'mission', message: 'Your toolbox is ready. Select a saw and deploy it on a lane. Try barriers and frost saws too.', targetId: 'toolbox' },
  { id: 'm03', order: 3, title: 'BRING THE INVASION', kind: 'mission', message: 'Try another type in ADD ZOMBIES, send a wave and defeat one. Each wave is saved.', targetId: 'zombieType' },
  { id: 'm04', order: 4, title: 'SHARPEN THE MATH', kind: 'mission', message: 'Use BLADE DAMAGE and SHARPEN THE MATH to reach 35 damage with arithmetic.', targetId: 'bladeDamage' },
  { id: 'm05', order: 5, title: 'AUTOMATIC ENERGY', kind: 'mission', message: 'Set POWER SUPPLY to 7 or more and AUTO COLLECT to true. Let a battery bank itself.', targetId: 'autoCollect' },
  { id: 'm06', order: 6, title: 'REACTIVE MACHINES', kind: 'mission', message: 'Add TWIN BLADES and KILL STREAK. Defeat three zombies to switch on twin shots. Try WAVE RESPONSE for overdrive too.', targetId: 'yard-kills' },
  { id: 'final', order: 7, title: 'THE LAST WORKSHOP', kind: 'final', message: 'Keep your scenery, lanes, props, tools, tuned damage and an activated live rule. Survive the third wave; retries resume your saved wave.' },
  { id: 'free', order: 8, title: 'FREE PLAY', kind: 'sandbox', message: 'Your basic defense is ready. Try TWIN BLADES, AUTO COLLECT or another zombie type and see the difference. Every mod is available; challenges are optional.' },
];
export const YARD_STARTER = YARD_MODS.map(m => `${m.type} ${m.name} = ${JSON.stringify(m.defaultValue)};`).join('\n');
export const YARD_SANDBOX = YARD_STARTER;
/** Example remix used to exercise advanced settings and live rules. */
export const YARD_REMIX = [
  'string background = "sunset";', 'string ground = "grass";', 'bool decorations = true;',
  'string toolbox = "full";', 'string zombieType = "mixed";',
  'string toolColor = "teal";', 'int bladeDamage = 25 + 10;', 'int chargeRate = 7;',
  'bool autoCollect = true;', 'bool doubleShot = false;', 'bool overdrive = false;', 'int barricadeHealth = 600;',
  'int zombieSpeed = 3;', 'int startingPower = 450;',
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
  switch (mission.id) {
    case 'm00': return c.background === 'night';
    case 'm01': return c.ground === 'concrete' && c.decorations;
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
  if (passed) return { message: mission.kind === 'final' ? 'Workshop saved. Keep remixing your defense.' : 'Challenge complete. Keep experimenting or try the next challenge.' };
  if (mission.id === 'm01' && snapshot.config.ground !== 'none' && !snapshot.config.decorations) return { message: 'Switch WORKSHOP PROPS on to add your final scenery layer.', targetId: 'decorations' };
  if (mission.id === 'm04' && program.symbols.some(s => s.mod === 'bladeDamage')) return { message: 'Add SHARPEN THE MATH, or write an expression that reaches 35 damage.', targetId: 'yard-math' };
  if (mission.id === 'm06' && !program.symbols.some(s => s.mod === 'doubleShot')) return { message: 'Add TWIN BLADES set to false, then KILL STREAK can switch them on.', targetId: 'doubleShot' };
  if (mission.id === 'm06' && program.rules.some(r => reads(r.condition, 'kills'))) return { message: `Defend your lanes. ${snapshot.metrics.kills}/3 zombies defeated; your twin-blade rule activates at three.` };
  return { message: mission.message, targetId: mission.targetId };
}
