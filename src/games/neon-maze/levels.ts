/**
 * Twelve sectors. Each one is carved from a seed, so it is the same every time you play it.
 * `grow` adds rooms on top of the mazeSize mod; `hunters` and `sleepers` are the sentinels on duty;
 * `pace` scales how quick they are; `dark` limits sight; `portals` opens side tunnels; `sealed` hides a gem
 * behind walls (only a phase dash gets in); `warden` brings the boss.
 */
export interface Sector {
  name: string; tip: string; seed: number; grow: number; hunters: number; sleepers: number; pace: number;
  dark?: boolean; portals?: boolean; sealed?: number; warden?: boolean; loops?: number;
}
export const SECTORS: readonly Sector[] = [
  { name: 'Boot Sequence', seed: 11, grow: -1, hunters: 1, sleepers: 0, pace: .7, tip: 'Steer with the arrows (or swipe). Roll over the 3 amber gems, then into the glowing exit.' },
  { name: 'First Contact', seed: 23, grow: 0, hunters: 2, sleepers: 0, pace: .8, tip: 'Hunters chase you. An amber gem freezes them: touch a frozen hunter to catch it!' },
  { name: 'Ghost Train', seed: 37, grow: 0, hunters: 1, sleepers: 6, pace: .85, tip: 'Sleeping drones wake up and follow you in a train. Grab a gem, turn around and eat the whole train!' },
  { name: 'Amber Rush', seed: 41, grow: 0, hunters: 3, sleepers: 2, pace: .9, loops: .35, tip: 'Keep collecting dots without stopping: your FLOW multiplier climbs to ×8.' },
  { name: 'Phase Walls', seed: 53, grow: 0, hunters: 2, sleepers: 3, pace: .9, sealed: 2, tip: 'Two gems are walled in. Press SPACE (or DASH) to phase straight through a wall.' },
  { name: 'Blackout', seed: 67, grow: 1, hunters: 2, sleepers: 4, pace: .95, dark: true, tip: 'The lights are out. Listen for the hunters, and look for the gems glowing in the dark.' },
  { name: 'Wraparound', seed: 79, grow: 1, hunters: 3, sleepers: 4, pace: 1, portals: true, tip: 'Tunnels on the sides wrap you to the other edge. Hunters use them too.' },
  { name: 'Hunter Pack', seed: 83, grow: 1, hunters: 4, sleepers: 4, pace: 1.05, tip: 'Four hunters, four roles: one chases, one cuts you off, one flanks and one guards the gems.' },
  { name: 'Overclock', seed: 97, grow: 1, hunters: 3, sleepers: 6, pace: 1.18, loops: .32, tip: 'Everything runs hot. Use dashes to escape, and keep your flow alive.' },
  { name: 'The Long Train', seed: 101, grow: 2, hunters: 2, sleepers: 14, pace: 1.1, tip: 'Fourteen sleepers. Build the longest train you can, then turn and devour it.' },
  { name: 'Static Storm', seed: 113, grow: 2, hunters: 4, sleepers: 6, pace: 1.15, dark: true, sealed: 1, tip: 'Dark, sealed and crowded. Everything you learned, all at once.' },
  { name: 'The Warden', seed: 127, grow: 1, hunters: 2, sleepers: 4, pace: 1.1, warden: true, tip: 'THE WARDEN guards the core. Catch it three times while it is frozen to open the exit.' },
];
export function sectorOf(level: number): Sector {
  const n = Math.max(1, level), base = SECTORS[(n - 1) % SECTORS.length], loop = Math.floor((n - 1) / SECTORS.length);
  return loop ? { ...base, seed: base.seed + loop * 1000, pace: base.pace + loop * .12, hunters: Math.min(5, base.hunters + loop) } : base;
}
export const sectorName = (level: number) => sectorOf(level).name + (level > SECTORS.length ? ` ${Math.ceil(level / SECTORS.length)}` : '');
