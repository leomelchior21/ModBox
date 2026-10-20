import type { ArcadeControl } from './PremiumScreen';

/**
 * Splits a game's controls between the two thumbs of a tablet held in either orientation.
 * Left thumb: steering (left, then down and up). When a game uses all four directions they form a D-pad.
 * Right thumb: the right-hand control in the corner (so left/right mirror each other), then the main action,
 * then everything else. Without a right control the main action takes the corner.
 */
export function touchPads(controls: readonly ArcadeControl[]) {
  const directions = ['left', 'right', 'up', 'down'] as const, has = (a: string) => controls.some(c => c.action === a);
  const dpad = directions.every(has);
  if (dpad) {
    const left = directions.map(d => controls.find(c => c.action === d)!);
    const rest = controls.filter(c => !left.includes(c));
    return { dpad, left, right: [...rest.filter(c => c.primary), ...rest.filter(c => !c.primary)] };
  }
  // A held throttle (DRIVE) takes the right thumb, so both steering buttons move to the left, as in a racing game.
  const throttle = controls.find(c => c.primary && c.hold && c.action === 'up');
  if (throttle) {
    const left = ['left', 'right'].flatMap(a => controls.filter(c => c.action === a));
    return { dpad, left, right: [throttle, ...controls.filter(c => c !== throttle && !left.includes(c))] };
  }
  const left = ['left', 'down', 'up'].flatMap(a => controls.filter(c => c.action === a && !(c.primary && a !== 'left')));
  const rest = controls.filter(c => !left.includes(c)), corner = rest.filter(c => c.action === 'right');
  return { dpad, left, right: [...corner, ...rest.filter(c => !corner.includes(c) && c.primary), ...rest.filter(c => !corner.includes(c) && !c.primary)] };
}
