import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { teamCatalog } from './catalog';
import { TeamRun } from './run';
import { TeamView } from './view';
import '../three-kit/world.css';

export const teamSpec: PremiumGameSpec<TeamRun> = {
  id: 'team-counters', title: 'TEAM COUNTERS', eyebrow: 'SMALL CREW. BIG POSSIBILITIES.',
  description: 'One good choice can change everything. Grow a tiny crew into a rushing crowd, outsmart the gates, dodge the saws and take the castle together.',
  instructions: 'Drag left/right or hold the arrow buttons to choose a gate. Compare additions and multipliers. RALLY adds three runners; E uses an enabled shield.', goal: 'MAKE EVERY RUNNER COUNT.',
  width: 1000, height: 760, catalog: teamCatalog,
  controls: [{ label: '← LEFT', action: 'left', hold: 'left' }, { label: 'RALLY +3', action: 'primary', primary: true }, { label: 'RIGHT →', action: 'right', hold: 'right' }, { label: 'SHIELD · E', action: 'ability' }],
  create: checkpoint => new TeamRun(checkpoint), createView: (canvas, run) => new TeamView(canvas, run),
  objective: run => ({ label: 'GROW YOUR CREW · TAKE THE CASTLE', value: run.distance, max: run.goal }),
  features: ['GROW A CROWD', 'CHOOSE A GATE', 'PROTECT THE CREW', 'TAKE THE CASTLE'],
};
export function TeamScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={teamSpec} />; }
