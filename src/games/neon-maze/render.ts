import { cellKey, sameCell, type Cell } from './maze';
import type { NeonMazeRun } from './run';
export const MAZE_COLORS: Record<string, string> = { cyan: '#4feaff', violet: '#ae82ff', lime: '#caff52', amber: '#ffcb69' };

export function drawMaze(ctx: CanvasRenderingContext2D, run: NeonMazeRun, width: number, height: number, time: number, reducedMotion: boolean): void {
  ctx.fillStyle = '#050b19'; ctx.fillRect(0, 0, width, height);
  const color = MAZE_COLORS[run.config.wallColor] ?? MAZE_COLORS.cyan;
  const top = height < 350 ? 54 : 70, bottom = height < 350 ? 73 : 100;
  const availableHeight = Math.max(30, height - top - bottom);
  const fitted = Math.min((width - 28) / run.maze.size, availableHeight / run.maze.size);
  // Compact phones follow the runner instead of shrinking every core to a dot.
  const cell = Math.max(14, fitted), board = cell * run.maze.size;
  const viewWidth = Math.min(width - 28, board), viewHeight = Math.min(availableHeight, board);
  const blend = reducedMotion ? 1 : Math.min(1, run.moveAge / 0.09);
  const playerCell = { x: run.playerFrom.x + (run.player.x - run.playerFrom.x) * blend, y: run.playerFrom.y + (run.player.y - run.playerFrom.y) * blend };
  const scrollX = Math.max(0, Math.min(board - viewWidth, (playerCell.x + 0.5) * cell - viewWidth / 2));
  const scrollY = Math.max(0, Math.min(board - viewHeight, (playerCell.y + 0.5) * cell - viewHeight / 2));
  const ox = (width - viewWidth) / 2, oy = top + Math.max(0, (availableHeight - viewHeight) / 2);
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, viewWidth, viewHeight); ctx.clip(); ctx.translate(ox - scrollX, oy - scrollY);
  // Quiet circuit grid behind the bright, carved corridors.
  ctx.strokeStyle = '#102339'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= run.maze.size; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, board); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(board, i * cell); ctx.stroke();
  }
  for (let y = 0; y < run.maze.size; y++) for (let x = 0; x < run.maze.size; x++) {
    const seen = run.config.revealMap || run.visited.has(`${x},${y}`);
    if (run.maze.tiles[y][x]) {
      ctx.fillStyle = seen ? '#101d32' : '#090f21'; ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2); continue;
    }
    ctx.globalAlpha = seen ? 0.85 : 0.24;
    ctx.fillStyle = '#12243a'; ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.shadowColor = color; ctx.shadowBlur = reducedMotion ? 2 : 5;
    ctx.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (run.config.trail) run.trail.forEach((position, i) => {
    ctx.globalAlpha = (i + 1) / run.trail.length * 0.35; ctx.fillStyle = color;
    ctx.fillRect((position.x + 0.38) * cell, (position.y + 0.38) * cell, cell * 0.24, cell * 0.24);
  });
  ctx.globalAlpha = 1;
  const center = (position: Cell) => ({ x: (position.x + 0.5) * cell, y: (position.y + 0.5) * cell });
  const gate = center(run.maze.exit), open = run.collected.size === 3;
  ctx.strokeStyle = open ? '#caff52' : '#708ba6'; ctx.fillStyle = open ? '#caff5228' : '#203244';
  ctx.shadowColor = '#caff52'; ctx.shadowBlur = open ? 14 : 0;
  ctx.fillRect(gate.x - cell * 0.35, gate.y - cell * 0.35, cell * 0.7, cell * 0.7);
  ctx.strokeRect(gate.x - cell * 0.35, gate.y - cell * 0.35, cell * 0.7, cell * 0.7);
  ctx.font = `700 ${Math.max(7, cell * 0.45)}px monospace`; ctx.textAlign = 'center'; ctx.fillStyle = open ? '#caff52' : '#9bb1ca'; ctx.fillText('↗', gate.x, gate.y + cell * 0.15);
  for (const core of run.maze.cores) {
    if (run.collected.has(cellKey(core))) continue;
    const p = center(core), pulse = reducedMotion ? 1 : 1 + Math.sin(time * 3 + core.x) * 0.1;
    ctx.fillStyle = '#ffe3a0'; ctx.shadowColor = '#ffb84f'; ctx.shadowBlur = 13;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - cell * 0.24 * pulse); ctx.lineTo(p.x + cell * 0.2 * pulse, p.y);
    ctx.lineTo(p.x, p.y + cell * 0.24 * pulse); ctx.lineTo(p.x - cell * 0.2 * pulse, p.y); ctx.closePath(); ctx.fill();
  }
  for (const sentinel of run.sentinels) {
    const p = center(sentinel); ctx.fillStyle = '#ff5b9d'; ctx.shadowColor = '#ff3c89'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - cell * 0.33); ctx.lineTo(p.x + cell * 0.3, p.y); ctx.lineTo(p.x, p.y + cell * 0.33); ctx.lineTo(p.x - cell * 0.3, p.y); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#200f28'; ctx.fillRect(p.x - cell * 0.13, p.y - cell * 0.07, cell * 0.08, cell * 0.1); ctx.fillRect(p.x + cell * 0.05, p.y - cell * 0.07, cell * 0.08, cell * 0.1);
  }
  const p = center(playerCell);
  ctx.globalAlpha = !reducedMotion && run.invulnerable > 0 && Math.sin(time * 15) < 0 ? 0.6 : 1;
  ctx.fillStyle = '#f0fff4'; ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.23, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.34, 0, Math.PI * 2); ctx.stroke();
  if (run.config.shield && run.shieldCooldown <= 0) { ctx.strokeStyle = '#caff52'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.restore();
  // A little directional readout keeps the exit findable on compact screens.
  ctx.font = '10px monospace'; ctx.fillStyle = '#7d9ab7'; ctx.textAlign = 'center';
  const nearest = open ? run.maze.exit : run.maze.cores.filter(core => !run.collected.has(cellKey(core)))
    .sort((a, b) => Math.abs(a.x - run.player.x) + Math.abs(a.y - run.player.y) - Math.abs(b.x - run.player.x) - Math.abs(b.y - run.player.y))[0];
  const direction = nearest ? `${nearest.y < run.player.y ? '↑' : nearest.y > run.player.y ? '↓' : ''}${nearest.x < run.player.x ? '←' : nearest.x > run.player.x ? '→' : ''}` : '';
  ctx.fillText(fitted < 14 || width < 500 ? `${open ? 'EXIT' : 'CORE'} ${direction} · ${run.collected.size}/3 LINKED` : open ? 'EXIT ONLINE · FOLLOW THE GREEN GATE' : 'LINK THE 3 AMBER CORES · UNLOCK THE EXIT', width / 2, oy + viewHeight + 17);
  if (sameCell(run.player, run.maze.start) && run.metrics.steps === 0) {
    ctx.fillStyle = '#d5ecff'; ctx.fillText('YOU', ox + (run.player.x + 0.5) * cell - scrollX, oy + run.player.y * cell - scrollY - 4);
  }
}
