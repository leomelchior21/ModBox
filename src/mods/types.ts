import type { LiteralValue, VarType } from '../interpreter/core/types';

/** A game owns its control names, values, limits and presentation. */
export interface ModDefinition<Key extends string = string> {
  id: Key;
  name: string;
  type: VarType;
  label: string;
  blurb: string;
  /** Canonical C# subset; the shared UI translates this to Python or Swift. */
  example: string;
  values?: readonly string[];
  range?: string;
  limits?: { min: number; max: number };
  maxLength?: number;
  defaultValue?: LiteralValue;
  glyph?: string;
  unlockAt: number;
}

export interface CopilotGuidance {
  message: string;
  hint?: string;
  targetId?: string;
}

export interface CodeToolDefinition {
  id: string;
  name: string;
  label: string;
  type: 'int' | 'write' | 'condition';
  blurb: string;
  example: string;
  glyph: string;
  unlockAt: number;
}
