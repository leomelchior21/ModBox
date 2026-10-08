import { cellKey, mazeLines, sameCell, type Cell, type Maze, type MazeLine } from './maze';
import type { NeonMazeRun } from './run';
import { SENTINEL_COLORS } from './sentinels';
export const MAZE_COLORS: Record<string, string> = { cyan: '#4feaff', violet: '#ae82ff', lime: '#caff52', amber: '#ffcb69' };
const lineCache = new WeakMap<Maze, MazeLine[]>();

/** The runner stays in view while the labyrinth rolls underneath at every screen size. */
export function mazeViewport(run: NeonMazeRun, width: number, height: number, reducedMotion: boolean) {
  const top = height < 350 ? 52 : 68, bottom = height < 350 ? 46 : 64;
  const viewWidth = Math.max(1, width - 24), viewHeight = Math.max(1, height - top - bottom);
  const cell = Math.max(12, Math.min(22, width / 24, viewHeight / 11));
  const player = reducedMotion ? run.player : run.playerPosition();
  const follow = (position: number, extent: number, viewport: number) => extent <= viewport
    ? (extent - viewport) / 2 : Math.max(0, Math.min(extent - viewport, position - viewport / 2));
  return { cell, viewWidth, viewHeight, ox: 12, oy: top, player,
    scrollX: follow((player.x + 0.5) * cell, run.maze.size * cell, viewWidth),
    scrollY: follow((player.y + 0.5) * cell, run.maze.tiles.length * cell, viewHeight) };
}

export function drawMaze(ctx: CanvasRenderingContext2D, run: NeonMazeRun, width: number, height: number, time: number, reducedMotion: boolean): void {
  ctx.fillStyle = '#030d17'; ctx.fillRect(0, 0, width, height);
  const color = MAZE_COLORS[run.config.wallColor] ?? MAZE_COLORS.cyan;
  const { cell, viewWidth, viewHeight, ox, oy, player, scrollX, scrollY } = mazeViewport(run, width, height, reducedMotion);
  const center = (position: Cell) => ({ x: (position.x + 0.5) * cell, y: (position.y + 0.5) * cell });
  const lines = lineCache.get(run.maze) ?? mazeLines(run.maze); lineCache.set(run.maze, lines);
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, viewWidth, viewHeight); ctx.clip(); ctx.translate(ox - scrollX, oy - scrollY);

  // A faint grid carries the motion, with open space between the laser boundaries.
  ctx.strokeStyle = '#112535'; ctx.lineWidth = 0.5;
  const minX = Math.floor(scrollX / cell), maxX = Math.ceil((scrollX + viewWidth) / cell);
  const minY = Math.floor(scrollY / cell), maxY = Math.ceil((scrollY + viewHeight) / cell);
  for (let x = minX; x <= maxX; x++) { ctx.beginPath(); ctx.moveTo(x * cell, scrollY); ctx.lineTo(x * cell, scrollY + viewHeight); ctx.stroke(); }
  for (let y = minY; y <= maxY; y++) { ctx.beginPath(); ctx.moveTo(scrollX, y * cell); ctx.lineTo(scrollX + viewWidth, y * cell); ctx.stroke(); }
  ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = color;
  for (const line of lines) {
    if (line.to.x < minX || line.from.x > maxX || line.to.y < minY || line.from.y > maxY) continue;
    const nearby = Math.abs((line.from.x + line.to.x) / 2 - player.x) + Math.abs((line.from.y + line.to.y) / 2 - player.y) < 8;
    ctx.globalAlpha = run.config.revealMap || nearby ? 0.95 : 0.3;
    ctx.shadowBlur = reducedMotion ? 1 : 5;
    ctx.beginPath(); ctx.moveTo(line.from.x * cell, line.from.y * cell); ctx.lineTo(line.to.x * cell, line.to.y * cell); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  ctx.fillStyle = '#b0f5ea';
  for (const key of run.dots) {
    if (run.collectedDots.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    const p = center({ x, y }); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.1, cell * 0.065), 0, Math.PI * 2); ctx.fill();
  }
  if (run.config.trail && run.trail.length) {
    ctx.strokeStyle = color; ctx.lineWidth = cell * 0.1;
    run.trail.forEach((position, i) => {
      if (!i) return;
      const a = center(run.trail[i - 1]), b = center(position);
      if (Math.abs(position.x - run.trail[i - 1].x) + Math.abs(position.y - run.trail[i - 1].y) > 1) return;
      ctx.globalAlpha = i / run.trail.length * 0.4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
  const gate = center(run.maze.exit), open = run.collected.size === 3;
  ctx.strokeStyle = open ? '#caff52' : '#708ba6'; ctx.lineWidth = 2;
  ctx.shadowColor = '#caff52'; ctx.shadowBlur = open ? 14 : 0;
  ctx.beginPath(); ctx.arc(gate.x, gate.y, cell * 0.36, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `700 ${cell * 0.45}px monospace`; ctx.textAlign = 'center'; ctx.fillStyle = open ? '#caff52' : '#9bb1ca'; ctx.fillText('↗', gate.x, gate.y + cell * 0.15);
  for (const core of run.maze.cores) {
    if (run.collected.has(cellKey(core))) continue;
    const p = center(core), pulse = reducedMotion ? 1 : 1 + Math.sin(time * 3 + core.x) * 0.08;
    ctx.fillStyle = '#ffe3a0'; ctx.shadowColor = '#ffb84f'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - cell * 0.25 * pulse); ctx.lineTo(p.x + cell * 0.21 * pulse, p.y);
    ctx.lineTo(p.x, p.y + cell * 0.25 * pulse); ctx.lineTo(p.x - cell * 0.21 * pulse, p.y); ctx.closePath(); ctx.fill();
  }
  const stunned = run.stunRemaining > 0;
  const sentinelPositions = run.sentinelPositions();
  for (const [i, sentinel] of run.sentinels.entries()) {
    const p = center(reducedMotion ? sentinel : sentinelPositions[i]);
    ctx.fillStyle = stunned ? '#a5dde7' : SENTINEL_COLORS[i % SENTINEL_COLORS.length]; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = stunned ? 5 : 12;
    ctx.globalAlpha = stunned && run.stunRemaining < 1.5 && !reducedMotion ? 0.65 + Math.sin(time * 12) * 0.2 : 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - cell * 0.3); ctx.lineTo(p.x + cell * 0.27, p.y); ctx.lineTo(p.x, p.y + cell * 0.3); ctx.lineTo(p.x - cell * 0.27, p.y); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#142b36'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - cell * 0.13, p.y - cell * 0.04); ctx.lineTo(p.x - cell * 0.04, p.y - cell * 0.04);
    ctx.moveTo(p.x + cell * 0.04, p.y - cell * 0.04); ctx.lineTo(p.x + cell * 0.13, p.y - cell * 0.04); ctx.stroke();
    if (stunned) { ctx.strokeStyle = '#9defff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.42, 0, Math.PI * 2); ctx.stroke(); }
  }
  const p = center(player);
  ctx.globalAlpha = !reducedMotion && run.invulnerable > 0 && Math.sin(time * 15) < 0 ? 0.65 : 1;
  const orb = ctx.createRadialGradient(p.x - cell * 0.09, p.y - cell * 0.11, 0, p.x, p.y, cell * 0.29);
  orb.addColorStop(0, '#ffffff'); orb.addColorStop(0.45, '#e7fff8'); orb.addColorStop(1, color);
  ctx.fillStyle = orb; ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.29, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.rotate(reducedMotion ? 0 : (run.metrics.steps - 1 + Math.min(1, run.moveAge * (run.config.moveSpeed + 1))) * 0.8);
  ctx.strokeStyle = '#163946'; ctx.globalAlpha *= 0.65; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.12, cell * 0.27, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  if (run.config.shield && run.shieldCooldown <= 0) { ctx.strokeStyle = '#caff52'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.43, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore();

  // Keep distant objectives findable while the world scrolls off screen.
  ctx.font = `${width < 400 ? 9 : 11}px monospace`; ctx.fillStyle = '#9ac1d4'; ctx.textAlign = 'center';
  const nearest = open ? run.maze.exit : run.maze.cores.filter(core => !run.collected.has(cellKey(core)))
    .sort((a, b) => Math.abs(a.x - run.player.x) + Math.abs(a.y - run.player.y) - Math.abs(b.x - run.player.x) - Math.abs(b.y - run.player.y))[0];
  const direction = nearest ? `${nearest.y < run.player.y ? '↑' : nearest.y > run.player.y ? '↓' : ''}${nearest.x < run.player.x ? '←' : nearest.x > run.player.x ? '→' : ''}` : '';
  ctx.fillText(`${open ? 'EXIT' : 'GEM'} ${direction} · ${run.collected.size}/3 · DOTS ${run.collectedDots.size}`, width / 2, oy + (width < 400 ? 36 : 60));

  if (run.config.revealMap && width > 440 && viewHeight > 150) {
    const scale = Math.min(70 / run.maze.size, 110 / run.maze.tiles.length), x = width - run.maze.size * scale - 20, y = oy + 8;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#03121eec'; ctx.fillRect(-5, -5, run.maze.size * scale + 10, run.maze.tiles.length * scale + 10);
    ctx.strokeStyle = color; ctx.lineWidth = 0.7;
    for (const line of lines) { ctx.beginPath(); ctx.moveTo(line.from.x * scale, line.from.y * scale); ctx.lineTo(line.to.x * scale, line.to.y * scale); ctx.stroke(); }
    for (const core of run.maze.cores) if (!run.collected.has(cellKey(core))) { ctx.fillStyle = '#ffe3a0'; ctx.fillRect(core.x * scale, core.y * scale, 3, 3); }
    ctx.fillStyle = open ? '#caff52' : '#708ba6'; ctx.fillRect(run.maze.exit.x * scale, run.maze.exit.y * scale, 3, 3);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((player.x + 0.5) * scale, (player.y + 0.5) * scale, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (sameCell(run.player, run.maze.start) && run.metrics.steps === 0) { ctx.fillStyle = '#d5ecff'; ctx.fillText('YOU', width / 2, oy + viewHeight / 2 - cell * 0.5); }
}
