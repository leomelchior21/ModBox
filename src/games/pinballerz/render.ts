import { palette, roundRect, sprite, type ArcadeArt, type ArcadeEffects } from '../premium-kit/visuals';
import { PIN_RAILS, type PinballRun } from './run';
export function drawPinball(ctx: CanvasRenderingContext2D, run: PinballRun, art: ArcadeArt, _fx: ArcadeEffects, reduced: boolean): void {
  const colors = palette(run.config.palette); ctx.fillStyle = '#101125'; ctx.fillRect(0, 0, 640, 920);
  const bed = ctx.createLinearGradient(0, 0, 640, 920); bed.addColorStop(0, '#352548'); bed.addColorStop(0.5, '#151c37'); bed.addColorStop(1, '#322047');
  roundRect(ctx, 20, 25, 600, 880, 45, '#171b2b', '#b7aa88'); roundRect(ctx, 35, 40, 570, 865, 36, bed, '#c7a96d');
  ctx.save(); ctx.beginPath(); ctx.roundRect(44, 50, 550, 840, 30); ctx.clip(); ctx.globalAlpha = 0.2; if (art.background.naturalWidth) ctx.drawImage(art.background, -300, 0, 1200, 920); ctx.restore();
  for (let i = 0; i < 13; i++) { ctx.strokeStyle = i % 2 ? '#73d8ff0e' : '#ff93cb13'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, 80 + i * 65); ctx.lineTo(560, 180 + i * 65); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#d4c5ec'; ctx.font = 'bold 19px monospace'; ctx.fillText('MIDNIGHT CIRCUIT', 305, 88);
  ctx.font = 'bold 27px monospace'; ctx.fillStyle = colors.warm; ctx.fillText(run.config.overdrive ? 'JACKPOT ×2' : 'LIGHT THE STARS', 305, 505);
  ctx.font = '14px monospace'; ctx.fillStyle = '#d3c8df'; ctx.fillText(`${Math.max(0, run.goal - (run.score - run.stageScore))} POINTS TO NEXT TABLE`, 305, 529);
  for (const [i, [x, y]] of [[145, 180], [305, 125], [465, 180]].entries()) {
    ctx.shadowBlur = run.targets[i] || run.targetFlash[i] > 0 ? 23 : 0; ctx.shadowColor = '#ffe797'; ctx.globalAlpha = run.targets[i] ? 1 : 0.65;
    if (!sprite(ctx, art, 6, x, y, 46, 46)) { ctx.fillStyle = colors.warm; ctx.font = '45px sans-serif'; ctx.fillText('★', x, y + 15); } ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  for (const [i, b] of run.bumpers.entries()) {
    const scale = reduced ? 1 : 1 + b.flash * 0.35; ctx.shadowColor = i === 1 ? '#ff83c6' : colors.accent; ctx.shadowBlur = b.flash > 0 ? 32 : 12;
    if (!sprite(ctx, art, i === 1 ? 2 : 1, b.x, b.y, (b.radius * 2 + 12) * scale, (b.radius * 2 + 12) * scale)) { ctx.fillStyle = colors.accent; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0; if (b.flash > 0) { ctx.strokeStyle = '#ffffd7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 6 + (reduced ? 0 : (0.25 - b.flash) * 80), 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const [ax, ay, bx, by] of PIN_RAILS) {
    ctx.lineCap = 'round'; ctx.strokeStyle = '#080f20'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#c4c5d5'; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = ax > 90 && ay > 500 && ay < 700 ? colors.warm : colors.accent; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = colors.accent; ctx.stroke(); ctx.shadowBlur = 0;
  }
  for (const f of run.flippers) {
    const ex = f.x + Math.cos(f.angle) * 128, ey = f.y + Math.sin(f.angle) * 128;
    ctx.lineCap = 'round'; ctx.lineWidth = 33; ctx.strokeStyle = '#d6bed0'; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineWidth = 26; ctx.strokeStyle = '#f46d9a'; ctx.shadowColor = colors.warm; ctx.shadowBlur = Math.abs(f.omega) > 1 ? 20 : 5; ctx.stroke(); ctx.shadowBlur = 0;
    sprite(ctx, art, f.left ? 4 : 5, (f.x + ex) / 2, (f.y + ey) / 2, 150, 38, f.left ? f.angle : f.angle - Math.PI);
    ctx.fillStyle = '#ffe0a6'; ctx.beginPath(); ctx.arc(f.x, f.y, 10, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt'; ctx.strokeStyle = '#73708f'; ctx.lineWidth = 5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(541, 860 + i * 7); ctx.lineTo(580, 860 + i * 7); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.font = 'bold 15px monospace'; ctx.fillStyle = run.saveTimer > 0 && !run.saveUsed ? colors.accent : '#676078'; ctx.fillText('BALL SAVE', 310, 850);
  ctx.fillStyle = '#5b405d'; ctx.fillRect(230, 886, 160, 10); ctx.fillStyle = '#ff95bb'; ctx.fillRect(230, 886, 160 * (run.nudges / 3), 10);
  const b = run.ball;
  if (!reduced && !run.waiting) for (const [i, p] of b.trail.entries()) { ctx.globalAlpha = i / b.trail.length * 0.33; ctx.fillStyle = colors.accent; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + i / b.trail.length * 7, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
  ctx.shadowColor = colors.accent; ctx.shadowBlur = 13;
  if (!sprite(ctx, art, 0, b.x, b.y, 29, 29)) { const g = ctx.createRadialGradient(b.x - 4, b.y - 5, 1, b.x, b.y, 13); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#d3def2'); g.addColorStop(1, '#344356'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, Math.PI * 2); ctx.fill(); } ctx.shadowBlur = 0;
  if (run.waiting) { ctx.fillStyle = colors.accent; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText('PRESS LAUNCH', 310, 715); }
}
