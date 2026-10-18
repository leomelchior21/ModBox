import { palette, roundRect, sprite, coverWash, type ArcadeArt, type ArcadeEffects } from '../premium-kit/visuals';
import { NAJA_SIZE, type NajaRun } from './run';
const C = 36, OFFSET = 36;
export function drawNaja(ctx: CanvasRenderingContext2D, run: NajaRun, art: ArcadeArt, fx: ArcadeEffects, reduced: boolean): void {
  const colors = palette(run.config.palette); ctx.fillStyle = '#0a241f'; ctx.fillRect(0, 0, 720, 720); coverWash(ctx, art, 720, 720, 0.19);
  roundRect(ctx, 24, 24, 672, 672, 18, '#12372bdd', '#c7aa6a');
  for (let y = 0; y < NAJA_SIZE; y++) for (let x = 0; x < NAJA_SIZE; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#20483a' : '#1a4035'; ctx.fillRect(OFFSET + x * C + 1, OFFSET + y * C + 1, C - 2, C - 2);
    if ((x * 13 + y * 7) % 11 === 0) { ctx.strokeStyle = '#6b997933'; ctx.beginPath(); ctx.moveTo(OFFSET + x * C + 7, OFFSET + y * C + 20); ctx.lineTo(OFFSET + x * C + 14, OFFSET + y * C + 14); ctx.lineTo(OFFSET + x * C + 16, OFFSET + y * C + 5); ctx.stroke(); }
  }
  ctx.strokeStyle = run.config.assist ? colors.accent : '#9e925b'; ctx.lineWidth = run.config.assist ? 5 : 2; ctx.strokeRect(35, 35, 650, 650);
  if (run.config.assist) { ctx.strokeStyle = '#abf0d8'; ctx.lineWidth = 3; ctx.setLineDash([12, 12]); ctx.strokeRect(30, 30, 660, 660); ctx.setLineDash([]); }
  for (const stone of run.obstacles) if (!sprite(ctx, art, 6, OFFSET + (stone.x + 0.5) * C, OFFSET + (stone.y + 0.5) * C, 36, 36)) roundRect(ctx, OFFSET + stone.x * C + 2, OFFSET + stone.y * C + 2, 32, 32, 6, '#626f50', '#afab77');
  const foodX = OFFSET + (run.food.x + 0.5) * C, foodY = OFFSET + (run.food.y + 0.5) * C, pulse = reduced ? 1 : 1 + Math.sin(fx.time * 4) * 0.08;
  ctx.shadowColor = run.crystal ? '#d9a0ff' : '#ffcf72'; ctx.shadowBlur = 18; if (!sprite(ctx, art, run.crystal ? 5 : 4, foodX, foodY, 35 * pulse, 35 * pulse)) { ctx.fillStyle = '#ffd66c'; ctx.beginPath(); ctx.arc(foodX, foodY, 13, 0, Math.PI * 2); ctx.fill(); } ctx.shadowBlur = 0;
  const alpha = Math.min(1, run.timer / run.interval), positions = run.body.map((t, i) => {
    const old = run.previousBody[i] ?? t, near = Math.abs(t.x - old.x) <= 1 && Math.abs(t.y - old.y) <= 1;
    return { x: OFFSET + ((near && !reduced ? old.x + (t.x - old.x) * alpha : t.x) + 0.5) * C, y: OFFSET + ((near && !reduced ? old.y + (t.y - old.y) * alpha : t.y) + 0.5) * C };
  });
  if (run.respawn > 0 && !reduced && Math.floor(fx.time * 8) % 2) ctx.globalAlpha = 0.4;
  for (let i = positions.length - 1; i >= 0; i--) {
    const p = positions[i];
    if (i < positions.length - 1) { const next = positions[i + 1]; if (Math.hypot(p.x - next.x, p.y - next.y) < C * 2) { ctx.strokeStyle = '#0b6d61'; ctx.lineWidth = 28; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(next.x, next.y); ctx.stroke(); ctx.strokeStyle = colors.accent; ctx.lineWidth = 17; ctx.stroke(); } }
    const radius = i === positions.length - 1 ? 9 : 14; const gradient = ctx.createRadialGradient(p.x - 4, p.y - 5, 1, p.x, p.y, radius); gradient.addColorStop(0, colors.accent); gradient.addColorStop(0.5, '#51b88e'); gradient.addColorStop(1, '#0f705e'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
    if (i > 0) { ctx.strokeStyle = '#e9d98b99'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 3); ctx.lineTo(p.x, p.y + 3); ctx.lineTo(p.x + 5, p.y - 3); ctx.stroke(); }
  }
  // Lay scales over the connecting strokes so each segment retains its detail.
  for (let i = 1; i < positions.length; i++) {
    const p = positions[i], previous = positions[i - 1]; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(previous.y - p.y, previous.x - p.x));
    ctx.strokeStyle = '#f2db926e'; ctx.lineWidth = 1.4;
    for (let x = -6; x <= 6; x += 6) { ctx.beginPath(); ctx.moveTo(x - 3, -8); ctx.lineTo(x + 1, 0); ctx.lineTo(x - 3, 8); ctx.stroke(); }
    ctx.restore();
  }
  const head = positions[0];
  if (head) {
    const index = run.direction === 'right' ? 1 : run.direction === 'left' ? 3 : 2, angle = run.direction === 'up' ? Math.PI : 0;
    sprite(ctx, art, index, head.x, head.y, 49, 49, angle);
    if (run.shield > 0) { ctx.strokeStyle = '#cdf5ff'; ctx.lineWidth = 3; ctx.shadowColor = '#78dbff'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(head.x, head.y, 29, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  for (let i = 0; i < 12; i++) { const x = 14 + (i * 71 % 700), y = 8 + (i * 119 % 700); ctx.fillStyle = '#c8e394aa'; ctx.beginPath(); ctx.arc(x, y, reduced ? 1 : 1.2 + Math.sin(fx.time * 2 + i) * 0.6, 0, Math.PI * 2); ctx.fill(); }
}
