import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { pinballCatalog } from './catalog';
import { PinballRun, PIN_STAGES, GOAL_TEXT, POWER_TEXT, pinStageName, type PowerKind } from './run';
import { VENUES } from './stadium';
import { YOUR_KITS } from './kits';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { PinballView } from './view';
import '../three-kit/world.css';
import './pinball.css';

const POWER_ICON: Record<PowerKind, string> = { fire: '🔥', multi: '⚽', wall: '🧱', freeze: '❄', double: '2×' };
const WEATHER_ICON: Record<string, string> = { clear: '☀', rain: '🌧', snow: '❄', fog: '🌫', storm: '⛈' };
const STADIUM_ORDER = ['classic', 'bernabeu', 'dortmund', 'maracana', 'wembley'];

/**
 * The commentator's coaching. A loss suggests help that fits how the match was lost; a win dares the player to
 * make it harder or stranger; a struggle mid-match offers one quick tweak. Every suggestion is a single line of code.
 */
function soccerInvites(run: PinballRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [];
  const add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(run.savesSinceGoal >= 3 && c.power < 1150, { id: 'pin-boots', icon: '🥾', title: 'Their keeper is reading you!', reason: 'Harder boots make shots too fast to stop.', code: 'int kickPower = 1200;', tone: 'help' });
    add(run.conceded >= 1 && !c.assist, { id: 'pin-keeper-live', icon: '🧤', title: 'Your goal looks open', reason: 'SUPER KEEPER chases every ball that slips past the flippers.', code: 'bool superKeeper = true;', tone: 'help' });
    add(run.elapsed - run.lastGoalAt > 40 && !c.overdrive, { id: 'pin-powershot', icon: '⚡', title: 'Need a goal? Unlock the POWER SHOT', reason: 'Press E (or POWER), then strike: the ball blazes past everyone.', code: 'bool powerShot = true;', tone: 'help' });
    add(c.weather === 'storm' && run.conceded >= 1, { id: 'pin-calm', icon: '☀', title: 'This wind is wild', reason: 'Clear skies stop the gusts pushing your shots wide.', code: 'string weather = "clear";', tone: 'help' });
    add(run.tally.goals >= 2 && (c.teammates ?? 0) === 0, { id: 'pin-mates-live', icon: '🤝', title: 'Bring your squad on', reason: 'Two pink teammates pass the ball toward goal.', code: 'int teammates = 2;', tone: 'style' });
    return out;
  }
  if (moment === 'lose') {
    const keeperBeat = run.keeper.saves >= 4, leaky = run.conceded >= 2;
    add(leaky && !c.assist, { id: 'pin-keeper', icon: '🧤', title: 'Call in SUPER KEEPER', reason: 'Your keeper dives for every ball that gets past the flippers.', code: 'bool superKeeper = true;', tone: 'help' });
    add(keeperBeat && c.power < 1150, { id: 'pin-power', icon: '🥾', title: 'Their keeper saved it all', reason: 'Stronger boots fire shots too fast to read.', code: 'int kickPower = 1200;', tone: 'help' });
    add(c.lives < 5, { id: 'pin-rack', icon: '⚽', title: 'More balls in the rack', reason: 'Start every match with five balls instead of three.', code: 'int matchBalls = 5;', tone: 'help' });
    add((c.difficulty ?? 'normal') !== 'easy', { id: 'pin-easy', icon: '🐢', title: 'A slower rival team', reason: 'An easy match makes their keeper and defenders react later.', code: 'string difficulty = "easy";', tone: 'help' });
    add(c.gravity > 650, { id: 'pin-tilt', icon: '📐', title: 'Flatten the pitch', reason: 'Less tilt gives you more time to line up each shot.', code: 'int pitchTilt = 600;', tone: 'help' });
    add((c.teammates ?? 0) < 2, { id: 'pin-mates', icon: '🤝', title: 'Bring two teammates', reason: 'Pink teammates pass loose balls toward goal.', code: 'int teammates = 2;', tone: 'help' });
    return out;
  }
  const next = STADIUM_ORDER[(STADIUM_ORDER.indexOf(c.worldTheme ?? 'classic') + 1) % STADIUM_ORDER.length], venue = VENUES[next];
  add((c.difficulty ?? 'normal') !== 'pro', { id: 'pin-pro', icon: '🔥', title: 'Too easy? Go PRO', reason: 'The rival keeper and defenders react twice as fast.', code: 'string difficulty = "pro";', tone: 'challenge' });
  add(true, { id: `pin-stadium-${next}`, icon: '🏟', title: `Next match: ${venue.name}`, reason: `Play in ${venue.city === 'PINBALL PARK' ? 'Pinball Park' : venue.city.charAt(0) + venue.city.slice(1).toLowerCase()} against a home side in its own colours.`, code: `string worldTheme = "${next}";`, tone: 'style' });
  add((c.weather ?? 'clear') === 'clear', { id: 'pin-storm', icon: '⛈', title: 'Play in a thunderstorm', reason: 'Wind pushes the ball sideways and the wet pitch is fast.', code: 'string weather = "storm";', tone: 'challenge' });
  add((c.rivals ?? 0) < 2, { id: 'pin-defenders', icon: '🛡', title: 'Two more defenders', reason: 'A packed defence: find the gaps or bounce it in.', code: 'int extraDefenders = 2;', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'pin-kit', icon: '👕', title: 'New kit day', reason: `Pull on the ${YOUR_KITS.stripes.name}.`, code: 'string characterStyle = "stripes";', tone: 'style' });
  add((c.balls ?? 1) < 2, { id: 'pin-twoballs', icon: '⚽', title: 'Two-ball chaos', reason: 'Every kick-off serves two balls at once.', code: 'int ballsInPlay = 2;', tone: 'challenge' });
  return out;
}


/** Big broadcast-style calls over the pitch: GOAL!, saves, kick-off and active power-ups. */
function SoccerHud({ run }: { run: PinballRun }) {
  const goal = run.goalTimer > 0 ? run.goal : null, call = !goal && !run.waiting && run.display.timer > 0 && run.display.timer < 50 ? run.display.text : '';
  const active = (Object.keys(run.power) as PowerKind[]).filter(k => k !== 'multi' && run.power[k] > 0);
  return <div className="sp__hud">
    {goal ? <div key={goal.id} className={`sp__goal${goal.conceded ? ' sp__goal--against' : ''}`} role="status" style={{ opacity: Math.min(1, run.goalTimer / .35) }}>
      <b>{goal.conceded ? 'GOAL AGAINST' : 'GOAL!'}</b>{goal.detail ? <span>{goal.detail}</span> : null}{goal.points ? <em>+{goal.points.toLocaleString()}</em> : null}
    </div> : call && run.phase === 'playing' ? <div key={call} className="sp__call" style={{ opacity: Math.min(1, run.display.timer / .3) }}>{call}</div> : null}
    {run.waiting && run.phase === 'playing' ? <div className="sp__kick"><i aria-hidden="true">⚽</i>TAP OR PRESS SPACE TO KICK OFF</div> : null}
    {run.weather.text && run.phase === 'playing' ? <div className={`sp__weather sp__weather--${run.config.weather}`}><i aria-hidden="true">{WEATHER_ICON[run.config.weather ?? 'clear']}</i>{run.weather.text}{run.wind ? <b style={{ transform: `scaleX(${run.wind > 0 ? 1 : -1})` }} aria-label={run.wind > 0 ? 'wind to the right' : 'wind to the left'}>➜</b> : null}</div> : null}
    {active.length || run.config.overdrive ? <div className="sp__powers">
      {active.map(k => <span key={k} className={`sp__power sp__power--${k}`}><i aria-hidden="true">{POWER_ICON[k]}</i>{POWER_TEXT[k]} <small>{Math.ceil(run.power[k])}s</small></span>)}
      {run.config.overdrive ? <span className={`sp__power sp__power--shot${run.powerArmed > 0 ? ' is-armed' : ''}`}><i aria-hidden="true">⚡</i>{run.powerArmed > 0 ? 'POWER SHOT ARMED' : run.powerCooldown > 0 ? `POWER SHOT ${Math.ceil(run.powerCooldown)}s` : 'POWER SHOT READY · E'}</span> : null}
    </div> : null}
  </div>;
}

export const pinballerzSpec: PremiumGameSpec<PinballRun> = {
  id: 'pinballerz', title: 'PINBALLERZ', eyebrow: 'FLIP IT. STRIKE IT. GOAL!', description: 'Soccer pinball: swing the flippers to strike the ball past purple defenders and a diving keeper, grab power-ups and chain combo goals across twelve matches.',
  instructions: 'Tap the left or right half of the pitch (or use ←/→, A/D) to swing that flipper. Space or a tap kicks off. E fires an unlocked Power Shot.', goal: 'Flip it into the net.',
  width: 640, height: 1000, catalog: pinballCatalog,
  controls: [{ label: '◀ LEFT', action: 'left', hold: 'left' }, { label: 'KICK OFF', action: 'primary', primary: true }, { label: 'RIGHT ▶', action: 'right', hold: 'right' }, { label: 'POWER · E', action: 'ability' }],
  create: checkpoint => new PinballRun(checkpoint), createView: (canvas, run) => new PinballView(canvas, run),
  objective: run => {
    const goals = run.goalProgress();
    return { label: `MATCH ${run.level} · ${run.levelName.toUpperCase()} · ${goals.map(g => `${GOAL_TEXT[g.kind]} ${g.value.toLocaleString()}/${g.count.toLocaleString()}`).join(' · ')}`, value: goals.reduce((sum, g) => sum + g.value / g.count, 0), max: goals.length };
  },
  hud: run => <SoccerHud run={run} />,
  invites: soccerInvites,
  hints: [{ keys: '← →', label: 'swing the flippers' }, { keys: 'Space', label: 'kick off' }, { keys: 'E', label: 'power shot (when unlocked)' }],
  touchHints: [{ keys: 'Tap', label: 'left or right half to flip' }, { keys: 'Two thumbs', label: 'flip both at once' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.tally.goals} GOAL${run.tally.goals === 1 ? '' : 'S'}`, caption: `${run.levelName} won!`, detail: `${run.score.toLocaleString()} points · best combo ×${Math.max(1, Math.min(5, run.best))} · ${run.lives} ball${run.lives === 1 ? '' : 's'} to spare` }
    : { win: false, caption: 'Full time!', detail: `${run.goalProgress().map(g => `${GOAL_TEXT[g.kind].toLowerCase()} ${g.value}/${g.count}`).join(' · ')} · strike near the flipper tips` },
  stages: run => Array.from({ length: Math.max(PIN_STAGES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: pinStageName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function PinballScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={pinballerzSpec} />; }
