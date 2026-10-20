import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { pinballCatalog } from './catalog';
import { PinballRun, PIN_STAGES, GOAL_TEXT, POWER_TEXT, pinStageName, type PowerKind } from './run';
import { PinballView } from './view';
import '../three-kit/world.css';
import './pinball.css';

const POWER_ICON: Record<PowerKind, string> = { fire: '🔥', multi: '⚽', wall: '🧱', freeze: '❄', double: '2×' };

/** Big broadcast-style calls over the pitch: GOAL!, saves, kick-off and active power-ups. */
function SoccerHud({ run }: { run: PinballRun }) {
  const goal = run.goalTimer > 0 ? run.goal : null, call = !goal && !run.waiting && run.display.timer > 0 && run.display.timer < 50 ? run.display.text : '';
  const active = (Object.keys(run.power) as PowerKind[]).filter(k => k !== 'multi' && run.power[k] > 0);
  return <div className="sp__hud">
    {goal ? <div key={goal.id} className={`sp__goal${goal.conceded ? ' sp__goal--against' : ''}`} role="status" style={{ opacity: Math.min(1, run.goalTimer / .35) }}>
      <b>{goal.conceded ? 'GOAL AGAINST' : 'GOAL!'}</b>{goal.detail ? <span>{goal.detail}</span> : null}{goal.points ? <em>+{goal.points.toLocaleString()}</em> : null}
    </div> : call && run.phase === 'playing' ? <div key={call} className="sp__call" style={{ opacity: Math.min(1, run.display.timer / .3) }}>{call}</div> : null}
    {run.waiting && run.phase === 'playing' ? <div className="sp__kick"><i aria-hidden="true">⚽</i>TAP OR PRESS SPACE TO KICK OFF</div> : null}
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
  hints: [{ keys: '← →', label: 'swing the flippers' }, { keys: 'Space', label: 'kick off' }, { keys: 'E', label: 'power shot (when unlocked)' }],
  touchHints: [{ keys: 'Tap', label: 'left or right half to flip' }, { keys: 'Two thumbs', label: 'flip both at once' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.tally.goals} GOAL${run.tally.goals === 1 ? '' : 'S'}`, caption: `${run.levelName} won!`, detail: `${run.score.toLocaleString()} points · best combo ×${Math.max(1, Math.min(5, run.best))} · ${run.lives} ball${run.lives === 1 ? '' : 's'} to spare` }
    : { win: false, caption: 'Full time!', detail: `${run.goalProgress().map(g => `${GOAL_TEXT[g.kind].toLowerCase()} ${g.value}/${g.count}`).join(' · ')} · strike near the flipper tips` },
  stages: run => Array.from({ length: Math.max(PIN_STAGES.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: pinStageName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function PinballScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={pinballerzSpec} />; }
