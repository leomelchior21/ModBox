import type { ConfigKey, LiteralValue, Notice, Position, VarType } from './types';
import {
  clampEnemyType,
  clampChoice,
  clampNumber,
  clampText,
  clampWeapon,
  NUMERIC_LIMITS,
} from './limits';
import type { ModDefinition } from './mods';
import { MOD_CODES } from './diagnostics';
import { csharpTechnical } from './diagnostics';
import type { DiagInput } from './diagnostics';

/* ============================================================================
   MODBOX — MOD BINDING
   Turns one value written by a student into a safe game value, or explains
   politely why that value cannot live where they put it.
   ========================================================================== */

export type ReportFn = (input: DiagInput) => void;

export interface BoundValue {
  value: LiteralValue;
  notice?: Notice;
}

type NumericModId = keyof typeof NUMERIC_LIMITS;

const NUMERIC_MOD_IDS = Object.keys(NUMERIC_LIMITS) as NumericModId[];

function isNumericMod(id: ConfigKey): id is NumericModId {
  return (NUMERIC_MOD_IDS as string[]).includes(id);
}

/** Human wording for a type expectation, used in friendly errors. */
function expectFor(mod: ModDefinition): string {
  if (mod.type === 'string') return 'text in quotes';
  if (mod.type === 'int') return 'a whole number';
  return 'true or false';
}

export function coerceModValue(
  mod: ModDefinition,
  raw: LiteralValue,
  report: ReportFn,
  pos: Position,
  source: string,
): BoundValue | null {
  if (mod.type === 'bool') {
    if (typeof raw !== 'boolean') {
      report({
        code: MOD_CODES.typeMismatch,
        pos,
        message: `${mod.name} is a bool, so it is either true or false.`,
        hint: `Write bool ${mod.name} = true; or bool ${mod.name} = false;`,
        technical: csharpTechnical('typeMismatch'),
        source,
      });
      return null;
    }
    return { value: raw };
  }

  if (isNumericMod(mod.id)) {
    if (typeof raw === 'boolean') {
      report({
        code: MOD_CODES.typeMismatch,
        pos,
        message: `${mod.name} counts with numbers, and true/false is not a number here.`,
        hint: `Try ${mod.example}`,
        technical: csharpTechnical('typeMismatch'),
        source,
      });
      return null;
    }
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(numeric)) {
      report({
        code: MOD_CODES.typeMismatch,
        pos,
        message: `${mod.name} needs ${expectFor(mod)}.`,
        hint: `Try ${mod.example}`,
        technical: csharpTechnical('typeMismatch'),
        source,
      });
      return null;
    }
    const clamped = clampNumber(mod.id, numeric);
    return { value: clamped.value, notice: clamped.notice };
  }

  // string mods
  if (typeof raw !== 'string') {
    report({
      code: MOD_CODES.typeMismatch,
      pos,
      message: `${mod.name} is text, so the value needs quotes.`,
      hint: `Try ${mod.example}`,
      technical: csharpTechnical('typeMismatch'),
      source,
    });
    return null;
  }

  if (mod.id === 'enemyType') {
    const clamped = clampEnemyType(raw);
    return { value: clamped.value, notice: clamped.notice };
  }
  if (mod.id === 'weaponType') {
    const clamped = clampWeapon(raw);
    return { value: clamped.value, notice: clamped.notice };
  }
  if (mod.id === 'shipType' || mod.id === 'backgroundColor' || mod.id === 'rockShape') {
    const clamped = clampChoice(mod.id, raw);
    return { value: clamped.value, notice: clamped.notice };
  }
  const clamped = clampText('shipName', raw);
  return { value: clamped.value, notice: clamped.notice };
}

/** Type check for a plain (non-Mod) student variable. */
export function coerceUserValue(
  varType: VarType,
  raw: LiteralValue,
  name: string,
  report: ReportFn,
  pos: Position,
  source: string,
): LiteralValue | null {
  const rawType: VarType =
    typeof raw === 'string' ? 'string' : typeof raw === 'boolean' ? 'bool' : 'int';

  if (rawType === varType) return raw;

  if (varType === 'string' && rawType === 'int') {
    report({
      code: MOD_CODES.typeMismatch,
      pos,
      message: `${name} is a string, so its value needs quotes.`,
      hint: `Try ${name} = "${raw}";`,
      technical: csharpTechnical('typeMismatch'),
      source,
    });
    return null;
  }

  if (varType === 'int' && rawType === 'string') {
    report({
      code: MOD_CODES.typeMismatch,
      pos,
      message: `${name} holds a whole number, so quotes turn it into text.`,
      hint: `Remove the quotes: ${name} = ${raw};`,
      technical: csharpTechnical('typeMismatch'),
      source,
    });
    return null;
  }

  if (varType === 'bool') {
    report({
      code: MOD_CODES.typeMismatch,
      pos,
      message: `${name} is a bool, so it can only hold true or false.`,
      hint: `${name} = true;`,
      technical: csharpTechnical('typeMismatch'),
      source,
    });
    return null;
  }

  report({
    code: MOD_CODES.typeMismatch,
    pos,
    message: `${name} holds ${expectFor({ type: varType } as ModDefinition)}, but a ${
      rawType === 'bool' ? 'bool' : rawType === 'string' ? 'string' : 'number'
    } was given.`,
    hint: `Change the type of ${name}, or change the value.`,
    technical: csharpTechnical('typeMismatch'),
    source,
  });
  return null;
}
