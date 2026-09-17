import type { LanguageId, QuickInsertToken } from './core/adapter';
import type { Diagnostic, VarType } from './core/types';
import type { Mission } from '../learning/missions/types';
import type { ModDefinition } from './core/mods';
import type { CodeToolDefinition } from '../learning/copilot';

const TYPE_WORD: Record<LanguageId, Record<VarType, string>> = {
  csharp: { string: 'string', int: 'int', bool: 'bool' },
  python: { string: 'str', int: 'int', bool: 'bool' },
  swift: { string: 'String', int: 'Int', bool: 'Bool' },
};

export function typeLabelForLanguage(type: VarType, language: LanguageId): string {
  return TYPE_WORD[language][type];
}

function stripComment(line: string, marker: '#' | '//'): string {
  let quote = '';
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && quote) { escaped = true; continue; }
    if ((char === '"' || char === "'") && (!quote || quote === char)) { quote = quote ? '' : char; continue; }
    if (!quote && line.startsWith(marker, index)) return line.slice(0, index);
  }
  return line;
}

export function fileNameForLanguage(language: LanguageId): string {
  return language === 'python' ? 'main.py' : language === 'swift' ? 'main.swift' : 'main.cs';
}

export function codeKey(language: LanguageId, missionId: string): string {
  return `${language}:${missionId}`;
}

function pythonExpression(expression: string): string {
  return expression
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False')
    .replace(/&&/g, 'and')
    .replace(/\|\|/g, 'or')
    .replace(/!\s*(?!=)/g, 'not ');
}

function canonicalExpression(expression: string): string {
  return expression
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_match, content: string) => `"${content.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`)
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\s+/g, '!');
}

/** Converts the supported C# teaching subset to valid, idiomatic source. */
export function formatCodeForLanguage(source: string, language: LanguageId): string {
  if (language === 'csharp' || !source.trim()) return source;
  const output: string[] = [];
  for (const original of source.split(/\r?\n/)) {
    const indent = original.match(/^\s*/)?.[0] ?? '';
    const line = original.trim();
    if (!line) { output.push(''); continue; }
    if (line.startsWith('//')) {
      output.push(`${indent}${language === 'python' ? '#' : '//'}${line.slice(2)}`);
      continue;
    }
    if (line === '{') continue;
    if (line === '}') {
      if (language === 'swift') output.push(`${indent}}`);
      continue;
    }

    const declaration = line.match(/^(string|int|bool)\s+([A-Za-z_]\w*)\s*=\s*(.+);$/);
    if (declaration) {
      const [, type, name, value] = declaration as [string, VarType, string, string];
      if (language === 'python') output.push(`${indent}${name} = ${pythonExpression(value)}`);
      else output.push(`${indent}var ${name}: ${TYPE_WORD.swift[type]} = ${value}`);
      continue;
    }

    const write = line.match(/^Console\.WriteLine\((.*)\);$/);
    if (write) { output.push(`${indent}print(${language === 'python' ? pythonExpression(write[1]) : write[1]})`); continue; }
    const condition = line.match(/^if\s*\((.*)\)$/);
    if (condition) {
      output.push(language === 'python'
        ? `${indent}if ${pythonExpression(condition[1])}:`
        : `${indent}if ${condition[1]} {`);
      continue;
    }
    const bareCondition = line.match(/^if\s*\((.*)\)\s*\{$/);
    if (bareCondition) {
      output.push(language === 'python'
        ? `${indent}if ${pythonExpression(bareCondition[1])}:`
        : `${indent}if ${bareCondition[1]} {`);
      continue;
    }
    output.push(`${indent}${language === 'python' ? pythonExpression(line.replace(/;$/, '')) : line.replace(/;$/, '')}`);
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n');
}

function inferType(value: string): VarType | null {
  const trimmed = value.trim();
  if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed)) return 'string';
  if (/^(?:true|false|True|False)$/.test(trimmed)) return 'bool';
  if (/^-?\d+(?:\s*[-+*/]\s*-?\d+)*$/.test(trimmed)) return 'int';
  return null;
}

function adapterError(source: string, line: number, message: string, hint: string): Diagnostic {
  return {
    code: 'MOD1006', severity: 'error', line, column: 1,
    title: `LINE ${line} NEEDS ATTENTION`, message, hint,
    sourceLine: source.split(/\r?\n/)[line - 1] ?? '',
  };
}

export interface CanonicalSource {
  source: string;
  diagnostics: Diagnostic[];
}

/** Translates supported Python into the canonical parser grammar, preserving line numbers. */
export function pythonToCanonical(source: string): CanonicalSource {
  const output: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const declared = new Set<string>();
  const blocks: number[] = [];
  let awaitingIndent: { indent: number; line: number } | null = null;
  const lines = source.split(/\r?\n/);

  lines.forEach((original, index) => {
    const lineNumber = index + 1;
    if (/^\s*#/.test(original)) { output.push(''); return; }
    const clean = stripComment(original, '#');
    const trimmed = clean.trim();
    const indentText = clean.match(/^\s*/)?.[0].replace(/\t/g, '    ') ?? '';
    const indent = indentText.length;
    if (!trimmed) { output.push(''); return; }

    if (awaitingIndent) {
      if (indent <= awaitingIndent.indent) {
        diagnostics.push(adapterError(source, lineNumber, 'The code inside a Python if rule must be indented.', 'Add four spaces before the line that belongs to the rule.'));
      }
      awaitingIndent = null;
    }

    while (blocks.length && indent <= blocks.at(-1)!) {
      output.push(`${' '.repeat(blocks.at(-1)!)} }`);
      blocks.pop();
    }

    const condition = trimmed.match(/^if\s+(.+):$/);
    if (condition) {
      output.push(`${indentText}if (${canonicalExpression(condition[1])}) {`);
      blocks.push(indent);
      awaitingIndent = { indent, line: lineNumber };
      return;
    }
    if (/^if\b/.test(trimmed)) {
      diagnostics.push(adapterError(source, lineNumber, 'A Python if statement ends with a colon.', 'Example: if score >= 300:'));
      output.push('');
      return;
    }
    const print = trimmed.match(/^print\((.*)\)$/);
    if (print) { output.push(`${indentText}Console.WriteLine(${canonicalExpression(print[1])});`); return; }
    const assignment = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignment && !/^(?:while|for)\b/.test(trimmed)) {
      const [, name, rawValue] = assignment;
      const value = canonicalExpression(rawValue);
      const type = inferType(value);
      if (!declared.has(name) && type) {
        declared.add(name);
        output.push(`${indentText}${type} ${name} = ${value};`);
      } else {
        output.push(`${indentText}${name} = ${value};`);
      }
      return;
    }
    diagnostics.push(adapterError(source, lineNumber, 'That line is outside the Python subset used by MODBOX.', 'Use assignments, print(...), or an indented if ...: block.'));
    output.push('');
  });
  const danglingRule = awaitingIndent as { indent: number; line: number } | null;
  if (danglingRule) diagnostics.push(adapterError(source, danglingRule.line, 'This Python if rule needs an indented body.', 'Add an indented assignment on the next line.'));
  while (blocks.length) { output.push(`${' '.repeat(blocks.pop()!)} }`); }
  return { source: output.join('\n'), diagnostics };
}

/** Translates supported Swift into the canonical parser grammar. */
export function swiftToCanonical(source: string): CanonicalSource {
  const output: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((original, index) => {
    const lineNumber = index + 1;
    const indent = original.match(/^\s*/)?.[0] ?? '';
    const line = stripComment(original, '//').trim().replace(/;$/, '');
    if (!line) { output.push(''); return; }
    if (line === '}') { output.push(`${indent}}`); return; }
    const declaration = line.match(/^(?:var|let)\s+([A-Za-z_]\w*)(?:\s*:\s*(String|Int|Bool))?\s*=\s*(.+)$/);
    if (declaration) {
      const [, name, annotation, value] = declaration;
      const mapped = annotation === 'String' ? 'string' : annotation === 'Int' ? 'int' : annotation === 'Bool' ? 'bool' : inferType(value);
      if (!mapped) diagnostics.push(adapterError(source, lineNumber, `MODBOX cannot infer the type of "${name}".`, 'Add : String, : Int, or : Bool after the name.'));
      else output.push(`${indent}${mapped} ${name} = ${value};`);
      return;
    }
    const print = line.match(/^print\((.*)\)$/);
    if (print) { output.push(`${indent}Console.WriteLine(${print[1]});`); return; }
    const condition = line.match(/^if\s+(?:\((.*)\)|(.*?))\s*\{$/);
    if (condition) { output.push(`${indent}if (${condition[1] ?? condition[2]}) {`); return; }
    const assignment = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignment) { output.push(`${indent}${assignment[1]} = ${assignment[2]};`); return; }
    diagnostics.push(adapterError(source, lineNumber, 'That line is outside the Swift subset used by MODBOX.', 'Use var/let, print(...), assignments, or an if condition { ... } block.'));
    output.push('');
  });
  return { source: output.join('\n'), diagnostics };
}

export function localizeLanguageCopy(text: string, language: LanguageId): string {
  if (language === 'csharp') return text;
  return text
    .replace(/Console\.WriteLine/g, 'print')
    .replace(/\bstring\b/g, TYPE_WORD[language].string)
    .replace(/\bint\b/g, TYPE_WORD[language].int)
    .replace(/\bbool\b/g, TYPE_WORD[language].bool)
    .replace(/\btrue\b/g, language === 'python' ? 'True' : 'true')
    .replace(/\bfalse\b/g, language === 'python' ? 'False' : 'false')
    .replace(/;/g, '');
}

export function localizeMission(mission: Mission, language: LanguageId): Mission {
  if (language === 'csharp') return mission;
  const localized = (text: string) => localizeLanguageCopy(text, language);
  return {
    ...mission,
    concept: mission.concept ? { ...mission.concept, name: localized(mission.concept.name), tagline: localized(mission.concept.tagline), explanation: localized(mission.concept.explanation), example: formatCodeForLanguage(mission.concept.example, language) } : undefined,
    action: localized(mission.action), hint: mission.hint ? localized(mission.hint) : undefined,
    starter: formatCodeForLanguage(mission.starter, language),
    additions: mission.additions.map((addition) => ({ ...addition, code: formatCodeForLanguage(addition.code, language) })),
    requirements: mission.requirements.map((requirement) => ({ ...requirement, label: localized(requirement.label) })),
  };
}

export function localizeMod(mod: ModDefinition, language: LanguageId): ModDefinition {
  return { ...mod, type: mod.type, example: formatCodeForLanguage(mod.example, language) };
}

export function localizeTool(tool: CodeToolDefinition, language: LanguageId): CodeToolDefinition {
  return { ...tool, example: formatCodeForLanguage(tool.example, language), name: tool.id === 'writeline' ? (language === 'csharp' ? 'WriteLine' : 'print') : tool.name };
}

export function localizeToken(token: QuickInsertToken, language: LanguageId): QuickInsertToken {
  if (language === 'csharp') return token;
  let label = token.label;
  if (label === 'string' || label === 'int' || label === 'bool') label = TYPE_WORD[language][label];
  if (label === 'Console.WriteLine()') label = 'print()';
  if (language === 'python' && (label === 'true' || label === 'false')) label = label[0].toUpperCase() + label.slice(1);
  return { ...token, label, insert: formatCodeForLanguage(token.insert, language) };
}
