import type { LanguageId } from '../interpreter/core/adapter';
import type { ModInsertMode } from './modEditing';

type Section = 'variable' | 'update' | 'output' | 'rule';

function isVariableLine(line: string, language: LanguageId): boolean {
  if (/^\s/.test(line) || !line.trim()) return false;
  if (language === 'csharp') return /^(?:string|int|bool)\s+[A-Za-z_]\w*\s*=.*;\s*$/.test(line);
  if (language === 'swift') return /^(?:var|let)\s+[A-Za-z_]\w*(?:\s*:\s*(?:String|Int|Bool))?\s*=/.test(line);
  return sectionForSnippet(line, 'python') === 'variable';
}

/** Removes only blank rows between adjacent top-level variable declarations. */
export function normalizeVariableSpacing(source: string, language: LanguageId): string {
  const lines = source.split(/\r?\n/);
  return lines.filter((line, index) => {
    if (line.trim()) return true;
    let previous = index - 1;
    let next = index + 1;
    while (previous >= 0 && !lines[previous].trim()) previous -= 1;
    while (next < lines.length && !lines[next].trim()) next += 1;
    return !(previous >= 0 && next < lines.length
      && isVariableLine(lines[previous], language)
      && isVariableLine(lines[next], language));
  }).join('\n');
}

function sectionForSnippet(snippet: string, language: Exclude<LanguageId, 'csharp'>): Section {
  const line = snippet.trimStart();
  if (/^if\b/.test(line)) return 'rule';
  if (/^print\s*\(/.test(line)) return 'output';
  if (language === 'swift') return /^(?:var|let)\s+[A-Za-z_]\w*/.test(line) ? 'variable' : 'update';
  const assignment = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
  if (!assignment) return 'update';
  const value = assignment[2].trim();
  return /^(?:True|False|-?\d+(?:\s*[-+*/]\s*-?\d+)*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(value)
    ? 'variable'
    : 'update';
}

function topLevelSections(source: string, language: Exclude<LanguageId, 'csharp'>) {
  const lines: { from: number; section: Section }[] = [];
  let offset = 0;
  for (const line of source.split(/(?<=\n)/)) {
    const text = line.replace(/\r?\n$/, '');
    if (text.trim() && !/^\s/.test(text) && !/^(?:#|\/\/|})/.test(text.trim())) {
      lines.push({ from: offset, section: sectionForSnippet(text, language) });
    }
    offset += line.length;
  }
  return lines;
}

/** Places Python and Swift snippets without adding gaps between declarations. */
export function placeLanguageSnippet(
  source: string,
  snippet: string,
  language: Exclude<LanguageId, 'csharp'>,
  mode: ModInsertMode = 'replace',
): string {
  const cleanSnippet = snippet.trim();
  const section = sectionForSnippet(cleanSnippet, language);
  const name = language === 'swift'
    ? cleanSnippet.match(/^(?:var|let)\s+([A-Za-z_]\w*)/)?.[1]
    : section === 'variable' ? cleanSnippet.match(/^([A-Za-z_]\w*)\s*=/)?.[1] : undefined;
  const declarationPattern = name
    ? (language === 'swift'
      ? new RegExp(`^\\s*(?:var|let)\\s+${name}\\b.*$`, 'm')
      : new RegExp(`^\\s*${name}\\s*=.*$`, 'm'))
    : null;
  if (mode === 'replace' && declarationPattern?.test(source)) {
    return source.replace(declarationPattern, cleanSnippet);
  }

  const order: Record<Section, number> = { variable: 0, update: 1, output: 2, rule: 3 };
  const boundary = topLevelSections(source, language).find((line) => order[line.section] > order[section]);
  const at = boundary?.from ?? source.length;
  const before = source.slice(0, at).trimEnd();
  const after = source.slice(at).trimStart();
  const beforeGap = before ? (section === 'variable' ? '\n' : '\n\n') : '';
  const afterGap = after ? (section === 'variable' && sectionForSnippet(after, language) === 'variable' ? '\n' : '\n\n') : '';
  return normalizeVariableSpacing(`${before}${beforeGap}${cleanSnippet}${afterGap}${after}`, language);
}
