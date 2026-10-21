import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import type { YardConfig } from './mods';

/** A yard for the workshop: lawn and soil tints, house colours, hedge, what lies beyond the fence and the sky. */
export interface YardWorld { name: string; grass: string; soil: string; wall: string; roof: string; fence: string; leaves: [string, string, string]; back: string; road: string; sky: [string, string]; props: 'none' | 'graves' | 'palms' | 'snowmen' | 'skyline' }
export const YARD_WORLDS: Record<string, YardWorld> = {
  classic: { name: 'Suburban Lawn', grass: '#ffffff', soil: '#ffffff', wall: '#f4e9d4', roof: '#d0573b', fence: '#efe9dc', leaves: ['#3f9a3c', '#4caf45', '#358a33'], back: '#5aa848', road: '#545b63', sky: ['#5ab4f0', '#cfeefc'], props: 'none' },
  graveyard: { name: 'Haunted Graveyard', grass: '#8a9a7a', soil: '#6a5a50', wall: '#8a8494', roof: '#3a2a4a', fence: '#4a4a50', leaves: ['#3a4a3a', '#2f3f30', '#45553f'], back: '#2a3a2a', road: '#2a2d33', sky: ['#120a24', '#4a2a5a'], props: 'graves' },
  beach: { name: 'Beach House', grass: '#f4e0b0', soil: '#e0c088', wall: '#fff0d8', roof: '#2fb5e0', fence: '#ffffff', leaves: ['#3aa860', '#4fbf6a', '#2f9a50'], back: '#1fb3d6', road: '#f2dfae', sky: ['#2fa8e0', '#e8fbff'], props: 'palms' },
  winter: { name: 'Winter Garden', grass: '#f6faff', soil: '#c8d8e8', wall: '#f4ecdc', roof: '#c8303c', fence: '#e8eef4', leaves: ['#2f6b55', '#3a7a60', '#e8f4fc'], back: '#e8f2fa', road: '#9aa6b2', sky: ['#7ab0dc', '#eef6fc'], props: 'snowmen' },
  rooftop: { name: 'City Rooftop', grass: '#a8b0b8', soil: '#7a8088', wall: '#c8ccd4', roof: '#3a4a5a', fence: '#5a6068', leaves: ['#4f9a45', '#3f8a3a', '#5fb04f'], back: '#3a4a5a', road: '#2a2d33', sky: ['#3a6aa8', '#ffcfa0'], props: 'skyline' },
};
export const yardWorld = (theme?: string) => YARD_WORLDS[theme ?? 'classic'] ?? YARD_WORLDS.classic;
/** How weather plays in the yard: zombie pace, and whether the yard goes dark or foggy. */
export const YARD_WEATHER: Record<string, { zombies: number; dark: boolean; kind: string; text: string }> = {
  clear: { zombies: 1, dark: false, kind: 'clear', text: '' },
  rain: { zombies: .9, dark: false, kind: 'rain', text: 'RAIN · muddy lawn, zombies wade slower' },
  snow: { zombies: .75, dark: false, kind: 'snow', text: 'SNOW · zombies trudge through the drifts' },
  fog: { zombies: 1, dark: false, kind: 'fog', text: 'FOG · zombies appear out of the mist' },
  night: { zombies: 1, dark: true, kind: 'fireflies', text: 'NIGHT · the yard goes dark' },
};
const YARDS = ['classic', 'graveyard', 'beach', 'winter', 'rooftop'];
/** The workshop foreman's advice: tougher walls and sharper blades after a breach, a harder yard after a win. */
export function yardInvites(s: { config: YardConfig; power: number; wave: number; kills: number; lost: boolean }, moment: InviteMoment): ModInvite[] {
  const c = s.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(s.power < 50 && s.wave >= 1 && !c.autoCollect, { id: 'yard-collect-live', icon: '🔋', title: 'Running out of power!', reason: 'Batteries bank themselves the moment they fall.', code: 'bool autoCollect = true;', tone: 'help' });
    add(s.wave >= 2 && c.bladeDamage < 30, { id: 'yard-sharp-live', icon: '🪚', title: 'Zombies are shrugging off the saws', reason: 'Sharper blades cut them down faster.', code: 'int bladeDamage = 30;', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(c.bladeDamage < 30, { id: 'yard-sharp', icon: '🪚', title: 'Sharpen every blade', reason: 'More damage per saw blade stops zombies sooner.', code: 'int bladeDamage = 30;', tone: 'help' });
    add(c.wallHealth < 2400, { id: 'yard-wall', icon: '🧰', title: 'Steel toolboxes', reason: 'Tougher walls hold the line longer.', code: 'int wallHealth = 2400;', tone: 'help' });
    add(c.zombieSpeed > 2, { id: 'yard-slow', icon: '🐢', title: 'Slow the invasion', reason: 'Zombies shuffle in more slowly.', code: 'int zombieSpeed = 2;', tone: 'help' });
    add(c.startingPower < 300, { id: 'yard-start', icon: '⚡', title: 'Start with more battery', reason: 'Build more saws before the first wave.', code: 'int startingPower = 300;', tone: 'help' });
    add(!c.autoCollect, { id: 'yard-collect', icon: '🔋', title: 'Auto collect', reason: 'Never miss a falling battery again.', code: 'bool autoCollect = true;', tone: 'help' });
    return out;
  }
  const next = YARDS[(YARDS.indexOf(c.worldTheme ?? 'classic') + 1) % YARDS.length];
  add(true, { id: `yard-world-${next}`, icon: '🏚', title: `Next defence: ${YARD_WORLDS[next].name}`, reason: 'A new yard, the same hungry visitors.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add(c.zombieSpeed < 4, { id: 'yard-fast', icon: '🧟', title: 'Faster zombies', reason: 'Turn up the invasion pace.', code: 'int zombieSpeed = 4;', tone: 'challenge' });
  add((c.weather ?? 'clear') !== 'fog', { id: 'yard-fog', icon: '🌫', title: 'Defend in the fog', reason: 'Zombies only appear when they are close.', code: 'string weather = "fog";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'yard-gold', icon: '🏆', title: 'Golden tools', reason: 'Every machine in polished gold.', code: 'string characterStyle = "gold";', tone: 'style' });
  return out;
}
