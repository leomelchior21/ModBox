import type { ModDefinition, CodeToolDefinition } from '../../mods/types';
import { createModSchema } from '../../interpreter/core/schema';

export interface YardConfig {
  background: string; ground: string; decorations: boolean; toolbox: string; zombieType: string;
  toolColor: string; workshopName: string; bladeDamage: number; chargeRate: number;
  autoCollect: boolean; doubleShot: boolean; overdrive: boolean; barricadeHealth: number;
  zombieSpeed: number; startingPower: number;
}
export const YARD_DEFAULTS: YardConfig = {
  background: 'none', ground: 'none', decorations: false, toolbox: 'none', zombieType: 'none',
  toolColor: 'teal', workshopName: 'The Last Workshop', bladeDamage: 25, chargeRate: 5,
  autoCollect: false, doubleShot: false, overdrive: false, barricadeHealth: 450,
  zombieSpeed: 3, startingPower: 350,
};
export const YARD_MODS: readonly ModDefinition<keyof YardConfig>[] = [
  { id: 'background', name: 'background', type: 'string', label: 'BUILD SCENERY', blurb: 'Add the workshop backdrop at sunset or under the night sky.', example: 'string background = "sunset";', values: ['none', 'sunset', 'night'], defaultValue: 'none', glyph: '◈', unlockAt: 0 },
  { id: 'ground', name: 'ground', type: 'string', label: 'BUILD THE YARD', blurb: 'Lay out five lanes of grass or concrete for your machines.', example: 'string ground = "grass";', values: ['none', 'grass', 'concrete'], defaultValue: 'none', glyph: '▦', unlockAt: 1 },
  { id: 'decorations', name: 'decorations', type: 'bool', label: 'WORKSHOP PROPS', blurb: 'Add fence posts, crates and workshop lights around the yard.', example: 'bool decorations = true;', defaultValue: false, glyph: '✦', unlockAt: 1 },
  { id: 'toolbox', name: 'toolbox', type: 'string', label: 'ADD MACHINES', blurb: 'Saws adds saw turrets and chargers. Full also adds barricades and frost saws.', example: 'string toolbox = "saws";', values: ['none', 'saws', 'full'], defaultValue: 'none', glyph: '⚒', unlockAt: 2 },
  { id: 'zombieType', name: 'zombieType', type: 'string', label: 'ADD ZOMBIES', blurb: 'Choose workers, hardhats, sprinters, brutes or a mixed invasion. None holds the invasion.', example: 'string zombieType = "worker";', values: ['none', 'worker', 'hardhat', 'sprinter', 'brute', 'mixed'], defaultValue: 'none', glyph: '☠', unlockAt: 3 },
  { id: 'toolColor', name: 'toolColor', type: 'string', label: 'TOOL COLOR', blurb: 'Choose the glow of your saws and spinning blades.', example: 'string toolColor = "amber";', values: ['teal', 'amber', 'violet', 'lime'], defaultValue: 'teal', glyph: '◈', unlockAt: 2 },
  { id: 'workshopName', name: 'workshopName', type: 'string', label: 'WORKSHOP NAME', blurb: 'Give your last line of defense a name.', example: 'string workshopName = "Saw Society";', maxLength: 22, defaultValue: 'The Last Workshop', glyph: '⚑', unlockAt: 7 },
  { id: 'bladeDamage', name: 'bladeDamage', type: 'int', label: 'BLADE DAMAGE', blurb: 'Damage dealt by each circular saw disc.', example: 'int bladeDamage = 25;', limits: { min: 15, max: 60 }, range: '15–60', defaultValue: 25, glyph: '✹', unlockAt: 4 },
  { id: 'chargeRate', name: 'chargeRate', type: 'int', label: 'POWER SUPPLY', blurb: 'Every six seconds the sky drops chargeRate × 5 battery power.', example: 'int chargeRate = 7;', limits: { min: 2, max: 12 }, range: '2–12', defaultValue: 5, glyph: 'ϟ', unlockAt: 5 },
  { id: 'autoCollect', name: 'autoCollect', type: 'bool', label: 'AUTO COLLECT', blurb: 'Automatically bank every battery drop.', example: 'bool autoCollect = true;', defaultValue: false, glyph: '↯', unlockAt: 5 },
  { id: 'doubleShot', name: 'doubleShot', type: 'bool', label: 'TWIN BLADES', blurb: 'Set true or use a kill-streak rule to fire two discs per shot.', example: 'bool doubleShot = false;', defaultValue: false, glyph: '»', unlockAt: 6 },
  { id: 'overdrive', name: 'overdrive', type: 'bool', label: 'OVERDRIVE', blurb: 'Set true or use a wave rule to fire forty percent faster.', example: 'bool overdrive = false;', defaultValue: false, glyph: '⚡', unlockAt: 6 },
  { id: 'barricadeHealth', name: 'barricadeHealth', type: 'int', label: 'BARRICADE ARMOR', blurb: 'Extra health for newly deployed timber barricades.', example: 'int barricadeHealth = 600;', limits: { min: 250, max: 1000 }, range: '250–1000', defaultValue: 450, glyph: '▥', unlockAt: 7 },
  { id: 'zombieSpeed', name: 'zombieSpeed', type: 'int', label: 'ZOMBIE SPEED', blurb: 'Tune the pace of the invasion.', example: 'int zombieSpeed = 3;', limits: { min: 1, max: 6 }, range: '1–6', defaultValue: 3, glyph: '≋', unlockAt: 7 },
  { id: 'startingPower', name: 'startingPower', type: 'int', label: 'STARTING BATTERY', blurb: 'Power bank when a new defense begins. Restart to apply.', example: 'int startingPower = 450;', limits: { min: 250, max: 800 }, range: '250–800', defaultValue: 350, glyph: '+', unlockAt: 7 },
];
export const YARD_RUNTIME_LABELS = { score: 'zombies defeated × 50', power: 'battery power available', wave: 'current invasion wave', kills: 'zombies defeated', lives: 'workshop integrity', placed: 'defenders deployed' };
export const yardSchema = createModSchema(YARD_MODS, Object.keys(YARD_RUNTIME_LABELS));
export const YARD_TOOLS: readonly CodeToolDefinition[] = [
  { id: 'yard-log', name: 'WriteLine', label: 'WORKSHOP RADIO', type: 'write', blurb: 'Broadcast a message from your workshop.', example: 'Console.WriteLine("Workshop ready");', glyph: '⌁', unlockAt: 7 },
  { id: 'yard-math', name: 'damageMath', label: 'SHARPEN THE MATH', type: 'int', blurb: 'Add ten points of blade damage.', example: 'bladeDamage = bladeDamage + 10;', glyph: '+', unlockAt: 4 },
  { id: 'yard-kills', name: 'killRule', label: 'KILL STREAK', type: 'condition', blurb: 'Activate twin blades after three defeats.', example: 'if (kills >= 3)\n{\n    doubleShot = true;\n}', glyph: '?', unlockAt: 6 },
  { id: 'yard-wave', name: 'waveRule', label: 'WAVE RESPONSE', type: 'condition', blurb: 'Engage overdrive from wave two.', example: 'if (wave >= 2)\n{\n    overdrive = true;\n}', glyph: '≥', unlockAt: 6 },
];
