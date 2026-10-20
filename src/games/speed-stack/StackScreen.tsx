import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { stackCatalog } from './catalog';
import { StackRun, STACK_LEVELS, stackLevelName } from './run';
import { StackView } from './view';
import '../three-kit/world.css';
import './stack.css';

function StackHud({ run }: { run: StackRun }) {
  return <div className="ss__hud" aria-label={`${run.placed} of ${run.goal} floors`}>
    <b>{run.placed}</b><span>of {run.goal} floors</span>
    {run.streak > 1 ? <em key={run.streak}>PERFECT ×{run.streak}</em> : null}
    {run.moving.gold && run.phase === 'playing' ? <i>GOLD SLAB</i> : null}
  </div>;
}

export const speedStackSpec: PremiumGameSpec<StackRun> = {
  id: 'speed-stack', title: 'SPEED STACK', eyebrow: 'FIND THE MOMENT. BUILD THE SKYLINE.', description: 'Drop each sliding slab onto the tower. Whatever hangs over the edge is cut away. Chain perfect drops to grow the tower back and reach the top of twelve skylines.',
  instructions: 'Tap anywhere, press Space or use DROP when the slab lines up. Three perfects in a row widen the tower. E activates an unlocked Focus slowdown.', goal: 'One more floor.',
  width: 840, height: 800, catalog: stackCatalog,
  controls: [{ label: 'DROP · SPACE', action: 'primary', primary: true }, { label: 'FOCUS · E', action: 'ability' }],
  create: checkpoint => new StackRun(checkpoint), createView: (canvas, run) => new StackView(canvas, run),
  objective: run => ({ label: `LEVEL ${run.level} · ${run.levelName.toUpperCase()}`, value: run.placed, max: run.goal }),
  hud: run => <StackHud run={run} />,
  hints: [{ keys: 'Space', label: 'drop the slab' }, { keys: 'E', label: 'focus' }],
  touchHints: [{ keys: 'Tap', label: 'anywhere to drop' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.placed} FLOORS`, caption: run.levelName, detail: `${run.perfects} perfect drops · best streak ×${run.best}` }
    : { win: false, caption: 'Tower toppled!', detail: `${run.placed} of ${run.goal} floors · watch the edge, not the middle` },
  stages: run => Array.from({ length: Math.max(STACK_LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: stackLevelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function StackScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={speedStackSpec} />; }
