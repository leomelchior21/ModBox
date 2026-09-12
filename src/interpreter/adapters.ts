import type { LanguageId } from './core/adapter';
import { csharpAdapter } from './csharp';

/* Adapter registry — adding Python or Swift means adding one file and one line. */

const registry = new Map<LanguageId, typeof csharpAdapter>();
registry.set('csharp', csharpAdapter);

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
