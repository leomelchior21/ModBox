import type { ModDefinition } from '../mods/types';

/* ============================================================================
   MODBOX — MOD GLYPHS
   One tiny mark per Mod so the library and the dock read like a box of powers
   rather than a list of variables. Shared so both surfaces stay in step.
   ========================================================================== */

export function modGlyph(mod: ModDefinition): string {
  return mod.glyph ?? (mod.type === 'bool' ? '⬡' : mod.type === 'int' ? '#' : '“”');
}
