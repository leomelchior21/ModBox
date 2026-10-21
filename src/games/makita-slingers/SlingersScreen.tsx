import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { slingersCatalog } from './catalog';
import { SlingersRun } from './run';
import { SLING_WORLDS } from './worlds';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { SlingersView } from './view';
import { SLING_LEVELS, slingLevelName } from './levels';
import '../three-kit/world.css';

const GROUNDS = ['classic', 'castle', 'cove', 'moon', 'jungle'];
/** The scrapyard crew chief. Misses bring the flight preview, empty racks bring more blades, a cleared quarry brings the Moon. */
function slingInvites(run: SlingersRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(run.shotsSinceKill >= 2 && !c.assist, { id: 'sling-preview-live', icon: '🎯', title: 'Two blades and no robots down', reason: 'The flight preview draws where your blade will really go.', code: 'bool aimGuide = true;', tone: 'help' });
    add(run.shotsSinceKill >= 3 && c.power < 100, { id: 'sling-power-live', icon: '💪', title: 'Not reaching the tower?', reason: 'More sling power launches blades faster and further.', code: 'int launchPower = 105;', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(!c.assist, { id: 'sling-preview', icon: '🎯', title: 'See the shot before you take it', reason: 'The flight preview shows the real path, wind included.', code: 'bool aimGuide = true;', tone: 'help' });
    add(c.lives < 6, { id: 'sling-rack', icon: '🪚', title: 'A bigger blade rack', reason: 'Six blades for every quarry.', code: 'int bladeCount = 6;', tone: 'help' });
    add(!c.overdrive, { id: 'sling-blast', icon: '💥', title: 'Blast blades', reason: 'Press E in flight to detonate any blade with a shockwave.', code: 'bool blastBlade = true;', tone: 'help' });
    add(c.weather === 'wind', { id: 'sling-calm', icon: '☀', title: 'The wind beat you', reason: 'Calm skies keep your blades on course.', code: 'string weather = "clear";', tone: 'help' });
    return out;
  }
  const next = GROUNDS[(GROUNDS.indexOf(c.worldTheme ?? 'classic') + 1) % GROUNDS.length];
  add(true, { id: `sling-ground-${next}`, icon: '🏰', title: `Next battle: ${SLING_WORLDS[next].name}`, reason: next === 'moon' ? 'Low gravity: blades fly a very long way.' : 'New towers, new backdrop.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add((c.weather ?? 'clear') !== 'wind', { id: 'sling-wind', icon: '🌬', title: 'Fling into the wind', reason: 'Gusts bend every blade. Read the preview!', code: 'string weather = "wind";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'sling-pizza', icon: '🍕', title: 'Pizza delivery', reason: 'Fling pizzas at the robots instead of saws.', code: 'string characterStyle = "pizza";', tone: 'style' });
  add(c.assist, { id: 'sling-noguide', icon: '👀', title: 'No preview', reason: 'Aim by eye like a real crew chief.', code: 'bool aimGuide = false;', tone: 'challenge' });
  add(c.gravity < 420, { id: 'sling-heavy', icon: '🌍', title: 'Heavy gravity', reason: 'Blades drop faster: lob them higher.', code: 'int gravity = 450;', tone: 'challenge' });
  return out;
}

export const makitaSlingersSpec: PremiumGameSpec<SlingersRun> = {
  id: 'makita-slingers', title: 'MAKITA SLINGERS', eyebrow: 'SCRAPYARD PHYSICS. SERIOUSLY SHARP.', description: 'Pull back a sawblade and turn robot fortresses into flying scrap. Real physics: break the supports and watch the towers fall.',
  instructions: 'Drag back anywhere and release to launch. Tap again in flight for the blade special. Keys: Up/Down aim, Left/Right power, Space fires.', goal: 'Knock out every robot.',
  width: 1000, height: 640, catalog: slingersCatalog,
  controls: [{ label: 'AIM ↑', action: 'up' }, { label: 'AIM ↓', action: 'down' }, { label: 'FIRE · SPECIAL', action: 'primary', primary: true }, { label: '− POWER', action: 'left' }, { label: '+ POWER', action: 'right' }, { label: 'BLAST · E', action: 'ability' }],
  create: checkpoint => new SlingersRun(checkpoint), createView: (canvas, run) => new SlingersView(canvas, run),
  objective: run => ({ label: `LEVEL ${run.level} · ${run.levelName.toUpperCase()} · ${run.robotsLeft} ROBOTS LEFT`, value: run.stage.robots.length - run.robotsLeft, max: run.stage.robots.length }),
  hints: [{ keys: 'Drag', label: 'back and release' }, { keys: 'Tap', label: 'in flight for specials' }, { keys: '↑↓ ←→', label: 'aim and power' }],
  touchHints: [{ keys: 'Drag', label: 'back and release' }, { keys: 'Tap', label: 'in flight for specials' }],
  invites: slingInvites,
  result: run => run.phase === 'cleared'
    ? { win: true, headline: '★'.repeat(run.stars) + '☆'.repeat(3 - run.stars), caption: run.levelName, detail: `${run.score.toLocaleString()} pts · ${run.queue.length} spare blade${run.queue.length === 1 ? '' : 's'}` }
    : { win: false, caption: 'So close!', detail: `${run.robotsLeft} robot${run.robotsLeft === 1 ? '' : 's'} still standing` },
  stages: run => Array.from({ length: Math.max(SLING_LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: slingLevelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function SlingersScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={makitaSlingersSpec} />; }
