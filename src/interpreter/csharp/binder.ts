import type {
  ConfigKey,
  CommsLine,
  Diagnostic,
  Expr,
  GameRule,
  LiteralValue,
  Notice,
  ProgramNode,
  RuleAction,
  RuleWrite,
  Statement,
  SymbolInfo,
  VarType,
} from '../core/types';
import { MODS, RUNTIME_LABELS } from '../core/mods';
import type { ModDefinition } from '../../mods/types';
import type { BindingSchema } from '../core/schema';
import { coerceModValue, coerceUserValue, type ReportFn } from '../core/modBinding';
import { MOD_CODES, csharpTechnical, formatValue, makeDiagnostic, prettyExpr } from '../core/diagnostics';

/* ============================================================================
   MODBOX — C# BINDER
   Walks the AST, checks it like a careful teacher, and produces:
     • symbols       — what the student created (Mod Library / HUD)
     • config        — the GameConfig their code describes (clamped, safe)
     • rules         — live reactive rules built from `if` statements
     • comms         — Console.WriteLine output for the COMMS feed
   ========================================================================== */

const VECTOR_ZERO_BINDINGS: BindingSchema<ConfigKey> = { mods: MODS, runtimeNames: Object.keys(RUNTIME_LABELS), coerceValue: coerceModValue };

type InferredType = VarType | 'runtime';

interface Analysis {
  type: InferredType;
  /** present when the value can be produced without live game state */
  value?: LiteralValue;
  known: boolean;
}

interface Binding<Key extends string> {
  name: string;
  type: VarType;
  value: LiteralValue;
  line: number;
  mod?: Key;
}

export interface BindResult<Key extends string = ConfigKey> {
  config: Partial<Record<Key, LiteralValue>>;
  symbols: SymbolInfo<Key>[];
  rules: GameRule<Key>[];
  comms: CommsLine[];
  notices: Notice[];
}

interface Branch<Key extends string> {
  conditions: Expr[];
  actions: RuleAction<Key>[];
  writes: RuleWrite[];
}

interface Pos {
  line: number;
  column: number;
}

export function bindProgram(program: ProgramNode, source: string, diagnostics: Diagnostic[]): BindResult;
export function bindProgram<Key extends string>(program: ProgramNode, source: string, diagnostics: Diagnostic[], schema: BindingSchema<Key>): BindResult<Key>;
export function bindProgram(program: ProgramNode, source: string, diagnostics: Diagnostic[], schema: BindingSchema = VECTOR_ZERO_BINDINGS): BindResult<string> {
  return new Binder(source, diagnostics, schema).run(program);
}

class Binder<Key extends string> {
  private readonly env = new Map<string, Binding<Key>>();
  private readonly config: Partial<Record<Key, LiteralValue>> = {};
  private readonly symbols: SymbolInfo<Key>[] = [];
  private readonly rules: GameRule<Key>[] = [];
  private readonly comms: CommsLine[] = [];
  private readonly notices: Notice[] = [];
  private readonly modsByName: Map<string, ModDefinition<Key>>;
  private ruleCounter = 0;
  private commsCounter = 0;
  private warnedUserOnlyRule = false;

  constructor(
    private readonly source: string,
    private readonly diagnostics: Diagnostic[],
    private readonly schema: BindingSchema<Key>,
  ) { this.modsByName = new Map(schema.mods.map(mod => [mod.name, mod])); }

  run(program: ProgramNode): BindResult<Key> {
    for (const statement of program.statements) {
      this.bindTopLevel(statement);
    }
    return {
      config: this.config,
      symbols: this.symbols,
      rules: this.rules,
      comms: this.comms,
      notices: this.notices,
    };
  }

  /* -------------------------------------------------------------- reporting */

  private report(
    code: string,
    pos: Pos,
    message: string,
    hint?: string,
    technical?: string,
    severity: Diagnostic['severity'] = 'error',
  ): void {
    this.diagnostics.push(
      makeDiagnostic({ code, severity, pos, message, hint, technical, source: this.source }),
    );
  }

  private pushDiag: ReportFn = (input) => {
    this.diagnostics.push(makeDiagnostic({ ...input, source: this.source }));
  };

  private notice(id: string, message: string, tone: Notice['tone'] = 'info'): void {
    if (this.notices.some((existing) => existing.id === id)) return;
    this.notices.push({ id, message, tone });
  }

  /* -------------------------------------------------------------- statements */

  private bindTopLevel(statement: Statement): void {
    switch (statement.kind) {
      case 'varDecl':
        this.handleDeclaration(statement);
        return;
      case 'assign':
        this.handleAssign(statement.name, statement.value, statement.pos);
        return;
      case 'writeLine':
        this.handleTopLevelWrite(statement);
        return;
      case 'if':
        this.handleRule(statement);
        return;
    }
  }

  private handleDeclaration(statement: Extract<Statement, { kind: 'varDecl' }>): void {
    if (!statement.name) return;

    const existing = this.env.get(statement.name);
    const mod = this.modsByName.get(statement.name);
    if (existing && mod && existing.type === mod.type && statement.varType === mod.type) {
      this.handleAssign(statement.name, statement.init, statement.pos);
      this.notice(
        `mod-repeated:${mod.id}`,
        `You added ${mod.name} again. The last ${mod.name} line controls the game.`,
      );
      return;
    }
    if (existing) {
      this.report(
        MOD_CODES.redeclared,
        statement.pos,
        `${statement.name} already exists — you created it on line ${existing.line}.`,
        'Change the value on that line instead, or rename this one.',
      );
      return;
    }

    if (mod && mod.type !== statement.varType) {
      this.report(
        MOD_CODES.typeMismatch,
        statement.pos,
        `${mod.name} is ${
          mod.type === 'string' ? 'text' : mod.type === 'int' ? 'a whole number' : 'true or false'
        }, so it cannot be a ${statement.varType}.`,
        `Write ${mod.example}`,
        csharpTechnical('typeMismatch'),
      );
    }

    const analysis = this.analyze(statement.init, false);
    const fallback: LiteralValue =
      statement.varType === 'string' ? '' : statement.varType === 'int' ? 0 : false;
    const rawValue = analysis.value ?? fallback;

    let finalValue: LiteralValue | null = null;

    if (mod) {
      const coerced = this.schema.coerceValue(mod, rawValue, this.pushDiag, statement.init.pos, this.source);
      if (coerced) {
        finalValue = coerced.value;
        this.config[mod.id] = coerced.value;
        if (coerced.notice) this.notices.push(coerced.notice);
      }
    } else {
      finalValue = coerceUserValue(
        statement.varType,
        rawValue,
        statement.name,
        this.pushDiag,
        statement.init.pos,
        this.source,
      );
    }

    const value = finalValue ?? rawValue;
    this.env.set(statement.name, {
      name: statement.name,
      type: statement.varType,
      value,
      line: statement.pos.line,
      mod: mod?.id,
    });
    this.symbols.push({
      name: statement.name,
      type: statement.varType,
      value,
      text: `${statement.varType} ${statement.name} = ${formatValue(value)};`,
      line: statement.pos.line,
      mod: mod?.id,
      userOnly: !mod,
    });
  }

  private handleAssign(name: string, value: Expr, pos: Pos): void {
    const binding = this.env.get(name);
    if (!binding) {
      const suggestion = this.suggest(name);
      this.report(
        MOD_CODES.unknownName,
        pos,
        `${name} has not been created yet.`,
        suggestion
          ? `Did you mean ${suggestion}? A variable is created once with its type: ${
              this.modsByName.get(suggestion)?.example ?? `int ${suggestion} = 2;`
            }`
          : `Create it above with its type, for example: int ${name} = 2;`,
        csharpTechnical('unknownName'),
      );
      return;
    }

    const analysis = this.analyze(value, false);
    const rawValue = analysis.value ?? binding.value;

    if (binding.mod) {
      const mod = this.modsByName.get(binding.name);
      if (!mod) return;
      const coerced = this.schema.coerceValue(mod, rawValue, this.pushDiag, pos, this.source);
      if (!coerced) return;
      binding.value = coerced.value;
      this.config[mod.id] = coerced.value;
      if (coerced.notice) this.notices.push(coerced.notice);
    } else {
      const coerced = coerceUserValue(
        binding.type,
        rawValue,
        binding.name,
        this.pushDiag,
        pos,
        this.source,
      );
      if (coerced === null) return;
      binding.value = coerced;
    }

    const symbol = this.symbols.find((entry) => entry.name === binding.name);
    if (symbol) {
      symbol.value = binding.value;
      symbol.text = `${binding.type} ${binding.name} = ${formatValue(binding.value)};`;
    }
  }

  private handleTopLevelWrite(statement: Extract<Statement, { kind: 'writeLine' }>): void {
    const nextId = (): string => `comms-${++this.commsCounter}`;
    if (!statement.arg) {
      this.comms.push({ id: nextId(), text: '', source: 'startup' });
      return;
    }
    const analysis = this.analyze(statement.arg, false);
    if (!analysis.known) {
      this.comms.push({ id: nextId(), text: prettyExpr(statement.arg), source: 'startup' });
      return;
    }
    this.comms.push({
      id: nextId(),
      text: renderText(analysis.value ?? ''),
      source: 'startup',
    });
  }

  private handleRule(statement: Extract<Statement, { kind: 'if' }>): void {
    const conditionAnalysis = this.analyze(statement.condition, true);
    if (conditionAnalysis.known && conditionAnalysis.type !== 'bool') {
      this.report(
        MOD_CODES.expectedValue,
        statement.condition.pos,
        'A condition must be a question with an answer of true or false.',
        'Compare a game value inside the condition, for example with == or >=.',
        csharpTechnical('expectedExpression'),
      );
    }

    const branches = this.collectBranches([statement.condition], statement.body);
    for (const branch of branches) {
      if (!branch.actions.length && !branch.writes.length) continue;
      const conditionText = branch.conditions.map((expr) => prettyExpr(expr)).join(' && ');
      const flat =
        branch.conditions.length === 1
          ? branch.conditions[0]
          : branch.conditions
              .slice(1)
              .reduce<Expr>(
                (left, right) => ({ kind: 'logical', op: '&&', left, right, pos: right.pos }),
                branch.conditions[0],
              );
      this.rules.push({
        id: `rule-${++this.ruleCounter}`,
        line: statement.pos.line,
        condition: flat,
        conditionText,
        actions: branch.actions,
        writes: branch.writes,
      });
    }
  }

  /** Flattens nested if statements into separate reactive rules joined with &&. */
  private collectBranches(conditions: Expr[], body: Statement[]): Branch<Key>[] {
    const branches: Branch<Key>[] = [];
    let current: Branch<Key> = { conditions: [...conditions], actions: [], writes: [] };

    for (const statement of body) {
      switch (statement.kind) {
        case 'assign': {
          const binding = this.env.get(statement.name);
          if (!binding) {
            const suggestion = this.suggest(statement.name);
            this.report(
              MOD_CODES.unknownName,
              statement.pos,
              `${statement.name} has not been created yet.`,
              suggestion
                ? `Did you mean ${suggestion}? Create it above with its type.`
                : 'Create it above with its type, then change it here.',
              csharpTechnical('unknownName'),
            );
            break;
          }
          const analysis = this.analyze(statement.value, true);
          if (binding.mod) {
            const mod = this.modsByName.get(binding.name)!;
            const compatible =
              (mod.type === 'bool' && (analysis.type === 'bool' || analysis.type === 'runtime')) ||
              (mod.type === 'int' && (analysis.type === 'int' || analysis.type === 'runtime')) ||
              (mod.type === 'string' && (analysis.type === 'string' || analysis.type === 'runtime'));
            if (!compatible) {
              const expected =
                mod.type === 'string'
                  ? 'text in quotes'
                  : mod.type === 'int'
                    ? 'a whole number'
                    : 'true or false';
              const example =
                mod.type === 'string' ? JSON.stringify(mod.defaultValue ?? mod.values?.[0] ?? 'example') : mod.type === 'int' ? String(mod.defaultValue ?? 4) : 'true';
              this.report(
                MOD_CODES.typeMismatch,
                statement.value.pos,
                `${mod.name} expects ${expected}.`,
                `Try: ${mod.name} = ${example};`,
                csharpTechnical('typeMismatch'),
              );
              break;
            }
            current.actions.push({
              target: mod.id,
              value: statement.value,
              text: `${mod.name} = ${prettyExpr(statement.value)}`,
            });
          } else if (!this.warnedUserOnlyRule) {
            this.warnedUserOnlyRule = true;
            this.notice(
              'rule:useronly',
              `${binding.name} is your own variable. Rules can change the game values listed in the Mod Library.`,
              'info',
            );
          }
          break;
        }

        case 'writeLine': {
          current.writes.push({
            arg: statement.arg ?? {
              kind: 'literal',
              value: '',
              type: 'string',
              pos: statement.pos,
            },
            text: statement.arg ? prettyExpr(statement.arg) : '""',
          });
          break;
        }

        case 'if': {
          const innerAnalysis = this.analyze(statement.condition, true);
          if (innerAnalysis.known && innerAnalysis.type !== 'bool') {
            this.report(
              MOD_CODES.expectedValue,
              statement.condition.pos,
              'A condition must be a question with an answer of true or false.',
              'Compare a game value with a number, text or true/false inside the condition.',
              csharpTechnical('expectedExpression'),
            );
          }
          if (current.actions.length || current.writes.length) branches.push(current);
          branches.push(
            ...this.collectBranches([...conditions, statement.condition], statement.body),
          );
          current = { conditions: [...conditions], actions: [], writes: [] };
          break;
        }

        case 'varDecl': {
          this.report(
            MOD_CODES.unsupportedSyntax,
            statement.pos,
            'Variables are created at the top of the file, not inside an if.',
            `Move ${statement.name} up to the top level.`,
            csharpTechnical('unsupported'),
          );
          break;
        }
      }
    }

    if (current.actions.length || current.writes.length) branches.push(current);
    return branches;
  }

  /* -------------------------------------------------------- type analysis */

  private analyzeIdentifier(name: string, pos: Pos, allowRuntime: boolean): Analysis {
    const binding = this.env.get(name);
    if (binding) return { type: binding.type, value: binding.value, known: true };

    if (this.schema.runtimeNames.includes(name)) {
      if (!allowRuntime) {
        this.report(
          MOD_CODES.unknownName,
          pos,
          `${name} only exists while the game is running.`,
          `Read ${name} inside an if condition, then change a mod inside the rule.`,
          csharpTechnical('unknownName'),
        );
      }
      return { type: 'runtime', known: false };
    }

    const suggestion = this.suggest(name);
    this.report(
      MOD_CODES.unknownName,
      pos,
      `${name} has not been created yet.`,
      suggestion ? `Did you mean ${suggestion}?` : `Create it first, for example: int ${name} = 3;`,
      csharpTechnical('unknownName'),
    );
    return { type: 'int', known: false };
  }

  private analyze(expr: Expr, allowRuntime: boolean): Analysis {
    switch (expr.kind) {
      case 'literal':
        return { type: expr.type, value: expr.value, known: true };

      case 'identifier':
        return this.analyzeIdentifier(expr.name, expr.pos, allowRuntime);

      case 'unary': {
        const operand = this.analyze(expr.operand, allowRuntime);
        if (expr.op === '!') {
          if (operand.type !== 'bool' && operand.type !== 'runtime') {
            this.report(
              MOD_CODES.typeMismatch,
              expr.pos,
              '! flips true and false, so it needs a bool after it.',
              'Use ! with a bool variable or a true/false condition.',
              csharpTechnical('typeMismatch'),
            );
          }
          const value = typeof operand.value === 'boolean' ? !operand.value : undefined;
          return { type: 'bool', value, known: value !== undefined };
        }
        if (operand.type !== 'int' && operand.type !== 'runtime') {
          this.report(
            MOD_CODES.typeMismatch,
            expr.pos,
            'The minus sign needs a number after it.',
            'Use minus with a number, for example: -1.',
            csharpTechnical('typeMismatch'),
          );
        }
        const negated = typeof operand.value === 'number' ? -operand.value : undefined;
        return { type: 'int', value: negated, known: negated !== undefined };
      }

      case 'logical': {
        const left = this.analyze(expr.left, allowRuntime);
        const right = this.analyze(expr.right, allowRuntime);
        const operands: [Analysis, Expr][] = [
          [left, expr.left],
          [right, expr.right],
        ];
        for (const [operand, node] of operands) {
          if (operand.type !== 'bool' && operand.type !== 'runtime') {
            this.report(
              MOD_CODES.typeMismatch,
              node.pos,
              `${expr.op} joins two questions that are true or false.`,
              'Compare game values first, then join those conditions with && or ||.',
              csharpTechnical('typeMismatch'),
            );
          }
        }
        if (typeof left.value === 'boolean' && typeof right.value === 'boolean') {
          const value = expr.op === '&&' ? left.value && right.value : left.value || right.value;
          return { type: 'bool', value, known: true };
        }
        return { type: 'bool', known: false };
      }

      case 'binary': {
        const left = this.analyze(expr.left, allowRuntime);
        const right = this.analyze(expr.right, allowRuntime);

        if (left.type === 'bool' || right.type === 'bool') {
          this.report(
            MOD_CODES.typeMismatch,
            expr.pos,
            `You cannot use ${expr.op} on true or false.`,
            'Booleans join with && or ||.',
            csharpTechnical('typeMismatch'),
          );
          return { type: 'int', known: false };
        }

        if (expr.op !== '+' && (left.type === 'string' || right.type === 'string')) {
          this.report(
            MOD_CODES.typeMismatch,
            expr.pos,
            `${expr.op} works on numbers, not text.`,
            'Text can be joined with + only.',
            csharpTechnical('typeMismatch'),
          );
          return { type: 'int', known: false };
        }

        if (expr.op === '+' && (left.type === 'string' || right.type === 'string')) {
          if (left.known && right.known && left.value !== undefined && right.value !== undefined) {
            return {
              type: 'string',
              value: renderText(left.value) + renderText(right.value),
              known: true,
            };
          }
          return { type: 'string', known: false };
        }

        if (typeof left.value === 'number' && typeof right.value === 'number') {
          const value = computeBinary(expr.op, left.value, right.value);
          return { type: 'int', value, known: value !== undefined };
        }
        return { type: 'int', known: false };
      }

      case 'compare': {
        const left = this.analyze(expr.left, allowRuntime);
        const right = this.analyze(expr.right, allowRuntime);
        const textual = left.type === 'string' || right.type === 'string';
        const boolean = left.type === 'bool' || right.type === 'bool';

        if (textual && boolean) {
          this.report(
            MOD_CODES.badComparison,
            expr.pos,
            'Text and true/false cannot be compared.',
            'Compare numbers with numbers, and text with text.',
            csharpTechnical('typeMismatch'),
          );
        } else if (textual && left.type !== right.type && left.type !== 'runtime' && right.type !== 'runtime') {
          this.report(
            MOD_CODES.badComparison,
            expr.pos,
            'One side is text and the other is a number.',
            'Remove the quotes to compare numbers, or add quotes on both sides.',
            csharpTechnical('typeMismatch'),
          );
        } else if (textual && expr.op !== '==' && expr.op !== '!=') {
          this.report(
            MOD_CODES.badComparison,
            expr.pos,
            `${expr.op} compares numbers. Text can use == or !=.`,
            'Use == to check matching text or != to check different text.',
            csharpTechnical('typeMismatch'),
          );
        }

        if (left.known && right.known && left.value !== undefined && right.value !== undefined) {
          return {
            type: 'bool',
            value: compareValues(expr.op, left.value, right.value),
            known: true,
          };
        }
        return { type: 'bool', known: false };
      }
    }
  }

  private suggest(name: string): string | undefined {
    const candidates = [...new Set([...this.modsByName.keys(), ...this.env.keys()])];
    const lower = name.toLowerCase();
    const caseMatch = candidates.find((candidate) => candidate.toLowerCase() === lower);
    if (caseMatch) return caseMatch;

    let best: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const distance = levenshtein(lower, candidate.toLowerCase());
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    const allowed = name.length > 6 ? 3 : 2;
    return bestDistance <= allowed ? best : undefined;
  }
}

/* ------------------------------------------------------------------ helpers */

export function renderText(value: LiteralValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function computeBinary(op: '+' | '-' | '*' | '/', a: number, b: number): number | undefined {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? 0 : Math.trunc(a / b);
    default:
      return undefined;
  }
}

function compareValues(
  op: '>' | '<' | '>=' | '<=' | '==' | '!=',
  a: LiteralValue,
  b: LiteralValue,
): boolean {
  const numeric = typeof a === 'number' && typeof b === 'number';
  if (numeric) {
    switch (op) {
      case '>':
        return a > b;
      case '<':
        return a < b;
      case '>=':
        return a >= b;
      case '<=':
        return a <= b;
      case '==':
        return a === b;
      case '!=':
        return a !== b;
    }
  }
  switch (op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    default:
      return false;
  }
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) grid[i][0] = i;
  for (let j = 0; j < cols; j += 1) grid[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + cost);
    }
  }

  return grid[rows - 1][cols - 1];
}
