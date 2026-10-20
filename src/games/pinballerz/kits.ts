import type { Kit } from './players';

/** Your team's jerseys (the `characterStyle` mod). Each has a matching goalkeeper kit. */
export const YOUR_KITS: Record<string, { name: string; outfield: Kit; keeper: Kit; robot?: boolean }> = {
  original: { name: 'Pink Power', outfield: { shirt: '#ff4fa3', stripe: '#ff6fb6', shorts: '#ffffff', socks: '#ff4fa3', boots: '#2a2140' }, keeper: { shirt: '#ff4fa3', stripe: '#ff74b8', shorts: '#2a2140', socks: '#ff4fa3', boots: '#ffffff', gloves: '#ffffff' } },
  red: { name: 'Red Rockets', outfield: { shirt: '#e3202f', stripe: '#c8101e', shorts: '#ffffff', socks: '#e3202f', boots: '#111111' }, keeper: { shirt: '#2fd17a', stripe: '#25b866', shorts: '#111111', socks: '#2fd17a', boots: '#111111', gloves: '#ffffff' } },
  blue: { name: 'Sky Blues', outfield: { shirt: '#2d8cff', stripe: '#1f6fe0', shorts: '#0e2a5c', socks: '#2d8cff', boots: '#ffffff' }, keeper: { shirt: '#ffd23f', stripe: '#ffdf6b', shorts: '#0e2a5c', socks: '#ffd23f', boots: '#111111', gloves: '#2d8cff' } },
  yellow: { name: 'Golden Boots', outfield: { shirt: '#ffd400', stripe: '#ffe14d', shorts: '#111111', socks: '#ffd400', boots: '#111111' }, keeper: { shirt: '#8a2be2', stripe: '#9d4bff', shorts: '#111111', socks: '#8a2be2', boots: '#ffd400', gloves: '#ffd400' } },
  white: { name: 'All Whites', outfield: { shirt: '#f6f6f2', stripe: '#e8dfc4', shorts: '#f6f6f2', socks: '#f6f6f2', boots: '#c9a227' }, keeper: { shirt: '#1d1d24', stripe: '#33333d', shorts: '#1d1d24', socks: '#1d1d24', boots: '#f6f6f2', gloves: '#c9a227' } },
  stripes: { name: 'Zebra Stripes', outfield: { shirt: '#111111', stripe: '#f4f4f4', shorts: '#111111', socks: '#f4f4f4', boots: '#e3202f' }, keeper: { shirt: '#ff8a1f', stripe: '#ff9f45', shorts: '#111111', socks: '#ff8a1f', boots: '#111111', gloves: '#111111' } },
  robot: { name: 'Robo Squad', robot: true, outfield: { shirt: '#4ff0ff', stripe: '#2fc8e0', shorts: '#2a3140', socks: '#4ff0ff', boots: '#2a3140' }, keeper: { shirt: '#c9ff3d', stripe: '#b0e830', shorts: '#2a3140', socks: '#c9ff3d', boots: '#2a3140', gloves: '#c9ff3d' } },
};
export const yourKit = (style?: string) => YOUR_KITS[style ?? 'original'] ?? YOUR_KITS.original;

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** True when two shirts would be hard to tell apart from the broadcast camera. */
export function clash(a: string, b: string): boolean { const [x, y] = [hex(a), hex(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 120; }
/** The home side wears its home kit unless it clashes with yours; then it changes to its away kit. */
export function rivalKit(home: Kit, away: Kit, yours: Kit): Kit { return clash(home.shirt, yours.shirt) ? away : home; }
