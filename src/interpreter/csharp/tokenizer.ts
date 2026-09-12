import type { Diagnostic, Position } from '../core/types';
import { MOD_CODES, csharpTechnical, makeDiagnostic } from '../core/diagnostics';

/* ============================================================================
   MODBOX — C# SUBSET TOKENIZER
   Deliberately small, deliberately forgiving. It never throws: problems are
   collected as friendly diagnostics and lexing continues so the student can
   see several issues at once.
   ========================================================================== */

export type TokenKind =
  | 'identifier'
  | 'number'
  | 'string'
  | 'keyword'
  | 'type'
  | 'operator'
  | 'punct'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  pos: Position;
  start: number;
  end: number;
}

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

/** Types we understand as variable types. */
export const SUPPORTED_TYPES = ['string', 'int', 'bool'] as const;

export const SUPPORTED_KEYWORDS = ['if', 'else', 'true', 'false'];

/** Names that exist in the C# world but are not wired into MODBOX v1. */
export const UNSUPPORTED_KEYWORDS = [
  'class', 'struct', 'interface', 'enum', 'namespace', 'using',
  'public', 'private', 'protected', 'internal', 'static', 'void',
  'var', 'dynamic', 'new', 'this', 'base', 'while', 'for', 'foreach',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
  'try', 'catch', 'finally', 'throw', 'async', 'await', 'lock',
  'delegate', 'event', 'override', 'virtual', 'abstract', 'sealed',
  'readonly', 'const', 'ref', 'out', 'params', 'operator', 'get',
  'set', 'goto', 'yield', 'unsafe', 'fixed', 'interface',
];

const CSHARP_CORE_TYPES = [
  'double', 'float', 'decimal', 'long', 'short', 'byte', 'char',
  'uint', 'ulong', 'object',
];

const MULTI_CHAR_OPERATORS = [
  '==', '!=', '>=', '<=', '&&', '||', '+=', '-=', '*=', '/=', '++', '--', '=>', '??',
];

const SINGLE_CHAR_TOKENS = '+-*/%><=!&|^~?:;,.(){}[]';

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentifierPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

/** Reads one string literal starting at `index` (which points at the opening quote). */
function readString(source: string, index: number): { value: string; end: number; closed: boolean } {
  let i = index + 1;
  let value = '';
  while (i < source.length) {
    const current = source[i];
    if (current === '\\') {
      const next = source[i + 1];
      if (next === 'n') value += '\n';
      else if (next === 't') value += '\t';
      else if (next === undefined) return { value, end: i + 1, closed: false };
      else value += next;
      i += 2;
      continue;
    }
    if (current === '"') return { value, end: i + 1, closed: true };
    if (current === '\n') return { value, end: i, closed: false };
    value += current;
    i += 1;
  }
  return { value, end: i, closed: false };
}

export interface UnsupportedExplanation {
  message: string;
  hint: string;
}

/** Friendly explanation for C# constructs MODBOX v1 does not run. */
export function explainUnsupported(word: string): UnsupportedExplanation {
  const lower = word.toLowerCase();
  const reasons: Record<string, UnsupportedExplanation> = {
    while: {
      message: 'Loops are not part of the MODBOX sandbox yet. The game already runs in a loop — for you.',
      hint: 'Change values with rules instead, or use `if` to react while playing.',
    },
    for: {
      message: 'The game loop is already `for` you. Loops are not wired into the sandbox yet.',
      hint: 'Try a rule: if (score >= 300) { shield = true; }',
    },
    foreach: {
      message: 'foreach is not supported in the sandbox yet.',
      hint: 'Set a value directly, or write a rule.',
    },
    class: {
      message: 'Classes are not needed to mod a game here. This editor takes statements, not classes.',
      hint: 'Delete the class wrapper and keep the lines inside it.',
    },
    void: {
      message: 'Methods are not part of the sandbox. Write plain statements instead.',
      hint: 'Example: Console.WriteLine("READY");',
    },
    static: {
      message: 'static belongs to C# classes, which the sandbox does not use.',
      hint: 'Keep only the statements you want to run.',
    },
    var: {
      message: 'MODBOX needs the type written out so it knows what the value controls.',
      hint: 'Use int, bool or string — for example: int enemies = 5;',
    },
    new: {
      message: 'Creating objects is not supported in the sandbox yet.',
      hint: 'Set a supported value, for example: string enemy = "big-rock";',
    },
    using: {
      message: 'MODBOX already loads everything the sandbox needs — no using lines required.',
      hint: 'Delete the line.',
    },
    async: {
      message: 'async and await are not supported in the sandbox.',
      hint: 'The game already updates live as you type.',
    },
    await: {
      message: 'await is not supported in the sandbox.',
      hint: 'Delete it and set a value instead.',
    },
  };

  if (reasons[lower]) return reasons[lower];

  return {
    message: `"${word}" is real C#, but MODBOX does not run it yet.`,
    hint: 'Supported here: string, int, bool, assignments, + - * /, comparisons, if, Console.WriteLine.',
  };
}

export function tokenize(source: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  const pos = (): Position => ({ line, column });

  const advance = (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      const ch = source[index];
      if (ch === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      index += 1;
    }
  };

  while (index < source.length) {
    const ch = source[index];

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    // line comment
    if (ch === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') advance();
      continue;
    }

    // block comment
    if (ch === '/' && source[index + 1] === '*') {
      const startPos = pos();
      advance(2);
      let closed = false;
      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          advance(2);
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) {
        diagnostics.push(
          makeDiagnostic({
            code: MOD_CODES.missingBrace,
            pos: startPos,
            message: 'This comment starts with /* but never closes with */.',
            hint: 'Add */ to end the comment.',
            source,
          }),
        );
      }
      continue;
    }

    // string literal
    if (ch === '"') {
      const startPos = pos();
      const start = index;
      const read = readString(source, index);
      const consumed = Math.max(1, read.end - index);
      advance(consumed);
      tokens.push({ kind: 'string', value: read.value, pos: startPos, start, end: index });
      if (!read.closed) {
        diagnostics.push(
          makeDiagnostic({
            code: MOD_CODES.unterminatedString,
            pos: startPos,
            message: "You opened a quote but didn't close it.",
            hint: 'Text needs a " on both sides, like "big-rock".',
            technical: csharpTechnical('unterminatedString'),
            source,
          }),
        );
      }
      continue;
    }

    // number
    if (isDigit(ch)) {
      const startPos = pos();
      const start = index;
      while (index < source.length && (isDigit(source[index]) || source[index] === '_')) advance();
      if (source[index] === '.' && isDigit(source[index + 1])) {
        advance();
        while (index < source.length && isDigit(source[index])) advance();
      }
      const text = source.slice(start, index).replace(/_/g, '');
      tokens.push({ kind: 'number', value: text, pos: startPos, start, end: index });
      continue;
    }

    // identifier / keyword / type
    if (isIdentifierStart(ch)) {
      const startPos = pos();
      const start = index;
      while (index < source.length && isIdentifierPart(source[index])) advance();
      const text = source.slice(start, index);
      const lower = text.toLowerCase();
      if ((SUPPORTED_TYPES as readonly string[]).includes(lower)) {
        tokens.push({ kind: 'type', value: lower, pos: startPos, start, end: index });
      } else if (SUPPORTED_KEYWORDS.includes(lower)) {
        tokens.push({ kind: 'keyword', value: lower, pos: startPos, start, end: index });
      } else if (UNSUPPORTED_KEYWORDS.includes(lower) || CSHARP_CORE_TYPES.includes(lower)) {
        tokens.push({ kind: 'keyword', value: text, pos: startPos, start, end: index });
      } else {
        tokens.push({ kind: 'identifier', value: text, pos: startPos, start, end: index });
      }
      continue;
    }

    // multi-character operators
    const two = source.slice(index, index + 2);
    if (MULTI_CHAR_OPERATORS.includes(two)) {
      const startPos = pos();
      tokens.push({ kind: 'operator', value: two, pos: startPos, start: index, end: index + 2 });
      advance(2);
      continue;
    }

    // single characters
    if (SINGLE_CHAR_TOKENS.includes(ch)) {
      const startPos = pos();
      const kind: TokenKind = '(){}[];,.'.includes(ch) ? 'punct' : 'operator';
      tokens.push({ kind, value: ch, pos: startPos, start: index, end: index + 1 });
      advance();
      continue;
    }

    const startPos = pos();
    diagnostics.push(
      makeDiagnostic({
        code: MOD_CODES.unknownCharacter,
        pos: startPos,
        message: `The galaxy doesn't use the character "${ch}" here.`,
        hint: 'Use letters, numbers, quotes and brackets.',
        source,
      }),
    );
    advance();
  }

  tokens.push({ kind: 'eof', value: '', pos: pos(), start: index, end: index });
  return { tokens, diagnostics };
}
