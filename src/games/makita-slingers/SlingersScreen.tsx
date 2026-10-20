import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { slingersCatalog } from './catalog';
import { SlingersRun } from './run';
import { SlingersView } from './view';
import { SLING_LEVELS, slingLevelName } from './levels';
import '../three-kit/world.css';

export const makitaSlingersSpec: PremiumGameSpec<SlingersRun> = {
  id: 'makita-slingers', title: 'MAKITA SLINGERS', eyebrow: 'SCRAPYARD PHYSICS. SERIOUSLY SHARP.', description: 'Pull back a sawblade and turn robot fortresses into flying scrap. Real physics: break the supports and watch the towers fall.',
  instructions: 'Drag back anywhere and release to launch. Tap again in flight for the blade special. Keys: Up/Down aim, Left/Right power, Space fires.', goal: 'Knock out every robot.',
  width: 1000, height: 640, catalog: slingersCatalog,
  controls: [{ label: 'AIM ↑', action: 'up' }, { label: 'AIM ↓', action: 'down' }, { label: 'FIRE · SPECIAL', action: 'primary', primary: true }, { label: '− POWER', action: 'left' }, { label: '+ POWER', action: 'right' }, { label: 'BLAST · E', action: 'ability' }],
  create: checkpoint => new SlingersRun(checkpoint), createView: (canvas, run) => new SlingersView(canvas, run),
  objective: run => ({ label: `LEVEL ${run.level} · ${run.levelName.toUpperCase()} · ${run.robotsLeft} ROBOTS LEFT`, value: run.stage.robots.length - run.robotsLeft, max: run.stage.robots.length }),
  hints: [{ keys: 'Drag', label: 'back and release' }, { keys: 'Tap', label: 'in flight for specials' }, { keys: '↑↓ ←→', label: 'aim and power' }],
  touchHints: [{ keys: 'Drag', label: 'back and release' }, { keys: 'Tap', label: 'in flight for specials' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: '★'.repeat(run.stars) + '☆'.repeat(3 - run.stars), caption: run.levelName, detail: `${run.score.toLocaleString()} pts · ${run.queue.length} spare blade${run.queue.length === 1 ? '' : 's'}` }
    : { win: false, caption: 'So close!', detail: `${run.robotsLeft} robot${run.robotsLeft === 1 ? '' : 's'} still standing` },
  stages: run => Array.from({ length: Math.max(SLING_LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: slingLevelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function SlingersScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={makitaSlingersSpec} />; }
