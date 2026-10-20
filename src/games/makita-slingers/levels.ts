export type Material = 'wood' | 'glass' | 'steel' | 'tnt';
export type RobotKind = 'robot' | 'helmet' | 'boss';
export type BladeKind = 'saw' | 'split' | 'turbo' | 'bomb';
export interface Block { material: Material; x: number; y: number; w: number; h: number }
export interface Robot { kind: RobotKind; x: number; y: number }
export interface Hill { x: number; w: number; h: number }
export interface SlingLevel { name: string; tip: string; blades: readonly BladeKind[]; blocks: readonly Block[]; robots: readonly Robot[]; hills: readonly Hill[] }

/** Builders in meters with the ground at y = 0. Blocks are centred on (x, y). */
const post = (material: Material, x: number, base: number, h = 2, w = .32): Block => ({ material, x, y: base + h / 2, w, h });
const plank = (material: Material, x: number, base: number, w = 2.6, h = .3): Block => ({ material, x, y: base + h / 2, w, h });
const cube = (material: Material, x: number, base: number, s = 1): Block => ({ material, x, y: base + s / 2, w: s, h: s });
const robot = (kind: RobotKind, x: number, base: number): Robot => ({ kind, x, y: base + (kind === 'boss' ? .75 : .42) });
/** A storey: two posts and a plank on top. Returns the blocks and the height of its roof. */
function storey(material: Material, x: number, base: number, width = 2.6, height = 2, roof: Material = material): [Block[], number] {
  return [[post(material, x - width / 2 + .3, base, height), post(material, x + width / 2 - .3, base, height), plank(roof, x, base + height, width)], base + height + .3];
}
function tower(material: Material, x: number, floors: number, base = 0, width = 2.6, roof: Material = material): { blocks: Block[]; top: number; floors: number[] } {
  const blocks: Block[] = [], levels: number[] = []; let y = base;
  for (let i = 0; i < floors; i++) { levels.push(y); const [b, top] = storey(material, x, y, width, 2, roof); blocks.push(...b); y = top; }
  return { blocks, top: y, floors: levels };
}

export const SLING_LEVELS: readonly SlingLevel[] = [
  (() => { const t = tower('wood', 16, 1); return { name: 'Scrap Shack', tip: 'Drag back from anywhere, aim high and let go. Knock the robots off their perch.', blades: ['saw', 'saw', 'saw'] as BladeKind[], hills: [],
    blocks: t.blocks, robots: [robot('robot', 16, t.top), robot('robot', 16, 0)] }; })(),
  (() => { const a = tower('glass', 15, 1), b = tower('glass', 19, 1); return { name: 'Glass House', tip: 'Glass shatters at a touch. Steel shrugs off almost anything.', blades: ['saw', 'saw', 'saw'] as BladeKind[], hills: [],
    blocks: [...a.blocks, ...b.blocks], robots: [robot('robot', 15, 0), robot('robot', 19, 0), robot('robot', 19, b.top)] }; })(),
  (() => { const a = tower('wood', 15, 2), b = tower('wood', 19.5, 2); return { name: 'Twin Towers', tip: 'The BLUE blade splits in three: tap again mid-flight.', blades: ['saw', 'split', 'saw'] as BladeKind[], hills: [],
    blocks: [...a.blocks, ...b.blocks], robots: [robot('robot', 15, a.top), robot('robot', 19.5, b.top), robot('robot', 15, a.floors[1])] }; })(),
  (() => { const t = tower('steel', 17, 2, 0, 3.2, 'wood'); return { name: 'Steel Cage', tip: 'The YELLOW blade bursts forward when you tap. Punch through the cage.', blades: ['turbo', 'saw', 'turbo'] as BladeKind[], hills: [],
    blocks: t.blocks, robots: [robot('helmet', 17, 0), robot('robot', 17, t.floors[1]), robot('robot', 17, t.top)] }; })(),
  { name: 'Pyramid', tip: 'Topple the top and let gravity do the rest.', blades: ['saw', 'split', 'saw', 'saw'], hills: [],
    blocks: [...[0, 1, 2, 3].map(i => cube('wood', 14.5 + i * 1.6, 0)), ...[0, 1, 2].map(i => plank('wood', 15.3 + i * 1.6, 1, 1.5)), ...[0, 1].map(i => cube('glass', 16.1 + i * 1.6, 1.3)), plank('wood', 16.9, 2.3, 1.5), cube('wood', 16.9, 2.6)],
    robots: [robot('robot', 15.3, 0), robot('robot', 18.5, 0), robot('robot', 16.9, 1.3), robot('helmet', 16.9, 3.6)] },
  (() => { const t = tower('wood', 18, 1, 0, 3.4); return { name: 'Boom Crates', tip: 'Red crates explode. The BLACK blade explodes too: tap to detonate.', blades: ['bomb', 'saw', 'saw'] as BladeKind[], hills: [],
    blocks: [...t.blocks, cube('tnt', 16, 0, .9), cube('tnt', 21, 0, .9), cube('tnt', 18, t.top, .9)], robots: [robot('robot', 17.3, 0), robot('robot', 18.7, 0), robot('helmet', 21, .9), robot('robot', 16, .9)] }; })(),
  (() => { const t = tower('wood', 17, 4, 0, 3.2), bunker = tower('steel', 23, 1, 0, 2.4); return { name: 'High Rise', tip: 'Hit it low and the whole thing comes down. Then deal with the bunker.', blades: ['saw', 'turbo', 'split', 'saw'] as BladeKind[], hills: [],
    blocks: [...t.blocks, ...bunker.blocks], robots: [robot('robot', 17, t.floors[1]), robot('robot', 17, t.floors[2]), robot('helmet', 17, t.top), robot('helmet', 23, 0)] }; })(),
  (() => { const base = 1.2, a = tower('steel', 16, 1, base, 2.4, 'wood'), b = tower('glass', 19.6, 1, base, 2.4); return { name: 'Fortress', tip: 'A fort on a hill. Lob the blade high to drop in from above.', blades: ['saw', 'bomb', 'split', 'saw'] as BladeKind[], hills: [{ x: 17.8, w: 7.5, h: base }],
    blocks: [...a.blocks, ...b.blocks, post('wood', 21.4, base, 2.6), plank('wood', 17.8, a.top, 6)], robots: [robot('helmet', 16, base), robot('robot', 19.6, base), robot('robot', 17.8, a.top + .3), robot('robot', 21.4, base + 2.6)] }; })(),
  { name: 'The Bridge', tip: 'Break a pillar and the whole bridge drops into the gap.', blades: ['turbo', 'saw', 'saw'], hills: [{ x: 14, w: 3, h: 1 }, { x: 22, w: 3, h: 1 }],
    blocks: [post('wood', 14.3, 1, 1.6, .4), post('wood', 21.7, 1, 1.6, .4), plank('wood', 18, 2.6, 8.4, .32)], robots: [robot('robot', 16, 2.92), robot('robot', 18, 2.92), robot('robot', 20, 2.92)] },
  (() => { const base = 3, t = tower('wood', 18, 2, base, 2.6, 'glass'); return { name: 'Hilltop', tip: 'High ground. Use a full pull and watch the gravity.', blades: ['saw', 'split', 'turbo', 'saw'] as BladeKind[], hills: [{ x: 18, w: 6, h: base }],
    blocks: [...t.blocks, cube('tnt', 16, base, .8)], robots: [robot('robot', 18, base), robot('robot', 18, t.floors[1]), robot('helmet', 18, t.top)] }; })(),
  (() => { const a = tower('glass', 15, 1), b = tower('steel', 18.6, 2, 0, 2.4, 'wood'), c = tower('wood', 22.2, 3, 0, 2.2); return { name: 'Junkyard', tip: 'Everything at once. Pick the right blade for each pile.', blades: ['split', 'bomb', 'turbo', 'saw', 'saw'] as BladeKind[], hills: [],
    blocks: [...a.blocks, ...b.blocks, ...c.blocks, cube('tnt', 20.4, 0, .9)], robots: [robot('robot', 15, a.top), robot('helmet', 18.6, 0), robot('robot', 18.6, b.top), robot('robot', 22.2, c.floors[2]), robot('robot', 22.2, c.top)] }; })(),
  (() => { const base = 1, t = tower('steel', 19, 2, base, 4, 'steel'); return { name: 'Boss Bot', tip: 'The boss is tough. Hit hard, use every special, bring the roof down.', blades: ['bomb', 'turbo', 'split', 'bomb', 'saw'] as BladeKind[], hills: [{ x: 19, w: 7, h: base }],
    blocks: [...t.blocks, post('glass', 16.4, base, 1.6), post('glass', 21.6, base, 1.6), cube('tnt', 17.6, base, .8), cube('tnt', 20.4, base, .8)], robots: [robot('boss', 19, base), robot('robot', 19, t.floors[1]), robot('helmet', 19, t.top)] }; })(),
];
export const slingLevel = (level: number) => SLING_LEVELS[(Math.max(1, level) - 1) % SLING_LEVELS.length];
export const slingLevelName = (level: number) => slingLevel(level).name + (level > SLING_LEVELS.length ? ` ${Math.ceil(level / SLING_LEVELS.length)}` : '');
