import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { anominersCatalog } from './catalog';
import { AnominersRun, ASTEROIDS, asteroidName, EMPTY, COPPER, CRYSTAL, GOLD, ICE, TECH } from './run';
import { SECTORS, SECTOR_ORDER, SHIPS } from './worlds';
import { AnominersView } from './view';
import './anominers.css';

/**
 * CORA, the base's old mining AI, keeps you company: help after a wreck, a dare after a warp, and a quick idea
 * when a run is going badly.
 */
function coraInvites(run: AnominersRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(run.cargo >= run.hold && Math.hypot(run.x - run.baseX, run.y - run.baseY) > 25 && (c.ammo ?? 30) < 60, { id: 'ano-hold-live', icon: '▣', title: 'Your hold is full, miner', reason: 'A bigger cargo hold means fewer trips home.', code: 'int cargoHold = 60;', tone: 'help' });
    add(run.glitches.length >= 3 && (c.bounces ?? 1) < 3, { id: 'ano-blaster-live', icon: '✸', title: 'Anomalites everywhere!', reason: 'Blaster level 3 fires a spread of three shots.', code: 'int blasterLevel = 3;', tone: 'help' });
    add(!run.rift && run.anomalyClock > 0 && run.anomalyClock < 40 && run.bank < run.ast.quota / 2 && c.power < 6, { id: 'ano-drill-live', icon: '⌁', title: 'The anomaly is coming', reason: 'A stronger drill mines twice as fast.', code: 'int drillPower = 6;', tone: 'help' });
    add(run.hull < 40 && c.lives < 5, { id: 'ano-hulls-live', icon: '⛨', title: 'Hull is cracking', reason: 'Pack more spare hulls for the trip.', code: 'int spareHulls = 5;', tone: 'help' });
    add(run.elapsed > 45 && !c.assist, { id: 'ano-magnet-live', icon: '◎', title: 'Minerals are drifting away', reason: 'The ore magnet pulls them in from far away.', code: 'bool magnet = true;', tone: 'style' });
    return out;
  }
  if (moment === 'lose') {
    add(c.lives < 5, { id: 'ano-hulls', icon: '⛨', title: 'More spare hulls', reason: 'Five ships in the hangar instead of three.', code: 'int spareHulls = 5;', tone: 'help' });
    add((c.difficulty ?? 'normal') !== 'sleepy', { id: 'ano-sleepy', icon: '😴', title: 'A sleepy anomaly', reason: 'It wakes later, hunts slower and sends fewer anomalites.', code: 'string anomalyMood = "sleepy";', tone: 'help' });
    add((c.bounces ?? 1) < 3, { id: 'ano-blaster', icon: '✸', title: 'Upgrade the blaster', reason: 'Stronger shots, in a spread of three.', code: 'int blasterLevel = 3;', tone: 'help' });
    add((c.teammates ?? 0) < 2, { id: 'ano-crew', icon: '⊙', title: 'Bring a drone crew', reason: 'Two drones mine for you from the start.', code: 'int droneCrew = 2;', tone: 'help' });
    add(c.power < 6, { id: 'ano-drill', icon: '⌁', title: 'A stronger drill', reason: 'Mine faster, before the anomaly wakes.', code: 'int drillPower = 6;', tone: 'help' });
    return out;
  }
  const next = SECTOR_ORDER[(SECTOR_ORDER.indexOf(c.worldTheme ?? 'classic') + 1) % SECTOR_ORDER.length];
  add(true, { id: `ano-sector-${next}`, icon: '✦', title: `Next stop: ${SECTORS[next].name}`, reason: next === 'ice' ? 'Your ship drifts on the ice fields. Careful!' : 'A new corner of the galaxy to mine.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add((c.difficulty ?? 'normal') !== 'furious', { id: 'ano-furious', icon: '🔥', title: 'Wake a furious anomaly', reason: 'It wakes early and hunts hard. Can you still warp out?', code: 'string anomalyMood = "furious";', tone: 'challenge' });
  add((c.weather ?? 'clear') === 'clear', { id: 'ano-meteors', icon: '☄', title: 'Mine in a meteor shower', reason: 'Meteors crater the rock and shake minerals loose. They hurt, too.', code: 'string weather = "meteors";', tone: 'challenge' });
  add(!c.overdrive, { id: 'ano-dronebay', icon: '⊙', title: 'Open the drone bay', reason: 'Press E to build mining drones from your cargo.', code: 'bool droneBay = true;', tone: 'style' });
  add((c.rivals ?? 0) < 3, { id: 'ano-swarm', icon: '◌', title: 'A bigger swarm', reason: 'Three more anomalites in every wave.', code: 'int anomalies = 3;', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'ano-whale', icon: '🐋', title: 'Fly the cargo whale', reason: 'A big, friendly mining ship.', code: 'string characterStyle = "whale";', tone: 'style' });
  return out;
}

/** The scanner's map: rock, minerals, lost tech, the rift, your base and you. */
function Scanner({ run }: { run: AnominersRun }) {
  const ref = useRef<HTMLCanvasElement>(null), sec = SECTORS[run.config.worldTheme ?? 'classic'] ?? SECTORS.classic;
  useEffect(() => {
    const g = ref.current?.getContext('2d'); if (!g) return; const w = Math.ceil(run.w / 2), h = Math.ceil(run.h / 2); if (ref.current!.width !== w) { ref.current!.width = w; ref.current!.height = h; }
    g.fillStyle = sec.space; g.fillRect(0, 0, w, h);
    for (let y = 0; y < run.h; y += 2) for (let x = 0; x < run.w; x += 2) { const k = run.grid[y * run.w + x]; if (k === EMPTY) continue; g.fillStyle = k === TECH ? sec.danger : k === COPPER || k === CRYSTAL || k === GOLD || k === ICE ? sec.ink : sec.rock; g.fillRect(x / 2, y / 2, 1, 1); }
    g.fillStyle = sec.ink; g.fillRect(Math.floor(run.baseX / 2) - 1, Math.floor(run.baseY / 2) - 1, 3, 3); g.fillStyle = '#ffffff'; g.fillRect(Math.floor(run.x / 2), Math.floor(run.y / 2), 2, 2);
    if (run.rift) { g.fillStyle = sec.danger; g.fillRect(Math.floor(run.rift.x / 2) - 1, Math.floor(run.rift.y / 2) - 1, 3, 3); }
  });
  return <canvas ref={ref} className="ano__map" aria-label="Scanner map" />;
}
function Goals({ run }: { run: AnominersRun }) {
  const text = { bank: (n: number) => `Bank ${n} minerals at your base`, tech: (n: number) => `Recover ${n} lost technolog${n === 1 ? 'y' : 'ies'}`, core: () => 'Destroy the anomaly core' };
  return <ul className="ano__goals" aria-label="Goals">
    {run.goalProgress().map(g => { const done = g.value >= g.count; return <li key={g.kind} className={done ? 'is-done' : ''}><i aria-hidden="true">{done ? '✓' : ''}</i><span>{text[g.kind](g.count)}</span>{g.kind !== 'core' ? <b>{g.value}/{g.count}</b> : null}</li>; })}
    <li className={run.ready ? '' : 'is-waiting'}><i aria-hidden="true" /><span>{run.ready ? 'Dock at the base to warp' : 'Then dock at the base to warp'}</span></li>
  </ul>;
}
const bar = (value: number, max: number, cells = 10) => '▮'.repeat(Math.round(value / max * cells)).padEnd(cells, '▯');
function AnominersHud({ run }: { run: AnominersRun }) {
  const sec = SECTORS[run.config.worldTheme ?? 'classic'] ?? SECTORS.classic, hud = useRef<HTMLDivElement>(null), playing = run.phase === 'playing';
  useEffect(() => { const stage = hud.current?.closest<HTMLElement>('.premium-stage'); if (!stage) return; for (const [k, v] of [['--ano-space', sec.space], ['--ano-ink', sec.ink], ['--ano-danger', sec.danger], ['--ano-rock', sec.rock]]) stage.style.setProperty(k, v); }, [sec]);
  const home = run.cargo >= run.hold || run.ready, turn = Math.atan2(run.baseY - run.y, run.baseX - run.x), dist = Math.round(Math.hypot(run.baseX - run.x, run.baseY - run.y));
  const clock = run.anomalyClock > 0 ? `${Math.floor(run.anomalyClock / 60)}:${String(Math.floor(run.anomalyClock % 60)).padStart(2, '0')}` : '';
  return <div className="ano__hud" ref={hud} style={{ '--ano-space': sec.space, '--ano-ink': sec.ink, '--ano-danger': sec.danger } as CSSProperties}>
    {playing && run.briefing > 0 ? <div className="ano__brief" style={{ opacity: Math.min(1, run.briefing / .5) }}><small>ASTEROID {String(run.level).padStart(2, '0')}</small><h2>{run.levelName}</h2><Goals run={run} /><p>{run.ast.tip}</p></div> : playing ? <Goals run={run} /> : null}
    {playing && run.display.timer > 0 && run.briefing <= 0 ? <div key={run.display.text} className="ano__call">{run.display.text}</div> : null}
    {playing ? <div className={`ano__threat${run.rift ? ' is-awake' : run.anomalyClock && run.anomalyClock < 15 ? ' is-near' : ''}`}>{run.rift ? <>ANOMALY · THREAT {run.ast.threat}{run.glitches.length ? ` · ${run.glitches.length} ◌` : ''}</> : run.contained ? 'ANOMALY CONTAINED' : clock ? <>ANOMALY IN {clock}</> : 'ALL QUIET'}</div> : null}
    {playing && home && dist > 6 ? <div className="ano__home"><b style={{ transform: `rotate(${turn}rad)` }} aria-hidden="true">➜</b>{run.ready ? 'WARP' : 'BASE'} {dist}</div> : null}
    {playing && run.ready && run.warp > 0 ? <div className="ano__warp">WARPING {bar(run.warp, 2.5, 8)}</div> : null}
    <div className="ano__bar" role="group" aria-label="Ship status">
      <div><small>CARGO</small><strong className={run.cargo >= run.hold ? 'is-full' : ''}>{run.cargo}<em>/{run.hold}</em></strong></div>
      <div><small>HULL</small><strong className={run.hull < 35 ? 'is-low' : ''}>{bar(run.hull, 100, 6)}</strong></div>
      <div><small>BANK</small><strong>{run.bank}{run.ast.quota ? <em>/{run.ast.quota}</em> : null}</strong></div>
      {run.drones.length ? <div><small>DRONES</small><strong>{'⊙'.repeat(run.drones.length)}</strong></div> : null}
      <div><small>HULLS</small><strong>{'▲'.repeat(Math.min(9, run.lives))}</strong></div>
    </div>
    {playing && run.config.revealMap ? <Scanner run={run} /> : null}
  </div>;
}

export const anominersSpec: PremiumGameSpec<AnominersRun> = {
  id: 'anominers', title: 'ANOMINERS', eyebrow: 'MINE · BANK · WARP', description: 'A cozy asteroid-mining roguelike: drill procedural asteroids, bank minerals at your base, build drones and decide whether to fight the anomaly or warp away.',
  instructions: 'Arrows or WASD fly (or hold the mouse or a finger where you want to go). Your drill beam mines whatever is in front of you. Space blasts anomalites; E builds a drone when the drone bay is on. Bank your minerals at the base, then dock to warp.', goal: 'Mine. Bank. Warp.',
  width: 1280, height: 720, catalog: anominersCatalog,
  controls: [{ label: '◀ LEFT', action: 'left', hold: 'left' }, { label: '▲ UP', action: 'up', hold: 'up' }, { label: '▼ DOWN', action: 'down', hold: 'down' }, { label: 'RIGHT ▶', action: 'right', hold: 'right' }, { label: 'BLAST', action: 'primary', primary: true }, { label: 'DRONE · E', action: 'ability' }],
  create: checkpoint => new AnominersRun(checkpoint), createView: (canvas, run) => new AnominersView(canvas, run),
  objective: run => { const g = run.goalProgress()[0]; return { label: `ASTEROID ${run.level} · ${run.levelName.toUpperCase()}`, value: g ? g.value : 1, max: g ? g.count : 1 }; },
  hud: run => <AnominersHud run={run} />,
  invites: coraInvites,
  hints: [{ keys: '← → ↑ ↓', label: 'fly (the beam mines ahead)' }, { keys: 'Mouse', label: 'hold to fly there' }, { keys: 'Space', label: 'blast anomalites' }, { keys: 'Base', label: 'bank minerals, then warp' }],
  touchHints: [{ keys: 'Hold', label: 'fly toward your finger' }, { keys: 'Tap', label: 'blast' }, { keys: 'Base', label: 'bank minerals, then warp' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `${run.bank} BANKED`, caption: `${run.levelName} mined!`, detail: `${run.score.toLocaleString()} points${run.contained ? ' · anomaly contained' : ''}${run.techTotal ? ` · ${run.techFound} lost tech` : ''} · ${SHIPS[run.config.characterStyle ?? 'original'] ?? 'Ship'} ${run.config.playerName}` }
    : { win: false, caption: 'Out of hulls!', detail: `banked ${run.bank}${run.ast.quota ? `/${run.ast.quota}` : ''} · bank often, and blast the anomalites before they reach you` },
  stages: run => Array.from({ length: Math.max(ASTEROIDS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: asteroidName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function AnominersScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={anominersSpec} />; }
