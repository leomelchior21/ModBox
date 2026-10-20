import type { Expr, ProgramResult } from '../../interpreter/core/types';
import type { CopilotGuidance } from '../../mods/types';
import { FORGE_MODS, type ForgeConfig } from './mods';
import type { ForgeRun } from './run';

export interface ForgeMission { id: string; order: number; title: string; kind: 'mission' | 'final' | 'sandbox'; message: string; targetId?: string }
export const FORGE_MISSIONS: readonly ForgeMission[] = [
  { id: 'm00', order: 0, kind: 'mission', title: 'CHOOSE A FINISH', targetId: 'blockStyle', message: 'Add BLOCK FINISH and change blockStyle to glass. Your board is already playable: select a piece, then tap a tile.' },
  { id: 'm01', order: 1, kind: 'mission', title: 'SIGN YOUR WORK', targetId: 'playerName', message: 'Add YOUR SIGNATURE and give your forge a name. Strings can make a game your own.' },
  { id: 'm02', order: 2, kind: 'mission', title: 'MAKE IT COUNT', targetId: 'linePoints', message: 'Set LINE VALUE to 150 or more with arithmetic, such as 100 + 50.' },
  { id: 'm03', order: 3, kind: 'mission', title: 'A NEW ANGLE', targetId: 'rotations', message: 'Set TWIST IT to true. Select a piece and press ROTATE to try your new power.' },
  { id: 'm04', order: 4, kind: 'mission', title: 'A LITTLE GUIDANCE', targetId: 'showHints', message: 'Set FIND A FIT to true, then use HINT to reveal a legal placement.' },
  { id: 'm05', order: 5, kind: 'mission', title: 'ROOM TO RETHINK', targetId: 'allowUndo', message: 'Set SECOND CHANCE to true. Place a piece, then UNDO it. Your board and score both rewind.' },
  { id: 'm06', order: 6, kind: 'mission', title: 'LIGHT THE COMBO', targetId: 'forge-combo', message: 'Add COMBO ENGINE set to false and FIRE UP THE FORGE. Clear a line to activate your live rule.' },
  { id: 'final', order: 7, kind: 'final', title: 'MASTER OF THE FORGE', message: 'Keep your glass finish, name, arithmetic and executed combo rule. Clear three lines to master the forge.' },
  { id: 'free', order: 8, kind: 'sandbox', title: 'FREE PLAY', message: 'Your basic game is ready. Try TWIST IT, FIND A FIT or SECOND CHANCE, then play to feel the difference. Every mod is available; challenges are optional.' },
];
export const FORGE_STARTER = FORGE_MODS.map(m => `${m.type} ${m.name} = ${JSON.stringify(m.defaultValue)};`).join('\n');
export const FORGE_SANDBOX = FORGE_STARTER;
/** Example remix used to exercise advanced settings and live rules. */
export const FORGE_REMIX = 'string playerName = "Blocksmith";\nint linePoints = 100 + 50;\nbool rotations = true;\nbool showHints = true;\nbool allowUndo = true;\nbool comboBoost = false;\nstring blockStyle = "bevel";\nbool sparkles = true;\nif (lines >= 1)\n{\n    comboBoost = true;\n}';
export const getForgeMission = (id?: string) => FORGE_MISSIONS.find(m => m.id === id) ?? FORGE_MISSIONS[0];
function reads(expr: Expr, name: string): boolean { return expr.kind === 'identifier' ? expr.name === name : expr.kind === 'literal' ? false : expr.kind === 'unary' ? reads(expr.operand, name) : reads(expr.left, name) || reads(expr.right, name); }
export function forgeMissionPassed(mission: ForgeMission, program: ProgramResult<ForgeConfig>, run: ForgeRun): boolean {
  if (!program.ok || mission.kind === 'sandbox') return false;
  const arithmetic = program.ast.statements.some(s => s.kind === 'varDecl' && s.name === 'linePoints' && s.init.kind === 'binary' || s.kind === 'assign' && s.name === 'linePoints' && s.value.kind === 'binary');
  const rule = program.rules.some(r => reads(r.condition, 'lines') && r.actions.some(a => a.target === 'comboBoost') && run.metrics.ruleTraces.some(t => t.startsWith(r.conditionText) && t.includes('comboBoost'))) && run.config.comboBoost;
  switch (mission.id) {
    case 'm00': return run.config.blockStyle !== 'bevel';
    case 'm01': return run.config.playerName.trim().length > 0 && run.config.playerName !== 'Blocksmith';
    case 'm02': return run.config.linePoints >= 150 && arithmetic;
    case 'm03': return run.config.rotations && run.metrics.rotations > 0;
    case 'm04': return run.config.showHints && run.metrics.hints > 0;
    case 'm05': return run.config.allowUndo && run.metrics.undos > 0;
    case 'm06': return rule;
    case 'final': return run.config.blockStyle !== 'bevel' && run.config.playerName !== 'Blocksmith' && run.config.linePoints >= 150 && arithmetic && rule && run.lines >= 3;
    default: return false;
  }
}
export function forgeGuidance(mission: ForgeMission, passed: boolean): CopilotGuidance {
  return passed ? { message: mission.kind === 'final' ? 'Forge mastered! Keep remixing your game.' : 'Challenge complete. Keep experimenting or try the next challenge.' } : { message: mission.message, targetId: mission.targetId };
}
