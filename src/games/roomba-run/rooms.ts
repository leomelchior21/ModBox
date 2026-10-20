/** Furniture blocks the robot; tables and chairs only block at their legs, so the robot slips underneath. */
export type FurnitureType = 'sofa' | 'armchair' | 'coffeeTable' | 'table' | 'chair' | 'shelf' | 'tv' | 'counter' | 'fridge' | 'bed' | 'desk' | 'plant' | 'toybox' | 'washer' | 'workbench' | 'car';
export interface Furniture { type: FurnitureType; x: number; z: number; w: number; d: number; rotation?: number; color?: string }
export type DebrisKind = 'popcorn' | 'crumbs' | 'coin' | 'sock' | 'brick' | 'leaf' | 'bolt';
export interface Debris { kind: DebrisKind; x: number; z: number }
export interface Toy { x: number; z: number; r: number; kind: 'ball' | 'cube' }
export interface Room {
  name: string; tip: string; width: number; depth: number; floor: 'oak' | 'tile' | 'carpet' | 'concrete'; wall: string;
  dock: { x: number; z: number }; furniture: readonly Furniture[]; debris: readonly Debris[]; toys: readonly Toy[]; target: number; dirt: number;
}
/** Legs of a table-like piece: the only parts that block the robot. */
export function legs(f: Furniture): { x: number; z: number; w: number; d: number }[] {
  if (f.type !== 'coffeeTable' && f.type !== 'table' && f.type !== 'chair' && f.type !== 'desk') return [{ x: f.x, z: f.z, w: f.w, d: f.d }];
  const inset = f.type === 'chair' ? .06 : .12, leg = f.type === 'chair' ? .08 : .12;
  return [-1, 1].flatMap(sx => [-1, 1].map(sz => ({ x: f.x + sx * (f.w / 2 - inset), z: f.z + sz * (f.d / 2 - inset), w: leg, d: leg })));
}
const scatter = (kind: DebrisKind, cx: number, cz: number, n: number, spread: number): Debris[] =>
  Array.from({ length: n }, (_, i) => ({ kind, x: cx + Math.cos(i * 2.39) * spread * ((i % 3 + 1) / 3), z: cz + Math.sin(i * 2.39) * spread * ((i % 3 + 1) / 3) }));

export const ROOMS: readonly Room[] = [
  {
    name: 'Living Room', tip: 'Drive over the dust to clean it. Popcorn and coins pay extra.', width: 12, depth: 10, floor: 'oak', wall: '#f1e3cf', dock: { x: 0, z: 4.2 }, target: 80, dirt: 1,
    furniture: [
      { type: 'sofa', x: -3.4, z: -3.7, w: 3.8, d: 1.4 }, { type: 'armchair', x: 3.9, z: -3.6, w: 1.4, d: 1.3 }, { type: 'coffeeTable', x: -.6, z: -1.2, w: 2.4, d: 1.2 },
      { type: 'tv', x: 5.55, z: .5, w: .7, d: 2.6 }, { type: 'shelf', x: -5.6, z: 1, w: .6, d: 2.8 }, { type: 'plant', x: 5.3, z: 4.3, w: .6, d: .6 }, { type: 'plant', x: -5.3, z: 4.3, w: .6, d: .6 },
    ],
    debris: [...scatter('popcorn', -.6, -1.2, 7, 1.2), ...scatter('coin', 2.5, 2, 3, .8), ...scatter('crumbs', -3.5, 1.8, 5, 1)], toys: [{ x: 2.2, z: -1.6, r: .3, kind: 'ball' }],
  },
  {
    name: 'Kitchen', tip: 'Crumbs hide under the dining table. Slip between the legs.', width: 11, depth: 9, floor: 'tile', wall: '#e6efe9', dock: { x: -4.6, z: 3.7 }, target: 80, dirt: 1.1,
    furniture: [
      { type: 'counter', x: 0, z: -4, w: 9, d: .9 }, { type: 'fridge', x: 4.95, z: -3.6, w: 1, d: 1.6 }, { type: 'counter', x: -4.95, z: -1.4, w: .9, d: 3.4 },
      { type: 'table', x: 1, z: 1, w: 2.6, d: 1.5 }, { type: 'chair', x: 1, z: -.3, w: .6, d: .6 }, { type: 'chair', x: 1, z: 2.3, w: .6, d: .6 }, { type: 'chair', x: -.75, z: 1, w: .6, d: .6 }, { type: 'chair', x: 2.75, z: 1, w: .6, d: .6 },
      { type: 'plant', x: 4.9, z: 3.9, w: .6, d: .6 },
    ],
    debris: [...scatter('crumbs', 1, 1, 9, 1.1), ...scatter('popcorn', -2.5, -2.8, 4, .8), ...scatter('coin', 3.5, 3, 3, .6)], toys: [{ x: -2, z: 2.4, r: .28, kind: 'ball' }],
  },
  {
    name: 'Kids Room', tip: 'Bricks everywhere! Push the toys out of the way.', width: 10, depth: 10, floor: 'carpet', wall: '#dfe9fb', dock: { x: 4.2, z: 4.2 }, target: 80, dirt: 1.2,
    furniture: [
      { type: 'bed', x: -3.3, z: -3, w: 2.2, d: 3.6 }, { type: 'toybox', x: 3.6, z: -4.1, w: 1.6, d: .9 }, { type: 'desk', x: 3.8, z: .2, w: 1.4, d: 2.2 }, { type: 'shelf', x: -4.65, z: 2.8, w: .6, d: 2.4 },
      { type: 'plant', x: -4.5, z: 4.4, w: .5, d: .5 },
    ],
    debris: [...scatter('brick', -.5, 1.5, 8, 1.6), ...scatter('sock', 1.5, -2.5, 3, 1), ...scatter('coin', -2, 3, 3, .7)],
    toys: [{ x: 0, z: -1, r: .32, kind: 'ball' }, { x: 1.6, z: 2.6, r: .3, kind: 'cube' }, { x: -1.2, z: 3.4, r: .26, kind: 'ball' }],
  },
  {
    name: 'Home Office', tip: 'Cables and clutter. Plan a route around the desks.', width: 12, depth: 9, floor: 'oak', wall: '#ece7f6', dock: { x: -5.1, z: 3.6 }, target: 80, dirt: 1.25,
    furniture: [
      { type: 'desk', x: -2.5, z: -3.5, w: 2.6, d: 1.2 }, { type: 'desk', x: 2.5, z: -3.5, w: 2.6, d: 1.2 }, { type: 'chair', x: -2.5, z: -2.3, w: .65, d: .65 }, { type: 'chair', x: 2.5, z: -2.3, w: .65, d: .65 },
      { type: 'shelf', x: 5.6, z: 0, w: .6, d: 3.2 }, { type: 'sofa', x: 0, z: 3.7, w: 3.2, d: 1.2 }, { type: 'plant', x: -5.4, z: -3.9, w: .6, d: .6 }, { type: 'coffeeTable', x: 0, z: 1.8, w: 1.6, d: .9 },
    ],
    debris: [...scatter('crumbs', -2.5, -2.5, 5, .9), ...scatter('crumbs', 2.5, -2.5, 5, .9), ...scatter('coin', 3.8, 2.6, 4, .7), ...scatter('popcorn', -3.5, .8, 4, .8)], toys: [],
  },
  {
    name: 'Garden Shed', tip: 'Leaves and bolts on a dusty concrete floor. Watch your battery.', width: 13, depth: 10, floor: 'concrete', wall: '#d9d2c3', dock: { x: 5.6, z: 4.2 }, target: 78, dirt: 1.4,
    furniture: [
      { type: 'workbench', x: -2, z: -4.2, w: 4.2, d: 1 }, { type: 'shelf', x: -6.1, z: 0, w: .6, d: 4 }, { type: 'washer', x: 5.7, z: -3.9, w: 1, d: 1 }, { type: 'washer', x: 4.6, z: -3.9, w: 1, d: 1 },
      { type: 'table', x: 1.6, z: .4, w: 2.2, d: 1.2 }, { type: 'plant', x: -5.6, z: 4.3, w: .7, d: .7 }, { type: 'toybox', x: 2.6, z: 4.2, w: 1.6, d: .9 },
    ],
    debris: [...scatter('leaf', -3, 1.5, 8, 1.6), ...scatter('bolt', -2, -3, 6, 1.2), ...scatter('coin', 1.6, .4, 4, .8)], toys: [{ x: -.5, z: 2.8, r: .32, kind: 'ball' }, { x: 3.5, z: 1.8, r: .3, kind: 'cube' }],
  },
  {
    name: 'Grand Hall', tip: 'The biggest room in the house. Use every trick you have coded.', width: 15, depth: 12, floor: 'tile', wall: '#f3ead8', dock: { x: 0, z: 5.3 }, target: 78, dirt: 1.5,
    furniture: [
      { type: 'table', x: 0, z: -1, w: 4, d: 1.8 }, ...[-1.4, 0, 1.4].flatMap(x => [{ type: 'chair' as const, x, z: -2.3, w: .6, d: .6 }, { type: 'chair' as const, x, z: .3, w: .6, d: .6 }]),
      { type: 'sofa', x: -5, z: 3.8, w: 3.4, d: 1.3 }, { type: 'sofa', x: 5, z: 3.8, w: 3.4, d: 1.3 }, { type: 'shelf', x: -7.1, z: -3, w: .6, d: 3.6 }, { type: 'shelf', x: 7.1, z: -3, w: .6, d: 3.6 },
      { type: 'plant', x: -6.8, z: -5.3, w: .7, d: .7 }, { type: 'plant', x: 6.8, z: -5.3, w: .7, d: .7 }, { type: 'coffeeTable', x: -5, z: 1.8, w: 1.8, d: .9 }, { type: 'coffeeTable', x: 5, z: 1.8, w: 1.8, d: .9 },
    ],
    debris: [...scatter('popcorn', 0, -1, 9, 1.8), ...scatter('crumbs', -5, 1.8, 5, 1), ...scatter('crumbs', 5, 1.8, 5, 1), ...scatter('coin', 0, 3.5, 5, 1.4), ...scatter('sock', -3, -4.5, 3, 1)],
    toys: [{ x: 3, z: 1.6, r: .3, kind: 'ball' }, { x: -3, z: -4.6, r: .3, kind: 'ball' }],
  },
];
export const roomFor = (level: number) => ROOMS[(Math.max(1, level) - 1) % ROOMS.length];
export const roomName = (level: number) => roomFor(level).name + (level > ROOMS.length ? ` ${Math.ceil(level / ROOMS.length)}` : '');
