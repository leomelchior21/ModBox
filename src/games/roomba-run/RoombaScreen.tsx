import type { CSSProperties } from 'react';
import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { roombaCatalog } from './catalog';
import { RoombaRun } from './run';
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
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${Math.floor(run.coverage)}% CLEAN`, caption: run.roomName, detail: `$${run.money} found · ${Math.ceil(run.battery)}% battery left` }
    : { win: false, caption: 'Out of juice!', detail: 'Head home before the battery runs dry' },
  stages: run => Array.from({ length: Math.max(ROOMS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: roomName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function RoombaScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={roombaSpec} />; }
