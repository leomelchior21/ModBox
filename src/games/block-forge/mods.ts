import type { CodeToolDefinition, ModDefinition } from '../../mods/types';
import { createModSchema } from '../../interpreter/core/schema';

export interface ForgeConfig {
  palette: string; playerName: string; blockStyle: string; linePoints: number;
  rotations: boolean; showHints: boolean; allowUndo: boolean; comboBoost: boolean; sparkles: boolean;
}
export const FORGE_DEFAULTS: ForgeConfig = {
  palette: 'aurora', playerName: 'Blocksmith', blockStyle: 'bevel', linePoints: 100,
  rotations: false, showHints: false, allowUndo: false, comboBoost: false, sparkles: true,
};
export const FORGE_MODS: readonly ModDefinition<keyof ForgeConfig>[] = [
  { id: 'palette', name: 'palette', type: 'string', label: 'COLOR LAB', blurb: 'Give your blocks a new color palette.', example: 'string palette = "sunset";', values: ['aurora', 'sunset', 'candy'], defaultValue: 'aurora', glyph: '◈', unlockAt: 0 },
  { id: 'playerName', name: 'playerName', type: 'string', label: 'YOUR SIGNATURE', blurb: 'Name your block workshop.', example: 'string playerName = "Pixel Pilot";', maxLength: 20, defaultValue: 'Blocksmith', glyph: 'Aa', unlockAt: 1 },
  { id: 'linePoints', name: 'linePoints', type: 'int', label: 'LINE VALUE', blurb: 'Points per cleared row or column. Try some arithmetic.', example: 'int linePoints = 100 + 50;', limits: { min: 50, max: 300 }, range: '50–300', defaultValue: 100, glyph: '+', unlockAt: 2 },
  { id: 'rotations', name: 'rotations', type: 'bool', label: 'TWIST IT', blurb: 'Rotate a selected piece before placing it.', example: 'bool rotations = true;', defaultValue: false, glyph: '↻', unlockAt: 3 },
  { id: 'showHints', name: 'showHints', type: 'bool', label: 'FIND A FIT', blurb: 'Light up a legal placement with the HINT button.', example: 'bool showHints = true;', defaultValue: false, glyph: '✧', unlockAt: 4 },
  { id: 'allowUndo', name: 'allowUndo', type: 'bool', label: 'SECOND CHANCE', blurb: 'Undo your last placement, including its score and clears.', example: 'bool allowUndo = true;', defaultValue: false, glyph: '↶', unlockAt: 5 },
  { id: 'comboBoost', name: 'comboBoost', type: 'bool', label: 'COMBO ENGINE', blurb: 'Double the bonus for consecutive clears. Switch it on with a live rule.', example: 'bool comboBoost = false;', defaultValue: false, glyph: '×', unlockAt: 6 },
  { id: 'blockStyle', name: 'blockStyle', type: 'string', label: 'BLOCK FINISH', blurb: 'Choose sculpted blocks or luminous glass.', example: 'string blockStyle = "glass";', values: ['bevel', 'glass'], defaultValue: 'bevel', glyph: '▣', unlockAt: 7 },
  { id: 'sparkles', name: 'sparkles', type: 'bool', label: 'CLEAR CELEBRATION', blurb: 'Celebrate line clears with bursts of light.', example: 'bool sparkles = true;', defaultValue: true, glyph: '✦', unlockAt: 7 },
];
export const FORGE_RUNTIME_LABELS = { score: 'points this round', lines: 'rows and columns cleared', moves: 'pieces placed', combo: 'consecutive clearing moves' };
export const forgeSchema = createModSchema(FORGE_MODS, Object.keys(FORGE_RUNTIME_LABELS));
export const FORGE_TOOLS: readonly CodeToolDefinition[] = [
  { id: 'forge-combo', name: 'comboRule', type: 'condition', label: 'FIRE UP THE FORGE', blurb: 'Activate bonus scoring after your first line clear.', example: 'if (lines >= 1)\n{\n    comboBoost = true;\n}', glyph: '?', unlockAt: 6 },
];
