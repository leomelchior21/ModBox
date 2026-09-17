import type { ModDefinition } from '../interpreter/core/mods';

/* ============================================================================
   MODBOX — MOD GLYPHS
   One tiny mark per Mod so the library and the dock read like a box of powers
   rather than a list of variables. Shared so both surfaces stay in step.
   ========================================================================== */

const MOD_GLYPH: Record<string, string> = {
  shipType: '△',
  backgroundColor: '◉',
  rockShape: '◇',
  enemyType: '☄',
  shipName: '✦',
  enemyCount: '☰',
  laserPower: '✹',
  enemySpeed: '»',
  shieldEnabled: '⬡',
  rapidFireEnabled: '⚡',
  homingEnabled: '➤',
  lives: '♥',
  scoreMultiplier: '×2',
  worldGravity: '↓',
  weaponType: '†',
};

export function modGlyph(mod: ModDefinition): string {
  return MOD_GLYPH[mod.id] ?? (mod.type === 'bool' ? '⬡' : mod.type === 'int' ? '#' : '“”');
}
