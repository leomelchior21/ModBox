import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { roombaCatalog } from './catalog';
import { RoombaRun } from './run';
import { RoombaView } from './view';
import '../three-kit/world.css';

export const roombaSpec: PremiumGameSpec<RoombaRun> = {
  id: 'roomba-run', title: 'ROOMBA RUN', eyebrow: 'A LITTLE ROBOT. A BIG CLEAN FEELING.',
  description: 'Turn a dusty apartment into a spotless little sanctuary. Slip under tables, trace satisfying clean trails and make it home before your battery gives up.',
  instructions: 'Use arrows / WASD. Tap the floor to route around furniture. Space returns to dock. Clean 90%, then dock to finish. N changes camera; E uses enabled turbo.', goal: 'LEAVE A LITTLE SHINE.',
  width: 1000, height: 760, catalog: roombaCatalog,
  controls: [{ label: '← LEFT', action: 'left', hold: 'left' }, { label: '↑ UP', action: 'up', hold: 'up' }, { label: 'DOCK', action: 'primary', primary: true }, { label: '↓ DOWN', action: 'down', hold: 'down' }, { label: 'RIGHT →', action: 'right', hold: 'right' }, { label: 'CAMERA · N', action: 'nudge' }, { label: 'TURBO · E', action: 'ability' }],
  create: checkpoint => new RoombaRun(checkpoint), createView: (canvas, run) => new RoombaView(canvas, run),
  objective: run => ({ label: '90% CLEAN · THEN RETURN TO DOCK', value: run.coverage, max: 90 }),
  features: ['MAKE IT SHINE', 'RECHARGE AT HOME', 'TURBO THE BRUSH', 'WATCH THE BATTERY'],
};
export function RoombaScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={roombaSpec} />; }
