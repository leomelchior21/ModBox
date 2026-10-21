/** A Speed Stack city: the sky, what stands around the tower, and how the slabs are tinted. */
export interface StackWorld { name: string; top: string | null; bottom: string | null; stars: number; skyline: 'clouds' | 'tokyo' | 'desert' | 'ocean' | 'space'; hue: number | null; saturation: number; lightness: number; floater: 'cloud' | 'petal' | 'bubble' | 'none' }
export const STACK_WORLDS: Record<string, StackWorld> = {
  classic: { name: 'Rainbow Skies', top: null, bottom: null, stars: 0, skyline: 'clouds', hue: null, saturation: .68, lightness: .56, floater: 'cloud' },
  tokyo: { name: 'Neon Tokyo', top: '#120a2e', bottom: '#6a1f70', stars: .8, skyline: 'tokyo', hue: 300, saturation: .85, lightness: .6, floater: 'petal' },
  desert: { name: 'Desert Mirage', top: '#3f8fd4', bottom: '#ffd9a0', stars: 0, skyline: 'desert', hue: 30, saturation: .55, lightness: .6, floater: 'none' },
  ocean: { name: 'Coral Reef', top: '#04304a', bottom: '#1fa8c8', stars: 0, skyline: 'ocean', hue: 170, saturation: .7, lightness: .55, floater: 'bubble' },
  space: { name: 'Orbit Station', top: '#02020a', bottom: '#1a1440', stars: 1, skyline: 'space', hue: 220, saturation: .35, lightness: .7, floater: 'none' },
};
export const stackWorld = (theme?: string) => STACK_WORLDS[theme ?? 'classic'] ?? STACK_WORLDS.classic;
/** Weather on the build: slab speed, how forgiving a perfect drop is, and whether gusts blow. */
export const STACK_WEATHER: Record<string, { speed: number; window: number; gust: boolean; text: string }> = {
  clear: { speed: 1, window: 1, gust: false, text: '' },
  wind: { speed: 1, window: 1, gust: true, text: 'WIND · the slab surges and slows in the gusts' },
  rain: { speed: 1, window: .75, gust: false, text: 'RAIN · wet slabs slip, perfect drops are harder' },
  snow: { speed: .85, window: .9, gust: false, text: 'SNOW · the crane slows down in the cold' },
  night: { speed: 1, window: 1, gust: false, text: 'NIGHT · building under the stars' },
};
