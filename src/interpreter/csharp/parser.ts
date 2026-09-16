import type {
  BinaryOp,
  CompareOp,
  Diagnostic,
  Expr,
  Position,
  ProgramNode,
  Statement,
  VarType,
} from '../core/types';
import { MOD_CODES, csharpTechnical, makeDiagnostic } from '../core/diagnostics';
import { explainUnsupported, tokenize, type Token } from './tokenizer';

/* ============================================================================
   MODBOX — C# SUBSET PARSER (recursive descent)
   Grammar (v1):

     program    := statement*
     statement  := varDecl | assign | ifStmt | writeLine | ';'
     varDecl    := ('string'|'int'|'bool') IDENT '=' expr ';'
     assign     := IDENT '=' expr ';'
     ifStmt     := 'if' '(' expr ')' '{' statement* '}'
     writeLine  := 'Console' '.' 'WriteLine' '(' expr? ')' ';'
     expr       := logicOr
     logicOr    := logicAnd ('||' logicAnd)*
     logicAnd   := equality ('&&' equality)*
     equality   := additive (('=='|'!='|'>'|'<'|'>='|'<=') additive)?
     additive   := multiplicative (('+'|'-') multiplicative)*
     multiplicative := unary (('*'|'/') unary)*
     unary      := ('!'|'-')? primary
     primary    := NUMBER | STRING | 'true' | 'false' | IDENT | '(' expr ')'
   ========================================================================== */

export interface ParseResult {
  ast: ProgramNode;
  diagnostics: Diagnostic[];
}

const COMPARE_OPS: CompareOp[] = ['>', '<', '>=', '<=', '==', '!='];

export function parseSource(source: string): ParseResult {
  const lex = tokenize(source);
  const parser = new Parser(source, lex.tokens, lex.diagnostics);
  const ast = parser.parseProgram();
  return { ast, diagnostics: parser.diagnostics };
}

class Parser {
  private index = 0;

  constructor(
    private readonly source: string,
    private readonly tokens: Token[],
    readonly diagnostics: Diagnostic[],
  ) {}

  /* --------------------------------------------------------------- utilities */

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private at(value: string): boolean {
    return this.peek().value === value;
  }

  private atKeyword(value: string): boolean {
    const token = this.peek();
    return token.kind === 'keyword' && token.value.toLowerCase() === value;
  }

  private next(): Token {
    const token = this.tokens[this.index];
    if (this.index < this.tokens.length - 1) this.index += 1;
    return token;
  }

  private error(
    code: string,
    pos: Position,
    message: string,
    hint?: string,
    technical?: string,
  ): void {
    this.diagnostics.push(
      makeDiagnostic({ code, pos, message, hint, technical, source: this.source }),
    );
  }

  private isAtEnd(): boolean {
    return this.peek().kind === 'eof';
  }

  /** Skip to a safe boundary so one mistake does not cascade. */
  private syncToStatementBoundary(): void {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.value === ';') {
        this.next();
        return;
      }
      if (token.value === '}') return;
      if (token.kind === 'type' || this.atKeyword('if') || this.atKeyword('else')) return;
      this.next();
    }
  }

  /* ----------------------------------------------------------------- program */

  parseProgram(): ProgramNode {
    const statements: Statement[] = [];
    while (!this.isAtEnd()) {
      const before = this.index;
      const statement = this.parseStatement();
      if (statement) statements.push(statement);
      if (this.index === before) {
        // never stall: consume a token so the loop always advances
        this.next();
      }
    }
    return { kind: 'program', statements };
  }

  private parseStatement(): Statement | null {
    const token = this.peek();

    if (token.value === ';') {
      this.next();
      return null;
    }

    if (token.value === '}') {
      this.next();
      this.error(
        MOD_CODES.missingBrace,
        token.pos,
        'There is one extra closing brace } here.',
        'Every { needs a matching }.',
      );
      return null;
    }

    if (token.kind === 'type') return this.parseVarDecl();

    if (this.atKeyword('if')) return this.parseIf();

    if (this.atKeyword('else')) {
      this.next();
      this.error(
        MOD_CODES.unsupportedSyntax,
        token.pos,
        'There is no `else` in the sandbox yet.',
        'Write a second `if` for the opposite case.',
        csharpTechnical('unsupported'),
      );
      this.syncToStatementBoundary();
      return null;
    }

    if (token.kind === 'identifier' && token.value === 'Console') {
      return this.parseConsoleCall();
    }

    if (token.kind === 'identifier') {
      return this.parseAssignment();
    }

    if (token.kind === 'keyword') {
      const explanation = explainUnsupported(token.value);
      this.next();
      this.error(
        MOD_CODES.unsupportedSyntax,
        token.pos,
        explanation.message,
        explanation.hint,
        csharpTechnical('unsupported'),
      );
      this.syncToStatementBoundary();
      return null;
    }

    if (token.kind === 'string' || token.kind === 'number') {
      this.next();
      this.error(
        MOD_CODES.missingSemicolon,
        token.pos,
        'This value is floating on its own. Values need a name and a type.',
        'Example: string enemy = "big-rock";',
      );
      this.syncToStatementBoundary();
      return null;
    }

    this.next();
    this.error(
      MOD_CODES.expectedValue,
      token.pos,
      `The galaxy expected a line of code here, not "${token.value}".`,
      'Lines usually start with a type (string, int, bool), `if`, or Console.WriteLine.',
      csharpTechnical('expectedExpression'),
    );
    return null;
  }

  /* ------------------------------------------------------ statement parsers */

  private parseVarDecl(): Statement {
    const typeToken = this.next();
    const varType = typeToken.value as VarType;
    const nameToken = this.peek();

    if (nameToken.kind !== 'identifier') {
      this.error(
        MOD_CODES.expectedValue,
        nameToken.pos,
        `${varType} needs a name right after it.`,
        `Try: ${varType} ${
          varType === 'string' ? 'shipName = "Brian\'s ship";' : varType === 'int' ? 'enemies = 3;' : 'shield = true;'
        }`,
        csharpTechnical('expectedExpression'),
      );
      this.syncToStatementBoundary();
      return { kind: 'varDecl', varType, name: '', init: emptyExpr(nameToken.pos), pos: typeToken.pos };
    }

    this.next();
    const name = nameToken.value;

    if (!this.at('=')) {
      const found = this.peek();
      this.error(
        MOD_CODES.expectedValue,
        found.pos,
        `${name} has no value yet.`,
        `Write ${varType} ${name} = ${
          varType === 'string' ? '"something"' : varType === 'int' ? '3' : 'true'
        };`,
        csharpTechnical('missingSemicolon'),
      );
      this.syncToStatementBoundary();
      return { kind: 'varDecl', varType, name, init: emptyExpr(found.pos), pos: typeToken.pos };
    }

    this.next(); // '='
    const init = this.parseExpression();
    this.expectSemicolon(`after the value of ${name}`);
    return { kind: 'varDecl', varType, name, init, pos: typeToken.pos };
  }

  private parseAssignment(): Statement {
    const nameToken = this.next();
    const name = nameToken.value;
    const operator = this.peek();

    if (operator.value === '+=' || operator.value === '-=' || operator.value === '*=' || operator.value === '/=') {
      this.next();
      this.error(
        MOD_CODES.unsupportedSyntax,
        operator.pos,
        `Shorthand like ${operator.value} is not installed in the sandbox yet.`,
        `Write it out instead: ${name} = ${name} ${operator.value[0]} 1;`,
        csharpTechnical('unsupported'),
      );
      this.syncToStatementBoundary();
      return { kind: 'assign', name, value: emptyExpr(operator.pos), pos: nameToken.pos };
    }

    if (operator.value === '++' || operator.value === '--') {
      this.next();
      this.error(
        MOD_CODES.unsupportedSyntax,
        operator.pos,
        `Shorthand like ${operator.value} is not installed in the sandbox yet.`,
        `Write it out instead: ${name} = ${name} + 1;`,
        csharpTechnical('unsupported'),
      );
      this.syncToStatementBoundary();
      return { kind: 'assign', name, value: emptyExpr(operator.pos), pos: nameToken.pos };
    }

    if (!this.at('=')) {
      this.error(
        MOD_CODES.expectedValue,
        operator.pos,
        `${name} is on a line with no value assigned to it.`,
        `Either finish the line (${name} = ${name} + 1;) or delete it.`,
        csharpTechnical('missingSemicolon'),
      );
      this.syncToStatementBoundary();
      return { kind: 'assign', name, value: emptyExpr(operator.pos), pos: nameToken.pos };
    }

    this.next(); // '='
    const value = this.parseExpression();
    this.expectSemicolon(`after the new value of ${name}`);
    return { kind: 'assign', name, value, pos: nameToken.pos };
  }

  private expectSemicolon(context: string): void {
    if (this.at(';')) {
      this.next();
      return;
    }
    const found = this.peek();
    this.error(
      MOD_CODES.missingSemicolon,
      found.pos,
      `A line of code ends with ; — this one stops ${context}.`,
      'Add ; at the end of the line.',
      csharpTechnical('missingSemicolon'),
    );
    this.syncToStatementBoundary();
  }

  private parseIf(): Statement {
    const ifToken = this.next();

    if (!this.at('(')) {
      this.error(
        MOD_CODES.expectedValue,
        this.peek().pos,
        'The condition of an if needs round brackets.',
        'Format: if (score >= 300) { … }',
        csharpTechnical('expectedExpression'),
      );
    } else {
      this.next();
    }

    const condition = this.parseExpression();

    if (this.at(')')) {
      this.next();
    } else {
      this.error(
        MOD_CODES.expectedValue,
        this.peek().pos,
        'This condition is missing its closing bracket.',
        'Format: if (score >= 300) { … }',
        csharpTechnical('expectedExpression'),
      );
    }

    if (!this.at('{')) {
      this.error(
        MOD_CODES.missingBrace,
        this.peek().pos,
        'An if needs curly braces around what it does.',
        'Format: if (score >= 300) {\n    shield = true;\n}',
        csharpTechnical('missingSemicolon'),
      );
      this.syncToStatementBoundary();
      return { kind: 'if', condition, body: [], pos: ifToken.pos, endLine: condition.pos.line };
    }

    this.next(); // '{'
    const body: Statement[] = [];
    let endLine = condition.pos.line;

    while (!this.isAtEnd() && !this.at('}')) {
      const before = this.index;
      const statement = this.parseStatement();
      if (statement) {
        body.push(statement);
        endLine = statement.pos.line;
      } else if (this.at('}')) {
        break;
      }
      if (this.index === before || this.peek() === this.tokens[this.tokens.length - 1]) break;
    }

    if (this.at('}')) {
      endLine = this.peek().pos.line;
      this.next();
    } else {
      this.error(
        MOD_CODES.missingBrace,
        { line: endLine, column: 1 },
        'This if block never closes.',
        'Add } on its own line to close the block.',
        csharpTechnical('missingSemicolon'),
      );
    }

    return { kind: 'if', condition, body, pos: ifToken.pos, endLine };
  }

  private parseConsoleCall(): Statement | null {
    const consoleToken = this.next(); // Console

    if (!this.at('.')) {
      this.error(
        MOD_CODES.unknownName,
        consoleToken.pos,
        'Console only talks through Console.WriteLine in the sandbox.',
        'Try: Console.WriteLine("READY");',
        csharpTechnical('unknownName'),
      );
      this.syncToStatementBoundary();
      return null;
    }
    this.next(); // '.'

    const memberToken = this.peek();
    if (memberToken.kind !== 'identifier') {
      this.error(
        MOD_CODES.unknownName,
        memberToken.pos,
        'Console needs to know which member to use.',
        'Try: Console.WriteLine("READY");',
        csharpTechnical('unknownName'),
      );
      this.syncToStatementBoundary();
      return null;
    }
    this.next();

    if (memberToken.value !== 'WriteLine') {
      const replacement = memberToken.value === 'ReadLine' || memberToken.value === 'ReadKey';
      this.error(
        MOD_CODES.unsupportedSyntax,
        memberToken.pos,
        replacement
          ? 'The ship has no keyboard for Console.ReadLine — MODBOX reads your code as you type instead.'
          : `Console.${memberToken.value} is not wired into the sandbox.`,
        'Use Console.WriteLine("…") to send a message to Flight Log.',
        csharpTechnical('unknownName'),
      );
      this.syncToStatementBoundary();
      return null;
    }

    if (!this.at('(')) {
      this.error(
        MOD_CODES.expectedValue,
        this.peek().pos,
        'WriteLine needs round brackets.',
        'Try: Console.WriteLine(shipName);',
        csharpTechnical('expectedExpression'),
      );
      this.syncToStatementBoundary();
      return null;
    }
    this.next(); // '('

    let arg: Expr | undefined;
    if (!this.at(')')) {
      arg = this.parseExpression();
    }

    if (this.at(')')) {
      this.next();
    } else {
      this.error(
        MOD_CODES.expectedValue,
        this.peek().pos,
        'This WriteLine is missing its closing bracket.',
        'Try: Console.WriteLine("READY");',
        csharpTechnical('expectedExpression'),
      );
    }

    this.expectSemicolon('before its ;');
    return { kind: 'writeLine', arg, pos: consoleToken.pos };
  }

  /* -------------------------------------------------------- expression parsing */

  private parseExpression(): Expr {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.at('||') || this.at('|')) {
      const token = this.next();
      if (token.value === '|') {
        this.error(
          MOD_CODES.expectedValue,
          token.pos,
          'A single | is not a logical OR in the sandbox.',
          'Use two: ||',
          csharpTechnical('expectedExpression'),
        );
      }
      const right = this.parseLogicalAnd();
      left = { kind: 'logical', op: '||', left, right, pos: token.pos };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseComparison();
    while (this.at('&&') || this.at('&')) {
      const token = this.next();
      if (token.value === '&') {
        this.error(
          MOD_CODES.expectedValue,
          token.pos,
          'A single & is not a logical AND in the sandbox.',
          'Use two: &&',
          csharpTechnical('expectedExpression'),
        );
      }
      const right = this.parseComparison();
      left = { kind: 'logical', op: '&&', left, right, pos: token.pos };
    }
    return left;
  }

  private parseComparison(): Expr {
    const left = this.parseAdditive();
    const token = this.peek();
    const op = token.value as CompareOp;
    if (token.kind === 'operator' && COMPARE_OPS.includes(op)) {
      this.next();
      const right = this.parseAdditive();
      const next = this.peek();
      if (next.kind === 'operator' && (COMPARE_OPS as string[]).includes(next.value)) {
        this.error(
          MOD_CODES.badComparison,
          next.pos,
          'Compare one thing at a time.',
          'For two checks, join them with && — for example: if (score >= 300 && health > 20)',
          csharpTechnical('expectedExpression'),
        );
        this.next();
        return { kind: 'compare', op, left, right, pos: token.pos };
      }
      return { kind: 'compare', op, left, right, pos: token.pos };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.at('+') || this.at('-')) {
      const token = this.next();
      const op = token.value as BinaryOp;
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op, left, right, pos: token.pos };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.at('*') || this.at('/') || this.at('%')) {
      const token = this.next();
      if (token.value === '%') {
        this.error(
          MOD_CODES.unsupportedSyntax,
          token.pos,
          'The % operator is not installed in the sandbox yet.',
          'Use + - * / for now.',
          csharpTechnical('unsupported'),
        );
      }
      const op = (token.value === '%' ? '/' : token.value) as BinaryOp;
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right, pos: token.pos };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.at('!')) {
      const token = this.next();
      return { kind: 'unary', op: '!', operand: this.parseUnary(), pos: token.pos };
    }
    if (this.at('-')) {
      const token = this.next();
      return { kind: 'unary', op: '-', operand: this.parseUnary(), pos: token.pos };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.peek();

    if (token.kind === 'number') {
      this.next();
      return { kind: 'literal', value: Number(token.value), type: 'int', pos: token.pos };
    }

    if (token.kind === 'string') {
      this.next();
      return { kind: 'literal', value: token.value, type: 'string', pos: token.pos };
    }

    if (token.kind === 'keyword' && (token.value === 'true' || token.value === 'false')) {
      this.next();
      return { kind: 'literal', value: token.value === 'true', type: 'bool', pos: token.pos };
    }

    if (token.kind === 'identifier') {
      this.next();
      return { kind: 'identifier', name: token.value, pos: token.pos };
    }

    if (token.value === '(') {
      this.next();
      const inner = this.parseExpression();
      if (this.at(')')) {
        this.next();
      } else {
        this.error(
          MOD_CODES.expectedValue,
          this.peek().pos,
          'A bracket was opened but never closed.',
          'Add the missing ).',
          csharpTechnical('expectedExpression'),
        );
      }
      return inner;
    }

    if (token.kind === 'keyword') {
      const explanation = explainUnsupported(token.value);
      this.next();
      this.error(
        MOD_CODES.unsupportedSyntax,
        token.pos,
        explanation.message,
        explanation.hint,
        csharpTechnical('unsupported'),
      );
      return emptyExpr(token.pos);
    }

    this.next();
    this.error(
      MOD_CODES.expectedValue,
      token.pos,
      token.kind === 'eof'
        ? 'The line ends too early — a value is missing.'
        : `Expected a number, text in quotes, true/false or a variable name — found "${token.value}".`,
      'Example: enemySpeed = 4;',
      csharpTechnical('expectedExpression'),
    );
    return emptyExpr(token.pos);
  }
}

function emptyExpr(pos: Position): Expr {
  return { kind: 'literal', value: 0, type: 'int', pos };
}
