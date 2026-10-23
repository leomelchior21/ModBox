/** Grid styles, runners and signal weather for NEON MAZE. Colours are glowing neon on a dark floor. */
export interface GridStyle { name: string; wall: string; edge: string; floor: string; line: string; dot: string; sky: [string, string]; hunters: string[]; fog: string }
export const GRIDS: Record<string, GridStyle> = {
  classic: { name: 'SYNTHWAVE GRID', wall: '#1a0b33', edge: '#ff3df2', floor: '#0b0618', line: '#3a1a6b', dot: '#ffe9ff', sky: ['#1b0838', '#04020c'], hunters: ['#ff3d6e', '#36e7ff', '#b07bff', '#ffb43d'], fog: '#0b0618' },
  arcade: { name: '1980 ARCADE', wall: '#000014', edge: '#2b5bff', floor: '#000000', line: '#0b0b30', dot: '#ffd7a8', sky: ['#000010', '#000000'], hunters: ['#ff2a2a', '#ff9ad8', '#2affff', '#ffb23a'], fog: '#000000' },
  matrix: { name: 'CODE RAIN', wall: '#001408', edge: '#29ff7a', floor: '#000a04', line: '#003d18', dot: '#c8ffd8', sky: ['#002010', '#000502'], hunters: ['#ffffff', '#7dff9e', '#00c853', '#c6ff00'], fog: '#000a04' },
  ocean: { name: 'ABYSS', wall: '#021a2a', edge: '#2fffe1', floor: '#010d16', line: '#05304a', dot: '#d9fff9', sky: ['#04304a', '#000810'], hunters: ['#ff6ad5', '#ffe066', '#6affb2', '#ff8a5c'], fog: '#010d16' },
  sunset: { name: 'VAPOR SUNSET', wall: '#2a0b2e', edge: '#ffb03d', floor: '#14061c', line: '#5c1f5a', dot: '#fff2c9', sky: ['#ff6f91', '#2b0b3f'], hunters: ['#00f0ff', '#ff3df2', '#ffef5a', '#9dff5c'], fog: '#14061c' },
};
export const GRID_ORDER = Object.keys(GRIDS);
/** The wallColor mod: "theme" keeps the grid's own neon, any other value rewires the walls. */
export const WALL_COLORS: Record<string, string> = { cyan: '#36e7ff', violet: '#a77bff', lime: '#9dff3d', amber: '#ffb43d', pink: '#ff3df2' };
export const RUNNERS: Record<string, string> = { original: 'Light orb', comet: 'Comet', ufo: 'Saucer', cube: 'Pixel cube', chomper: 'Chomper' };

/**
 * Signal weather changes play: static makes walls flicker out, blackout shrinks your light, a storm leaves you
 * in the dark between lightning flashes, and data snow slows everyone down.
 */
export interface Signal { sight: number | null; speed: number; flicker: boolean; storm: boolean; text: string }
export const SIGNALS: Record<string, Signal> = {
  clear: { sight: null, speed: 1, flicker: false, storm: false, text: '' },
  static: { sight: null, speed: 1, flicker: true, storm: false, text: 'STATIC · WALLS FLICKER' },
  blackout: { sight: 3.2, speed: 1, flicker: false, storm: false, text: 'BLACKOUT · STAY CLOSE TO THE LIGHT' },
  storm: { sight: 4.5, speed: 1.05, flicker: false, storm: true, text: 'STORM · LIGHTNING SHOWS THE WAY' },
  snow: { sight: null, speed: .85, flicker: false, storm: false, text: 'DATA SNOW · EVERYONE IS SLOWER' },
};
/** Hunter brains: speed, how often they wander off, and whether they ever take a break (scatter). */
export const BRAINS: Record<string, { speed: number; wander: number; scatter: boolean; lookAhead: number }> = {
  sleepy: { speed: .8, wander: .45, scatter: true, lookAhead: 2 },
  normal: { speed: 1, wander: .12, scatter: true, lookAhead: 4 },
  smart: { speed: 1.08, wander: .04, scatter: false, lookAhead: 4 },
  genius: { speed: 1.18, wander: 0, scatter: false, lookAhead: 6 },
};
