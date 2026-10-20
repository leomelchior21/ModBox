import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { templeCatalog } from './catalog';
import { RunnerRun, TEMPLE_STAGES, runnerStageName } from '../three-kit/runner';
import { RunnerView } from '../three-kit/runner-view';
import '../three-kit/world.css';

export const templeSpec: PremiumGameSpec<RunnerRun> = {
  id: 'temple-race', title: 'TEMPLE RACE', eyebrow: 'THE RUINS ARE AWAKE. KEEP RUNNING.',
  description: 'Race along ancient causeways above a misty jungle with the temple monkeys on your heels. Swipe at the corners, leap roots and broken stone, slide under the vines.',
  instructions: 'Swipe or use arrows: Left/Right change lanes and take marked turns, Up jumps, Down slides. E activates an enabled aegis.', goal: 'CHASE THE ANCIENT LIGHT.',
  width: 1000, height: 760, catalog: templeCatalog,
  controls: [{ label: '← LEFT', action: 'left' }, { label: 'JUMP · SPACE', action: 'primary', primary: true }, { label: 'SLIDE ↓', action: 'down' }, { label: 'RIGHT →', action: 'right' }, { label: 'AEGIS · E', action: 'ability' }],
  create: checkpoint => new RunnerRun('temple', checkpoint), createView: (canvas, run) => new RunnerView(canvas, run),
  objective: run => ({ label: `STAGE ${run.level} · ${run.stageName.toUpperCase()} · ${run.goal}m`, value: run.distance, max: run.goal }),
  hints: [{ keys: '← →', label: 'turn and change lanes' }, { keys: '↑ ↓', label: 'jump and slide' }],
  touchHints: [{ keys: 'Swipe', label: 'to turn, jump and slide' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.score.toLocaleString()}`, caption: run.stageName, detail: `${run.coins} coins · ${run.lives} charm${run.lives === 1 ? '' : 's'} left` }
    : { win: false, caption: 'The monkeys got you!', detail: `${Math.floor(run.distance)} of ${run.goal}m · ${run.coins} coins` },
  stages: run => Array.from({ length: Math.max(TEMPLE_STAGES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: runnerStageName('temple', level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
  features: ['CHASE RELICS', 'CHAIN GOLD', 'BUILD AN AEGIS', 'MASTER THE TURNS'],
};
export function TempleScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={templeSpec} />; }
