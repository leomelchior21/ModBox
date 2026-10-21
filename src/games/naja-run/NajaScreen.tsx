import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { najaCatalog } from './catalog';
import { NajaRun } from './run';
import { NajaView } from '../three-kit/arcade-views';
import { NAJA_GARDENS } from './worlds';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import '../three-kit/world.css';

const GARDENS = ['classic', 'desert', 'frozen', 'neon', 'candy'];
/** The old cobra's advice ("Sssss"): portals for wall bumps, a shield for tail knots, a calmer pace, or a new garden. */
function najaInvites(run: NajaRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, b = run.bumps, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(b.wall >= 1 && !c.assist, { id: 'naja-portal-live', icon: '🌀', title: 'Sssss... the edge again?', reason: 'Temple portals carry you across to the other side.', code: 'bool wrapWalls = true;', tone: 'help' });
    add(b.tail >= 1 && !c.overdrive, { id: 'naja-shield-live', icon: '🛡', title: 'Tangled in your own tail', reason: 'JADE RUSH on E: a shield that lets you pass through once.', code: 'bool venomRush = true;', tone: 'help' });
    return out;
  }
  if (moment === 'lose') {
    add(b.wall >= 1 && !c.assist, { id: 'naja-portal', icon: '🌀', title: 'Open the temple portals', reason: 'Leave one edge and slither in on the opposite side.', code: 'bool wrapWalls = true;', tone: 'help' });
    add(c.speed > 5, { id: 'naja-slow', icon: '🐢', title: 'A calmer serpent', reason: 'Slower slithering gives you time to turn.', code: 'int snakeSpeed = 5;', tone: 'help' });
    add(b.tail + b.stone >= 1 && !c.overdrive, { id: 'naja-rush', icon: '🛡', title: 'Unlock JADE RUSH', reason: 'A shield on E breaks one stone or tail knot.', code: 'bool venomRush = true;', tone: 'help' });
    add(c.lives < 5, { id: 'naja-charms', icon: '❤', title: 'More temple charms', reason: 'Five tries for the garden.', code: 'int charms = 5;', tone: 'help' });
    return out;
  }
  const next = GARDENS[(GARDENS.indexOf(c.worldTheme ?? 'classic') + 1) % GARDENS.length];
  add(true, { id: `naja-garden-${next}`, icon: '🐍', title: `Next garden: ${NAJA_GARDENS[next].name}`, reason: 'Fresh fruit in a new world.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add(c.speed < 9, { id: 'naja-fast', icon: '⚡', title: 'Strike faster', reason: 'A quicker serpent for quick thinkers.', code: 'int snakeSpeed = 9;', tone: 'challenge' });
  add(c.bonus < 2, { id: 'naja-grow', icon: '📏', title: 'Grow twice as long', reason: 'Two segments per fruit: your tail fills the garden fast.', code: 'int growth = 2;', tone: 'challenge' });
  add((c.weather ?? 'clear') === 'clear', { id: 'naja-fog', icon: '🌫', title: 'Hunt in the fog', reason: 'The fruit only shows up when you are close.', code: 'string weather = "fog";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'naja-rainbow', icon: '🌈', title: 'Rainbow scales', reason: 'Every segment a new colour.', code: 'string characterStyle = "rainbow";', tone: 'style' });
  return out;
}

export const najaRunSpec: PremiumGameSpec<NajaRun> = {
  id: 'naja-run', title: 'NAJA RUN', eyebrow: "A GOLDEN TRAIL. A GROWING LEGEND.", description: "Guide a jewel-scaled cobra through a forgotten temple. Gather glowing fruit and crystals, weave around your tail, and find your way to the next garden.",
  instructions: "Swipe or use arrow keys to turn. Gather five fruits, avoid stones and your own tail. E activates an unlocked Jade Rush shield.", goal: "FOLLOW YOUR INSTINCT.",
  width: 720, height: 720, catalog: najaCatalog, controls: [{"label":"← LEFT","action":"left"},{"label":"↑ UP","action":"up"},{"label":"↓ DOWN","action":"down"},{"label":"RIGHT →","action":"right"},{"label":"JADE RUSH","action":"ability","primary":true}],
  create: checkpoint => new NajaRun(checkpoint), createView: (canvas, run) => new NajaView(canvas, run),
  invites: najaInvites,
};
export function NajaScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={najaRunSpec} />; }
