export type UnitKind = 'saw' | 'charger' | 'wall' | 'mine' | 'frost' | 'chainsaw' | 'twin';
export type ZombieKind = 'worker' | 'hardhat' | 'welder' | 'runner' | 'brute' | 'flag';
export interface YardWave { at: number; zombies: readonly ZombieKind[]; huge?: boolean }
export interface YardLevel { name: string; tip: string; lanes: readonly number[]; cards: readonly UnitKind[]; reward?: UnitKind; night?: boolean; waves: readonly YardWave[] }

/** Builds a wave script: steady trickles between flag waves, each flag wave led by a flag zombie. */
function script(trickle: readonly ZombieKind[][], flags: readonly ZombieKind[][], first = 20, gap = 13): YardWave[] {
  const waves: YardWave[] = []; let at = first, flag = 0;
  const per = Math.ceil(trickle.length / Math.max(1, flags.length));
  trickle.forEach((zombies, i) => {
    waves.push({ at, zombies }); at += gap;
    if ((i + 1) % per === 0 && flag < flags.length) { at += 4; waves.push({ at, zombies: ['flag', ...flags[flag++]], huge: true }); at += gap + 6; }
  });
  while (flag < flags.length) { waves.push({ at, zombies: ['flag', ...flags[flag++]], huge: true }); at += gap + 6; }
  return waves;
}
const w = (n: number, kind: ZombieKind = 'worker'): ZombieKind[] => Array.from({ length: n }, () => kind);

/** Ten levels in the spirit of a classic lawn defense: lanes open up, a new tool arrives after every level. */
export const YARD_LEVELS: readonly YardLevel[] = [
  { name: 'First Shift', tip: 'Place a SAW SHOOTER, then tap falling batteries to collect power.', lanes: [2], cards: ['saw'], reward: 'charger',
    waves: script([w(1), w(1), w(1), w(2)], [w(2)], 22, 14) },
  { name: 'Overtime', tip: 'Battery Chargers pay for everything. Build them early.', lanes: [1, 2, 3], cards: ['saw', 'charger'], reward: 'wall',
    waves: script([w(1), w(1), w(2), w(1), w(2), w(2)], [w(4)], 24) },
  { name: 'Hard Hats', tip: 'Hard hats take three times the hits. Toolboxes buy your saws time.', lanes: [1, 2, 3], cards: ['saw', 'charger', 'wall'], reward: 'mine',
    waves: script([w(1), w(2), ['worker', 'hardhat'], w(2), ['hardhat', 'worker'], ['hardhat', 'hardhat']], [['worker', 'hardhat', 'worker', 'worker']], 22) },
  { name: 'Full Yard', tip: 'All five lanes are open. Nail mines are cheap: arm them early.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine'], reward: 'frost',
    waves: script([w(1), w(2), ['hardhat'], w(2), ['worker', 'hardhat', 'worker'], w(3), ['hardhat', 'hardhat']], [w(5), ['worker', 'hardhat', 'worker', 'hardhat', 'worker', 'worker']], 22) },
  { name: 'Rush Hour', tip: 'Runners sprint. Frost saws slow everything in the lane.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine', 'frost'], reward: 'chainsaw',
    waves: script([w(2), ['runner'], ['worker', 'runner'], ['hardhat', 'worker'], ['runner', 'runner'], ['hardhat', 'runner', 'worker'], w(3)], [['runner', 'worker', 'worker', 'runner', 'hardhat'], ['runner', 'runner', 'hardhat', 'worker', 'worker', 'runner']], 20) },
  { name: 'Welders', tip: 'Welder masks soak up damage. The chainsaw cuts through anything.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine', 'frost', 'chainsaw'], reward: 'twin',
    waves: script([w(2), ['hardhat'], ['welder'], ['worker', 'hardhat'], ['runner', 'worker'], ['welder', 'worker'], ['hardhat', 'hardhat'], ['welder', 'runner']], [['worker', 'hardhat', 'welder', 'worker', 'worker'], ['welder', 'hardhat', 'runner', 'worker', 'hardhat', 'worker']], 20) },
  { name: 'Night Shift', tip: 'No batteries fall at night. Every charger counts.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine', 'frost', 'chainsaw', 'twin'], night: true,
    waves: script([w(1), w(2), ['hardhat'], ['runner', 'worker'], ['welder'], ['hardhat', 'worker', 'worker'], ['runner', 'hardhat'], ['welder', 'worker']], [['worker', 'hardhat', 'worker', 'runner', 'worker'], ['welder', 'hardhat', 'runner', 'worker', 'worker', 'hardhat']], 26) },
  { name: 'Big Boss', tip: 'Brutes smash tools flat. Hit them early with everything.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine', 'frost', 'chainsaw', 'twin'],
    waves: script([w(2), ['hardhat', 'worker'], ['runner', 'runner'], ['welder'], ['brute'], ['hardhat', 'welder'], ['worker', 'runner', 'worker'], ['brute', 'worker']], [['worker', 'hardhat', 'welder', 'runner', 'worker'], ['brute', 'hardhat', 'welder', 'worker', 'worker', 'runner']], 20) },
  { name: 'The Swarm', tip: 'Wave after wave. Keep a sweeper in every lane as long as you can.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine', 'frost', 'chainsaw', 'twin'],
    waves: script([w(2), w(2), ['hardhat', 'runner'], w(3), ['welder', 'worker'], ['runner', 'runner', 'hardhat'], w(3), ['welder', 'hardhat'], ['brute'], w(4)], [w(7), ['hardhat', 'welder', 'runner', 'worker', 'worker', 'hardhat', 'runner'], ['brute', 'welder', 'hardhat', 'runner', 'worker', 'worker', 'worker', 'hardhat']], 18, 11) },
  { name: 'The Foreman', tip: 'The final shift. Everything you have learned, all at once.', lanes: [0, 1, 2, 3, 4], cards: ['saw', 'charger', 'wall', 'mine', 'frost', 'chainsaw', 'twin'],
    waves: script([w(2), ['hardhat', 'worker'], ['runner', 'welder'], ['brute'], w(3), ['welder', 'hardhat', 'runner'], ['brute', 'worker'], ['hardhat', 'hardhat', 'welder'], ['runner', 'runner', 'runner'], ['brute', 'welder']], [['worker', 'hardhat', 'welder', 'runner', 'worker', 'hardhat'], ['brute', 'welder', 'hardhat', 'runner', 'worker', 'worker', 'hardhat'], ['brute', 'brute', 'welder', 'welder', 'hardhat', 'runner', 'runner', 'worker']], 18, 11) },
];
/** After the campaign, the finale repeats with tougher zombies. */
export const yardLevel = (level: number): YardLevel => YARD_LEVELS[Math.min(YARD_LEVELS.length, Math.max(1, level)) - 1];
export const yardToughness = (level: number) => 1 + Math.max(0, level - YARD_LEVELS.length) * .2;
export const yardLevelName = (level: number) => level > YARD_LEVELS.length ? `${YARD_LEVELS[YARD_LEVELS.length - 1].name} +${level - YARD_LEVELS.length}` : yardLevel(level).name;
