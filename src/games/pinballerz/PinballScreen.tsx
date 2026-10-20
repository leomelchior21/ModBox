import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { pinballCatalog } from './catalog';
import { PinballRun, PIN_STAGES, GOAL_TEXT, pinStageName } from './run';
import { PinballView } from './view';
import '../three-kit/world.css';

export const pinballerzSpec: PremiumGameSpec<PinballRun> = {
  id: 'pinballerz', title: 'PINBALLERZ', eyebrow: 'CHROME. COILS. ONE MORE BALL.', description: 'A neon pinball table with real flipper physics: pop bumpers, drop targets, a spinner, an elevated ramp and multiball jackpots.',
  instructions: 'Space launches the ball. Left/Right or A/D work the flippers; on a tablet, tap each half of the table. N nudges, three per ball.', goal: 'Complete every table mission.',
  width: 640, height: 920, catalog: pinballCatalog,
  controls: [{ label: 'LEFT', action: 'left', hold: 'left' }, { label: 'LAUNCH', action: 'primary', primary: true }, { label: 'RIGHT', action: 'right', hold: 'right' }, { label: 'NUDGE · N', action: 'nudge' }],
  create: checkpoint => new PinballRun(checkpoint), createView: (canvas, run) => new PinballView(canvas, run),
  objective: run => {
    const goals = run.goalProgress();
    return { label: `STAGE ${run.level} · ${run.levelName.toUpperCase()} · ${goals.map(g => `${GOAL_TEXT[g.kind]} ${g.value.toLocaleString()}/${g.count.toLocaleString()}`).join(' · ')}`, value: goals.reduce((sum, g) => sum + g.value / g.count, 0), max: goals.length };
  },
  hints: [{ keys: 'Space', label: 'launch' }, { keys: '← →', label: 'flippers' }, { keys: 'N', label: 'nudge' }],
  touchHints: [{ keys: 'Tap', label: 'left or right half to flip' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: run.score.toLocaleString(), caption: run.levelName, detail: `Mission complete · ${run.lives} ball${run.lives === 1 ? '' : 's'} to spare` }
    : { win: false, caption: 'Game over', detail: run.goalProgress().map(g => `${GOAL_TEXT[g.kind].toLowerCase()} ${g.value}/${g.count}`).join(' · ') },
  stages: run => Array.from({ length: Math.max(PIN_STAGES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: pinStageName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function PinballScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={pinballerzSpec} />; }
