import type { WorldLook } from '../three-kit/looks';

/** A Team Counters course: the runway, what lies below it, and what floats around it. */
export interface TeamWorld { name: string; look: WorldLook; runway: string; edge: string; under: string; below: string; belowGlow: boolean; props: 'ice' | 'candy' | 'islands' | 'space' | 'lava'; propColors: string[] }
const L = (sky: [string, string, string], fog: [string, number, number], sun: [string, number], hemi: [string, string, number], stars = false): WorldLook => ({ sky, fog, sun, hemi, stars });
export const TEAM_WORLDS: Record<string, TeamWorld> = {
  classic: { name: 'Ice Canyon', look: L(['#2f8fe0', '#8fd0f5', '#e2f5ff'], ['#cdeaf8', 40, 130], ['#fff0ce', 2.4], ['#e7f7ff', '#617c64', 1.15]), runway: '#f6f9fd', edge: '#5fb3ee', under: '#d4e6f5', below: '#4aaee6', belowGlow: false, props: 'ice', propColors: ['#8fd0f5', '#5fb4ea', '#b8e4fa', '#4a9fd8'] },
  candy: { name: 'Candy Land', look: L(['#ff9ccf', '#ffd1ea', '#fff1f8'], ['#ffd8ec', 40, 130], ['#fff2f8', 2.4], ['#fff0f8', '#c890b8', 1.2]), runway: '#ffe3f1', edge: '#ff6fb1', under: '#ffc2e0', below: '#7a4428', belowGlow: false, props: 'candy', propColors: ['#ff4f7a', '#ffd23f', '#5fd4ff', '#8aff7a', '#c27bff'] },
  beach: { name: 'Tropical Beach', look: L(['#1f9de0', '#7fd6f5', '#ecfcff'], ['#c8eef8', 45, 140], ['#fff6dc', 2.7], ['#ecfbff', '#d9c39a', 1.2]), runway: '#f6e7c1', edge: '#2fb5e0', under: '#e8d29e', below: '#1fc0d8', belowGlow: false, props: 'islands', propColors: ['#f2dfae', '#3aa860', '#9a7a52'] },
  space: { name: 'Space Station', look: L(['#03030c', '#0d0f2e', '#1c1a4a'], ['#0d0f2e', 60, 200], ['#e8ecff', 2], ['#b8c4ff', '#1a1a3a', .75], true), runway: '#d9dde6', edge: '#38e8ff', under: '#7a8294', below: '#05050f', belowGlow: false, props: 'space', propColors: ['#ff8a5c', '#7ab8ff', '#c27bff', '#ffd27a'] },
  volcano: { name: 'Volcano Run', look: L(['#2a0f14', '#8a2f1f', '#ff8a3c'], ['#6a2418', 35, 120], ['#ffb080', 2], ['#ffb890', '#3a1010', .9]), runway: '#3a3434', edge: '#ff6a24', under: '#2a2222', below: '#ff5a1c', belowGlow: true, props: 'lava', propColors: ['#2a1a18', '#3a2420', '#4a2a22'] },
};
export const teamWorld = (theme?: string) => TEAM_WORLDS[theme ?? 'classic'] ?? TEAM_WORLDS.classic;
/** How the sky plays: run speed, steering grip and a sideways gust. */
export const TEAM_WEATHER: Record<string, { speed: number; grip: number; gust: number; text: string }> = {
  clear: { speed: 1, grip: 12, gust: 0, text: '' },
  snow: { speed: .88, grip: 10, gust: 0, text: 'SNOW · the crowd marches slower' },
  rain: { speed: 1, grip: 6, gust: 0, text: 'RAIN · steering slides on the wet runway' },
  wind: { speed: 1, grip: 12, gust: 1.5, text: 'WIND · gusts push your crowd sideways' },
  aurora: { speed: 1, grip: 12, gust: 0, text: 'AURORA · a glowing night run' },
};
