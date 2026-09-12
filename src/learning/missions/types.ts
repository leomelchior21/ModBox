import type {
  ConfigKey,
  GameConfig,
  ProgramResult,
  ProgramSummary,
} from '../../interpreter/core/types';
import type { RuntimeMetrics } from '../../games/vector-zero/engine/types';

/* ============================================================================
   MODBOX — MISSION SCHEMA
   Missions validate *structure and behaviour* from the parsed program plus
   live runtime metrics. Nothing here knows about C# text, so a future Python
   or Swift adapter inherits the whole campaign (spec §32).
   ========================================================================== */

export interface ValidationContext {
  code: string;
  program: ProgramResult;
  summary: ProgramSummary;
  /** the config the game is actually running (after unlocks + scenario) */
  config: GameConfig;
  /** mods the student wrote but has not discovered yet */
  ignored: { mod: ConfigKey; name: string }[];
  metrics: RuntimeMetrics;
  unlocked: ConfigKey[];
}

export interface MissionRequirement {
  id: string;
  label: string;
  test: (ctx: ValidationContext) => boolean;
}

export interface MissionConcept {
  name: string;
  tagline: string;
  explanation: string;
  example: string;
}

export interface MissionAddition {
  /** key used to detect whether this line already exists in the student's code */
  key: string;
  code: string;
}

export type MissionKind = 'mission' | 'final' | 'sandbox';

export interface Mission {
  id: string;
  order: number;
  /** codename shown in the brief, e.g. FIRST CONTACT */
  code: string;
  title: string;
  kind: MissionKind;
  concept?: MissionConcept;
  brief: string;
  action: string;
  hint?: string;
  /** shown when the mission is passed — the "MOD APPLIED" moment (spec §14) */
  appliedCopy?: string;
  starter: string;
  additions: MissionAddition[];
  quickInsert: string[];
  scenario: Partial<GameConfig>;
  unlocks: ConfigKey[];
  requirements: MissionRequirement[];
  playPrompt: string;
}
