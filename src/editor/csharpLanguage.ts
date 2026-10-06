import { StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { csharp } from '@codemirror/legacy-modes/mode/clike';
import type { ModDefinition } from '../mods/types';
import { modboxHighlightStyle } from './theme';

/* ============================================================================
   MODBOX — C# EDITOR LANGUAGE
   A real C# highlighting mode (StreamLanguage) plus completions that only
   offer things the sandbox actually runs — teaching by suggestion.
   ========================================================================== */

export const csharpLanguage = StreamLanguage.define(csharp);
export const csharpHighlighting = syntaxHighlighting(modboxHighlightStyle);

export const SUPPORTED_SNIPPETS: { label: string; type: string; detail?: string }[] = [
  { label: 'string', type: 'keyword', detail: 'text value' },
  { label: 'int', type: 'keyword', detail: 'whole number' },
  { label: 'bool', type: 'keyword', detail: 'true or false' },
  { label: 'if', type: 'keyword', detail: 'rule that reacts while playing' },
  { label: 'true', type: 'keyword' },
  { label: 'false', type: 'keyword' },
  { label: 'Console.WriteLine', type: 'function', detail: 'send a message to the game log' },
];

export function csharpCompletions(context: CompletionContext, mods: readonly ModDefinition[], runtimeLabels: Readonly<Record<string, string>>): CompletionResult | null {
  const word = context.matchBefore(/[A-Za-z_][\w.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const options = [
    ...SUPPORTED_SNIPPETS,
    ...mods.map((mod) => ({
      label: mod.name,
      type: 'variable',
      detail: `${mod.type} · ${mod.blurb}`,
    })),
    ...Object.entries(runtimeLabels).map(([name, label]) => ({
      label: name,
      type: 'property',
      detail: `live value · ${label}`,
    })),
  ];

  return {
    from: word.from,
    options: options.map((option) => ({ ...option, boost: option.type === 'keyword' ? 1 : 0 })),
    validFor: /^[\w.]*$/,
  };
}
