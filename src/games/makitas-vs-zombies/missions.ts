import type { Expr, ProgramResult } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { YARD_DEFAULTS, YARD_MODS, YARD_RUNTIME_LABELS, type YardConfig } from './mods';
import type { YardSnapshot } from './run';

export interface YardMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const YARD_MISSIONS: readonly YardMission[] = [
  { id: 'm00', order: 0, title: 'PICK YOUR PALETTE', kind: 'mission', message: 'Change toolColor from "teal" to "amber", "violet", or "lime". Your blade glow changes live.', targetId: 'toolColor' },
  { id: 'm01', order: 1, title: 'WORKSHOP RADIO', kind: 'mission', message: 'Add WORKSHOP NAME, choose a name, then add WORKSHOP RADIO to broadcast it.', targetId: 'workshopName' },
  { id: 'm02', order: 2, title: 'SHARPEN THE MATH', kind: 'mission', message: 'Add BLADE DAMAGE and SHARPEN THE MATH. Use arithmetic to reach 35 damage.', targetId: 'bladeDamage' },
  { id: 'm03', order: 3, title: 'POWER THE YARD', kind: 'mission', message: 'Set POWER SUPPLY to 7 or more. Deploy a tool and collect a glowing battery in the yard.', targetId: 'chargeRate' },
  { id: 'm04', order: 4, title: 'AUTOMATIC ENERGY', kind: 'mission', message: 'Set AUTO COLLECT to true. Start defending and let a battery bank itself.', targetId: 'autoCollect' },
  { id: 'm05', order: 5, title: 'KILL STREAK', kind: 'mission', message: 'Add TWIN BLADES, then KILL STREAK. Defeat three zombies to activate your rule.', targetId: 'doubleShot' },
  { id: 'm06', order: 6, title: 'WAVE RESPONSE', kind: 'mission', message: 'Add OVERDRIVE, then WAVE RESPONSE. Reach wave two to activate your rule.', targetId: 'overdrive' },
  { id: 'final', order: 7, title: 'THE LAST WORKSHOP', kind: 'final', message: 'Keep your custom name, color, damage, a boolean, radio log and live rule. Defend the workshop through all three waves.' },
  { id: 'free', order: 8, title: 'FREE MOD MODE', kind: 'sandbox', message: 'Every tool and mod is unlocked. Defend three waves, then face a harder night.' },
];
export const YARD_STARTER = 'string toolColor = "teal";';
export const YARD_SANDBOX = [
  'string toolColor = "teal";', 'string workshopName = "Saw Society";', 'int bladeDamage = 35;', 'int chargeRate = 7;',
  'bool autoCollect = true;', 'bool doubleShot = false;', 'bool overdrive = false;', 'int barricadeHealth = 600;',
  'int zombieSpeed = 3;', 'int startingPower = 450;', 'Console.WriteLine(workshopName);',
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
  const declares = (id: keyof YardConfig) => program.symbols.some(s => s.mod === id);
  const rule = (name: string, target: keyof YardConfig) => program.rules.some(r => reads(r.condition, name) && r.actions.some(a => a.target === target)
    && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes(target)));
  switch (mission.id) {
    case 'm00': return c.toolColor !== 'teal';
    case 'm01': return declares('workshopName') && c.workshopName !== YARD_DEFAULTS.workshopName && c.workshopName.trim().length > 1 && program.comms.some(l => l.text.includes(c.workshopName));
    case 'm02': return c.bladeDamage >= 35 && program.ast.statements.some(s => (s.kind === 'assign' && s.name === 'bladeDamage' && s.value.kind === 'binary') || (s.kind === 'varDecl' && s.name === 'bladeDamage' && s.init.kind === 'binary'));
    case 'm03': return c.chargeRate >= 7 && snapshot.metrics.placed > 0 && snapshot.metrics.collected > 0;
    case 'm04': return c.autoCollect && snapshot.metrics.collected > 0;
    case 'm05': return rule('kills', 'doubleShot');
    case 'm06': return rule('wave', 'overdrive');
    case 'final': return declares('workshopName') && c.workshopName.trim().length > 1 && declares('toolColor') && declares('bladeDamage')
      && program.symbols.some(s => s.type === 'bool') && program.comms.length > 0
      && program.rules.some(r => Object.keys(YARD_RUNTIME_LABELS).some(name => reads(r.condition, name)) && snapshot.metrics.ruleTraces.some(t => t.startsWith(r.conditionText))) && snapshot.metrics.clears > 0;
    default: return false;
  }
}
export function yardGuidance(mission: YardMission, program: ProgramResult<YardConfig>, snapshot: YardSnapshot, passed: boolean): CopilotGuidance {
  if (passed) return { message: mission.kind === 'final' ? 'Workshop saved. Play the full game with every mod unlocked.' : 'Mission complete. Your next workshop mod is ready.' };
  const c = { ...YARD_DEFAULTS, ...program.config };
  if (mission.id === 'm01' && program.symbols.some(s => s.mod === 'workshopName')) return { message: 'Add WORKSHOP RADIO to broadcast workshopName.', targetId: 'yard-log' };
  if (mission.id === 'm02' && program.symbols.some(s => s.mod === 'bladeDamage')) return { message: 'Add SHARPEN THE MATH, or write an expression that reaches 35 damage.', targetId: 'yard-math' };
  if (mission.id === 'm03' && c.chargeRate >= 7) return { message: 'Start defending. Select a saw or charger, tap an empty tile, then collect a glowing battery.' };
  if (mission.id === 'm04' && c.autoCollect) return { message: 'Start defending. The next battery will bank itself.' };
  if (mission.id === 'm05' && program.symbols.some(s => s.mod === 'doubleShot') && !program.rules.length) return { message: 'Add KILL STREAK to turn on twin blades after three defeats.', targetId: 'yard-kills' };
  if (mission.id === 'm06' && program.symbols.some(s => s.mod === 'overdrive') && !program.rules.some(r => reads(r.condition, 'wave'))) return { message: 'Add WAVE RESPONSE to engage overdrive from wave two.', targetId: 'yard-wave' };
  if (mission.id === 'm05' && program.rules.length) return { message: `Deploy saws in the threatened lanes. ${snapshot.metrics.kills}/3 zombies defeated.` };
  if (mission.id === 'm06' && program.rules.length) return { message: `Keep defending. Your overdrive rule activates in wave two. Current wave: ${snapshot.wave}.` };
  return { message: mission.message, targetId: mission.targetId };
}
