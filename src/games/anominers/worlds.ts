/**
 * Sectors, ships and space weather. Every sector is drawn in two inks (space and line) plus a warning colour for
 * the anomaly and a dim tone for solid rock.
 */
export interface Sector { name: string; space: string; ink: string; rock: string; danger: string; drag: number }
export const SECTORS: Record<string, Sector> = {
  classic: { name: 'KUIPER BELT', space: '#1b2638', ink: '#8fd1f2', rock: '#223047', danger: '#ff6b8b', drag: 2.4 },
  ice: { name: 'ICE FIELDS', space: '#0f2433', ink: '#e6fbff', rock: '#173246', danger: '#ff7a6b', drag: .9 },
  ember: { name: 'EMBER REACH', space: '#2a1012', ink: '#ffb27a', rock: '#3a171a', danger: '#7af0ff', drag: 2.4 },
  amethyst: { name: 'AMETHYST CLOUD', space: '#1d1430', ink: '#d6b2ff', rock: '#281c40', danger: '#ffd36b', drag: 2.4 },
  verdant: { name: 'VERDANT RUINS', space: '#0f1f17', ink: '#a6f2b6', rock: '#17301f', danger: '#ff8ad0', drag: 2.4 },
};
export const SECTOR_ORDER = Object.keys(SECTORS);
export const SHIPS: Record<string, string> = { original: 'Miner pod', whale: 'Cargo whale', saucer: 'Saucer', rocket: 'Rocket', beetle: 'Beetle drone' };
/**
 * Space weather changes play: meteors crater the asteroid (and shake loose minerals), solar wind pushes your ship,
 * a nebula hides you and the anomaly, and an ion storm throws lightning.
 */
export interface Weather { text: string; meteors: boolean; wind: number; sight: number | null; lightning: boolean }
export const WEATHER: Record<string, Weather> = {
  clear: { text: '', meteors: false, wind: 0, sight: null, lightning: false },
  meteors: { text: 'METEOR SHOWER', meteors: true, wind: 0, sight: null, lightning: false },
  solar: { text: 'SOLAR WIND', meteors: false, wind: 3, sight: null, lightning: false },
  nebula: { text: 'NEBULA · LOW VISIBILITY', meteors: false, wind: 0, sight: 15, lightning: false },
  ionstorm: { text: 'ION STORM', meteors: false, wind: 0, sight: null, lightning: true },
};
/** How the anomaly behaves: how fast its creatures move, how often they come and how soon it wakes. */
export const MOODS: Record<string, { speed: number; spawn: number; timer: number }> = {
  sleepy: { speed: .7, spawn: 1.6, timer: 1.4 },
  normal: { speed: 1, spawn: 1, timer: 1 },
  angry: { speed: 1.25, spawn: .75, timer: .8 },
  furious: { speed: 1.5, spawn: .55, timer: .6 },
};
