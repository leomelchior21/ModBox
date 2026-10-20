import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { subwayCatalog } from './catalog';
import { RunnerRun, SUBWAY_STAGES, runnerStageName } from '../three-kit/runner';
import { RunnerView } from '../three-kit/runner-view';
import '../three-kit/world.css';

export const subwaySpec: PremiumGameSpec<RunnerRun> = {
  id: 'subway-runnerz', title: 'SUBWAY RUNNERZ', eyebrow: 'NEXT STOP: YOUR NEXT HIGH SCORE.',
  description: 'Own the rush hour. Dodge trains, run up the ramps onto their roofs, grab jetpacks and magnets, and stay ahead of the inspector across twelve lines.',
  instructions: 'Swipe or use arrows: left and right switch tracks, up jumps, down slides. Ramps lead onto train roofs. Enable hoverboard, then press BOARD or E for a crash save.', goal: 'RUN YOUR OWN LINE.',
  width: 1000, height: 760, catalog: subwayCatalog,
  controls: [{ label: '← LEFT', action: 'left' }, { label: 'JUMP · SPACE', action: 'primary', primary: true }, { label: 'SLIDE ↓', action: 'down' }, { label: 'RIGHT →', action: 'right' }, { label: 'BOARD · E', action: 'ability' }],
  create: checkpoint => new RunnerRun('subway', checkpoint), createView: (canvas, run) => new RunnerView(canvas, run),
  objective: run => ({ label: `LINE ${run.level} · ${run.stageName.toUpperCase()} · ${run.goal}m`, value: run.distance, max: run.goal }),
  hints: [{ keys: '← →', label: 'switch tracks' }, { keys: '↑ ↓', label: 'jump and slide' }],
  touchHints: [{ keys: 'Swipe', label: 'left, right, up or down' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.score.toLocaleString()}`, caption: run.stageName, detail: `${run.coins} coins · ${run.lives} chance${run.lives === 1 ? '' : 's'} left` }
    : { win: false, caption: 'Caught!', detail: `${Math.floor(run.distance)} of ${run.goal}m · ${run.coins} coins` },
  stages: run => Array.from({ length: Math.max(SUBWAY_STAGES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: runnerStageName('subway', level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
  features: ['SURF THE CITY', 'CHAIN TOKENS', 'PULL COINS', 'BIGGER JUMPS'],
};
export function SubwayScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={subwaySpec} />; }
