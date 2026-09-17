import type { GameConfig, ProgramResult } from '../core/types';
import type { LanguageAdapter, QuickInsertToken } from '../core/adapter';
import { languageById } from '../core/adapter';
import { parseSource } from '../csharp/parser';
import { bindProgram } from '../csharp/binder';
import { csharpAdapter } from '../csharp';
import { localizeToken, swiftToCanonical } from '../languageSyntax';

export function parseSwift(source: string): ProgramResult {
  const canonical = swiftToCanonical(source);
  const parsed = parseSource(canonical.source);
  const sourceLines = source.split(/\r?\n/);
  const diagnostics = [...canonical.diagnostics, ...parsed.diagnostics].map((diagnostic) => ({
    ...diagnostic,
    technical: undefined,
    sourceLine: sourceLines[diagnostic.line - 1] ?? diagnostic.sourceLine,
  }));
  const bound = bindProgram(parsed.ast, source, diagnostics);
  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    ast: parsed.ast, source, diagnostics,
    notices: bound.notices, symbols: bound.symbols,
    config: bound.config as Partial<GameConfig>, rules: bound.rules, comms: bound.comms,
  };
}

export const swiftAdapter: LanguageAdapter = {
  meta: languageById('swift'),
  parse: parseSwift,
  quickInsert: (allowed) => csharpAdapter.quickInsert(allowed).map((token: QuickInsertToken) => localizeToken(token, 'swift')),
};
