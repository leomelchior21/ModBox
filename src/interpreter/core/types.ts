/* ============================================================================
   MODBOX — INTERPRETER CORE TYPES
   Language-agnostic. Nothing in here may know about C#, Python or Swift.
   ========================================================================== */

export type VarType = 'string' | 'int' | 'bool';
export type LiteralValue = string | number | boolean;

export interface Position {
  line: number;
  column: number;
}

export type BinaryOp = '+' | '-' | '*' | '/';
export type CompareOp = '>' | '<' | '>=' | '<=' | '==' | '!=';
export type LogicalOp = '&&' | '||';
export type UnaryOp = '!' | '-';

export type Expr =
  | { kind: 'literal'; value: LiteralValue; type: VarType; pos: Position }
  | { kind: 'identifier'; name: string; pos: Position }
  | {
      kind: 'binary';
      op: BinaryOp;
      left: Expr;
      right: Expr;
      pos: Position;
    }
  | {
      kind: 'compare';
      op: CompareOp;
      left: Expr;
      right: Expr;
      pos: Position;
    }
  | {
      kind: 'logical';
      op: LogicalOp;
      left: Expr;
      right: Expr;
      pos: Position;
    }
  | { kind: 'unary'; op: UnaryOp; operand: Expr; pos: Position };

export type Statement =
  | {
      kind: 'varDecl';
      varType: VarType;
      name: string;
      init: Expr;
      pos: Position;
    }
  | { kind: 'assign'; name: string; value: Expr; pos: Position }
  | {
      kind: 'if';
      condition: Expr;
      body: Statement[];
      pos: Position;
      endLine: number;
    }
  | { kind: 'writeLine'; arg?: Expr; pos: Position };

export interface ProgramNode {
  kind: 'program';
  statements: Statement[];
}

/* ------------------------------------------------------------- diagnostics */

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  /** MODBOX internal code, e.g. MOD1003 */
  code: string;
  severity: Severity;
  /** 1-based line the issue is on */
  line: number;
  column: number;
  /** Short headline, e.g. "LINE 4 NEEDS ATTENTION" */
  title: string;
  /** The shortest useful explanation for a 13 year old */
  message: string;
  /** Optional action-shaped suggestion */
  hint?: string;
  /** The offending source line, for the editor highlight */
  sourceLine?: string;
  /** Formal C#-flavoured detail, hidden behind "technical details" */
  technical?: string;
  /** Marks a "you cannot control this yet" discovery message */
  discovery?: boolean;
}

export interface Notice {
  id: string;
  tone: 'info' | 'playful' | 'warn';
  message: string;
}

/* --------------------------------------------------------------- game model */

export type AsteroidKind = 'small-rock' | 'medium-rock' | 'big-rock';

/** Every programmable control a student can reach from code. */
export interface GameConfig {
  shipName: string;
  enemyType: AsteroidKind;
  enemyCount: number;
  enemySpeed: number;
  weaponType: string;
  laserPower: number;
  lives: number;
  shieldEnabled: boolean;
  rapidFireEnabled: boolean;
  homingEnabled: boolean;
  scoreMultiplier: number;
  worldGravity: number;
}

export type ConfigKey = keyof GameConfig;

/** Runtime values a rule may read while the game is running. */
export interface RuntimeValues {
  score: number;
  health: number;
  wave: number;
  enemiesRemaining: number;
}

export type RuntimeKey = keyof RuntimeValues;

export interface RuleAction {
  target: ConfigKey;
  value: Expr;
  /** Pretty text, used by the debug panel and rule traces */
  text: string;
}

export interface GameRule {
  id: string;
  line: number;
  condition: Expr;
  conditionText: string;
  actions: RuleAction[];
  /** Console.WriteLine inside the if body: evaluated live when the rule fires */
  writes: RuleWrite[];
}

export interface RuleWrite {
  arg: Expr;
  text: string;
}

export interface SymbolInfo {
  name: string;
  type: VarType;
  value: LiteralValue;
  text: string;
  line: number;
  /** true when a supported system name is bound to game config */
  mod?: ConfigKey;
  /** true for a name the student invented, bound only to a value */
  userOnly?: boolean;
}

export interface CommsLine {
  id: string;
  text: string;
  source: 'startup' | 'rule' | 'system';
}

export interface ProgramResult {
  ok: boolean;
  ast: ProgramNode;
  source: string;
  diagnostics: Diagnostic[];
  notices: Notice[];
  symbols: SymbolInfo[];
  config: Partial<GameConfig>;
  rules: GameRule[];
  comms: CommsLine[];
}

/* ------------------------------------------------------------------ summary */

export interface ProgramSummary {
  declares: Record<VarType, string[]>;
  writesCount: number;
  rulesCount: number;
  /** composite comparison strings used, e.g. [">=", "<="] */
  comparisons: string[];
  /** arithmetic operators used, e.g. ["+", "*"] */
  arithmeticOps: string[];
  /** runtime values referenced in rule conditions */
  runtimeRefs: RuntimeKey[];
  /** mod names the student actually set a value for */
  modsUsed: ConfigKey[];
  hasCondition: boolean;
  astNodes: number;
  /** keys used to detect "this line already exists" when missions are added */
  keys: string[];
}
