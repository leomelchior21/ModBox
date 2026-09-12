import { DEFAULT_CONFIG } from '../../interpreter/core/limits';
import { MOD_BY_ID } from '../../interpreter/core/mods';
import type { ConfigKey, GameConfig, ProgramResult } from '../../interpreter/core/types';
import type { RuntimeMetrics } from '../../games/vector-zero/engine/types';
import type { Mission } from '../missions/types';
import type { ValidationContext } from '../missions/types';

/* ============================================================================
   MODBOX — MISSION VALIDATION
   Validation reads the parsed program + live metrics. It never compares code
   strings, so students can solve a mission any way they like (spec §32).
   ========================================================================== */

export interface RequirementResult {
  id: string;
  label: string;
  done: boolean;
}

export interface MissionValidation {
  passed: boolean;
  results: RequirementResult[];
  done: number;
  total: number;
}

export interface UnlockFilter {
  config: Partial<GameConfig>;
  ignored: { mod: ConfigKey; name: string }[];
}

/** Mods the student wrote but has not discovered yet are held back politely. */
export function filterConfigToUnlocked(
  config: Partial<GameConfig>,
  unlocked: ConfigKey[],
): UnlockFilter {
  const allowed: Partial<GameConfig> = {};
  const ignored: { mod: ConfigKey; name: string }[] = [];

  for (const [key, value] of Object.entries(config) as [ConfigKey, GameConfig[ConfigKey]][]) {
    if (unlocked.includes(key)) {
      (allowed as Record<ConfigKey, unknown>)[key] = value;
    } else {
      ignored.push({ mod: key, name: MOD_BY_ID[key]?.name ?? key });
    }
  }

  return { config: allowed, ignored };
}

export function resolveLiveConfig(
  scenario: Partial<GameConfig>,
  codeConfig: Partial<GameConfig>,
  unlocked: ConfigKey[],
): GameConfig {
  const { config } = filterConfigToUnlocked(codeConfig, unlocked);
  return { ...DEFAULT_CONFIG, ...scenario, ...config };
}

export interface ValidationInput {
  code: string;
  program: ProgramResult;
  config: GameConfig;
  metrics: RuntimeMetrics;
  unlocked: ConfigKey[];
  ignored: { mod: ConfigKey; name: string }[];
}

export function validateMission(mission: Mission, ctx: ValidationContext): MissionValidation {
  const results: RequirementResult[] = mission.requirements.map((requirement) => {
    let done = false;
    try {
      done = requirement.test(ctx);
    } catch {
      done = false;
    }
    return { id: requirement.id, label: requirement.label, done };
  });

  const done = results.filter((result) => result.done).length;
  return {
    passed: results.length > 0 ? done === results.length : false,
    results,
    done,
    total: results.length,
  };
}

export function makeValidationContext(input: ValidationInput, summary: ValidationContext['summary']) {
  return {
    code: input.code,
    program: input.program,
    summary,
    config: input.config,
    metrics: input.metrics,
    unlocked: input.unlocked,
    ignored: input.ignored,
  } satisfies ValidationContext;
}
