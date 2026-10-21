/**
 * Towns, throwers and fiesta weather. Every town is drawn with two inks (paper and ink) plus tomato red,
 * the only colour in the game.
 */
export interface Town { name: string; paper: string; ink: string; tomato: string; tomatoDark: string; place: string }
export const TOWNS: Record<string, Town> = {
  classic: { name: 'BUÑOL', place: 'the whitewashed streets of Buñol', paper: '#f7ecc8', ink: '#5a170c', tomato: '#e8341a', tomatoDark: '#9c1a0b' },
  boqueria: { name: 'LA BOQUERIA', place: 'the market halls of Barcelona', paper: '#eaf2dc', ink: '#1d3a28', tomato: '#ee3a22', tomatoDark: '#9a1d10' },
  alhambra: { name: 'THE ALHAMBRA', place: 'the palace courtyards of Granada', paper: '#f4e3c3', ink: '#1f2c6b', tomato: '#e9401f', tomatoDark: '#9a2410' },
  metro: { name: 'METRO SOL', place: 'the tiled tunnels of the Madrid metro', paper: '#eef3f5', ink: '#122042', tomato: '#ff3a2c', tomatoDark: '#a81d15' },
  guell: { name: 'PARK GÜELL', place: "Gaudí's mosaic park in Barcelona", paper: '#fff4e3', ink: '#4a1d5e', tomato: '#ff4719', tomatoDark: '#a6240c' },
};
export const TOWN_ORDER = Object.keys(TOWNS);

/** The thrower: the arm you see on screen and the face on the status bar. */
export const THROWERS: Record<string, { name: string; hand: 'glove' | 'mitt' | 'claw' | 'gauntlet' }> = {
  original: { name: 'Fiesta kid', hand: 'glove' },
  chef: { name: 'The chef', hand: 'mitt' },
  robot: { name: 'A rebel robot', hand: 'claw' },
  knight: { name: 'Sir Tomate', hand: 'gauntlet' },
  abuela: { name: 'Abuela', hand: 'mitt' },
  luchador: { name: 'El Luchador', hand: 'glove' },
};

/**
 * Weather changes how the fiesta plays. `wind` pushes tomatoes sideways (m/s²), `wash` is how fast rain rinses
 * paint off the street, `sight` scales how far robots (and you) can see, `grip` slows your feet on wet stones.
 */
export interface FiestaWeather { wind: number; wash: number; sight: number; grip: number; fog: readonly [number, number] | null; text: string }
export const WEATHER: Record<string, FiestaWeather> = {
  clear: { wind: 0, wash: 0, sight: 1, grip: 1, fog: null, text: '' },
  rain: { wind: 0, wash: .05, sight: .85, grip: .9, fog: [16, 34], text: 'RAIN · PAINT WASHES AWAY' },
  wind: { wind: 5, wash: 0, sight: 1, grip: 1, fog: null, text: 'WIND · AIM INTO IT' },
  fog: { wind: 0, wash: 0, sight: .55, grip: 1, fog: [4, 15], text: 'FOG · SNEAK UP ON THEM' },
  night: { wind: 0, wash: 0, sight: .6, grip: 1, fog: [7, 22], text: 'NIGHT · ROBOTS SEE LESS' },
};

/** Robot difficulty: movement, sight (m), seconds between hose shots and soak strength. */
export const ROBOT_LEVELS: Record<string, { speed: number; sight: number; fire: number; soak: number }> = {
  easy: { speed: .75, sight: 9, fire: 2.6, soak: .7 },
  normal: { speed: 1, sight: 12, fire: 1.8, soak: 1 },
  hard: { speed: 1.2, sight: 15, fire: 1.3, soak: 1.25 },
  loco: { speed: 1.5, sight: 18, fire: .85, soak: 1.5 },
};
