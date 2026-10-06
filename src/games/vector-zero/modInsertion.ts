import { codeBlocks, placeMod } from '../../editor/modEditing';
import { placeLanguageSnippet } from '../../editor/languageEditing';
import type { LanguageId } from '../../interpreter/core/adapter';
import { formatCodeForLanguage, swiftToCanonical } from '../../interpreter/languageSyntax';
import { CODE_TOOLS } from '../../learning/copilot';

/** Reset the rule's starting value in the same transaction as its insertion. */
export function prepareVectorModInsert(source: string, snippet: string, language: LanguageId): string {
  const tool = CODE_TOOLS.find(tool =>
    (tool.id === 'score-rule' || tool.id === 'health-rule') &&
    formatCodeForLanguage(tool.example, language).trim() === snippet.trim());
  if (!tool) return source;

  const name = tool.id === 'score-rule' ? 'shield' : 'laserPower';
  const declaration = name === 'shield' ? 'bool shield = false;' : 'int laserPower = 1;';
  if (language === 'csharp') {
    const blocks = codeBlocks(source);
    if (!blocks) return source;
    const targets = blocks.filter(block =>
      (block.statement.kind === 'varDecl' || block.statement.kind === 'assign') && block.statement.name === name);
    const firstDeclaration = targets.find(block => block.statement.kind === 'varDecl');
    let next = source;
    for (const block of [...targets].reverse()) {
      next = next.slice(0, block.from) + (block === firstDeclaration ? declaration : '') + next.slice(block.to);
    }
    return firstDeclaration ? next : placeMod(next, declaration, 'replace');
  }

  const replacement = formatCodeForLanguage(declaration, language);
  // Swift allows indentation outside a rule; use its AST to keep nested actions intact.
  const swiftBlocks = language === 'swift' ? codeBlocks(swiftToCanonical(source).source) : null;
  if (language === 'swift' && !swiftBlocks) return source;
  const swiftLines = new Set(swiftBlocks?.filter(block =>
    (block.statement.kind === 'varDecl' || block.statement.kind === 'assign') && block.statement.name === name
  ).map(block => block.statement.pos.line));
  const assignment = new RegExp(`^${name}\\s*=(?!=)`);
  let replaced = false;
  const next = source.split('\n').map((line, index) => {
    if (language === 'swift' ? !swiftLines.has(index + 1) : !assignment.test(line)) return line;
    if (replaced) return '';
    replaced = true;
    const comment = line.match(language === 'python' ? /\s+#.*$/ : /\s+\/\/.*$/)?.[0] ?? '';
    return (line.match(/^\s*/)?.[0] ?? '') + replacement + comment;
  }).join('\n');
  return replaced ? next : placeLanguageSnippet(next, replacement, language, 'replace');
}
