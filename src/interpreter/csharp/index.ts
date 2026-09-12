import type { GameConfig, ProgramResult } from '../core/types';
import type { LanguageAdapter, QuickInsertToken } from '../core/adapter';
import { LANGUAGES } from '../core/adapter';
import { parseSource } from './parser';
import { bindProgram } from './binder';

/* ============================================================================
   MODBOX — C# ADAPTER
   Student Code → (tokenize → parse → bind) → ProgramResult
   The rest of MODBOX only ever sees ProgramResult, never C# syntax.
   ========================================================================== */

export function parseCSharp(source: string): ProgramResult {
  const { ast, diagnostics } = parseSource(source);
  const bound = bindProgram(ast, source, diagnostics);
  const ok = !diagnostics.some((diagnostic) => diagnostic.severity === 'error');

  return {
    ok,
    ast,
    source,
    diagnostics,
    notices: bound.notices,
    symbols: bound.symbols,
    config: bound.config as Partial<GameConfig>,
    rules: bound.rules,
    comms: bound.comms,
  };
}

/* ------------------------------------------------------------- insert helpers */

interface ChipToken extends QuickInsertToken {
  id: string;
}

const ALL_CHIPS: ChipToken[] = [
  { id: 'string', label: 'string', insert: 'string ', hint: 'Text in quotes', group: 'type' },
  { id: 'int', label: 'int', insert: 'int ', hint: 'Whole numbers', group: 'type' },
  { id: 'bool', label: 'bool', insert: 'bool ', hint: 'true or false', group: 'type' },
  { id: 'true', label: 'true', insert: 'true', group: 'value' },
  { id: 'false', label: 'false', insert: 'false', group: 'value' },
  {
    id: 'writeline',
    label: 'Console.WriteLine()',
    insert: 'Console.WriteLine("READY");',
    caretBack: 3,
    hint: 'Send a message to Flight Log',
    group: 'action',
  },
  {
    id: 'if',
    label: 'if',
    insert: 'if (score >= 300)\n{\n    \n}',
    caretBack: 2,
    hint: 'React while playing',
    group: 'logic',
  },
  { id: 'ge', label: '>=', insert: ' >= ', group: 'logic' },
  { id: 'le', label: '<=', insert: ' <= ', group: 'logic' },
  { id: 'eq', label: '==', insert: ' == ', group: 'logic' },
  { id: 'plus', label: '+', insert: ' + ', group: 'logic' },
  { id: 'minus', label: '-', insert: ' - ', group: 'logic' },
  { id: 'times', label: '*', insert: ' * ', group: 'logic' },
  { id: 'score', label: 'score', insert: 'score', hint: 'live score', group: 'logic' },
  { id: 'health', label: 'health', insert: 'health', hint: 'live ship integrity', group: 'logic' },
  { id: 'wave', label: 'wave', insert: 'wave', hint: 'live wave number', group: 'logic' },
  { id: 'enemiesRemaining', label: 'enemiesRemaining', insert: 'enemiesRemaining', group: 'logic' },
  { id: 'decl:shipName', label: 'shipName', insert: 'string shipName = "Nova";', group: 'mod' },
  { id: 'decl:enemy', label: 'enemy', insert: 'string enemy = "big-rock";', group: 'mod' },
  { id: 'decl:enemies', label: 'enemies', insert: 'int enemies = 5;', group: 'mod' },
  { id: 'decl:enemySpeed', label: 'enemySpeed', insert: 'int enemySpeed = 2;', group: 'mod' },
  { id: 'decl:laserPower', label: 'laserPower', insert: 'int laserPower = 1;', group: 'mod' },
  { id: 'decl:lives', label: 'lives', insert: 'int lives = 3;', group: 'mod' },
  { id: 'decl:shield', label: 'shield', insert: 'bool shield = true;', group: 'mod' },
  { id: 'decl:rapidFire', label: 'rapidFire', insert: 'bool rapidFire = true;', group: 'mod' },
  { id: 'decl:homing', label: 'homing', insert: 'bool homing = true;', group: 'mod' },
  { id: 'decl:scoreMultiplier', label: 'scoreMultiplier', insert: 'int scoreMultiplier = 2;', group: 'mod' },
  { id: 'decl:worldGravity', label: 'worldGravity', insert: 'int worldGravity = 1;', group: 'mod' },
];

export function chipById(id: string): QuickInsertToken | undefined {
  return ALL_CHIPS.find((chip) => chip.id === id);
}

export const csharpAdapter: LanguageAdapter = {
  meta: LANGUAGES[0],
  parse: parseCSharp,
  quickInsert: (allowed) => {
    if (!allowed || !allowed.length) return ALL_CHIPS.slice(0, 6);
    const set = new Set(allowed);
    return ALL_CHIPS.filter((chip) => set.has(chip.id));
  },
};
