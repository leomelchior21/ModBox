import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import type { RunnerRun } from './runner';
import { SUBWAY_WORLDS, TEMPLE_WORLDS } from './runner-worlds';

const NEXT = { subway: ['classic', 'tokyo', 'beach', 'arctic', 'mars'], temple: ['classic', 'desert', 'ice', 'lava', 'sky'] } as const;

/**
 * Runner coaching. The subway coach talks like a street crew ("you got clipped by a train!"), the temple coach like
 * an explorer's journal. Suggestions follow what actually tripped the runner: trains, hurdles, bars, gaps or corners.
 */
export function runnerInvites(run: RunnerRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, temple = run.theme === 'temple', out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  const k = run.crashes, shield = temple ? 'relicShield' : 'hoverboard', lives = temple ? 'charms' : 'chances';
  if (moment === 'struggle') {
    add(k.turn >= 1 && !c.overdrive, { id: 'run-turn-shield', icon: '🛡', title: 'The corners keep catching you', reason: 'ANCIENT AEGIS (press E) also rescues a missed turn.', code: 'bool relicShield = true;', tone: 'help' });
    add(k.hurdle + k.gap >= 2 && c.power < 12, { id: 'run-jump-live', icon: '🦘', title: temple ? 'Those gaps are wide' : 'Hurdles keep tripping you', reason: 'Bigger jumps clear them with room to spare.', code: `int jumpPower = ${temple ? 12 : 13};`, tone: 'help' });
    add(!temple && k.train >= 1 && !c.overdrive, { id: 'run-board-live', icon: '🛹', title: 'Clipped by a train!', reason: 'A hoverboard (press E) absorbs one crash.', code: 'bool hoverboard = true;', tone: 'help' });
    add(run.coins < 5 && run.distance > 120 && !c.assist, { id: 'run-magnet-live', icon: '🧲', title: 'Coins are getting away', reason: 'A magnet pulls them in from the next lane.', code: 'bool coinMagnet = true;', tone: 'style' });
    return out;
  }
  if (moment === 'lose') {
    const worst = (Object.entries(k) as [keyof typeof k, number][]).sort((a, b) => b[1] - a[1])[0][0];
    add(worst === 'turn' && temple && !c.overdrive, { id: 'run-aegis', icon: '🛡', title: 'Missed the turn?', reason: 'The Ancient Aegis saves you from one missed corner or crash.', code: 'bool relicShield = true;', tone: 'help' });
    add((worst === 'hurdle' || worst === 'gap') && c.power < 12, { id: 'run-jump', icon: '🦘', title: temple ? 'Leap of faith' : 'Super sneakers', reason: 'Jump higher and stay in the air longer.', code: `int jumpPower = ${temple ? 12 : 13};`, tone: 'help' });
    add(worst === 'train' && !c.overdrive && !temple, { id: 'run-board', icon: '🛹', title: 'Ride a hoverboard', reason: 'Press E to board up: one crash is forgiven.', code: 'bool hoverboard = true;', tone: 'help' });
    add(c.speed > 9, { id: 'run-slow', icon: '🐢', title: 'Slow the chase down', reason: 'A gentler pace gives you more time to react.', code: `int runSpeed = ${temple ? 8 : 9};`, tone: 'help' });
    add(c.lives < 5, { id: 'run-lives', icon: '❤', title: temple ? 'Carry more lucky charms' : 'More second winds', reason: 'Start with five chances instead of three.', code: `int ${lives} = 5;`, tone: 'help' });
    add(!c.overdrive && !out.some(i => i.code.includes(shield)), { id: 'run-shield', icon: '✨', title: temple ? 'Ancient Aegis' : 'Board culture', reason: 'Unlock a rechargeable shield on E.', code: `bool ${shield} = true;`, tone: 'help' });
    return out;
  }
  const list = NEXT[run.theme], next = list[(list.indexOf((c.worldTheme ?? 'classic') as never) + 1) % list.length], world = temple ? TEMPLE_WORLDS[next] : SUBWAY_WORLDS[next];
  add(true, { id: `run-world-${next}`, icon: temple ? '🗺' : '🚇', title: `Next run: ${world.name}`, reason: next === 'mars' || next === 'sky' ? 'Low gravity: every jump floats.' : temple ? 'A whole new lost world to explore.' : 'A new city line, new trains, new views.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add(c.speed < 16, { id: 'run-fast', icon: '⚡', title: temple ? 'Outrun the monkeys' : 'Rush hour', reason: 'Turn up the pace for a real challenge.', code: `int runSpeed = ${temple ? 14 : 17};`, tone: 'challenge' });
  add((c.weather ?? 'clear') === 'clear', { id: 'run-weather', icon: temple ? '🌪' : '⛈', title: temple ? 'Run through a sandstorm' : 'Run in a thunderstorm', reason: temple ? 'Slower legs and the path fades into the dust.' : 'Slippery lanes, longer slides and lightning.', code: `string weather = "${temple ? 'sandstorm' : 'storm'}";`, tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'run-style', icon: temple ? '🛡' : '🛹', title: temple ? 'Suit up as a knight' : 'Become a skater', reason: 'A new look for your runner.', code: `string characterStyle = "${temple ? 'knight' : 'skater'}";`, tone: 'style' });
  return out;
}
