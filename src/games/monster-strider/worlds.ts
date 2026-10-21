import type { WorldLook } from '../three-kit/looks';

/** A Monster Strider world: what surrounds the islands, the ground tints and how gravity feels. */
export interface MonsterWorld { name: string; look: WorldLook; sea: string; seaGlow: number; cliffs: string[]; far: string; grass: string; face: string; brick: string; gravity: number }
const L = (sky: [string, string, string], fog: [string, number, number], sun: [string, number], hemi: [string, string, number], stars = false): WorldLook => ({ sky, fog, sun, hemi, stars });
export const MONSTER_WORLDS: Record<string, MonsterWorld> = {
  classic: { name: 'Island Hop', look: L(['#1f9df5', '#5cc8ff', '#b9ecff'], ['#7fd8ff', 45, 145], ['#fff0ce', 2.7], ['#e7f7ff', '#617c64', 1.15]), sea: '#14c3f6', seaGlow: .22, cliffs: ['#0f7fec', '#1a8ff5', '#0a6cd8', '#3aa4ff', '#2495fb'], far: '#7fcfff', grass: '#ffffff', face: '#ffffff', brick: '#ffffff', gravity: 1 },
  desert: { name: 'Canyon Rally', look: L(['#3f8fd4', '#f2c98a', '#ffe3b0'], ['#f0cf9a', 45, 150], ['#fff0d0', 2.9], ['#fff2dc', '#b88a5a', 1.15]), sea: '#e3b36e', seaGlow: 0, cliffs: ['#c2683f', '#b5552f', '#d4794a', '#a84a2a', '#cf6a3c'], far: '#e8a070', grass: '#f2cf86', face: '#d98a5a', brick: '#c9895a', gravity: 1 },
  arctic: { name: 'Ice Floes', look: L(['#6aa8e0', '#cfe8f7', '#f4fbff'], ['#dceef8', 40, 140], ['#f4f9ff', 2.5], ['#f2f9ff', '#a8bcd0', 1.25]), sea: '#2a6fa8', seaGlow: .1, cliffs: ['#e8f4fc', '#cfe6f5', '#bcdcf0', '#f4fbff', '#d8ecf8'], far: '#f0f8ff', grass: '#f4f9ff', face: '#9cc8e8', brick: '#bcdcf0', gravity: 1 },
  lava: { name: 'Lava Field', look: L(['#2a0f14', '#8a2f1f', '#ff8a3c'], ['#6a2418', 35, 120], ['#ffb080', 2.2], ['#ffb890', '#3a1010', .95]), sea: '#ff5a1c', seaGlow: 1, cliffs: ['#2a1a18', '#3a2420', '#241414', '#4a2a22', '#331c18'], far: '#3a1a14', grass: '#8a7a72', face: '#4a3a36', brick: '#5a4a44', gravity: 1 },
  mars: { name: 'Mars Dunes', look: L(['#b85a35', '#e89a6a', '#f6c9a0'], ['#d9926a', 40, 140], ['#ffe0c4', 2.5], ['#ffd8b8', '#7a3a24', 1.05]), sea: '#b85a35', seaGlow: 0, cliffs: ['#a8502f', '#c2683f', '#8a3a24', '#d07a4a', '#9a4428'], far: '#d98a5a', grass: '#e8a070', face: '#b8582f', brick: '#a8603a', gravity: .62 },
};
export const monsterWorld = (theme?: string) => MONSTER_WORLDS[theme ?? 'classic'] ?? MONSTER_WORLDS.classic;
/** Tyre grip and wind for each weather. */
export const MONSTER_WEATHER: Record<string, { grip: number; wind: number; text: string }> = {
  clear: { grip: 1, wind: 0, text: '' }, rain: { grip: .7, wind: 0, text: 'RAIN · the tyres slip, ease the throttle' },
  snow: { grip: .45, wind: 0, text: 'SNOW · ice racing, very little grip' }, wind: { grip: 1, wind: 6, text: 'WIND · gusts push the truck in the air' },
  fog: { grip: 1, wind: 0, text: 'FOG · the next jump hides in the mist' },
};
