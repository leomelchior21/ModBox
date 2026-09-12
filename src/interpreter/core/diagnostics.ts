import type { Diagnostic, Expr, Position, Statement, VarType } from './types';

/* ============================================================================
   MODBOX — FRIENDLY DIAGNOSTICS
   Students never see a wall of compiler text. They see a short headline,
   the shortest useful explanation, and (optionally) real C# detail.
   ========================================================================== */

export function headlineFor(line: number): string {
  const variants = [
    `LINE ${line} NEEDS ATTENTION`,
    `THE GALAXY COULDN'T READ LINE ${line}`,
    `LINE ${line} PUSHED BACK`,
    `TRANSMISSION BLOCKED ON LINE ${line}`,
  ];
  // Deterministic pick: stable for a given line, varied across the file.
  return variants[line % variants.length];
}

export interface DiagInput {
  code: string;
  severity?: Diagnostic['severity'];
  pos: Position;
  message: string;
  hint?: string;
  technical?: string;
  source?: string;
  discovery?: boolean;
}

export function makeDiagnostic(input: DiagInput): Diagnostic {
  const sourceLine = input.source ? lineOfText(input.source, input.pos.line) : undefined;
  return {
    code: input.code,
    severity: input.severity ?? 'error',
    line: input.pos.line,
    column: input.pos.column,
    title:
      input.severity === 'info' || input.severity === 'warning'
        ? input.discovery
          ? 'NOT WIRED UP YET'
          : `LINE ${input.pos.line}`
        : headlineFor(input.pos.line),
    message: input.message,
    hint: input.hint,
    sourceLine,
    technical: input.technical,
    discovery: input.discovery,
  };
}

export function lineOfText(source: string, line: number): string {
  const lines = source.split(/\r?\n/);
  return lines[line - 1] ?? '';
}

/* --------------------------------------------------------------- error codes */

export const MOD_CODES = {
  unterminatedString: 'MOD1001',
  unknownCharacter: 'MOD1002',
  expectedValue: 'MOD1003',
  missingSemicolon: 'MOD1004',
  missingBrace: 'MOD1005',
  unsupportedSyntax: 'MOD1006',
  unknownName: 'MOD1007',
  typeMismatch: 'MOD1008',
  redeclared: 'MOD1009',
  badComparison: 'MOD1010',
  rediscoveryLocked: 'MOD2001',
} as const;

/* ------------------------------------------------------- friendly C# mapping */

export function csharpTechnical(kind: keyof typeof TECHNICAL_MAP): string | undefined {
  return TECHNICAL_MAP[kind];
}

const TECHNICAL_MAP = {
  expectedExpression: 'CS1525: Invalid expression term',
  missingSemicolon: "CS1002: ; expected",
  unknownName: "CS0103: The name does not exist in the current context",
  typeMismatch: 'CS0029: Cannot implicitly convert type',
  unterminatedString: 'CS1010: Newline in constant',
  unsupported: 'CS0246 / CS0234: The type or namespace name could not be found',
} as const;

/* ------------------------------------------------------------- pretty printer */

export function formatValue(value: string | number | boolean): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export function prettyExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'literal':
      return formatValue(expr.value);
    case 'identifier':
      return expr.name;
    case 'binary':
      return `${prettyExpr(expr.left)} ${expr.op} ${prettyExpr(expr.right)}`;
    case 'compare':
      return `${prettyExpr(expr.left)} ${expr.op} ${prettyExpr(expr.right)}`;
    case 'logical':
      return `${prettyExpr(expr.left)} ${expr.op} ${prettyExpr(expr.right)}`;
    case 'unary':
      return `${expr.op}${prettyExpr(expr.operand)}`;
  }
}

export function typeOfLiteral(value: string | number | boolean): VarType {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'bool';
  return 'int';
}

export function statementLabel(statement: Statement): string {
  switch (statement.kind) {
    case 'varDecl':
      return `${statement.varType} ${statement.name} = ${prettyExpr(statement.init)};`;
    case 'assign':
      return `${statement.name} = ${prettyExpr(statement.value)};`;
    case 'writeLine':
      return `Console.WriteLine(${statement.arg ? prettyExpr(statement.arg) : ''});`;
    case 'if':
      return `if (${prettyExpr(statement.condition)}) { … }`;
  }
}
