import type { LanguageId } from './core/adapter';
import type { LiteralValue, ProgramResult } from './core/types';
import type { BindingSchema } from './core/schema';
import { bindProgram } from './csharp/binder';
import { parseSource } from './csharp/parser';
import { localizeLanguageCopy, pythonToCanonical, swiftToCanonical } from './languageSyntax';
import { evaluateRulesInScope } from './core/rules';

/** The same educational grammar, bound exclusively to the selected game. */
export function parseGameScript<Config extends object>(
  source: string,
  language: LanguageId,
  schema: BindingSchema<Extract<keyof Config, string>>,
): ProgramResult<Config> {
  const canonical = language === 'python' ? pythonToCanonical(source) : language === 'swift' ? swiftToCanonical(source) : { source, diagnostics: [] };
  const parsed = parseSource(canonical.source);
  const diagnostics = [...canonical.diagnostics, ...parsed.diagnostics];
  const bound = bindProgram(parsed.ast, source, diagnostics, schema);
  const lines = source.split(/\r?\n/);
  return {
    ok: !diagnostics.some(diagnostic => diagnostic.severity === 'error'),
    ast: parsed.ast, source,
    diagnostics: diagnostics.map(diagnostic => ({ ...diagnostic, message: localizeLanguageCopy(diagnostic.message, language), hint: diagnostic.hint ? localizeLanguageCopy(diagnostic.hint, language) : undefined, technical: language === 'csharp' ? diagnostic.technical : undefined, sourceLine: lines[diagnostic.line - 1] })),
    ...bound,
    config: bound.config as Partial<Config>,
  };
}

/** Evaluate custom runtime values and clamp live changes using the same catalog. */
export function evaluateGameScript<Config extends object>(
  program: ProgramResult<Config>,
  baseConfig: Config,
  runtime: Record<string, LiteralValue>,
  schema: BindingSchema<Extract<keyof Config, string>>,
) {
  if (!program.ok) return { config: { ...baseConfig }, frame: { overrides: {}, activeRuleIds: [], traces: [], errors: program.diagnostics.filter(diagnostic => diagnostic.severity === 'error').map(diagnostic => diagnostic.message) } };
  const modValues: Record<string, LiteralValue> = {};
  for (const mod of schema.mods) modValues[mod.name] = baseConfig[mod.id] as LiteralValue;
  const constants = Object.fromEntries(program.symbols.filter(symbol => symbol.userOnly).map(symbol => [symbol.name, symbol.value]));
  const frame = evaluateRulesInScope(program.rules, { runtime, modValues, constants });
  const config = { ...baseConfig };
  for (const mod of schema.mods) {
    const override = frame.overrides[mod.id];
    if (override === undefined) continue;
    const coerced = schema.coerceValue(mod, override, input => frame.errors.push(input.message), { line: 0, column: 0 }, program.source);
    if (coerced) Object.assign(config, { [mod.id]: coerced.value });
  }
  return { config, frame };
}
