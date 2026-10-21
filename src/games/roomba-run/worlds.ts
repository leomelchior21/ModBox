/** A house style for Roomba Run: walls, floor tint, trim, windows, light and the furniture palette. */
export interface HouseStyle {
  name: string; wall: string; floor: string; trim: string; rug: string; window: 'glass' | 'stained' | 'porthole' | 'candy' | 'leafy'; light: string; ambient: string;
  /** Furniture repaint: original colour → this style's colour. */
  furniture: [string, string][]; decor: 'none' | 'banners' | 'neon' | 'candy' | 'vines';
  /** The dust this house gathers: base smudge colour (r,g,b) and speck colours. */
  dust: [number, number, number]; specks: string[];
}
const SOFA = ['#c9765d', '#dd8f74', '#5d8fa8', '#78a8c0'], WOOD = ['#9a7350', '#b98557', '#d9b48a', '#c39463', '#8a6a4c', '#5b4636'];
export const HOUSE_STYLES: Record<string, HouseStyle> = {
  classic: { name: 'Cosy Home', wall: '', floor: '#ffffff', trim: '#f7efe2', rug: '', window: 'glass', light: '#fff1db', ambient: '#e7f7ff', furniture: [], decor: 'none', dust: [88, 62, 38], specks: ['rgba(60,42,25,.45)', 'rgba(170,140,100,.4)'] },
  castle: { name: 'Castle Hall', wall: '#9a9488', floor: '#b8b0a4', trim: '#5a5248', rug: '#8a1f2a', window: 'stained', light: '#ffc888', ambient: '#c8a888',
    furniture: [[SOFA[0], '#8a1f2a'], [SOFA[1], '#b8303c'], [SOFA[2], '#2a3f7a'], [SOFA[3], '#3a5a9a'], ...WOOD.map(w => [w, '#5a3a24'] as [string, string])], decor: 'banners', dust: [96, 94, 100], specks: ['rgba(60,60,66,.5)', 'rgba(190,186,176,.45)'] },
  spaceship: { name: 'Starship Deck', wall: '#2a3140', floor: '#8a96a8', trim: '#38e8ff', rug: '#1d2a40', window: 'porthole', light: '#d8e8ff', ambient: '#8aa8d8',
    furniture: [[SOFA[0], '#e8ecf2'], [SOFA[1], '#38e8ff'], [SOFA[2], '#e8ecf2'], [SOFA[3], '#ff4fd8'], ...WOOD.map(w => [w, '#5a6478'] as [string, string])], decor: 'neon', dust: [70, 60, 140], specks: ['rgba(140,220,255,.7)', 'rgba(255,120,230,.6)'] },
  candy: { name: 'Candy House', wall: '#ffd1e6', floor: '#ffe8f2', trim: '#ff6fb1', rug: '#8ad8ff', window: 'candy', light: '#fff0f8', ambient: '#ffe0f0',
    furniture: [[SOFA[0], '#ff6fb1'], [SOFA[1], '#ffd23f'], [SOFA[2], '#8ad8ff'], [SOFA[3], '#b0ff9a'], ...WOOD.map(w => [w, '#c98a5a'] as [string, string])], decor: 'candy', dust: [214, 110, 160], specks: ['rgba(255,210,63,.8)', 'rgba(56,200,255,.8)'] },
  jungle: { name: 'Treehouse', wall: '#a8784a', floor: '#d9a868', trim: '#5a3a1e', rug: '#4f9a45', window: 'leafy', light: '#ffeec8', ambient: '#c8e8b0',
    furniture: [[SOFA[0], '#3f7a3a'], [SOFA[1], '#6aa84f'], [SOFA[2], '#c9a46a'], [SOFA[3], '#e8c88a'], ...WOOD.map(w => [w, '#7a5232'] as [string, string])], decor: 'vines', dust: [72, 104, 40], specks: ['rgba(200,130,50,.7)', 'rgba(110,170,60,.6)'] },
};
export const houseStyle = (theme?: string) => HOUSE_STYLES[theme ?? 'classic'] ?? HOUSE_STYLES.classic;
/** Household chaos (the `weather` mod): how fast the battery drains and what keeps making new mess. */
export const ROOMBA_CHAOS: Record<string, { drain: number; mess: 'none' | 'party' | 'pets'; dark: boolean; text: string }> = {
  clear: { drain: 1, mess: 'none', dark: false, text: '' },
  party: { drain: 1, mess: 'party', dark: false, text: 'PARTY · confetti keeps landing on clean floor' },
  pets: { drain: 1, mess: 'pets', dark: false, text: 'PETS · the puppy tracks muddy paws around' },
  night: { drain: 1, mess: 'none', dark: true, text: 'NIGHT · lights off, follow your headlight' },
  storm: { drain: 1.6, mess: 'none', dark: false, text: 'STORM · the power flickers and drains the battery' },
};
