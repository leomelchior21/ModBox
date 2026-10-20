/** Match goals for each stage of the soccer pinball campaign. */
export type PinGoal = 'goals' | 'volleys' | 'powerups' | 'hattricks' | 'score';
/**
 * A rival outfield player. Static players sway in place; `patrol` slides them side to side (or up and down with
 * `vertical`), and `mark` lets them shadow the ball across a zone that wide. `speed` is cycles per second for a
 * patrol and table units per second for a marker.
 */
export interface Defender { x: number; y: number; patrol?: number; mark?: number; speed?: number; vertical?: boolean }
export interface PinStage {
  name: string; tip: string; goals: readonly [PinGoal, number][]; defenders: readonly Defender[];
  /** Rival keeper top speed (table units per second) and how well it reads a shot, 0 to 1. */
  keeper: number; smart: number;
  /** Balls served at each kick-off, and seconds between power-up tokens (0 for none). */
  balls: number; powerups: number; light: 'day' | 'dusk' | 'night';
}

export const PIN_STAGES: readonly PinStage[] = [
  { name: 'Kick-Off', tip: 'Tap the left or right side to swing that flipper. Shoot past the keeper!', goals: [['goals', 2]], defenders: [{ x: 320, y: 330 }], keeper: 45, smart: .1, balls: 1, powerups: 0, light: 'day' },
  { name: 'First Touch', tip: 'Strike near the flipper tip for a harder shot.', goals: [['goals', 3]], defenders: [{ x: 215, y: 320 }, { x: 425, y: 320 }], keeper: 60, smart: .2, balls: 1, powerups: 0, light: 'day' },
  { name: 'The Wall', tip: 'Three defenders in a line. Aim for the gaps.', goals: [['goals', 3]], defenders: [{ x: 195, y: 345 }, { x: 320, y: 300 }, { x: 445, y: 345 }], keeper: 70, smart: .25, balls: 1, powerups: 13, light: 'day' },
  { name: 'Power Play', tip: 'Roll over the glowing tokens: fireball, extra balls, a goal-line wall and more.', goals: [['goals', 3], ['powerups', 2]], defenders: [{ x: 215, y: 300 }, { x: 425, y: 300 }, { x: 320, y: 420 }], keeper: 80, smart: .3, balls: 1, powerups: 6, light: 'day' },
  { name: 'Moving Midfield', tip: 'Defenders on the move. Time your shot for the gap.', goals: [['goals', 4]], defenders: [{ x: 320, y: 255 }, { x: 195, y: 370 }, { x: 445, y: 370 }, { x: 320, y: 445, patrol: 120, speed: .45 }], keeper: 90, smart: .35, balls: 1, powerups: 11, light: 'dusk' },
  { name: 'Volley Club', tip: 'A VOLLEY is a goal straight off your flipper. Strike first time!', goals: [['goals', 4], ['volleys', 2]], defenders: [{ x: 225, y: 285 }, { x: 415, y: 285 }, { x: 320, y: 395, patrol: 100, speed: .5 }, { x: 175, y: 520 }, { x: 465, y: 520 }], keeper: 100, smart: .4, balls: 1, powerups: 11, light: 'dusk' },
  { name: 'Twin Strike', tip: 'Two balls at every kick-off. Only the last one costs you.', goals: [['goals', 5]], defenders: [{ x: 320, y: 255 }, { x: 205, y: 360, patrol: 60, speed: .6 }, { x: 435, y: 360, patrol: 60, speed: .6 }, { x: 245, y: 600 }, { x: 395, y: 600 }], keeper: 110, smart: .45, balls: 2, powerups: 11, light: 'dusk' },
  { name: 'High Press', tip: 'The striker in the middle shadows the ball. Fake him out!', goals: [['goals', 5]], defenders: [{ x: 215, y: 275 }, { x: 425, y: 275 }, { x: 320, y: 380, mark: 110, speed: 85 }, { x: 190, y: 505, patrol: 50, speed: .65 }, { x: 450, y: 505, patrol: 50, speed: .65 }], keeper: 118, smart: .5, balls: 1, powerups: 10, light: 'dusk' },
  { name: 'Hat-Trick Hero', tip: 'Score three goals in a row without losing a ball.', goals: [['hattricks', 1]], defenders: [{ x: 320, y: 245 }, { x: 195, y: 335 }, { x: 445, y: 335 }, { x: 320, y: 430, mark: 120, speed: 95 }, { x: 230, y: 610, patrol: 60, speed: .5 }], keeper: 125, smart: .5, balls: 1, powerups: 10, light: 'night' },
  { name: 'Derby Day', tip: 'A packed derby. Grab two power-ups on the way to six goals.', goals: [['goals', 6], ['powerups', 2]], defenders: [{ x: 240, y: 255 }, { x: 400, y: 255 }, { x: 320, y: 350, mark: 120, speed: 100 }, { x: 180, y: 450, patrol: 60, speed: .55 }, { x: 460, y: 450, patrol: 60, speed: .55 }, { x: 320, y: 620, patrol: 130, speed: .35 }], keeper: 132, smart: .55, balls: 1, powerups: 8, light: 'night' },
  { name: 'Floodlights', tip: 'Two markers now. Volleys beat them before they move.', goals: [['goals', 6], ['volleys', 3]], defenders: [{ x: 320, y: 240, mark: 80, speed: 80 }, { x: 200, y: 330 }, { x: 440, y: 330 }, { x: 320, y: 430, mark: 140, speed: 105 }, { x: 195, y: 560, patrol: 60, speed: .6 }, { x: 445, y: 560, patrol: 60, speed: .6 }], keeper: 140, smart: .58, balls: 1, powerups: 8, light: 'night' },
  { name: 'Cup Final', tip: 'The final! Volleys, power-ups and combos: use every trick you know.', goals: [['goals', 8]], defenders: [{ x: 320, y: 230, mark: 70, speed: 85 }, { x: 210, y: 300 }, { x: 430, y: 300 }, { x: 320, y: 395, mark: 150, speed: 115 }, { x: 170, y: 480, patrol: 50, speed: .5 }, { x: 470, y: 480, patrol: 50, speed: .5 }, { x: 320, y: 625, patrol: 150, speed: .3 }], keeper: 148, smart: .62, balls: 1, powerups: 8, light: 'night' },
];

/** Beyond the twelfth stage the campaign loops with bigger targets and a sharper keeper. */
export const pinStage = (level: number): PinStage => {
  const n = Math.max(1, level), base = PIN_STAGES[(n - 1) % PIN_STAGES.length], loop = Math.floor((n - 1) / PIN_STAGES.length);
  return loop ? { ...base, keeper: base.keeper + loop * 12, smart: Math.min(.8, base.smart + loop * .05), goals: base.goals.map(([k, c]) => [k, k === 'hattricks' ? c + loop : Math.round(c * (1 + loop * .5))]) } : base;
};
export const pinStageName = (level: number) => pinStage(level).name + (level > PIN_STAGES.length ? ` ${Math.ceil(level / PIN_STAGES.length)}` : '');
export const GOAL_TEXT: Record<PinGoal, string> = { goals: 'GOALS', volleys: 'VOLLEYS', powerups: 'POWER-UPS', hattricks: 'HAT-TRICKS', score: 'POINTS' };
