import type { LanguageId } from './core/adapter';
import { csharpAdapter } from './csharp';
import { pythonAdapter } from './python';
import { swiftAdapter } from './swift';

/* Adapter registry — adding Python or Swift means adding one file and one line. */

const registry = new Map<LanguageId, typeof csharpAdapter>();
registry.set('csharp', csharpAdapter);
registry.set('python', pythonAdapter);
registry.set('swift', swiftAdapter);

export function getAdapter(id: LanguageId): typeof csharpAdapter | null {
  return registry.get(id) ?? null;
}

export function requireAdapter(id: LanguageId): typeof csharpAdapter {
  const adapter = registry.get(id);
  if (!adapter) throw new Error(`No adapter registered for ${id}`);
  return adapter;
}

export { csharpAdapter };
export { parseCSharp } from './csharp';
export { pythonAdapter, parsePython } from './python';
export { swiftAdapter, parseSwift } from './swift';
