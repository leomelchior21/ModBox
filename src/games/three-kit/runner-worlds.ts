import type { WorldLook } from './looks';

type Mood = 'day' | 'dusk' | 'night';
/** A subway world: what lines the track, what stands beyond it, the trains' paint and how gravity feels. */
export interface SubwayWorld {
  name: string; look: Record<Mood, WorldLook>; ballast: string; ties: string; walls: 'graffiti' | 'neon' | 'fence' | 'ice' | 'rock'; wall: string; trim: string;
  skyline: 'city' | 'tokyo' | 'beach' | 'arctic' | 'mars'; buildings: string[]; liveries: [string, string][]; gravity: number; glowWindows: boolean;
}
/** A temple world: the causeway stone, what lies in the abyss below, the far horizon and the fire in the bowls. */
export interface TempleWorld {
  name: string; look: Record<Mood, WorldLook>; floor: string; curb: string; wall: string; pillar: string; cap: string;
  abyss: 'canopy' | 'dunes' | 'glacier' | 'lava' | 'clouds'; abyssColor: string; mist: string; horizon: 'temples' | 'pyramids' | 'peaks' | 'volcanoes' | 'islands'; flame: string; gravity: number;
}
const L = (sky: [string, string, string], fog: [string, number, number], sun: [string, number], hemi: [string, string, number], stars = false): WorldLook => ({ sky, fog, sun, hemi, stars });

export const SUBWAY_WORLDS: Record<string, SubwayWorld> = {
  classic: { name: 'Downtown', look: {
    day: L(['#2f86da', '#8fd0ff', '#e9f6ff'], ['#cfe9f7', 50, 190], ['#fff3dc', 2.5], ['#e7f7ff', '#617c64', 1.15]),
    dusk: L(['#36387e', '#ef8a6a', '#ffd9a2'], ['#e7a98c', 50, 190], ['#ffb27a', 2], ['#ffe2c8', '#5a4a5a', 1.05]),
    night: L(['#070b24', '#232a66', '#4b3f80'], ['#252a50', 30, 190], ['#9fb4ff', .8], ['#8fa2ff', '#1c2440', .55], true) },
    ballast: '#ffffff', ties: '#4a3a2e', walls: 'graffiti', wall: '#ffffff', trim: '#8f8a82', skyline: 'city', buildings: ['#f2a65a', '#6fb7e9', '#ef6f6c', '#9ad17a', '#c792ea', '#f6d365'],
    liveries: [['#e8473c', '#ffd23d'], ['#2f6fd6', '#ffffff'], ['#22a06b', '#f2f2f2'], ['#f08a24', '#2b2b2b'], ['#8a4bd6', '#ffd0f0']], gravity: 1, glowWindows: false },
  tokyo: { name: 'Neon Tokyo', look: {
    day: L(['#3a1f6e', '#c04fa0', '#ffb3d1'], ['#c48ab5', 40, 170], ['#ffd6ec', 1.8], ['#ffd0f0', '#3a2a5a', 1]),
    dusk: L(['#24124d', '#a3388f', '#ff8fb3'], ['#8a4c84', 36, 160], ['#ff9fc8', 1.5], ['#ffb8e0', '#2a1a40', .9]),
    night: L(['#07041a', '#2a0f4a', '#6a1f70'], ['#2a1240', 26, 150], ['#c6a8ff', .7], ['#b48cff', '#140a26', .55], true) },
    ballast: '#9a8fa8', ties: '#2b2233', walls: 'neon', wall: '#251a38', trim: '#ff4fd8', skyline: 'tokyo', buildings: ['#2b1d4a', '#1d2a4a', '#3a1d3a', '#1d1d33'],
    liveries: [['#f7f7fa', '#ff4fa3'], ['#f7f7fa', '#2f9cff'], ['#1d1d29', '#38e8ff']], gravity: 1, glowWindows: true },
  beach: { name: 'Beach Line', look: {
    day: L(['#1f9de0', '#7fd6f5', '#e8fbff'], ['#bfeaf5', 60, 220], ['#fff6dc', 2.8], ['#ecfbff', '#d9c39a', 1.2]),
    dusk: L(['#4a3a8e', '#ff9a6a', '#ffe1a8'], ['#f5b08c', 50, 200], ['#ffb27a', 2.2], ['#ffe3c4', '#a8846a', 1.05]),
    night: L(['#081a3a', '#1f4a7a', '#3f6f9a'], ['#1f3a5a', 34, 200], ['#a8c4ff', .8], ['#9fc0ff', '#24304a', .6], true) },
    ballast: '#f2dfae', ties: '#a8875a', walls: 'fence', wall: '#ffffff', trim: '#2fb5e0', skyline: 'beach', buildings: ['#ffd1dc', '#bfe9ff', '#fff1a8', '#c8f2c8', '#ffd9b3'],
    liveries: [['#ffd23d', '#2fb5e0'], ['#ff6f61', '#ffffff'], ['#2fb5e0', '#ffffff']], gravity: 1, glowWindows: false },
  arctic: { name: 'Arctic Express', look: {
    day: L(['#7ab8e6', '#cfe8f7', '#f4fbff'], ['#e3f0f8', 40, 170], ['#f4f9ff', 2.4], ['#f2f9ff', '#a8bcd0', 1.25]),
    dusk: L(['#4a5a9e', '#f0a6c0', '#fde4e8'], ['#d6c6dc', 36, 160], ['#ffc8d8', 1.8], ['#ffe8f0', '#8a8aa8', 1.05]),
    night: L(['#040b1f', '#10305a', '#1f6a7a'], ['#13304a', 28, 150], ['#a8d8ff', .7], ['#9fd8ff', '#1a2a3a', .6], true) },
    ballast: '#f4f8fc', ties: '#7b8a99', walls: 'ice', wall: '#bfe6ff', trim: '#ffffff', skyline: 'arctic', buildings: ['#e8f4fc', '#d2e6f4'],
    liveries: [['#e3202f', '#ffffff'], ['#ffffff', '#2f6fd6'], ['#ffd23d', '#1d2a3a']], gravity: 1, glowWindows: false },
  mars: { name: 'Mars Colony', look: {
    day: L(['#b85a35', '#e89a6a', '#f6c9a0'], ['#d9926a', 34, 160], ['#ffe0c4', 2.3], ['#ffd8b8', '#7a3a24', 1.05]),
    dusk: L(['#3a2a5a', '#b4566a', '#e8a07a'], ['#9a5a5a', 30, 150], ['#ff9f7a', 1.7], ['#ffc0a0', '#4a2420', .9]),
    night: L(['#08040f', '#2a0f1a', '#5a2420'], ['#2a1414', 26, 140], ['#ffb8a0', .6], ['#d89a8a', '#1a0a0a', .5], true) },
    ballast: '#c2683f', ties: '#4a3a3a', walls: 'rock', wall: '#a8502f', trim: '#7a3420', skyline: 'mars', buildings: ['#d9dde3', '#bfc6cf'],
    liveries: [['#d9dde3', '#ff6a24'], ['#f4f4f4', '#2f2f3a'], ['#ff6a24', '#f4f4f4']], gravity: .62, glowWindows: true },
};
export const TEMPLE_WORLDS: Record<string, TempleWorld> = {
  classic: { name: 'Jungle Temple', look: {
    day: L(['#58a9d4', '#b9dccd', '#d4e4c8'], ['#c2d8bf', 12, 80], ['#fff3dc', 2.5], ['#e7f7ff', '#617c64', 1.15]),
    dusk: L(['#45357a', '#ee8659', '#ffd28a'], ['#c58a6c', 12, 80], ['#ffb27a', 2], ['#ffe2c8', '#5a4a5a', 1.05]),
    night: L(['#060f1d', '#17304a', '#355466'], ['#1a2c40', 12, 80], ['#9fb4ff', .8], ['#8fa2ff', '#1c2440', .55], true) },
    floor: '#ffffff', curb: '#d9cfb8', wall: '#9a9282', pillar: '#bfb194', cap: '#d8c9a4', abyss: 'canopy', abyssColor: '#2f6b45', mist: '#e8f4ee', horizon: 'temples', flame: '#ffb340', gravity: 1 },
  desert: { name: 'Desert Pyramids', look: {
    day: L(['#3f8fd4', '#f2c98a', '#ffe3b0'], ['#f0cf9a', 16, 95], ['#fff0d0', 2.9], ['#fff2dc', '#b88a5a', 1.2]),
    dusk: L(['#3a2a6a', '#e8744a', '#ffc070'], ['#d98a5a', 14, 90], ['#ff9a5a', 2.2], ['#ffd0a0', '#7a4a3a', 1]),
    night: L(['#0a0a24', '#2a2450', '#6a4a5a'], ['#2a2440', 12, 80], ['#c8b8ff', .8], ['#b8a8e0', '#2a1f2a', .55], true) },
    floor: '#f0d6a0', curb: '#e8c88a', wall: '#c9a06a', pillar: '#e0b878', cap: '#f5d9a0', abyss: 'dunes', abyssColor: '#e3b36e', mist: '#f6e2b8', horizon: 'pyramids', flame: '#ff9a3c', gravity: 1 },
  ice: { name: 'Frozen Temple', look: {
    day: L(['#6aa8e0', '#cfe8f7', '#f2fbff'], ['#dceef8', 12, 78], ['#f4f9ff', 2.3], ['#eaf6ff', '#9ab4c8', 1.25]),
    dusk: L(['#3a3a8e', '#c08ad0', '#f5d0e8'], ['#c0b0d8', 12, 75], ['#ffc8e0', 1.7], ['#f0e0ff', '#6a6a8a', 1]),
    night: L(['#030a1a', '#0d2a4a', '#1f5a6a'], ['#102a3a', 12, 70], ['#a8e0ff', .8], ['#9fe0ff', '#14243a', .6], true) },
    floor: '#d8eefc', curb: '#bfe2f8', wall: '#8fb8d8', pillar: '#a8d4f0', cap: '#e8f6ff', abyss: 'glacier', abyssColor: '#e8f4fc', mist: '#f2fbff', horizon: 'peaks', flame: '#7fe0ff', gravity: 1 },
  lava: { name: 'Lava Temple', look: {
    day: L(['#3a1a1a', '#a8402a', '#ff8a3c'], ['#7a3020', 12, 75], ['#ffb080', 2], ['#ffb890', '#3a1010', .9]),
    dusk: L(['#200a14', '#7a2020', '#ff6a2a'], ['#5a1a14', 11, 70], ['#ff8a5a', 1.7], ['#ff9a70', '#2a0a0a', .8]),
    night: L(['#08020a', '#2a0808', '#6a1a0a'], ['#2a0a08', 10, 65], ['#ff9a6a', .9], ['#ff8a60', '#1a0505', .5], true) },
    floor: '#4a4040', curb: '#3a3232', wall: '#2a2222', pillar: '#4a3a36', cap: '#ff7a3c', abyss: 'lava', abyssColor: '#ff5a1c', mist: '#ff9a5a', horizon: 'volcanoes', flame: '#ff5a1c', gravity: 1 },
  sky: { name: 'Sky Temple', look: {
    day: L(['#4aa0f0', '#a8d8ff', '#f4fbff'], ['#e8f4ff', 18, 110], ['#fffbe8', 2.7], ['#ffffff', '#c8d8f0', 1.3]),
    dusk: L(['#5a4aa0', '#ffa8c0', '#ffe8d0'], ['#f0c8d8', 16, 100], ['#ffc0a0', 2.1], ['#ffe8f0', '#a890b8', 1.1]),
    night: L(['#0a0a2a', '#2a3a7a', '#6a7ab8'], ['#2a3a6a', 14, 90], ['#d8e0ff', .9], ['#c8d4ff', '#2a2a4a', .6], true) },
    floor: '#f6f4ee', curb: '#ffffff', wall: '#e8e2d4', pillar: '#f4f0e6', cap: '#ffd23f', abyss: 'clouds', abyssColor: '#ffffff', mist: '#ffffff', horizon: 'islands', flame: '#ffe27a', gravity: .72 },
};
export const subwayWorld = (theme?: string) => SUBWAY_WORLDS[theme ?? 'classic'] ?? SUBWAY_WORLDS.classic;
export const templeWorld = (theme?: string) => TEMPLE_WORLDS[theme ?? 'classic'] ?? TEMPLE_WORLDS.classic;
/** How each runner weather plays: run speed, slide length and lane grip. */
export const RUNNER_WEATHER: Record<string, { speed: number; slide: number; grip: number; text: string }> = {
  clear: { speed: 1, slide: .75, grip: 17, text: '' },
  rain: { speed: 1, slide: 1.05, grip: 11, text: 'RAIN · slides go longer, lane changes slip' },
  storm: { speed: 1.04, slide: 1.1, grip: 9, text: 'STORM · lightning, slippery lanes' },
  snow: { speed: .88, slide: .9, grip: 13, text: 'SNOW · the run slows down' },
  fog: { speed: 1, slide: .75, grip: 17, text: 'FOG · obstacles appear late' },
  sandstorm: { speed: .9, slide: .8, grip: 14, text: 'SANDSTORM · slower run, low visibility' },
  fireflies: { speed: 1, slide: .75, grip: 17, text: 'FIREFLIES · a glowing night run' },
};
