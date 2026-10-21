import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { tomatinaCatalog } from './catalog';
import { TomatinaRun, LEVELS, GOAL_TEXT, POWER_TEXT, levelName, type PowerKind, type TomatoGoal } from './run';
import { TOWNS, TOWN_ORDER, THROWERS } from './worlds';
import { TomatinaView } from './view';
import '../three-kit/world.css';
import './tomatina.css';

/**
 * EL PREGONERO, the town crier, coaches the fiesta. A soaking suggests help, a cleared street dares you to go
 * further or take the fiesta on tour, and a struggle mid-street offers one quick line of code.
 */
function crierInvites(run: TomatinaRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  const goal = (kind: string) => run.stage.goals.some(([k]) => k === kind);
  if (moment === 'struggle') {
    add(run.blockedThrows >= 4 && (c.bounces ?? 0) === 0, { id: 'tom-bounce-live', icon: '↯', title: 'That umbrella is a wall!', reason: 'Bouncy tomatoes ricochet off the walls and around the umbrella.', code: 'int bounces = 2;', tone: 'help' });
    add(run.metrics.actions >= 12 && run.tally.robots === 0 && !c.assist, { id: 'tom-radar-live', icon: '◎', title: '¡Casi! Almost!', reason: 'TOMATO RADAR curves your tomatoes into the robots.', code: 'bool autoAim = true;', tone: 'help' });
    add(run.dry < 45 && c.lives < 5, { id: 'tom-shirts-live', icon: '👕', title: 'You are dripping wet', reason: 'Pack spare shirts so a soaking is not the end.', code: 'int dryShirts = 5;', tone: 'help' });
    add(run.ammo === 0 && (c.ammo ?? 20) < 40, { id: 'tom-bag-live', icon: '🍅', title: 'Out of tomatoes!', reason: 'A bigger bag carries twice as many.', code: 'int bagSize = 40;', tone: 'help' });
    add(goal('zone') && run.elapsed > 35 && run.zonePercent < 25 && (c.splash ?? 2) < 4, { id: 'tom-size-live', icon: '●', title: 'Paint faster', reason: 'Bigger tomatoes paint much wider splats.', code: 'int tomatoSize = 4;', tone: 'help' });
    add(run.elapsed > 50 && (c.teammates ?? 0) === 0, { id: 'tom-amigos-live', icon: '☺', title: 'Call your friends', reason: 'Two amigos follow you and throw tomatoes too.', code: 'int amigos = 2;', tone: 'style' });
    return out;
  }
  if (moment === 'lose') {
    add(c.lives < 5, { id: 'tom-shirts', icon: '👕', title: 'Soaked to the bone', reason: 'Five spare shirts: five more chances on every street.', code: 'int dryShirts = 5;', tone: 'help' });
    add(!c.assist, { id: 'tom-radar', icon: '◎', title: 'Switch on TOMATO RADAR', reason: 'Your tomatoes curve toward the nearest robot.', code: 'bool autoAim = true;', tone: 'help' });
    add((c.difficulty ?? 'normal') !== 'easy', { id: 'tom-easy', icon: '😴', title: 'Sleepy robots', reason: 'Easy robots move slowly, see less and spray less often.', code: 'string robotLevel = "easy";', tone: 'help' });
    add((c.teammates ?? 0) < 2, { id: 'tom-amigos', icon: '☺', title: 'Bring your amigos', reason: 'Friends from the town throw tomatoes at the robots with you.', code: 'int amigos = 2;', tone: 'help' });
    add(c.power < 24, { id: 'tom-arm', icon: '💪', title: 'A stronger arm', reason: 'Faster, flatter throws that reach further.', code: 'int throwPower = 24;', tone: 'help' });
    add((c.ammo ?? 20) < 40, { id: 'tom-bag', icon: '🍅', title: 'Carry more tomatoes', reason: 'A bag of forty: fewer trips to the crates.', code: 'int bagSize = 40;', tone: 'help' });
    return out;
  }
  const next = TOWN_ORDER[(TOWN_ORDER.indexOf(c.worldTheme ?? 'classic') + 1) % TOWN_ORDER.length];
  add(true, { id: `tom-town-${next}`, icon: '✈', title: `Fiesta on tour: ${TOWNS[next].name}`, reason: `Take the tomato fight to ${TOWNS[next].place}.`, code: `string worldTheme = "${next}";`, tone: 'style' });
  add((c.difficulty ?? 'normal') !== 'loco', { id: 'tom-loco', icon: '🔥', title: 'Too easy? Go LOCO', reason: 'Fast robots with sharp eyes and busy hoses.', code: 'string robotLevel = "loco";', tone: 'challenge' });
  add((c.rivals ?? 0) < 4, { id: 'tom-invasion', icon: '⚙', title: 'Robot invasion', reason: 'Four more Limpiabots on every street.', code: 'int extraRobots = 4;', tone: 'challenge' });
  add((c.weather ?? 'clear') === 'clear', { id: 'tom-night', icon: '🌙', title: 'A fiesta at midnight', reason: 'The town goes dark and the robots see less. Neither do you.', code: 'string weather = "night";', tone: 'challenge' });
  add((c.bounces ?? 0) === 0, { id: 'tom-banks', icon: '↯', title: 'Learn the bank shot', reason: 'Tomatoes ricochet off walls: hit robots around corners.', code: 'int bounces = 2;', tone: 'style' });
  add(c.gravity > 5, { id: 'tom-moon', icon: '☾', title: 'Moon tomatoes', reason: 'Low gravity makes long, floaty arcs.', code: 'int tomatoGravity = 4;', tone: 'style' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'tom-abuela', icon: '👵', title: 'Let Abuela throw', reason: 'Oven mitt on. Nobody throws like Abuela.', code: 'string characterStyle = "abuela";', tone: 'style' });
  return out;
}

const WEATHER_ICON: Record<string, string> = { clear: '☀', rain: '☂', wind: '≋', fog: '▒', night: '☾' };
const POWER_ICON: Record<PowerKind, string> = { cherry: '⁂', mega: '⬤', bounce: '↯' };
/** The status-bar portrait, drawn in two inks on a 24 × 24 grid: it grins after a splat and winces when soaked. */
function Face({ style, mood, look, paper, ink, red }: { style: string; mood: 'calm' | 'happy' | 'hurt' | 'wet'; look: number; paper: string; ink: string; red: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d'); if (!g) return;
    const px = (x: number, y: number, c = ink) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); }, rect = (x: number, y: number, w: number, h: number, c = ink) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    rect(0, 0, 24, 24, paper);
    const robot = style === 'robot';
    if (robot) { rect(5, 6, 14, 15); rect(6, 7, 12, 13, paper); rect(11, 2, 2, 4); rect(10, 1, 4, 2, red); }
    else for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const e = ((x - 11.5) / 7) ** 2 + ((y - 13) / 8.5) ** 2, inner = ((x - 11.5) / 6) ** 2 + ((y - 13) / 7.5) ** 2; if (e <= 1 && inner > 1) px(x, y); }
    if (style === 'luchador') for (let y = 5; y < 21; y++) for (let x = 6; x < 18; x++) { const e = ((x - 11.5) / 6) ** 2 + ((y - 13) / 7.5) ** 2; if (e < 1) px(x, y, (x + y) % 5 ? red : paper); }
    if (style === 'knight') { rect(5, 4, 14, 8); for (let x = 6; x < 18; x += 2) px(x, 5, paper); rect(6, 11, 12, 3, paper); rect(5, 14, 14, 2); }
    if (style === 'chef') { rect(6, 0, 12, 6, paper); for (let x = 6; x < 18; x++) { px(x, 0); px(x, 5); } px(5, 1); px(5, 4); px(18, 1); px(18, 4); rect(8, 2, 1, 3); rect(12, 1, 1, 4); rect(15, 2, 1, 3); }
    if (style === 'abuela') { for (let y = 3; y < 9; y++) for (let x = 5; x < 19; x++) if ((x + y) % 2 === 0 && y < 8 - Math.abs(x - 11.5) * .2) px(x, y); rect(10, 0, 4, 3); }
    if (style === 'original') { rect(5, 7, 14, 2, red); rect(18, 8, 2, 3, red); }
    // Eyes follow the action; mood changes eyes and mouth.
    const ex = 9 + look, ey = robot ? 11 : 12;
    if (mood === 'happy') { for (const x of [ex, ex + 5]) { px(x, ey); px(x + 1, ey - 1); px(x + 2, ey); } }
    else if (mood === 'hurt') { for (const x of [ex, ex + 5]) { px(x, ey - 1); px(x + 2, ey - 1); px(x + 1, ey); px(x, ey + 1); px(x + 2, ey + 1); } }
    else for (const x of [ex, ex + 5]) rect(x, ey, 2, 2, style === 'luchador' ? ink : ink);
    if (style === 'abuela') { g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(ex - 1.5, ey - 1.5, 4, 4); g.strokeRect(ex + 3.5, ey - 1.5, 4, 4); }
    if (style === 'original' || style === 'chef' || style === 'abuela') { px(11, 15); px(12, 15); }
    const my = robot ? 16 : 18;
    if (mood === 'happy') { rect(8, my, 8, 1); rect(9, my + 1, 6, 1, red); rect(9, my + 2, 6, 1); px(8, my - 1); px(15, my - 1); }
    else if (mood === 'hurt') { rect(10, my - 1, 4, 4); rect(11, my, 2, 2, paper); }
    else if (mood === 'wet') { for (let x = 8; x < 16; x++) px(x, my + (x % 2)); for (const x of [5, 18]) { rect(x, 13, 1, 2); rect(x, 16, 1, 1); } }
    else rect(9, my, 6, 1);
  }, [style, mood, look, paper, ink, red]);
  return <canvas ref={ref} className="tom__face" width={24} height={24} aria-hidden="true" />;
}

/** Each goal in plain words, with its progress. */
function goalLines(run: TomatinaRun) {
  const boss = run.bots.find(b => b.kind === 'boss');
  const text: Record<TomatoGoal, (n: number) => string> = {
    robots: n => `Splat ${n} robot${n === 1 ? '' : 's'}`, zone: n => `Paint the dotted plaza ${n}% red`, targets: n => `Hit ${n} bullseye${n === 1 ? '' : 's'} to open the gate`,
    golden: n => `Find ${n} golden tomato${n === 1 ? '' : 'es'}`, exit: () => run.exitOpen ? 'Run to the ¡FIESTA! arch' : 'Then run to the ¡FIESTA! arch', boss: () => 'Splat La Gran Lavadora when its door opens',
  };
  return run.goalProgress().map(g => ({ kind: g.kind, text: text[g.kind](g.count), done: g.value >= g.count, waiting: g.kind === 'exit' && !run.exitOpen,
    progress: g.kind === 'zone' ? `${g.value}%` : g.kind === 'exit' ? '' : g.kind === 'boss' && boss ? `${boss.max - boss.hp}/${boss.max}` : `${g.value}/${g.count}`,
    fill: g.kind === 'boss' && boss ? (boss.max - boss.hp) / boss.max : g.value / g.count }));
}
function Goals({ run }: { run: TomatinaRun }) {
  return <ul className="tom__goals" aria-label="Goals">{goalLines(run).map(g => <li key={g.kind} className={g.done ? 'is-done' : g.waiting ? 'is-waiting' : ''}>
    <i aria-hidden="true">{g.done ? '✓' : ''}</i><span>{g.text}</span>{g.progress ? <b>{g.progress}</b> : null}{!g.done && g.kind !== 'exit' ? <em style={{ width: `${Math.round(g.fill * 100)}%` }} /> : null}
  </li>)}</ul>;
}

/** Doom-style status bar, crosshair, goals, a compass to the next goal and the crier's big calls. */
function TomatinaHud({ run }: { run: TomatinaRun }) {
  const town = TOWNS[run.config.worldTheme ?? 'classic'] ?? TOWNS.classic, night = run.night;
  const paper = night ? town.ink : town.paper, ink = night ? town.paper : town.ink;
  const mood = run.hurt > 0 ? 'hurt' : run.happy > 0 ? 'happy' : run.dry < 35 ? 'wet' : 'calm', look = [0, -1, 0, 1][Math.floor(run.elapsed / 1.6) % 4];
  const powers = (Object.keys(run.power) as PowerKind[]).filter(k => run.power[k] > 0), bag = run.bag;
  const style = { '--tom-paper': paper, '--tom-ink': ink, '--tom-red': town.tomato } as CSSProperties;
  const playing = run.phase === 'playing', hud = useRef<HTMLDivElement>(null), next = playing ? run.nextObjective() : null;
  // The touch buttons live beside the HUD: give them the town's inks too.
  useEffect(() => { const stage = hud.current?.closest<HTMLElement>('.premium-stage'); if (!stage) return; stage.style.setProperty('--tom-paper', paper); stage.style.setProperty('--tom-ink', ink); stage.style.setProperty('--tom-red', town.tomato); }, [paper, ink, town.tomato]);
  const turn = next ? Math.atan2(Math.sin(Math.atan2(next.z - run.pz, next.x - run.px) - run.yaw), Math.cos(Math.atan2(next.z - run.pz, next.x - run.px) - run.yaw)) : 0;
  return <div className="tom__hud" style={style} ref={hud}>
    {playing && run.briefing > 0 ? <div className="tom__brief" style={{ opacity: Math.min(1, run.briefing / .6) }}>
      <small>STREET {run.level}</small><h2>{run.levelName}</h2><Goals run={run} /><p>{run.stage.tip}</p>
    </div> : playing ? <Goals run={run} /> : null}
    {next && run.briefing <= 0 ? <div className="tom__compass" role="status"><b style={{ transform: `rotate(${turn}rad)` }} aria-hidden="true">▲</b>{next.label} · {Math.round(Math.hypot(next.x - run.px, next.z - run.pz))} M</div> : null}
    {playing ? <div className="tom__cross" aria-hidden="true" /> : null}
    {playing && run.display.timer > 0 && run.briefing <= 0 ? <div key={run.display.text} className="tom__call" style={{ opacity: Math.min(1, run.display.timer / .3) }}>{run.display.text}</div> : null}
    {playing && run.weather.text ? <div className="tom__weather"><i aria-hidden="true">{WEATHER_ICON[run.config.weather ?? 'clear']}</i>{run.weather.text}{run.windX || run.windZ ? <b style={{ transform: `rotate(${Math.atan2(run.windZ, run.windX) - run.yaw + Math.PI / 2}rad)` }} aria-label="wind direction">↑</b> : null}</div> : null}
    <div className="tom__bar" role="group" aria-label="Status">
      <Face style={run.config.characterStyle ?? 'original'} mood={mood} look={look} paper={paper} ink={ink} red={town.tomato} />
      <div className="tom__stat"><small>DRY</small><strong className={run.dry < 35 ? 'is-low' : ''}>♥{Math.round(run.dry)}</strong></div>
      <div className="tom__stat tom__stat--ammo"><small>TOMATOES</small><strong className={run.ammo === 0 ? 'is-low' : ''}>●{run.ammo}<em>/{bag}</em></strong></div>
      <div className="tom__stat"><small>SHIRTS</small><strong>{'▮'.repeat(Math.min(9, run.lives))}</strong></div>
      {powers.length || run.config.overdrive ? <div className="tom__powers">
        {powers.map(k => <span key={k} title={POWER_TEXT[k]}><i aria-hidden="true">{POWER_ICON[k]}</i>{Math.ceil(run.power[k])}</span>)}
        {run.config.overdrive ? <span className={run.rainCool > 0 ? '' : 'is-ready'} title="Tomato rain">☂{run.rainCool > 0 ? Math.ceil(run.rainCool) : 'E'}</span> : null}
      </div> : null}
    </div>
  </div>;
}

export const tomatinaSpec: PremiumGameSpec<TomatinaRun> = {
  id: 'tomatina', title: 'TOMATINA', eyebrow: 'PAINT THE TOWN RED', description: 'A first-person tomato fight in the streets of a Spanish town: lob tomatoes at the cleaning robots, paint the plazas red and hit every bullseye across twelve streets.',
  instructions: 'Arrows or WASD walk and turn (on a tablet the pad walks and sidesteps). Drag to aim up, down and around. Tap or click anywhere (or press Space or THROW) to throw at the crosshair. E pours an unlocked tomato rain.', goal: 'Paint the town red.',
  width: 1280, height: 720, catalog: tomatinaCatalog,
  controls: [{ label: '◀ LEFT', action: 'left', hold: 'left' }, { label: '▲ GO', action: 'up', hold: 'up' }, { label: '▼ BACK', action: 'down', hold: 'down' }, { label: 'RIGHT ▶', action: 'right', hold: 'right' }, { label: 'THROW', action: 'primary', primary: true }, { label: 'RAIN · E', action: 'ability' }],
  create: checkpoint => new TomatinaRun(checkpoint), createView: (canvas, run) => new TomatinaView(canvas, run),
  objective: run => { const goals = run.goalProgress(); return { label: `STREET ${run.level} · ${run.levelName.toUpperCase()} · ${goals.map(g => `${GOAL_TEXT[g.kind]} ${g.value}/${g.count}${g.kind === 'zone' ? '%' : ''}`).join(' · ')}`, value: goals.reduce((sum, g) => sum + g.value / g.count, 0), max: goals.length }; },
  hud: run => <TomatinaHud run={run} />,
  invites: crierInvites,
  hints: [{ keys: '← → ↑ ↓', label: 'turn and walk' }, { keys: 'Drag', label: 'aim up, down and around' }, { keys: 'Click', label: 'throw at the crosshair' }, { keys: 'Space', label: 'throw too' }],
  touchHints: [{ keys: 'Pad', label: 'walk and sidestep' }, { keys: 'Drag', label: 'aim anywhere' }, { keys: 'Tap', label: 'throw at the crosshair' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.paintPercent}% RED`, caption: `${run.levelName} is painted!`, detail: `${run.score.toLocaleString()} points · ${run.tally.robots} robot${run.tally.robots === 1 ? '' : 's'} splatted · best combo ×${Math.max(1, run.best)}` }
    : { win: false, caption: 'Soaked!', detail: `${run.goalProgress().map(g => `${GOAL_TEXT[g.kind].toLowerCase()} ${g.value}/${g.count}${g.kind === 'zone' ? '%' : ''}`).join(' · ')} · ${THROWERS[run.config.characterStyle ?? 'original']?.name ?? 'You'} needs a dry shirt` },
  stages: run => Array.from({ length: Math.max(LEVELS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: levelName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function TomatinaScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={tomatinaSpec} />; }
