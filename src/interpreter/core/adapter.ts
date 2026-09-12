import type { ProgramResult } from './types';

/* ============================================================================
   MODBOX — LANGUAGE ADAPTER CONTRACT
   Student Code → Language Adapter → Educational AST → GameConfig + GameRules
   → game engine. The flavour of the adapter is C# today, Python or Swift
   tomorrow, and the engine never learns the difference.
   ========================================================================== */

export type LanguageId = 'csharp' | 'python' | 'swift';

export interface LanguageMeta {
  id: LanguageId;
  label: string;
  short: string;
  status: 'play' | 'coming-soon';
  blurb: string;
  /** one-line teaser for the language select screen */
  detail: string;
  /** 0–1 progress of this language's support */
  support: number;
}

/** Chips are grouped so a long insert bar still scans in one glance (§F). */
export type QuickInsertGroup = 'type' | 'value' | 'logic' | 'action' | 'mod';

export interface QuickInsertToken {
  label: string;
  /** text inserted at the cursor */
  insert: string;
  /** how far to move the caret back from the end of the inserted text */
  caretBack?: number;
  hint?: string;
  /** personality of the token, drives the chip's colour + cluster label */
  group?: QuickInsertGroup;
}

export interface LanguageAdapter {
  meta: LanguageMeta;
  parse: (source: string) => ProgramResult;
  /** Insert helpers relevant to the current mission (chips near the editor). */
  quickInsert: (allowedLabels?: string[]) => QuickInsertToken[];
}

export const LANGUAGES: LanguageMeta[] = [
  {
    id: 'csharp',
    label: 'C#',
    short: 'C#',
    status: 'play',
    blurb: 'Ship it in C#',
    detail: 'Variables, booleans and rules — the full Vector Zero campaign.',
    support: 1,
  },
  {
    id: 'python',
    label: 'Python',
    short: 'PY',
    status: 'coming-soon',
    blurb: 'Python adapter',
    detail: 'Same arcade, same Mods — indentation instead of braces.',
    support: 0,
  },
  {
    id: 'swift',
    label: 'Swift',
    short: 'SW',
    status: 'coming-soon',
    blurb: 'Swift adapter',
    detail: 'Build the arcade on Apple platforms, in Swift.',
    support: 0,
  },
];

export function languageById(id: LanguageId): LanguageMeta {
  const found = LANGUAGES.find((language) => language.id === id);
  if (!found) throw new Error(`Unknown language: ${id}`);
  return found;
}
