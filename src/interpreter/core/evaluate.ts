import type { Expr, GameConfig, LiteralValue, RuntimeValues, VarType } from './types';
import { MODS } from './mods';

/* ============================================================================
   MODBOX — EXPRESSION EVALUATION (language agnostic)
   Used by the rule engine at runtime. Never throws: returns a result object so
   a bad rule can be reported instead of killing the game loop.
   ========================================================================== */

export interface EvalScope {
  runtime: RuntimeValues;
  /** base config expressed with the student-facing mod names */
  modValues: Record<string, LiteralValue>;
  /** student-invented variables that are not bound to the game */
  constants: Record<string, LiteralValue>;
}

export type EvalResult =
  | { ok: true; value: LiteralValue; type: VarType }
  | { ok: false; message: string };

export function modValuesFrom(config: GameConfig): Record<string, LiteralValue> {
  const out: Record<string, LiteralValue> = {};
  for (const mod of MODS) {
    out[mod.name] = config[mod.id] as LiteralValue;
  }
  return out;
}

export function makeScope(
  config: GameConfig,
  runtime: RuntimeValues,
  constants: Record<string, LiteralValue> = {},
): EvalScope {
  return { runtime, modValues: modValuesFrom(config), constants };
}

function typeOf(value: LiteralValue): VarType {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'bool';
  return 'int';
}

function truthy(value: LiteralValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value.length > 0;
}

function toNumber(value: LiteralValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function display(value: LiteralValue): string {
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

export function resolveIdentifier(name: string, scope: EvalScope): EvalResult {
  if (name in scope.runtime) {
    const value = scope.runtime[name as keyof RuntimeValues];
    return { ok: true, value, type: 'int' };
  }
  if (name in scope.modValues) {
    const value = scope.modValues[name];
    return { ok: true, value, type: typeOf(value) };
  }
  if (name in scope.constants) {
    const value = scope.constants[name];
    return { ok: true, value, type: typeOf(value) };
  }
  return { ok: false, message: `The game cannot read "${name}" while playing.` };
}

export function evalExpr(expr: Expr, scope: EvalScope): EvalResult {
  switch (expr.kind) {
    case 'literal':
      return { ok: true, value: expr.value, type: expr.type };

    case 'identifier':
      return resolveIdentifier(expr.name, scope);

    case 'unary': {
      const operand = evalExpr(expr.operand, scope);
      if (!operand.ok) return operand;
      if (expr.op === '!') return { ok: true, value: !truthy(operand.value), type: 'bool' };
      const n = toNumber(operand.value);
      if (n === null) return { ok: false, message: 'That value is not a number.' };
      return { ok: true, value: -n, type: 'int' };
    }

    case 'logical': {
      const left = evalExpr(expr.left, scope);
      if (!left.ok) return left;
      if (expr.op === '&&' && !truthy(left.value)) {
        return { ok: true, value: false, type: 'bool' };
      }
      if (expr.op === '||' && truthy(left.value)) {
        return { ok: true, value: true, type: 'bool' };
      }
      const right = evalExpr(expr.right, scope);
      if (!right.ok) return right;
      return { ok: true, value: truthy(right.value), type: 'bool' };
    }

    case 'binary': {
      const left = evalExpr(expr.left, scope);
      if (!left.ok) return left;
      const right = evalExpr(expr.right, scope);
      if (!right.ok) return right;

      // string concatenation
      if (expr.op === '+' && (typeof left.value === 'string' || typeof right.value === 'string')) {
        return { ok: true, value: display(left.value) + display(right.value), type: 'string' };
      }

      const a = toNumber(left.value);
      const b = toNumber(right.value);
      if (a === null || b === null) {
        return {
          ok: false,
          message: `Cannot use ${expr.op} on ${display(left.value)} and ${display(right.value)}.`,
        };
      }
      switch (expr.op) {
        case '+':
          return { ok: true, value: a + b, type: 'int' };
        case '-':
          return { ok: true, value: a - b, type: 'int' };
        case '*':
          return { ok: true, value: a * b, type: 'int' };
        case '/':
          return {
            ok: true,
            value: b === 0 ? 0 : Math.trunc(a / b),
            type: 'int',
          };
      }
      break;
    }

    case 'compare': {
      const left = evalExpr(expr.left, scope);
      if (!left.ok) return left;
      const right = evalExpr(expr.right, scope);
      if (!right.ok) return right;
      const bothNumbers = toNumber(left.value) !== null && toNumber(right.value) !== null;
      const a = bothNumbers ? (toNumber(left.value) as number) : left.value;
      const b = bothNumbers ? (toNumber(right.value) as number) : right.value;
      switch (expr.op) {
        case '>':
          return { ok: true, value: a > b, type: 'bool' };
        case '<':
          return { ok: true, value: a < b, type: 'bool' };
        case '>=':
          return { ok: true, value: a >= b, type: 'bool' };
        case '<=':
          return { ok: true, value: a <= b, type: 'bool' };
        case '==':
          return { ok: true, value: a === b, type: 'bool' };
        case '!=':
          return { ok: true, value: a !== b, type: 'bool' };
      }
      break;
    }
  }
  return { ok: false, message: 'That expression is not supported yet.' };
}
