import type { ModDefinition, CodeToolDefinition } from '../../mods/types';
import { createModSchema } from '../../interpreter/core/schema';

export interface YardConfig {
  worldTheme: string; characterStyle: string; weather: string;
  workshopName: string; bladeDamage: number; chargeRate: number; autoCollect: boolean;
  doubleShot: boolean; overdrive: boolean; wallHealth: number; zombieSpeed: number; startingPower: number; quickHands: boolean;
}
export const YARD_DEFAULTS: YardConfig = {
  worldTheme: 'classic', characterStyle: 'original', weather: 'clear',
  workshopName: 'The Last Workshop', bladeDamage: 20, chargeRate: 5, autoCollect: false,
  doubleShot: false, overdrive: false, wallHealth: 1600, zombieSpeed: 3, startingPower: 200, quickHands: false,
};
export const YARD_MODS: readonly ModDefinition<keyof YardConfig>[] = [
  { id: 'worldTheme', name: 'worldTheme', type: 'string', label: 'YARD', blurb: 'Defend a haunted "graveyard", a "beach" house, a snowy "winter" garden or a city "rooftop".', example: 'string worldTheme = "graveyard";', values: ['classic', 'graveyard', 'beach', 'winter', 'rooftop'], defaultValue: 'classic', glyph: '◈', unlockAt: 0 },
  { id: 'characterStyle', name: 'characterStyle', type: 'string', label: 'MACHINE LAB', blurb: 'Rebuild your tools as chrome "robot" machines, polished "gold", bright plastic "toy" tools or brass "steampunk" contraptions.', example: 'string characterStyle = "robot";', values: ['original', 'robot', 'gold', 'toy', 'steampunk'], defaultValue: 'original', glyph: '♟', unlockAt: 0 },
  { id: 'weather', name: 'weather', type: 'string', label: 'YARD WEATHER', blurb: '"rain" and "snow" slow the zombies down, "fog" hides them until they are close and "night" turns the yard dark.', example: 'string weather = "fog";', values: ['clear', 'rain', 'snow', 'fog', 'night'], defaultValue: 'clear', glyph: '☁', unlockAt: 0 },
  { id: 'workshopName', name: 'workshopName', type: 'string', label: 'WORKSHOP NAME', blurb: 'Give your last line of defense a name. It appears on the workshop sign.', example: 'string workshopName = "Saw Society";', maxLength: 22, defaultValue: 'The Last Workshop', glyph: '⚑', unlockAt: 0 },
  { id: 'bladeDamage', name: 'bladeDamage', type: 'int', label: 'BLADE DAMAGE', blurb: 'Damage of every saw blade. A worker zombie has 190 health.', example: 'int bladeDamage = 20 + 10;', limits: { min: 10, max: 60 }, range: '10–60', defaultValue: 20, glyph: '✹', unlockAt: 0 },
  { id: 'chargeRate', name: 'chargeRate', type: 'int', label: 'POWER SUPPLY', blurb: 'Each falling battery is worth chargeRate × 5 power.', example: 'int chargeRate = 7;', limits: { min: 2, max: 12 }, range: '2–12', defaultValue: 5, glyph: 'ϟ', unlockAt: 0 },
  { id: 'autoCollect', name: 'autoCollect', type: 'bool', label: 'AUTO COLLECT', blurb: 'Batteries bank themselves the moment they appear.', example: 'bool autoCollect = true;', defaultValue: false, glyph: '↯', unlockAt: 0 },
  { id: 'doubleShot', name: 'doubleShot', type: 'bool', label: 'TWIN BLADES', blurb: 'Every saw fires two blades per shot. Switch it on with a rule.', example: 'bool doubleShot = false;', defaultValue: false, glyph: '»', unlockAt: 0 },
  { id: 'overdrive', name: 'overdrive', type: 'bool', label: 'OVERDRIVE', blurb: 'Saws fire forty percent faster.', example: 'bool overdrive = false;', defaultValue: false, glyph: '⚡', unlockAt: 0 },
  { id: 'wallHealth', name: 'wallHealth', type: 'int', label: 'STEEL TOOLBOX', blurb: 'Health of each new toolbox wall.', example: 'int wallHealth = 2400;', limits: { min: 800, max: 4000 }, range: '800–4000', defaultValue: 1600, glyph: '▥', unlockAt: 0 },
  { id: 'zombieSpeed', name: 'zombieSpeed', type: 'int', label: 'ZOMBIE SPEED', blurb: 'Tune the pace of the invasion. 3 is normal.', example: 'int zombieSpeed = 2;', limits: { min: 1, max: 6 }, range: '1–6', defaultValue: 3, glyph: '≋', unlockAt: 0 },
  { id: 'startingPower', name: 'startingPower', type: 'int', label: 'STARTING BATTERY', blurb: 'Power when a level begins. Retry the level to apply.', example: 'int startingPower = 300;', limits: { min: 50, max: 600 }, range: '50–600', defaultValue: 200, glyph: '+', unlockAt: 0 },
  { id: 'quickHands', name: 'quickHands', type: 'bool', label: 'QUICK HANDS', blurb: 'Tool cards recharge twice as fast.', example: 'bool quickHands = true;', defaultValue: false, glyph: '⟳', unlockAt: 0 },
];
export const YARD_RUNTIME_LABELS = { score: 'points this run', power: 'battery power available', wave: 'current zombie wave', kills: 'zombies defeated', placed: 'tools placed', level: 'current level' };
export const yardSchema = createModSchema(YARD_MODS, Object.keys(YARD_RUNTIME_LABELS));
/** Rule snippets open with the declarations they assign; the editor adds only missing ones. */
export const YARD_TOOLS: readonly CodeToolDefinition[] = [
  { id: 'yard-log', name: 'WriteLine', label: 'WORKSHOP RADIO', type: 'write', blurb: 'Broadcast a message from your workshop.', example: 'Console.WriteLine("Workshop ready");', glyph: '⌁', unlockAt: 0 },
  { id: 'yard-math', name: 'damageMath', label: 'SHARPEN THE MATH', type: 'int', blurb: 'Add ten points of blade damage.', example: 'int bladeDamage = 20;\nbladeDamage = bladeDamage + 10;', glyph: '+', unlockAt: 0 },
  { id: 'yard-kills', name: 'killRule', label: 'KILL STREAK', type: 'condition', blurb: 'Activate twin blades after three defeats.', example: 'bool doubleShot = false;\nif (kills >= 3)\n{\n    doubleShot = true;\n}', glyph: '?', unlockAt: 0 },
  { id: 'yard-wave', name: 'waveRule', label: 'WAVE RESPONSE', type: 'condition', blurb: 'Engage overdrive from wave two.', example: 'bool overdrive = false;\nif (wave >= 2)\n{\n    overdrive = true;\n}', glyph: '≥', unlockAt: 0 },
];
