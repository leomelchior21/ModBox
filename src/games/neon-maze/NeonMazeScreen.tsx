import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import type { InviteMoment, ModInvite } from '../premium-kit/invites';
import { mazeCatalog } from './catalog';
import { NeonMazeRun, SECTORS, sectorName } from './run';
import { GRIDS, GRID_ORDER, WALL_COLORS, RUNNERS } from './worlds';
import { NeonMazeView } from './view';
import '../three-kit/world.css';
import './neon-maze.css';

/**
 * The SIGNAL OPERATOR talks the runner through the grid: help after a crash, a dare after a clear,
 * and one quick tweak when a sector is going badly.
 */
function operatorInvites(run: NeonMazeRun, moment: InviteMoment): ModInvite[] {
  const c = run.config, out: ModInvite[] = [], add = (when: boolean, invite: ModInvite) => { if (when) out.push(invite); };
  if (moment === 'struggle') {
    add(run.lives < c.lives && !c.assist, { id: 'nm-shield-live', icon: '⬡', title: 'Signal lost! Raise a shield', reason: 'One sentinel hit is absorbed, then it recharges.', code: 'bool shield = true;', tone: 'help' });
    add(run.dark && !c.revealMap, { id: 'nm-lights-live', icon: '◉', title: 'It is dark in here', reason: 'ROOM LIGHTS shows the whole maze and a map.', code: 'bool revealMap = true;', tone: 'help' });
    add(run.elapsed > 40 && run.cores === 0 && c.power < 7, { id: 'nm-speed-live', icon: '»', title: 'Roll faster', reason: 'A quicker runner outpaces every hunter.', code: 'int moveSpeed = 7;', tone: 'help' });
    add(run.train >= 4 && (c.gemDuration ?? 6) < 9, { id: 'nm-stun-live', icon: '❄', title: `A train of ${run.train}!`, reason: 'A longer gem freeze gives you time to eat it all.', code: 'int gemDuration = 10;', tone: 'style' });
    return out;
  }
  if (moment === 'lose') {
    add(!c.assist, { id: 'nm-shield', icon: '⬡', title: 'Raise a shield', reason: 'One sentinel hit is absorbed, then it recharges.', code: 'bool shield = true;', tone: 'help' });
    add(c.speed > 1, { id: 'nm-slow', icon: '🐢', title: 'Slow the hunters', reason: 'They patrol at a gentle pace.', code: 'int sentinelSpeed = 1;', tone: 'help' });
    add((c.difficulty ?? 'normal') !== 'sleepy', { id: 'nm-sleepy', icon: '😴', title: 'Sleepy hunters', reason: 'They wander off and forget about you.', code: 'string sentinelBrain = "sleepy";', tone: 'help' });
    add(c.lives < 5, { id: 'nm-orbs', icon: '●', title: 'More spare orbs', reason: 'Five chances in every sector.', code: 'int spareOrbs = 5;', tone: 'help' });
    add(run.dark && !c.revealMap, { id: 'nm-lights', icon: '◉', title: 'Turn on the room lights', reason: 'See every corridor, even in a blackout.', code: 'bool revealMap = true;', tone: 'help' });
    add((c.gemDuration ?? 6) < 9, { id: 'nm-stun', icon: '❄', title: 'Longer gem freeze', reason: 'More time to catch the frozen sentinels.', code: 'int gemDuration = 10;', tone: 'help' });
    return out;
  }
  const next = GRID_ORDER[(GRID_ORDER.indexOf(c.worldTheme ?? 'classic') + 1) % GRID_ORDER.length];
  add((c.sleepers ?? 0) < 8, { id: 'nm-train', icon: '∴', title: 'Build a monster train', reason: 'Eight more sleeping drones to wake and devour.', code: 'int sleepers = 8;', tone: 'challenge' });
  add((c.difficulty ?? 'normal') !== 'genius', { id: 'nm-genius', icon: '🧠', title: 'Genius hunters', reason: 'They predict your route and never take a break.', code: 'string sentinelBrain = "genius";', tone: 'challenge' });
  add(true, { id: `nm-grid-${next}`, icon: '◈', title: `Rebuild as ${GRIDS[next].name}`, reason: 'A whole new look for the labyrinth.', code: `string worldTheme = "${next}";`, tone: 'style' });
  add((c.weather ?? 'clear') === 'clear', { id: 'nm-storm', icon: '⚡', title: 'Run it in a storm', reason: 'Darkness, with lightning to show the way.', code: 'string weather = "storm";', tone: 'challenge' });
  add((c.characterStyle ?? 'original') === 'original', { id: 'nm-chomper', icon: '◔', title: 'Roll as a chomper', reason: 'Hungry for dots.', code: 'string characterStyle = "chomper";', tone: 'style' });
  add((c.rivals ?? 0) < 2, { id: 'nm-squad', icon: '◇', title: 'Two more hunters', reason: 'A bigger squad on every sector.', code: 'int sentinels = 2;', tone: 'challenge' });
  return out;
}

/** A small map of the maze for ROOM LIGHTS. */
function MiniMap({ run }: { run: NeonMazeRun }) {
  const g = run.grid, path = useMemo(() => { let d = ''; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.open[y][x]) d += `M${x} ${y}h1v1h-1z`; return d; }, [g]), p = run.position;
  return <svg className="nm__map" viewBox={`-0.5 -0.5 ${g.w + 1} ${g.h + 1}`} aria-label="Maze map">
    <path d={path} />{g.gems.map((t, i) => run.gemsTaken[i] ? null : <rect key={i} className="nm__mapGem" x={t.x + .1} y={t.y + .1} width=".8" height=".8" />)}
    <rect className={`nm__mapExit${run.exitOpen ? ' is-open' : ''}`} x={g.exit.x} y={g.exit.y} width="1" height="1" />
    <circle className="nm__mapYou" cx={p.x + .5} cy={p.y + .5} r=".7" />
  </svg>;
}
function Goals({ run }: { run: NeonMazeRun }) {
  const goals = run.goalProgress();
  return <ul className="nm__goals" aria-label="Goals">{goals.map(g => {
    const done = g.value >= g.count, waiting = g.kind === 'exit' && !run.exitOpen;
    const text = g.kind === 'gems' ? `Collect ${g.count} amber gems` : g.kind === 'warden' ? 'Catch the frozen Warden 3 times' : run.exitOpen ? 'Roll into the exit portal' : 'Then roll into the exit portal';
    return <li key={g.kind} className={done ? 'is-done' : waiting ? 'is-waiting' : ''}><i aria-hidden="true">{done ? '✓' : ''}</i><span>{text}</span>{g.kind !== 'exit' ? <b>{g.value}/{g.count}</b> : null}</li>;
  })}</ul>;
}
function NeonHud({ run }: { run: NeonMazeRun }) {
  const theme = GRIDS[run.config.worldTheme ?? 'classic'] ?? GRIDS.classic, edge = run.config.wallColor && WALL_COLORS[run.config.wallColor] ? WALL_COLORS[run.config.wallColor] : theme.edge;
  const playing = run.phase === 'playing', flow = Math.floor(run.flow), hud = useRef<HTMLDivElement>(null);
  // The touch pads sit beside the HUD: give them the same neon.
  useEffect(() => { hud.current?.closest<HTMLElement>('.premium-stage')?.style.setProperty('--nm-edge', edge); }, [edge]);
  return <div className="nm__hud" ref={hud} style={{ '--nm-edge': edge } as CSSProperties}>
    {playing && run.briefing > 0 ? <div className="nm__brief" style={{ opacity: Math.min(1, run.briefing / .5) }}><small>SECTOR {String(run.level).padStart(2, '0')}</small><h2>{run.levelName}</h2><Goals run={run} /><p>{run.sector.tip}</p></div> : playing ? <Goals run={run} /> : null}
    {playing && run.display.timer > 0 && run.briefing <= 0 ? <div key={run.display.text} className="nm__call" style={{ opacity: Math.min(1, run.display.timer / .3) }}>{run.display.text}</div> : null}
    {playing ? <div className="nm__flow" aria-label={`Flow times ${flow}`}><small>FLOW</small><strong>×{flow}</strong><span><em style={{ width: `${(run.flow - 1) / 7 * 100}%` }} /></span></div> : null}
    {playing && run.stun > 0 ? <div className={`nm__frozen${run.stun < 2 ? ' is-ending' : ''}`}><b>❄</b>FROZEN {run.stun.toFixed(1)}s</div> : null}
    {playing && run.train > 0 ? <div className="nm__train">TRAIN <strong>×{run.train}</strong></div> : null}
    {playing ? <div className="nm__chips">
      <span className={run.dashCool > 0 ? '' : 'is-ready'}>↠ {run.dashCool > 0 ? run.dashCool.toFixed(1) : 'DASH'}</span>
      {run.config.overdrive ? <span className={run.warpCool > 0 ? '' : 'is-ready'}>◷ {run.warp > 0 ? 'WARP!' : run.warpCool > 0 ? Math.ceil(run.warpCool) : 'WARP · E'}</span> : null}
      {run.config.assist ? <span className={run.shieldCool > 0 ? '' : 'is-ready'}>⬡ {run.shieldCool > 0 ? Math.ceil(run.shieldCool) : 'SHIELD'}</span> : null}
      {run.signal.text ? <span>{run.signal.text}</span> : null}
    </div> : null}
    {playing && run.config.revealMap ? <MiniMap run={run} /> : null}
  </div>;
}

export const neonMazeSpec: PremiumGameSpec<NeonMazeRun> = {
  id: 'maze', title: 'NEON MAZE', eyebrow: 'ROLL · CHAIN · DEVOUR', description: 'A neon labyrinth chase: chain dots for FLOW, wake a ghost train of drones, freeze everything with amber gems and devour the whole train across twelve sectors.',
  instructions: 'Arrows or WASD steer (on a tablet, swipe or use the pad). Space dashes through walls; E fires an unlocked time warp. Three gems open the exit.', goal: 'Chain. Freeze. Devour.',
  width: 1280, height: 720, catalog: mazeCatalog,
  controls: [{ label: '◀ LEFT', action: 'left', hold: 'left' }, { label: '▲ UP', action: 'up', hold: 'up' }, { label: '▼ DOWN', action: 'down', hold: 'down' }, { label: 'RIGHT ▶', action: 'right', hold: 'right' }, { label: 'DASH', action: 'primary', primary: true }, { label: 'WARP · E', action: 'ability' }],
  create: checkpoint => new NeonMazeRun(checkpoint), createView: (canvas, run) => new NeonMazeView(canvas, run),
  objective: run => { const g = run.goalProgress()[0]; return { label: `SECTOR ${run.level} · ${run.levelName.toUpperCase()} · ${g.kind === 'warden' ? 'WARDEN' : 'GEMS'} ${g.value}/${g.count}`, value: g.value, max: g.count }; },
  hud: run => <NeonHud run={run} />,
  invites: operatorInvites,
  hints: [{ keys: '← → ↑ ↓', label: 'steer (turns are remembered)' }, { keys: 'Space', label: 'phase dash through a wall' }, { keys: 'Gem', label: 'freeze them, then catch them' }],
  touchHints: [{ keys: 'Swipe', label: 'steer' }, { keys: 'Tap', label: 'phase dash' }, { keys: 'Gem', label: 'freeze them, then catch them' }],
  result: run => run.phase === 'cleared'
    ? { win: true, headline: `×${Math.max(1, run.best)} CHAIN`, caption: `${run.levelName} cleared!`, detail: `${run.score.toLocaleString()} points · ${run.dotsEaten}/${run.dotsTotal} dots · ${RUNNERS[run.config.characterStyle ?? 'original'] ?? 'Runner'} ${run.config.playerName}` }
    : { win: false, caption: 'Signal lost!', detail: `${run.sector.warden ? `warden ${run.wardenCaught}/3` : `gems ${run.cores}/${run.gemsTaken.length}`} · ${run.dotsEaten} dots · grab a gem, then catch them` },
  stages: run => Array.from({ length: Math.max(SECTORS.length, run.frontier) }, (_, i) => i + 1).map(level => ({ level, name: sectorName(level), state: level < run.frontier || level === run.level && run.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' })),
};
export function NeonMazeScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={neonMazeSpec} />; }
