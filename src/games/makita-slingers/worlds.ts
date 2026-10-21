/** A Makita Slingers battleground: sky, ground, the backdrop silhouettes and how strong gravity is. */
export interface SlingWorld { name: string; sky: [string, string]; dirt: string; base: string; grass: string; grassDark: string; cloud: string; far: string; mid: string; backdrop: 'hills' | 'castle' | 'cove' | 'moon' | 'jungle'; gravity: number; stars: boolean }
export const SLING_WORLDS: Record<string, SlingWorld> = {
  classic: { name: 'Scrapyard Quarry', sky: ['#7cc8f0', '#d6f0fb'], dirt: '#ffffff', base: '#ffffff', grass: '#5fbf3a', grassDark: '#3f9a2a', cloud: '#ffffff', far: '#8fc9a8', mid: '#6fb86a', backdrop: 'hills', gravity: 1, stars: false },
  castle: { name: 'Castle Siege', sky: ['#6a9fd8', '#e8ecf4'], dirt: '#b8b2a8', base: '#8a8478', grass: '#6aa84a', grassDark: '#4a8a3a', cloud: '#ffffff', far: '#9aa0b0', mid: '#7a8090', backdrop: 'castle', gravity: 1, stars: false },
  cove: { name: 'Pirate Cove', sky: ['#2fa8e0', '#ffe8c0'], dirt: '#f2dfae', base: '#e8c88a', grass: '#e8d29e', grassDark: '#d9bc80', cloud: '#ffffff', far: '#1fb3d6', mid: '#2aa0c0', backdrop: 'cove', gravity: 1, stars: false },
  moon: { name: 'Moon Base', sky: ['#02020a', '#1a1a3a'], dirt: '#b8bcc4', base: '#8a8e98', grass: '#d8dce4', grassDark: '#a8acb4', cloud: '#2a2a44', far: '#4a4e5a', mid: '#6a6e78', backdrop: 'moon', gravity: .4, stars: true },
  jungle: { name: 'Jungle Ruins', sky: ['#3fa8a0', '#d8f0d0'], dirt: '#8a6a44', base: '#5a4a30', grass: '#3f9a3a', grassDark: '#2a7a2a', cloud: '#e8fff0', far: '#2f7a5a', mid: '#3f8a4a', backdrop: 'jungle', gravity: 1, stars: false },
};
export const slingWorld = (theme?: string) => SLING_WORLDS[theme ?? 'classic'] ?? SLING_WORLDS.classic;
/** Wind on blades in flight (m/s², gusting) and how weather slows the sling. */
export const SLING_WEATHER: Record<string, { wind: number; speed: number; text: string; kind: string }> = {
  clear: { wind: 0, speed: 1, text: '', kind: 'clear' },
  wind: { wind: 2.6, speed: 1, text: 'WIND · gusts push blades in flight', kind: 'wind' },
  rain: { wind: 0, speed: .95, text: 'RAIN · a slick sling, slightly slower shots', kind: 'rain' },
  snow: { wind: 0, speed: .88, text: 'SNOW · cold bands fire slower blades', kind: 'snow' },
  night: { wind: 0, speed: 1, text: 'NIGHT · fireflies over the battleground', kind: 'fireflies' },
};
