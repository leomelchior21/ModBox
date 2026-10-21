import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { stackCatalog } from './catalog';
import { StackRun, STACK_LEVELS, stackLevelName } from './run';
import { StackView } from './view';
import '../three-kit/world.css';
import './stack.css';
import { STACK_WORLDS } from './worlds';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';

const SITES = ['classic', 'tokyo', 'desert', 'ocean', 'space'];
/** The site foreman. Missed slabs bring timing help; a finished skyline brings a tougher or stranger build. */
function stackInvites(run: StackRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(run.cuts >= 4 && run.perfects < 2 && !c.overdrive, { id: 'stack-focus-live', icon: '⏳', title: 'Slow the moment down', reason: 'FOCUS on E gives you three seconds of slow motion.', code: 'bool focusMode = true;', tone: 'help' });
    add(run.cuts >= 6 && !c.assist, { id: 'stack-magnet-live', icon: '🧲', title: 'The tower keeps shrinking', reason: 'Magnet snap pulls near misses into a perfect.', code: 'bool magnetSnap = true;', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(!c.assist, { id: 'stack-magnet', icon: '🧲', title: 'Hard hats on: magnet snap', reason: 'Near misses snap into perfect drops.', code: 'bool magnetSnap = true;', tone: 'help' });
    add(c.speed > 110, { id: 'stack-slow', icon: '🐢', title: 'Slow the crane', reason: 'Slower slabs give you more time to line up.', code: 'int blockSpeed = 110;', tone: 'help' });
    add(c.power < 14, { id: 'stack-window', icon: '🎯', title: 'A wider perfect window', reason: 'Drops this close count as perfect.', code: 'int perfectWindow = 14;', tone: 'help' });
    add(c.lives < 4, { id: 'stack-chances', icon: '❤', title: 'More second chances', reason: 'Four misses before the build stops.', code: 'int chances = 4;', tone: 'help' });
    return out;
  }
  const next = SITES[(SITES.indexOf(c.worldTheme ?? 'classic') + 1) % SITES.length];
  add(true, { id: `stack-site-${next}`, icon: '🏗', title: `Next site: ${STACK_WORLDS[next].name}`, reason: 'A new skyline to build into.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add(c.speed < 180, { id: 'stack-fast', icon: '⚡', title: 'Speed up the crane', reason: 'Faster slabs, same perfect timing.', code: 'int blockSpeed = 190;', tone: 'challenge' });
  add((c.weather ?? 'clear') === 'clear', { id: 'stack-wind', icon: '🌬', title: 'Build in the wind', reason: 'Gusts make every slab surge and slow.', code: 'string weather = "wind";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'stack-glass', icon: '💎', title: 'A glass tower', reason: 'See-through slabs with shining edges.', code: 'string characterStyle = "glass";', tone: 'style' });
  add(c.assist, { id: 'stack-nomagnet', icon: '🎯', title: 'No magnet', reason: 'Every perfect is all yours.', code: 'bool magnetSnap = false;', tone: 'challenge' });
  return out;
}

function StackHud({ run }: { run: StackRun }) {
  return <div className="ss__hud" aria-label={`${run.placed} of ${run.goal} floors`}>
    <b>{run.placed}</b><span>of {run.goal} floors</span>
    {run.streak > 1 ? <em key={run.streak}>PERFECT ×{run.streak}</em> : null}
    {run.moving.gold && run.phase === 'playing' ? <i>GOLD SLAB</i> : null}
  </div>;
}

export const speedStackSpec: PremiumGameSpec<StackRun> = {
  id: 'speed-stack', title: 'SPEED STACK', eyebrow: 'FIND THE MOMENT. BUILD THE SKYLINE.', description: 'Drop each sliding slab onto the tower. Whatever hangs over the edge is cut away. Chain perfect drops to grow the tower back and reach the top of twelve skylines.',
  instructions: 'Tap anywhere, press Space or use DROP when the slab lines up. Three perfects in a row widen the tower. E activates an unlocked Focus slowdown.', goal: 'One more floor.',
  width: 840, height: 800, catalog: stackCatalog,
  controls: [{ label: 'DROP · SPACE', action: 'primary', primary: true }, { label: 'FOCUS · E', action: 'ability' }],
  create: checkpoint => new StackRun(checkpoint), createView: (canvas, run) => new StackView(canvas, run),
  objective: run => ({ label: `LEVEL ${run.level} · ${run.levelName.toUpperCase()}`, value: run.placed, max: run.goal }),
  hud: run => <StackHud run={run} />,
  hints: [{ keys: 'Space', label: 'drop the slab' }, { keys: 'E', label: 'focus' }],
  touchHints: [{ keys: 'Tap', label: 'anywhere to drop' }],
  invites: stackInvites,
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.placed} FLOORS`, caption: run.levelName, detail: `${run.perfects} perfect drops · best streak ×${run.best}` }
    : { win: false, caption: 'Tower toppled!', detail: `${run.placed} of ${run.goal} floors · watch the edge, not the middle` },
  stages: run => Array.from({ length: Math.max(STACK_LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: stackLevelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function StackScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={speedStackSpec} />; }
