import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { teamCatalog } from './catalog';
import { TeamRun, TEAM_LEVEL_NAMES, teamLevelName } from './run';
import { TeamView } from './view';
import { TEAM_WORLDS } from './worlds';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import '../three-kit/world.css';

const COURSES = ['classic', 'candy', 'beach', 'space', 'volcano'];
/**
 * The math coach. Wrong-gate choices get "do the math" help, blade losses get a shield, lost fights get recruits;
 * a win dares the crew to run faster, in the wind, or on a new course.
 */
function teamInvites(run: TeamRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, l = run.losses, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(l.badGates >= 2 && !c.assist, { id: 'team-math-live', icon: '🧮', title: 'That gate made your crowd smaller', reason: 'Show the result of each gate before you choose.', code: 'bool gatePreview = true;', tone: 'help' });
    add(l.blades >= 8 && !c.overdrive, { id: 'team-shield-live', icon: '🛡', title: 'The blades are eating your crew', reason: 'A team shield (press E) blocks one hazard.', code: 'bool teamShield = true;', tone: 'help' });
    add(c.weather === 'wind' && l.blades >= 4, { id: 'team-calm', icon: '☀', title: 'This wind is pushing you around', reason: 'Clear skies stop the sideways gusts.', code: 'string weather = "clear";', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(l.badGates >= 1 && !c.assist, { id: 'team-math', icon: '🧮', title: 'Do the math first', reason: `You picked the smaller gate ${l.badGates} time${l.badGates === 1 ? '' : 's'}. See each result before you choose.`, code: 'bool gatePreview = true;', tone: 'help' });
    add(l.clashes >= 1 && c.power < 10, { id: 'team-recruit', icon: '➕', title: 'Bring more runners to the fight', reason: 'Every good gate recruits ten extra runners.', code: 'int recruitBonus = 10;', tone: 'help' });
    add(l.blades >= 5 && !c.overdrive, { id: 'team-shield', icon: '🛡', title: 'Shield your crew', reason: 'Press E to block one blade, or halve your losses in a fight.', code: 'bool teamShield = true;', tone: 'help' });
    add(c.speed > 5, { id: 'team-slow', icon: '🐢', title: 'March a little slower', reason: 'More time to read the gates and dodge.', code: 'int runSpeed = 5;', tone: 'help' });
    add(c.lives < 5, { id: 'team-rally', icon: '🚩', title: 'More rally tokens', reason: 'Five chances to regroup at the last gate.', code: 'int rallyTokens = 5;', tone: 'help' });
    return out;
  }
  const next = COURSES[(COURSES.indexOf(c.worldTheme ?? 'classic') + 1) % COURSES.length];
  add(true, { id: `team-course-${next}`, icon: '🗺', title: `Next race: ${TEAM_WORLDS[next].name}`, reason: 'Same maths, a brand new course.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add(c.speed < 10, { id: 'team-fast', icon: '⚡', title: 'Think faster', reason: 'Turn up the pace: less time to work out each gate.', code: 'int runSpeed = 10;', tone: 'challenge' });
  add((c.weather ?? 'clear') !== 'wind', { id: 'team-wind', icon: '🌬', title: 'Race in the wind', reason: 'Gusts push the crowd sideways. Steer against them.', code: 'string weather = "wind";', tone: 'challenge' });
  add(c.assist, { id: 'team-nomath', icon: '🧠', title: 'Mental maths only', reason: 'Turn off the gate preview and work it out yourself.', code: 'bool gatePreview = false;', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'team-penguins', icon: '🐧', title: 'Penguin army', reason: 'Both crowds waddle into battle.', code: 'string characterStyle = "penguin";', tone: 'style' });
  return out;
}

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
  invites: teamInvites,
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `×${run.victory}`, caption: run.levelName, detail: `${run.finaleTeam} runner${run.finaleTeam === 1 ? '' : 's'} reached the stairs · ${run.score.toLocaleString()} pts` }
    : { win: false, caption: 'Crowd lost!', detail: 'Bigger gates first, then fight.' },
  stages: run => Array.from({ length: Math.max(TEAM_LEVEL_NAMES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: teamLevelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function TeamScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={teamSpec} />; }
