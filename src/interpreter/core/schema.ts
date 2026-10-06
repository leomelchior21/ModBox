import type { ModDefinition } from '../../mods/types';
import type { LiteralValue, Position } from './types';
import type { BoundValue, ReportFn } from './modBinding';
import { MOD_CODES } from './diagnostics';

export interface BindingSchema<Key extends string = string> {
  mods: readonly ModDefinition<Key>[];
  runtimeNames: readonly string[];
  coerceValue(mod: ModDefinition<Key>, raw: LiteralValue, report: ReportFn, pos: Position, source: string): BoundValue | null;
}

/** Build bindings from a game's catalog without registering global mod names. */
export function createModSchema<Key extends string>(
  mods: readonly ModDefinition<Key>[],
  runtimeNames: readonly string[] = [],
): BindingSchema<Key> {
  const ids = new Set<string>();
  const names = new Set<string>(runtimeNames);
  if (names.size !== runtimeNames.length || runtimeNames.some(name => !/^[A-Za-z_]\w*$/.test(name))) throw new Error('Invalid or duplicate runtime name');
  for (const mod of mods) {
    if (!mod.id || !/^[A-Za-z_]\w*$/.test(mod.name) || ids.has(mod.id) || names.has(mod.name)) {
      throw new Error(`Invalid or duplicate mod: ${mod.id}/${mod.name}`);
    }
    if (mod.limits && (mod.type !== 'int' || !Number.isInteger(mod.limits.min) || !Number.isInteger(mod.limits.max) || mod.limits.min > mod.limits.max)) {
      throw new Error(`Invalid limits for ${mod.name}`);
    }
    if (mod.values && !mod.values.length) throw new Error(`Empty choices for ${mod.name}`);
    if (mod.values && mod.type !== 'string') throw new Error(`Choices require text for ${mod.name}`);
    ids.add(mod.id); names.add(mod.name);
  }
  return { mods, runtimeNames, coerceValue: coerceCatalogValue };
}

export function coerceCatalogValue(
  mod: ModDefinition,
  raw: LiteralValue,
  report: ReportFn,
  pos: Position,
  source: string,
): BoundValue | null {
  const expected = mod.type === 'int' ? 'number' : mod.type === 'bool' ? 'boolean' : 'string';
  if (typeof raw !== expected || (typeof raw === 'number' && !Number.isFinite(raw))) {
    report({ code: MOD_CODES.typeMismatch, pos, source, message: `${mod.name} needs ${mod.type === 'int' ? 'a whole number' : mod.type === 'bool' ? 'true or false' : 'text in quotes'}.`, hint: `Try ${mod.example}` });
    return null;
  }
  let value = raw;
  if (typeof raw === 'number') {
    value = Math.trunc(raw);
    if (mod.limits) value = Math.max(mod.limits.min, Math.min(mod.limits.max, value));
  } else if (typeof raw === 'string') {
    value = raw.slice(0, mod.maxLength ?? 64);
    if (mod.values && !mod.values.includes(value)) {
      report({ code: MOD_CODES.typeMismatch, pos, source, message: `${mod.name} accepts ${mod.values.map(choice => `"${choice}"`).join(', ')}.`, hint: `Try ${mod.example}` });
      return null;
    }
  }
  return {
    value,
    notice: value === raw ? undefined : { id: `limit:${mod.id}`, tone: 'info', message: `${mod.name} was limited to ${String(value)}.` },
  };
}
