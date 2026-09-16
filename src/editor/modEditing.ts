import { parseSource } from '../interpreter/csharp/parser';
import { tokenize } from '../interpreter/csharp/tokenizer';
import type { Statement } from '../interpreter/core/types';

export const MOD_DRAG_TYPE = 'application/x-modbox-mod';
export const MOD_DRAG_START_EVENT = 'modbox:mod-drag-start';
export const MOD_DRAG_END_EVENT = 'modbox:mod-drag-end';
export type ModInsertMode = 'replace' | 'duplicate';
export interface CodeBlock { from: number; to: number; text: string; statement: Statement; group: number }

/** Keeps the editor's destination highlight in sync across mouse and touch drags. */
export function beginModDrag(snippet: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MOD_DRAG_START_EVENT, { detail: { snippet } }));
}

export function endModDrag(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MOD_DRAG_END_EVENT));
}

/** Token boundaries keep strings, comments and entire if bodies intact. */
export function codeBlocks(source: string): CodeBlock[] | null {
  const parsed = parseSource(source);
  if (parsed.diagnostics.some(d => d.severity === 'error')) return null;
  const { tokens } = tokenize(source);
  return parsed.ast.statements.map(statement => {
    const start = tokens.findIndex(t => t.pos.line === statement.pos.line && t.pos.column === statement.pos.column);
    let end = start, depth = 0;
    for (; end < tokens.length; end++) {
      const t = tokens[end];
      if (t.kind === 'punct' && t.value === '{') depth++;
      if (t.kind === 'punct' && t.value === '}' && --depth === 0) break;
      if (t.kind === 'punct' && t.value === ';' && depth === 0) break;
      if (t.kind === 'eof') break;
    }
    const from = tokens[start]?.start ?? 0, to = tokens[end]?.end ?? source.length;
    const group = statement.kind === 'varDecl' ? 0 : statement.kind === 'assign' ? 1 : statement.kind === 'writeLine' ? 2 : 3;
    return { from, to, text: source.slice(from, to), statement, group };
  });
}

/**
 * Tap-to-apply replaces a Mod. Drag-to-add preserves another copy. Both paths
 * append to the correct top-level section, never inside the caret's if body.
 */
export function placeMod(
  source: string,
  snippet: string,
  mode: ModInsertMode = 'replace',
): string {
  const incoming = codeBlocks(snippet)?.[0];
  if (!incoming) return source;
  const blocks = codeBlocks(source);
  // Incomplete student code stays untouched. A fresh declaration can still go safely at the top.
  if (!blocks) return `${snippet.trim()}\n${source}`;
  const stmt = incoming.statement;
  const existing = stmt.kind === 'varDecl' ? blocks.filter(b => b.statement.kind === 'varDecl' && b.statement.name === stmt.name) : [];
  if (mode === 'replace' && existing.length) {
    let result = source;
    // Collapse duplicate mod declarations when selecting a replacement, preserving unrelated code.
    for (let i = existing.length - 1; i >= 0; i--) {
      const b = existing[i];
      result = result.slice(0, b.from) + (i === 0 ? snippet.trim() : '') + result.slice(b.to);
    }
    return result;
  }
  const sameSection = blocks.filter(b => b.group === incoming.group);
  const preceding = blocks.filter(b => b.group < incoming.group);
  const anchor = sameSection.at(-1) ?? preceding.at(-1);
  const at = anchor?.to ?? 0;
  const lineBreakBefore = at ? (stmt.kind === 'if' ? '\n\n' : '\n') : '';
  return source.slice(0, at) + lineBreakBefore + snippet.trim() + (source.slice(at).startsWith('\n') ? '' : '\n') + source.slice(at);
}

/** Move one whole statement within its section. This never splits a rule or sorts dependencies. */
export function moveCodeBlock(source: string, index: number, direction: -1 | 1): string {
  const blocks = codeBlocks(source);
  const current = blocks?.[index], neighbor = blocks?.[index + direction];
  if (!current || !neighbor || current.group !== neighbor.group) return source;
  const [a, b] = direction === 1 ? [current, neighbor] : [neighbor, current];
  return source.slice(0, a.from) + b.text + source.slice(a.to, b.from) + a.text + source.slice(b.to);
}
