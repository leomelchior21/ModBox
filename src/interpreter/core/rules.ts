import type {
  ConfigKey,
  GameConfig,
  GameRule,
  LiteralValue,
  RuleWrite,
  RuntimeValues,
} from './types';
import { evalExpr, makeScope, type EvalScope } from './evaluate';

/* ============================================================================
   MODBOX — RULE ENGINE
   A supported `if` statement does not run once. It becomes a live rule:
   WHILE  score >= 300  →  enemySpeed = 5
   Rules are always evaluated against the BASE config so results stay stable
   and predictable for the student.
   ========================================================================== */

export interface RuleTrace {
  ruleId: string;
  line: number;
  text: string;
  targets: ConfigKey[];
  writes: RuleWrite[];
}

export interface RuleFrame {
  /** values produced by currently-true rules */
  overrides: Partial<Record<ConfigKey, LiteralValue>>;
  activeRuleIds: string[];
  traces: RuleTrace[];
  errors: string[];
}

export const EMPTY_RULE_FRAME: RuleFrame = {
  overrides: {},
  activeRuleIds: [],
  traces: [],
  errors: [],
};

export function evaluateRules(
  rules: GameRule[],
  baseConfig: GameConfig,
  runtime: RuntimeValues,
  constants: Record<string, LiteralValue> = {},
): RuleFrame {
  const scope: EvalScope = makeScope(baseConfig, runtime, constants);
  const frame: RuleFrame = { overrides: {}, activeRuleIds: [], traces: [], errors: [] };

  for (const rule of rules) {
    const condition = evalExpr(rule.condition, scope);
    if (!condition.ok) {
      frame.errors.push(rule.conditionText + ' — ' + condition.message);
      continue;
    }
    if (condition.value !== true) continue;

    frame.activeRuleIds.push(rule.id);
    const targets: ConfigKey[] = [];
    for (const action of rule.actions) {
      const evaluated = evalExpr(action.value, scope);
      if (!evaluated.ok) {
        frame.errors.push(`${rule.conditionText} → ${action.target}: ${evaluated.message}`);
        continue;
      }
      frame.overrides[action.target] = evaluated.value;
      targets.push(action.target);
    }
    if (targets.length || rule.writes.length) {
      frame.traces.push({
        ruleId: rule.id,
        line: rule.line,
        text: `${rule.conditionText} → ${rule.actions.map((a) => a.text).join(', ')}`,
        targets,
        writes: rule.writes,
      });
    }
  }

  return frame;
}

/** Apply rule overrides on top of the base config (typed, no clamping here). */
export function applyOverrides(
  base: GameConfig,
  overrides: Partial<Record<ConfigKey, LiteralValue>>,
): GameConfig {
  const next: GameConfig = { ...base };
  for (const [key, value] of Object.entries(overrides) as [ConfigKey, LiteralValue][]) {
    const current = base[key];
    if (typeof current === 'number' && typeof value !== 'number') continue;
    if (typeof current === 'boolean' && typeof value !== 'boolean') continue;
    if (typeof current === 'string' && typeof value !== 'string') continue;
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

export function diffConfigKeys(a: GameConfig, b: GameConfig): ConfigKey[] {
  const keys = Object.keys(a) as ConfigKey[];
  return keys.filter((key) => a[key] !== b[key]);
}
