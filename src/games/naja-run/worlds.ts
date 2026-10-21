import type { WorldLook } from '../three-kit/looks';

/** A Naja Run garden: tile and wall colours, the tree canopy and what grows around the walls. */
export interface NajaGarden { name: string; look: WorldLook; tiles: [string, string]; stone: string; cap: string; leaves: string; trunk: string; props: 'none' | 'dunes' | 'crystals' | 'grid' | 'lollipops' }
const L = (sky: [string, string, string], fog: [string, number, number], sun: [string, number], hemi: [string, string, number], stars = false): WorldLook => ({ sky, fog, sun, hemi, stars });
export const NAJA_GARDENS: Record<string, NajaGarden> = {
  classic: { name: 'Temple Garden', look: L(['#5ba9d5', '#b6d7c4', '#e2f0dc'], ['#c1e4ef', 55, 160], ['#fff0ce', 2.4], ['#e7f7ff', '#617c64', 1.15]), tiles: ['#c5cead', '#d7d6b6'], stone: '#c7b98c', cap: '#dec588', leaves: '#368b6f', trunk: '#6c6850', props: 'none' },
  desert: { name: 'Desert Oasis', look: L(['#3f8fd4', '#f2c98a', '#ffe3b0'], ['#f0cf9a', 55, 160], ['#fff0d0', 2.7], ['#fff2dc', '#b88a5a', 1.2]), tiles: ['#ecd4a0', '#f4e0b4'], stone: '#d9a866', cap: '#f2c98a', leaves: '#3aa860', trunk: '#9a7a52', props: 'dunes' },
  frozen: { name: 'Frozen Garden', look: L(['#6aa8e0', '#cfe8f7', '#f4fbff'], ['#dceef8', 55, 160], ['#f4f9ff', 2.4], ['#f2f9ff', '#a8bcd0', 1.3]), tiles: ['#e8f4fc', '#d6eaf8'], stone: '#9cc4e4', cap: '#ffffff', leaves: '#dff0fb', trunk: '#8a9aa8', props: 'crystals' },
  neon: { name: 'Neon Grid', look: L(['#05051a', '#160f44', '#3a1f6e'], ['#160f44', 55, 160], ['#c8b8ff', 1.4], ['#b48cff', '#140a26', .7], true), tiles: ['#141434', '#1b1b48'], stone: '#2a2a6a', cap: '#ff4fd8', leaves: '#38e8ff', trunk: '#2a2a5a', props: 'grid' },
  candy: { name: 'Candy Garden', look: L(['#ff9ccf', '#ffd1ea', '#fff1f8'], ['#ffd8ec', 55, 160], ['#fff2f8', 2.4], ['#fff0f8', '#c890b8', 1.25]), tiles: ['#ffd8ea', '#ffe9f3'], stone: '#ff6fb1', cap: '#ffd23f', leaves: '#8ad8ff', trunk: '#ffffff', props: 'lollipops' },
};
export const najaGarden = (theme?: string) => NAJA_GARDENS[theme ?? 'classic'] ?? NAJA_GARDENS.classic;
/** Weather in the garden: how much faster the snake slides and how far you can see the fruit (tiles, 0 = always). */
export const NAJA_WEATHER: Record<string, { speed: number; sight: number; text: string }> = {
  clear: { speed: 1, sight: 0, text: '' }, rain: { speed: 1.15, sight: 0, text: 'RAIN · slippery stones, Naja slides faster' },
  fog: { speed: 1, sight: 5, text: 'FOG · fruit only shows when you are close' }, fireflies: { speed: 1, sight: 0, text: 'FIREFLIES · a glowing night hunt' },
  petals: { speed: 1, sight: 0, text: 'PETALS · cherry blossom season' },
};
