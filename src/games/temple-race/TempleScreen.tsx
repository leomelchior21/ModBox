import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { templeCatalog } from './catalog';
import { RunnerRun } from '../three-kit/runner';
import { RunnerView } from '../three-kit/runner-view';
import '../three-kit/world.css';

export const templeSpec: PremiumGameSpec<RunnerRun> = {
  id: 'temple-race', title: 'TEMPLE RACE', eyebrow: 'THE RUINS ARE AWAKE. KEEP RUNNING.',
  description: 'Race across mossy causeways above a forgotten jungle. Read the turns, leap broken stone and follow the gold to the temple beacon.',
  instructions: 'Swipe or use arrows: Left/Right change lanes and take marked turns, Up jumps, Down slides. E activates an enabled aegis.', goal: 'CHASE THE ANCIENT LIGHT.',
  width: 1000, height: 760, catalog: templeCatalog,
  controls: [{ label: '← LEFT', action: 'left' }, { label: 'JUMP · SPACE', action: 'primary', primary: true }, { label: 'SLIDE ↓', action: 'down' }, { label: 'RIGHT →', action: 'right' }, { label: 'AEGIS · E', action: 'ability' }],
  create: checkpoint => new RunnerRun('temple', checkpoint), createView: (canvas, run) => new RunnerView(canvas, run),
  objective: run => ({ label: `TEMPLE BEACON · ${run.goal}m`, value: run.distance, max: run.goal }),
  features: ['CHASE RELICS', 'CHAIN GOLD', 'BUILD AN AEGIS', 'MASTER THE TURNS'],
};
export function TempleScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={templeSpec} />; }
