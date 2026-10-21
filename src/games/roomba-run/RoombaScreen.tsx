import type { CSSProperties } from 'react';
import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { roombaCatalog } from './catalog';
import { RoombaRun } from './run';
import { HOUSE_STYLES } from './worlds';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { RoombaView } from './view';
import { ROOMS, roomName } from './rooms';
import '../three-kit/world.css';
import './roomba.css';

/** Room progress ring and bar, cash, battery and the floating joystick. */
function RoombaHud({ run }: { run: RoombaRun }) {
  const pct = Math.min(100, Math.floor(run.coverage)), goal = run.target, stick = run.joystick, clamp = (v: number) => Math.max(-1, Math.min(1, v / 110)) * 38;
  return <>
    <div className="rr__room" aria-label={`${run.roomName}: ${pct} percent clean, goal ${goal} percent`}>
      <div className="rr__ring" style={{ '--p': `${Math.min(1, pct / goal) * 360}deg` } as CSSProperties}><b>{pct}%</b></div>
      <div className="rr__bar"><span>{run.roomName}</span><div><i style={{ width: `${Math.min(100, pct / goal * 100)}%` }} /></div><small>{pct >= goal ? 'GOAL REACHED · BACK TO THE DOCK' : `GOAL ${goal}%`}</small></div>
    </div>
    <div className="rr__cash" aria-label={`${run.money} dollars`}><b>$</b>{run.money}</div>
    <div className={`rr__battery ${run.battery < 22 ? 'rr__battery--low' : ''}`} aria-label={`Battery ${Math.ceil(run.battery)} percent`}><i style={{ width: `${run.battery}%` }} /><span>{Math.ceil(run.battery)}%</span></div>
    {stick ? <div className="rr__stick" style={{ left: `${stick.ox / 10}%`, top: `${stick.oy / 7.6}%` }}><i style={{ transform: `translate(${clamp(stick.x - stick.ox)}px, ${clamp(stick.y - stick.oy)}px)` }} /></div> : null}
  </>;
}

const HOUSES = ['classic', 'castle', 'spaceship', 'candy', 'jungle'];
/**
 * The robot talks for itself ("BEEP"). A flat battery asks for the smart route or spare packs, slow cleaning asks for
 * suction, and a spotless finish invites a new house, a party or a cat passenger.
 */
function roombaInvites(run: RoombaRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(run.battery < 30 && run.coverage < run.target * .7 && !c.assist, { id: 'roomba-route-live', icon: '🧭', title: 'BEEP. Battery getting low!', reason: 'Let me plan my own route and go home before I run out.', code: 'bool smartRoute = true;', tone: 'help' });
    add(run.elapsed > 40 && run.coverage < 30 && c.power < 85, { id: 'roomba-suction-live', icon: '🌀', title: 'BEEP. This dust is stubborn', reason: 'More suction cleans a wider path, faster.', code: 'int suction = 90;', tone: 'help' });
    add(run.messes >= 6, { id: 'roomba-calm-live', icon: '🧹', title: 'BEEP. The mess keeps coming back', reason: 'A calm house stops new mess landing on clean floor.', code: 'string weather = "clear";', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(!c.assist, { id: 'roomba-route', icon: '🧭', title: 'BEEP. I ran out of power', reason: 'With a smart route I find the dirt and head home to charge on my own.', code: 'bool smartRoute = true;', tone: 'help' });
    add(c.lives < 5, { id: 'roomba-packs', icon: '🔋', title: 'Pack spare batteries', reason: 'Five spare packs before the job is lost.', code: 'int batteryPacks = 5;', tone: 'help' });
    add(c.power < 85, { id: 'roomba-suction', icon: '🌀', title: 'Clean in fewer passes', reason: 'More suction: a wider brush and faster cleaning.', code: 'int suction = 90;', tone: 'help' });
    add(run.chaos.drain > 1, { id: 'roomba-nostorm', icon: '☀', title: 'The storm drained me', reason: 'Calm weather keeps the power steady.', code: 'string weather = "clear";', tone: 'help' });
    return out;
  }
  const next = HOUSES[(HOUSES.indexOf(c.worldTheme ?? 'classic') + 1) % HOUSES.length];
  add(true, { id: `roomba-house-${next}`, icon: '🏰', title: `Next job: ${HOUSE_STYLES[next].name}`, reason: 'A whole new house to make spotless.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add((c.weather ?? 'clear') === 'clear', { id: 'roomba-party', icon: '🎉', title: 'Clean during a party', reason: 'Confetti keeps landing on the floor you just cleaned.', code: 'string weather = "party";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'roomba-cat', icon: '🐱', title: 'Take a cat for a ride', reason: 'Every robot vacuum deserves a passenger.', code: 'string characterStyle = "cat";', tone: 'style' });
  add(c.assist, { id: 'roomba-manual', icon: '🎮', title: 'Drive it yourself', reason: 'No smart route: plan the cleaning path by hand.', code: 'bool smartRoute = false;', tone: 'challenge' });
  add(!c.overdrive, { id: 'roomba-turbo', icon: '⚡', title: 'Unlock TURBO TIDY', reason: 'E for a wider, stronger clean (it drinks battery).', code: 'bool turboBrush = true;', tone: 'challenge' });
  return out;
}

export const roombaSpec: PremiumGameSpec<RoombaRun> = {
  id: 'roomba-run', title: 'ROOMBA RUN', eyebrow: 'A LITTLE ROBOT. A BIG CLEAN FEELING.',
  description: 'Six rooms full of dust, popcorn, socks and toys. Drive a little robot vacuum, carve clean trails through the grime and make it home to the dock before the battery runs out.',
  instructions: 'Arrows / WASD drive: up goes forward, left and right steer. On touch, drag anywhere on the floor like a joystick. Space returns to the dock; N switches camera; E fires enabled turbo.', goal: 'Clean the room, then dock to finish.',
  width: 1000, height: 760, catalog: roombaCatalog,
  controls: [{ label: '◀ LEFT', action: 'left', hold: 'left' }, { label: '▲ DRIVE', action: 'up', hold: 'up', primary: true }, { label: 'RIGHT ▶', action: 'right', hold: 'right' }, { label: 'DOCK · SPACE', action: 'primary' }, { label: 'CAMERA · N', action: 'nudge' }, { label: 'TURBO · E', action: 'ability' }],
  create: checkpoint => new RoombaRun(checkpoint), createView: (canvas, run) => new RoombaView(canvas, run),
  hud: run => <RoombaHud run={run} />,
  hints: [{ keys: '↑', label: 'Drive' }, { keys: '← →', label: 'Steer' }, { keys: 'Space', label: 'Back to the dock' }],
  touchHints: [{ keys: 'Drag', label: 'the floor to drive' }, { keys: 'Dock', label: 'to recharge' }],
  invites: roombaInvites,
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${Math.floor(run.coverage)}% CLEAN`, caption: run.roomName, detail: `$${run.money} found · ${Math.ceil(run.battery)}% battery left` }
    : { win: false, caption: 'Out of juice!', detail: 'Head home before the battery runs dry' },
  stages: run => Array.from({ length: Math.max(ROOMS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: roomName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function RoombaScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={roombaSpec} />; }
