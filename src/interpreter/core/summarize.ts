import type { ConfigKey, Expr, ProgramResult, ProgramSummary, RuntimeKey, Statement } from './types';
import { RUNTIME_LABELS } from './mods';
import { prettyExpr } from './diagnostics';

/* ============================================================================
   MODBOX — PROGRAM SUMMARY
   Mission validation works from this, never from source text. Because the
   summary is built from the language-agnostic AST, a future Python or Swift
   adapter gets the whole mission campaign for free.
   ========================================================================== */

const RUNTIME_KEYS = Object.keys(RUNTIME_LABELS) as RuntimeKey[];

function visitExpr(expr: Expr, onExpr: (expr: Expr) => void): void {
  onExpr(expr);
  switch (expr.kind) {
    case 'binary':
    case 'compare':
    case 'logical':
      visitExpr(expr.left, onExpr);
      visitExpr(expr.right, onExpr);
      break;
    case 'unary':
      visitExpr(expr.operand, onExpr);
      break;
    default:
      break;
  }
}

interface SummaryAcc {
  declares: Record<'string' | 'int' | 'bool', string[]>;
  writesCount: number;
  rulesCount: number;
  comparisons: Set<string>;
  arithmeticOps: Set<string>;
  runtimeRefs: Set<RuntimeKey>;
  astNodes: number;
  declaredMods: { mod: ConfigKey; name: string; line: number }[];
  hasCondition: boolean;
  keys: Set<string>;
}

function visitStatement(statement: Statement, acc: SummaryAcc, depth: number): void {
  acc.astNodes += 1;

  switch (statement.kind) {
    case 'varDecl':
      if (depth === 0) acc.declares[statement.varType].push(statement.name);
      acc.keys.add(`decl:${statement.name}`);
      visitExpr(statement.init, (expr) => collectExpr(expr, acc));
      break;

    case 'assign':
      acc.keys.add(`assign:${statement.name}`);
      visitExpr(statement.value, (expr) => collectExpr(expr, acc));
      break;

    case 'writeLine':
      acc.writesCount += 1;
      acc.keys.add(`write:${statement.arg ? prettyExpr(statement.arg) : ''}`);
      if (statement.arg) visitExpr(statement.arg, (expr) => collectExpr(expr, acc));
      break;

    case 'if':
      acc.hasCondition = true;
      acc.keys.add(`rule:${prettyExpr(statement.condition)}`);
      visitExpr(statement.condition, (expr) => collectExpr(expr, acc));
      for (const child of statement.body) {
        visitStatement(child, acc, depth + 1);
      }
      break;
  }
}

function collectExpr(expr: Expr, acc: SummaryAcc): void {
  if (expr.kind === 'compare') acc.comparisons.add(expr.op);
  if (expr.kind === 'binary') acc.arithmeticOps.add(expr.op);
  if (expr.kind === 'identifier' && (RUNTIME_KEYS as string[]).includes(expr.name)) {
    acc.runtimeRefs.add(expr.name as RuntimeKey);
  }
}

export function summarize(result: ProgramResult): ProgramSummary {
  const acc: SummaryAcc = {
    declares: { string: [], int: [], bool: [] },
    writesCount: 0,
    rulesCount: result.rules.length,
    comparisons: new Set<string>(),
    arithmeticOps: new Set<string>(),
    runtimeRefs: new Set<RuntimeKey>(),
    astNodes: 0,
    declaredMods: [],
    hasCondition: false,
    keys: new Set<string>(),
  };

  for (const statement of result.ast.statements) {
    visitStatement(statement, acc, 0);
  }

  for (const rule of result.rules) {
    acc.keys.add(`rule:${rule.conditionText}`);
    visitExpr(rule.condition, (expr) => collectExpr(expr, acc));
    for (const action of rule.actions) {
      acc.keys.add(`assign:${action.target}`);
      visitExpr(action.value, (expr) => collectExpr(expr, acc));
    }
  }

  return {
    declares: acc.declares,
    writesCount: acc.writesCount,
    rulesCount: acc.rulesCount,
    comparisons: [...acc.comparisons],
    arithmeticOps: [...acc.arithmeticOps],
    runtimeRefs: [...acc.runtimeRefs],
    modsUsed: Object.keys(result.config) as ConfigKey[],
    hasCondition: acc.hasCondition,
    astNodes: acc.astNodes,
    keys: [...acc.keys],
  };
}
