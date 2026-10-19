import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { subwayCatalog } from './catalog';
import { RunnerRun } from '../three-kit/runner';
import { RunnerView } from '../three-kit/runner-view';
import '../three-kit/world.css';

export const subwaySpec: PremiumGameSpec<RunnerRun> = {
  id: 'subway-runnerz', title: 'SUBWAY RUNNERZ', eyebrow: 'NEXT STOP: YOUR NEXT HIGH SCORE.',
  description: 'Own the rush hour. Weave between trains, take the ramps onto their roofs and thread bright coin trails through a city that never stands still.',
  instructions: 'Swipe or use arrows to switch tracks, jump and slide. Ramps lead onto train roofs. Enable hoverboard, then press BOARD or E for a crash save.', goal: 'RUN YOUR OWN LINE.',
  width: 1000, height: 760, catalog: subwayCatalog,
  controls: [{ label: '← LEFT', action: 'left' }, { label: 'JUMP · SPACE', action: 'primary', primary: true }, { label: 'SLIDE ↓', action: 'down' }, { label: 'RIGHT →', action: 'right' }, { label: 'BOARD · E', action: 'ability' }],
  create: checkpoint => new RunnerRun('subway', checkpoint), createView: (canvas, run) => new RunnerView(canvas, run),
  objective: run => ({ label: `NEXT STATION · ${run.goal}m`, value: run.distance, max: run.goal }),
  features: ['SURF THE CITY', 'CHAIN TOKENS', 'PULL COINS', 'BIGGER JUMPS'],
};
export function SubwayScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={subwaySpec} />; }
