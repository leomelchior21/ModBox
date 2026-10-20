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
/** Rolling terrain: `count` smooth humps of height `amp` between from and to. */
const bumps = (from: number, to: number, amp: number, count: number, base = 0): Vec[] => {
  const points: Vec[] = [], n = count * 6;
  for (let i = 0; i <= n; i++) { const t = i / n; points.push([from + (to - from) * t, base + amp * (1 - Math.cos(t * count * Math.PI * 2)) / 2]); }
  return points;
};
const steps = (from: number, count: number, run: number, rise: number, base = 0): Vec[] => {
  const points: Vec[] = [[from, base]];
  // Risers lean very slightly so the profile stays a function of x.
  for (let i = 1; i <= count; i++) { const x = from + i * run, y = base + i * rise; points.push([x - run * .02, y - rise], [x, y]); }
  return points;
};

/** Eight short handcrafted courses. Each one introduces a single idea, then combines it with the previous ones. */
export const MONSTER_LEVELS: readonly MonsterLevel[] = [
  {
    name: 'Classic', tip: 'Hold GAS and enjoy the wobble.', start: -4, finish: 58, par: 8,
    checkpoints: [28], coins: [[14, 1.4], [20, 1.2], [35, 2.6], [43, 4.2], [52, 1.6]], signs: [[2, 'GO →'], [30, 'HILL!']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'rope', from: [6, -.05], to: [24, -.05], planks: 15, slack: 1.004 },
      { kind: 'land', top: [[24, 0], [32, 0], [36, .9], [40, .9], [44, 0], [66, 0]] },
    ],
  },
  {
    name: 'Ramp Day', tip: 'Speed is your friend. GAS tilts you back in the air, BACK tilts you forward.', start: -9, finish: 74, par: 10,
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
    name: 'Wobbly Planks', tip: 'Long bridges bounce. Keep a steady throttle.', start: -4, finish: 70, par: 9,
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
    name: 'Crate Escape', tip: 'Crates are light. Push through, but do not let them flip you.', start: -4, finish: 68, par: 14.5,
    checkpoints: [28], coins: [[9, 2.6], [15, 2], [20, 3], [34, 2.8], [47, 3.4], [60, 1.4]], signs: [[1, 'PUSH!'], [29, 'MIND THE STEP']],
    pieces: [
      { kind: 'land', top: [[-12, 0], [17, 0], [17.1, .5], [30, .5], [36, 1.9], [37.5, 2.1]], gate: true },
      { kind: 'crate', at: [10, .6], size: 1.15 }, { kind: 'crate', at: [10.2, 1.8], size: 1.1 }, { kind: 'crate', at: [11.4, .6], size: 1.15 },
      { kind: 'crate', at: [21.5, 1.1], size: 1.2 }, { kind: 'crate', at: [22.8, 1.1], size: 1.2 },
      { kind: 'land', top: [[42.5, 1.3], [46, .5], [53, .5], [56, 0], [76, 0]] },
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
    name: 'Lighthouse Leap', tip: 'Everything you have learned, one last time.', start: -4, finish: 104, par: 13,
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
  {
    name: 'Bumpy Road', tip: 'Ride the bumps. Tap BACK when the nose climbs.', start: -4, finish: 66, par: 9.5,
    checkpoints: [30], coins: [[12, 2], [20, 2.2], [28, 2], [40, 2.4], [52, 2.2]], signs: [[2, 'BUMPY!']],
    pieces: [{ kind: 'land', top: [[-12, 0], ...bumps(6, 56, .55, 7), [74, 0]], gate: true }],
  },
  {
    name: 'Twin Bridges', tip: 'Two rope bridges. Keep it smooth in the middle.', start: -4, finish: 70, par: 9,
    checkpoints: [29], coins: [[12, .9], [18, .6], [36, 1.6], [44, .9], [50, .6]], signs: [[2, 'WOBBLE x2']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'rope', from: [6, -.05], to: [24, -.05], planks: 15, slack: 1.004 },
      { kind: 'land', top: [[24, 0], [28, 0], [31, .6], [34, 0], [38, 0]] },
      { kind: 'rope', from: [38, -.05], to: [56, -.05], planks: 15, slack: 1.005 },
      { kind: 'land', top: flat(56, 78) },
    ],
  },
  {
    name: 'Big Drop', tip: 'Climb, then fall. Tilt forward to land on the slope.', start: -4, finish: 66, par: 8.5,
    checkpoints: [24], coins: [[14, 3], [24, 4.4], [31, 4.2], [37, 2], [50, 1.4]], signs: [[2, 'CLIMB'], [26, 'DROP!']],
    pieces: [
      { kind: 'land', top: [[-12, 0], [6, 0], [16, 3.2], [29, 3.2]], gate: true },
      { kind: 'land', top: [[34, 2], [38, .7], [42, 0], [74, 0]] },
    ],
  },
  {
    name: 'Seesaw Ladder', tip: 'Seesaws can lift you up to the next island.', start: -4, finish: 62, par: 8.5,
    checkpoints: [24], coins: [[11, 2.4], [17, 3.6], [32, 3.8], [38, 4.4], [52, 2.8]], signs: [[1, 'UP WE GO']],
    pieces: [
      { kind: 'land', top: flat(-12, 8.5), gate: true },
      { kind: 'seesaw', pivot: [13.5, .95], length: 11.5, tilt: .1 },
      { kind: 'land', top: flat(18.4, 27.5, .7) },
      { kind: 'seesaw', pivot: [32.5, 1.65], length: 11.5, tilt: .1 },
      { kind: 'land', top: flat(37.4, 70, 1.4) },
    ],
  },
  {
    name: 'Crate Wall', tip: 'Smash through the stack with speed.', start: -4, finish: 66, par: 10.5,
    checkpoints: [32], coins: [[12, 3.6], [18, 3.2], [36, 2.8], [44, 3.6], [56, 1.6]], signs: [[2, 'SMASH!'], [34, 'JUMP']],
    pieces: [
      { kind: 'land', top: [[-12, 0], [36, 0], [41, 1.5], [42.5, 1.6]], gate: true },
      { kind: 'crate', at: [16, .55], size: 1.05 }, { kind: 'crate', at: [17.15, .55], size: 1.05 }, { kind: 'crate', at: [16.5, 1.65], size: 1.05 },
      { kind: 'crate', at: [24, .55], size: 1.05 }, { kind: 'crate', at: [25.2, .55], size: 1.05 }, { kind: 'crate', at: [24.6, 1.65], size: 1.05 },
      { kind: 'land', top: [[48, 1], [51, .3], [54, 0], [74, 0]] },
    ],
  },
  {
    name: 'Hop Skip', tip: 'Three small gaps. Keep the wheels level.', start: -6, finish: 70, par: 10,
    checkpoints: [35], coins: [[15, 2.6], [29, 2.6], [42, 2.6], [56, 1.6]], signs: [[2, 'HOP x3']],
    pieces: [
      { kind: 'land', top: [[-14, 0], [9, 0], [13, .9], [13.8, 1]], gate: true },
      { kind: 'land', top: [[17.5, .6], [19.5, 0], [24, 0], [27, .9], [27.8, 1]] },
      { kind: 'land', top: [[31.5, .6], [33.5, 0], [37, 0], [40, .9], [40.8, 1]] },
      { kind: 'land', top: [[44.5, .6], [46.5, 0], [78, 0]] },
    ],
  },
  {
    name: 'Fragile Hill', tip: 'The uphill boardwalk is crumbling. Full throttle!', start: -4, finish: 62, par: 7.5,
    checkpoints: [], coins: [[12, 1.2], [20, 2.4], [28, 3.6], [36, 4.6], [48, 5]], signs: [[2, 'NO STOPPING']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'crumble', from: [6, -.05], to: [40, 3.35], planks: 26, delay: .45 },
      { kind: 'land', top: flat(40, 70, 3.4) },
    ],
  },
  {
    name: 'Rope Climb', tip: 'A steep rope bridge. Lean on the gas, mind the wheelie.', start: -4, finish: 58, par: 8,
    checkpoints: [], coins: [[10, .8], [17, 2.2], [24, 3.6], [31, 5], [44, 5.8]], signs: [[2, 'STEEP']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'rope', from: [6, -.05], to: [34, 4.75], planks: 22, slack: 1.003 },
      { kind: 'land', top: flat(34, 66, 4.8) },
    ],
  },
  {
    name: 'Canyon', tip: 'One huge jump. Do not over-rotate.', start: -18, finish: 62, par: 10,
    checkpoints: [], coins: [[18, 5], [22, 6], [26, 5.6], [44, 1.4]], signs: [[-12, 'FULL SPEED'], [9, 'LEAP!']],
    pieces: [
      { kind: 'land', top: [[-26, 0], [6, 0], [12, 2.2], [13.5, 2.5]], gate: true },
      { kind: 'land', top: [[22.5, 1.5], [27, .5], [32, 0], [70, 0]] },
    ],
  },
  {
    name: 'Wobble and Tip', tip: 'Off the bridge, onto the seesaw.', start: -4, finish: 66, par: 8.5,
    checkpoints: [24], coins: [[12, .8], [18, .8], [30, 2.6], [34, 2.8], [52, 1.4]], signs: [[2, 'WOBBLE'], [25, 'TIP']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'rope', from: [6, -.05], to: [20, -.05], planks: 12, slack: 1.004 },
      { kind: 'land', top: flat(20, 27.5) },
      { kind: 'seesaw', pivot: [32.5, .75], length: 11.5, tilt: .17 },
      { kind: 'land', top: flat(37.5, 74) },
    ],
  },
  {
    name: 'Staircase Down', tip: 'Bounce down the steps, then jump the gap.', start: -4, finish: 64, par: 7.5,
    checkpoints: [30], coins: [[12, 4.2], [20, 3.2], [28, 2.2], [38, 2.8], [50, 1.4]], signs: [[2, 'DOWN']],
    pieces: [
      { kind: 'land', top: [[-12, 2.5], [8, 2.5], [8.05, 2.1], [11, 2.1], [11.05, 1.7], [14, 1.7], [14.05, 1.3], [17, 1.3], [17.05, .9], [20, .9], [20.05, .5], [30, .5], [34, 1.4], [35.4, 1.5]], gate: true },
      { kind: 'land', top: [[41, .8], [44, .2], [46, 0], [72, 0]] },
    ],
  },
  {
    name: 'Crate Bridge', tip: 'Crates on a rope bridge. Push them into the sea!', start: -4, finish: 64, par: 12.5,
    checkpoints: [], coins: [[12, 2], [18, 2], [26, 2], [40, 1.4]], signs: [[2, 'PUSH']],
    pieces: [
      { kind: 'land', top: flat(-12, 6), gate: true },
      { kind: 'rope', from: [6, -.05], to: [30, -.05], planks: 20, slack: 1.003 },
      { kind: 'crate', at: [13, .2], size: 1 }, { kind: 'crate', at: [20, .2], size: 1 }, { kind: 'crate', at: [20, 1.3], size: 1 },
      { kind: 'land', top: flat(30, 72) },
    ],
  },
  {
    name: 'Island Hopper', tip: 'Small islands, quick hops. Land, recover, go.', start: -4, finish: 80, par: 11.5,
    checkpoints: [37], coins: [[16, 2.8], [31, 3], [46, 3], [61, 3], [72, 1.4]], signs: [[2, 'HOP!']],
    pieces: [
      { kind: 'land', top: [[-12, 0], [8, 0], [12, 1], [13, 1.1]], gate: true },
      { kind: 'land', top: [[18, .8], [20, 0], [24, 0], [27, 1.1], [28, 1.2]] },
      { kind: 'land', top: [[32.5, .9], [34.5, .2], [39, .2], [42, 1.2], [43, 1.3]] },
      { kind: 'land', top: [[47.5, 1], [49.5, .3], [54, .3], [57, 1.2], [58, 1.3]] },
      { kind: 'land', top: [[62.5, .9], [64.5, 0], [88, 0]] },
    ],
  },
  {
    name: 'Grand Finale', tip: 'Every trick in the book. You have got this.', start: -6, finish: 128, par: 20,
    checkpoints: [28, 51, 98], coins: [[14, 4.4], [26, .9], [44, 1], [58, 2.8], [76, 3.2], [90, 1.4], [104, 3.2], [118, 5.4]], signs: [[2, 'FINALE'], [64, 'TIP'], [99, 'LAST CLIMB']],
    pieces: [
      { kind: 'land', top: [[-14, 0], [7, 0], [13, 1.8], [14.5, 2]], gate: true },
      { kind: 'land', top: [[22.5, 1.2], [25.5, .3], [32, .3]] },
      { kind: 'crumble', from: [32, .25], to: [48, .25], planks: 14, delay: .4 },
      { kind: 'land', top: [[48, .3], [54, .3], ...bumps(54, 62, .45, 2, .3), [64.3, .3]] },
      { kind: 'seesaw', pivot: [69.7, .9], length: 11, tilt: .15 },
      { kind: 'land', top: [[74.4, .3], [80, .3]] },
      { kind: 'rope', from: [80, .25], to: [96, .25], planks: 13, slack: 1.004 },
      { kind: 'land', top: [[96, .3], [100, .3], [103, 1.1], [104.5, 1.2]] },
      { kind: 'rope', from: [104.5, 1.15], to: [116, 4.25], planks: 10, slack: 1.003 },
      { kind: 'land', top: flat(116, 136, 4.3) },
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
