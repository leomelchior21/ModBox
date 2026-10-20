import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { teamCatalog } from './catalog';
import { TeamRun, TEAM_LEVEL_NAMES, teamLevelName } from './run';
import { TeamView } from './view';
import '../three-kit/world.css';

export const teamSpec: PremiumGameSpec<TeamRun> = {
  id: 'team-counters', title: 'TEAM COUNTERS', eyebrow: 'SMALL CREW. BIG POSSIBILITIES.',
  description: 'Start with one runner. Pick the best gate, dodge the blades, beat the red army and climb the multiplier stairs.',
  instructions: 'Drag left or right to steer. Space squeezes the crowd through narrow spots; E uses an enabled shield.', goal: 'Grow your crowd. Beat the army.',
  width: 1000, height: 760, catalog: teamCatalog,
  controls: [{ label: '← LEFT', action: 'left', hold: 'left' }, { label: 'SQUEEZE', action: 'primary', primary: true }, { label: 'RIGHT →', action: 'right', hold: 'right' }, { label: 'SHIELD · E', action: 'ability' }],
  create: checkpoint => new TeamRun(checkpoint), createView: (canvas, run) => new TeamView(canvas, run),
  objective: run => ({ label: `LEVEL ${run.level} · ${run.levelName.toUpperCase()}`, value: Math.min(run.distance, run.goal), max: run.goal }),
  hints: [{ keys: '← →', label: 'steer the crowd' }, { keys: 'Space', label: 'squeeze' }],
  touchHints: [{ keys: 'Drag', label: 'steer the crowd' }, { keys: 'Squeeze', label: 'slip through gaps' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `×${run.victory}`, caption: run.levelName, detail: `${run.finaleTeam} runner${run.finaleTeam === 1 ? '' : 's'} reached the stairs · ${run.score.toLocaleString()} pts` }
    : { win: false, caption: 'Crowd lost!', detail: 'Bigger gates first, then fight.' },
  stages: run => Array.from({ length: Math.max(TEAM_LEVEL_NAMES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: teamLevelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function TeamScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={teamSpec} />; }
