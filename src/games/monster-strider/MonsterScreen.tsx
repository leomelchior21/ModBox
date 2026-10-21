import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { monsterCatalog } from './catalog';
import { MonsterRun, formatTime } from './run';
import { MonsterView } from './view';
import { MONSTER_WORLDS } from './worlds';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { MONSTER_LEVELS, levelName } from './levels';
import '../three-kit/world.css';

const WORLDS = ['classic', 'desert', 'arctic', 'lava', 'mars'];
/**
 * The stunt announcer. Splashes ask for more engine, roof landings and rollovers ask for the stabilizer,
 * and a clean run dares the driver onto ice, into low gravity or into a hot dog.
 */
function monsterInvites(run: MonsterRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, w = run.wrecks, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(w.splash >= 2 && c.power < 26, { id: 'mon-torque-live', icon: '🔧', title: 'Into the water again!', reason: 'More torque reaches the far side of the gaps.', code: 'int enginePower = 28;', tone: 'help' });
    add(w.roof + w.side >= 2 && !c.assist, { id: 'mon-gyro-live', icon: '🎯', title: 'Landing on the roof!', reason: 'A gyro levels the truck in the air for you.', code: 'bool autoBalance = true;', tone: 'help' });
    add(c.weather === 'snow' && w.splash + w.side >= 1, { id: 'mon-dry', icon: '☀', title: 'No grip on the ice', reason: 'Dry roads give the tyres their grip back.', code: 'string weather = "clear";', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(w.roof + w.side >= 1 && !c.assist, { id: 'mon-gyro', icon: '🎯', title: 'Keep it level', reason: 'The stabilizer stops roof landings and rollovers.', code: 'bool autoBalance = true;', tone: 'help' });
    add(w.splash >= 1 && c.power < 26, { id: 'mon-torque', icon: '🔧', title: 'Too slow for the gaps', reason: 'More torque, more speed at the take-off.', code: 'int enginePower = 28;', tone: 'help' });
    add(c.gravity > 16, { id: 'mon-air', icon: '🪶', title: 'Floatier jumps', reason: 'Lower gravity gives you more time to line up the landing.', code: 'int gravity = 14;', tone: 'help' });
    add(c.lives < 5, { id: 'mon-trucks', icon: '🚚', title: 'A bigger pit crew', reason: 'Five spare trucks for the course.', code: 'int spareTrucks = 5;', tone: 'help' });
    return out;
  }
  const next = WORLDS[(WORLDS.indexOf(c.worldTheme ?? 'classic') + 1) % WORLDS.length];
  add(true, { id: `mon-world-${next}`, icon: '🏁', title: `Next rally: ${MONSTER_WORLDS[next].name}`, reason: next === 'mars' ? 'Low gravity: jumps go huge.' : 'New ground, new cliffs, same nerve.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add(!c.overdrive, { id: 'mon-nitro', icon: '🔥', title: 'Bottle some lightning', reason: 'NITRO on E: a rocket boost for record times.', code: 'bool nitro = true;', tone: 'challenge' });
  add((c.weather ?? 'clear') === 'clear', { id: 'mon-ice', icon: '❄', title: 'Try ice racing', reason: 'Snow steals almost all your grip. Feather the throttle!', code: 'string weather = "snow";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'mon-hotdog', icon: '🌭', title: 'Drive a giant hot dog', reason: 'Same truck, much tastier.', code: 'string characterStyle = "hotdog";', tone: 'style' });
  add(c.assist, { id: 'mon-nogyro', icon: '🤘', title: 'No stabilizer', reason: 'Land every jump with your own throttle control.', code: 'bool autoBalance = false;', tone: 'challenge' });
  return out;
}

export const monsterSpec: PremiumGameSpec<MonsterRun> = {
  id: 'monster-strider', title: 'MONSTER STRIDER', eyebrow: 'BIG TIRES. WOBBLY BRIDGES.',
  description: 'Eight handcrafted island courses full of sagging plank bridges, seesaws, crates and boardwalks that crumble behind you. Balance throttle and tilt, keep the roof off the ground and cross the checkered line.',
  instructions: 'Hold → / GAS to drive; ← / BACK brakes and reverses. In the air GAS tilts back and BACK tilts forward. On touch, hold either half of the world. Space hops; E fires nitro.', goal: 'Reach the finish. Don’t land on your roof.',
  width: 1000, height: 760, catalog: monsterCatalog,
  controls: [{ label: '◀ BACK', action: 'left', hold: 'left' }, { label: 'HOP · SPACE', action: 'primary' }, { label: 'GAS ▶', action: 'right', hold: 'right', primary: true }, { label: 'NITRO · E', action: 'ability' }],
  create: checkpoint => new MonsterRun(checkpoint), createView: (canvas, run) => new MonsterView(canvas, run),
  objective: run => ({ label: `LEVEL ${run.level} · ${run.stageName.toUpperCase()}`, value: run.progress, max: 1 }),
  hints: [{ keys: '→', label: 'Gas · tilt back' }, { keys: '←', label: 'Brake · tilt forward' }, { keys: 'Space', label: 'Hop' }],
  touchHints: [{ keys: 'Right', label: 'Hold to gas · tilt back' }, { keys: 'Left', label: 'Hold to brake · tilt forward' }],
  invites: monsterInvites,
  result: run => run.phase === 'cleared'
    ? { win: true, headline: formatTime(run.finishTime), caption: run.stageName, detail: `${run.score.toLocaleString()} pts${run.flips ? ` · ${run.flips} flip${run.flips > 1 ? 's' : ''}` : ''} · par ${formatTime(run.stage.par)}` }
    : { win: false, caption: run.progress > .8 ? 'So close!' : 'Awwww', detail: run.notice.split('.')[0] },
  stages: run => Array.from({ length: Math.max(MONSTER_LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: levelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function MonsterScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={monsterSpec} />; }
