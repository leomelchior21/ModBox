export type Vec = readonly [number, number];
/** Course pieces. Land is described by its top profile (left to right) and is solid down to the seabed. */
export type Piece =
  | { kind: 'land'; top: readonly Vec[]; gate?: boolean }
  | { kind: 'rope'; from: Vec; to: Vec; planks: number; slack: number }
  | { kind: 'crumble'; from: Vec; to: Vec; planks: number; delay: number }
  | { kind: 'seesaw'; pivot: Vec; length: number; tilt: number }
  | { kind: 'crate'; at: Vec; size: number };
export interface MonsterLevel {
  name: string; tip: string; start: number; finish: number; par: number;
  checkpoints: readonly number[]; coins: readonly Vec[]; signs: readonly (readonly [number, string])[]; pieces: readonly Piece[];
}
export const WATER_Y = -2.4, SEABED_Y = -9, TRACK_DEPTH = 4.8;

const flat = (from: number, to: number, y = 0): Vec[] => [[from, y], [to, y]];
const steps = (from: number, count: number, run: number, rise: number, base = 0): Vec[] => {
  const points: Vec[] = [[from, base]];
  // Risers lean very slightly so the profile stays a function of x.
  for (let i = 1; i <= count; i++) { const x = from + i * run, y = base + i * rise; points.push([x - run * .02, y - rise], [x, y]); }
  return points;
};

/** Eight short handcrafted courses. Each one introduces a single idea, then combines it with the previous ones. */
export const MONSTER_LEVELS: readonly MonsterLevel[] = [
  {
    name: 'Classic', tip: 'Hold GAS and enjoy the wobble.', start: -4, finish: 58, par: 8.5,
    checkpoints: [28], coins: [[14, 1.4], [20, 1.2], [35, 2.6], [43, 4.2], [52, 1.6]], signs: [[2, 'GO →'], [30, 'JUMP!']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'rope', from: [6, -.05], to: [24, -.05], planks: 15, slack: 1.004 },
      { kind: 'land', top: [[24, 0], [32, 0], [38, 1.25], [39.5, 1.25]] },
      { kind: 'land', top: [[45.5, .5], [49, 0], [66, 0]] },
    ],
  },
  {
    name: 'Ramp Day', tip: 'Speed is your friend. GAS tilts you back in the air, BACK tilts you forward.', start: -9, finish: 74, par: 11,
    checkpoints: [32], coins: [[12, 1.2], [19, 4.6], [22, 4.9], [46, 4.8], [50, 4.3], [66, 1.3]], signs: [[4, 'FULL SPEED'], [36, 'BIGGER!']],
    pieces: [
      { kind: 'land', top: [[-17, 0], [8, 0], [14, 1.6], [15.5, 1.9]], gate: true },
      { kind: 'land', top: [[23, 1.1], [27, 0], [36, 0], [42, 2], [43.5, 2.2]] },
      { kind: 'land', top: [[48, 1.5], [52, .6], [56, 0], [82, 0]] },
    ],
  },
  {
    name: 'Seesaw Sea', tip: 'Drive up, wait for the tip, roll down.', start: -4, finish: 64, par: 8,
    checkpoints: [24], coins: [[12, 2.6], [17, 2.8], [33, 2.8], [38, 2.6], [56, 1.3]], signs: [[1, 'EASY NOW'], [26, 'AGAIN!']],
    pieces: [
      { kind: 'land', top: flat(-12, 8.5), gate: true },
      { kind: 'seesaw', pivot: [13.5, .75], length: 11.5, tilt: .17 },
      { kind: 'land', top: flat(18.5, 28.5) },
      { kind: 'seesaw', pivot: [33.5, .75], length: 11.5, tilt: .17 },
      { kind: 'land', top: flat(38.5, 72) },
    ],
  },
  {
    name: 'Wobbly Planks', tip: 'Long bridges bounce. Keep a steady throttle.', start: -4, finish: 70, par: 8.5,
    checkpoints: [33], coins: [[10, .8], [17, .2], [24, .8], [38, 1.2], [47, 2.2], [53, 3.6]], signs: [[2, 'WOBBLY'], [35, 'UPHILL']],
    pieces: [
      { kind: 'land', top: flat(-12, 4), gate: true },
      { kind: 'rope', from: [4, -.05], to: [30, -.05], planks: 22, slack: 1.0035 },
      { kind: 'land', top: [[30, 0], [36, 0], [38, .4], [40, .4]] },
      { kind: 'rope', from: [40, .35], to: [57, 3.15], planks: 15, slack: 1.003 },
      { kind: 'land', top: flat(57, 78, 3.2) },
    ],
  },
  {
    name: 'Crate Escape', tip: 'Crates are light. Push through, but do not let them flip you.', start: -4, finish: 68, par: 15,
    checkpoints: [28], coins: [[9, 2.6], [15, 2], [20, 3], [34, 2.8], [47, 3.4], [60, 1.4]], signs: [[1, 'PUSH!'], [29, 'MIND THE STEP']],
    pieces: [
      { kind: 'land', top: [[-12, 0], [17, 0], [17.1, .5], [30, .5], [36, 1.9], [37.5, 2.1]], gate: true },
      { kind: 'crate', at: [10, .6], size: 1.15 }, { kind: 'crate', at: [10.2, 1.8], size: 1.1 }, { kind: 'crate', at: [11.4, .6], size: 1.15 },
      { kind: 'crate', at: [21.5, 1.1], size: 1.2 }, { kind: 'crate', at: [22.8, 1.1], size: 1.2 },
      { kind: 'land', top: [[44, 1.2], [47, .5], [53, .5], [56, 0], [76, 0]] },
      { kind: 'crate', at: [51.5, 1.05], size: 1.0 },
    ],
  },
  {
    name: 'Crumble Bay', tip: 'These boards drop soon after you touch them. Do not stop!', start: -4, finish: 66, par: 7.5,
    checkpoints: [25], coins: [[11, 1.2], [17, 1.2], [32, 1.2], [39, 1.2], [46, 1.2], [58, 1.4]], signs: [[2, 'NO STOPPING'], [27, 'LONGER!']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'crumble', from: [6, -.05], to: [22, -.05], planks: 14, delay: .38 },
      { kind: 'land', top: flat(22, 29) },
      { kind: 'crumble', from: [29, -.05], to: [51, -.05], planks: 19, delay: .34 },
      { kind: 'land', top: flat(51, 74) },
    ],
  },
  {
    name: 'Stair Climb', tip: 'Big tires climb steps. Ease off at the top, the drop is steep.', start: -4, finish: 66, par: 12,
    checkpoints: [33], coins: [[10, 1.6], [14, 2.5], [18, 3.4], [24, 4.4], [40, 1], [47, .6], [55, 1.2]], signs: [[1, 'CLIMB'], [29, 'STEEP!']],
    pieces: [
      { kind: 'land', top: [[-12, 0], ...steps(8, 6, 2.4, .42), [27, 2.52], [33, 0], [36, 0]], gate: true },
      { kind: 'rope', from: [36, -.05], to: [50, -.05], planks: 12, slack: 1.004 },
      { kind: 'land', top: flat(50, 74) },
    ],
  },
  {
    name: 'Lighthouse Leap', tip: 'Everything you have learned, one last time.', start: -4, finish: 104, par: 13.5,
    checkpoints: [30, 66], coins: [[13, 4.4], [17, 5], [36, 1.2], [45, 1.2], [60, 2.6], [77, 2.8], [92, 5.4]], signs: [[2, 'FINALE'], [32, 'QUICK!'], [68, 'LAST CLIMB']],
    pieces: [
      { kind: 'land', top: [[-12, 0], [9, 0], [15, 1.8], [16.5, 2]], gate: true },
      { kind: 'land', top: [[22.5, 1.2], [25.5, .3], [34, .3]] },
      { kind: 'crumble', from: [34, .25], to: [50, .25], planks: 14, delay: .36 },
      { kind: 'land', top: flat(50, 56.8, .3) },
      { kind: 'seesaw', pivot: [61.4, .9], length: 11, tilt: .15 },
      { kind: 'land', top: [[66.1, .3], [75, .3], [78, .9], [79.6, .9]] },
      { kind: 'rope', from: [79.6, .85], to: [92, 4.25], planks: 11, slack: 1.003 },
      { kind: 'land', top: flat(92, 112, 4.3) },
    ],
  },
];

export const levelFor = (level: number): MonsterLevel => MONSTER_LEVELS[(Math.max(1, level) - 1) % MONSTER_LEVELS.length];
export const levelName = (level: number): string => {
  const lap = Math.floor((Math.max(1, level) - 1) / MONSTER_LEVELS.length);
  return levelFor(level).name + (lap ? ` ${'I'.repeat(Math.min(3, lap + 1))}` : '');
};
/** Surface height of solid land at x (ignores bridges and props). */
export function landHeight(level: MonsterLevel, x: number): number | null {
  let best: number | null = null;
  for (const piece of level.pieces) {
    if (piece.kind !== 'land') continue;
    const top = piece.top; if (x < top[0][0] || x > top[top.length - 1][0]) continue;
    for (let i = 0; i < top.length - 1; i++) {
      const [ax, ay] = top[i], [bx, by] = top[i + 1];
      if (x >= ax && x <= bx) { const y = bx - ax < 1e-6 ? Math.max(ay, by) : ay + (by - ay) * (x - ax) / (bx - ax); best = best === null ? y : Math.max(best, y); }
    }
  }
  return best;
}
