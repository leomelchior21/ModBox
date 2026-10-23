/**
 * Twelve asteroids. Each is grown from a seed: `size` in cells, how hollow it is (`caves`), which minerals it
 * holds, how many minerals to bank (`quota`), how long until the anomaly wakes (`timer`, seconds) and how strong it
 * is (`threat`). `tech` hides lost technology to recover; `magma` adds hot pockets; `core` is the final anomaly.
 */
export type OreMix = { copper: number; crystal: number; gold: number; ice: number };
export interface Asteroid {
  name: string; tip: string; seed: number; size: [number, number]; caves: number; ores: OreMix;
  quota: number; timer: number; threat: number; tech?: number; magma?: number; core?: boolean;
}
export const ASTEROIDS: readonly Asteroid[] = [
  { name: 'First Rock', seed: 7, size: [64, 46], caves: .3, ores: { copper: 1, crystal: 0, gold: 0, ice: 0 }, quota: 12, timer: 0, threat: 0, tip: 'Fly into the rock: your drill beam mines it. Bring 12 minerals back to your base.' },
  { name: 'Copper Belt', seed: 19, size: [72, 50], caves: .32, ores: { copper: 1, crystal: .15, gold: 0, ice: 0 }, quota: 25, timer: 120, threat: 1, tip: 'The anomaly wakes when the timer runs out. Bank your minerals, then dock to warp away.' },
  { name: 'Hollow Moon', seed: 31, size: [78, 54], caves: .44, ores: { copper: 1, crystal: .3, gold: 0, ice: 0 }, quota: 30, timer: 110, threat: 1, tip: 'Caves everywhere. Press SPACE to blast the anomalites if they find you.' },
  { name: 'Glitter Field', seed: 43, size: [80, 56], caves: .36, ores: { copper: .5, crystal: 1, gold: .1, ice: 0 }, quota: 40, timer: 100, threat: 1, tip: 'Crystals are worth three. They are harder to drill, so keep the beam on them.' },
  { name: 'Lost Probe', seed: 57, size: [82, 58], caves: .38, ores: { copper: 1, crystal: .4, gold: .1, ice: 0 }, quota: 30, timer: 100, threat: 2, tech: 1, tip: 'A probe crashed deep inside. Recover its lost technology, then bank your minerals.' },
  { name: 'Cold Comet', seed: 61, size: [84, 58], caves: .34, ores: { copper: .6, crystal: .5, gold: .1, ice: 1.2 }, quota: 45, timer: 95, threat: 2, tip: 'Ice drills fast. Your cargo hold fills up quickly: fly home often.' },
  { name: 'Magma Heart', seed: 73, size: [86, 60], caves: .38, ores: { copper: .8, crystal: .4, gold: .5, ice: 0 }, quota: 50, timer: 90, threat: 2, magma: 1, tip: 'Glowing magma burns your hull. Mine around it, and grab the gold near the centre.' },
  { name: 'The Swarm', seed: 89, size: [80, 56], caves: .42, ores: { copper: 1, crystal: .5, gold: .2, ice: 0 }, quota: 40, timer: 60, threat: 3, tip: 'The anomaly comes early and angry. Fight it, or bank fast and run.' },
  { name: 'Deep Core', seed: 97, size: [96, 66], caves: .36, ores: { copper: .7, crystal: .6, gold: .6, ice: .2 }, quota: 70, timer: 100, threat: 3, tip: 'A huge asteroid with gold at its heart. Drones help: press E when the drone bay is on.' },
  { name: 'Ruins of Vela', seed: 101, size: [88, 62], caves: .46, ores: { copper: .8, crystal: .6, gold: .3, ice: 0 }, quota: 50, timer: 90, threat: 3, tech: 2, tip: 'Two pieces of lost technology lie in the ruins. Find both.' },
  { name: 'Rift Storm', seed: 113, size: [90, 62], caves: .4, ores: { copper: .8, crystal: .7, gold: .4, ice: .2 }, quota: 60, timer: 50, threat: 4, magma: .6, tip: 'Rifts tear open fast here. Destroy the rift to calm the whole asteroid.' },
  { name: 'The Anomaly', seed: 127, size: [84, 60], caves: .42, ores: { copper: .6, crystal: .6, gold: .6, ice: 0 }, quota: 0, timer: 1, threat: 5, core: true, tip: 'This is where it all began. Destroy the anomaly core, then warp home.' },
];
export function asteroidOf(level: number): Asteroid {
  const n = Math.max(1, level), base = ASTEROIDS[(n - 1) % ASTEROIDS.length], loop = Math.floor((n - 1) / ASTEROIDS.length);
  return loop ? { ...base, seed: base.seed + loop * 1000, threat: Math.min(6, base.threat + loop), quota: Math.round(base.quota * (1 + loop * .3)), timer: base.timer ? Math.max(30, base.timer - loop * 15) : base.timer } : base;
}
export const asteroidName = (level: number) => asteroidOf(level).name + (level > ASTEROIDS.length ? ` ${Math.ceil(level / ASTEROIDS.length)}` : '');
