import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { monsterCatalog } from './catalog';
import { MonsterRun, formatTime } from './run';
import { MonsterView } from './view';
import { MONSTER_LEVELS, levelName } from './levels';
import '../three-kit/world.css';

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
  result: run => run.phase === 'cleared'
    ? { win: true, headline: formatTime(run.finishTime), caption: run.stageName, detail: `${run.score.toLocaleString()} pts${run.flips ? ` · ${run.flips} flip${run.flips > 1 ? 's' : ''}` : ''} · par ${formatTime(run.stage.par)}` }
    : { win: false, caption: run.progress > .8 ? 'So close!' : 'Awwww', detail: run.notice.split('.')[0] },
  stages: run => Array.from({ length: Math.max(MONSTER_LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: levelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function MonsterScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={monsterSpec} />; }
