import { coverWash, palette, sprite, type ArcadeArt, type ArcadeEffects } from '../premium-kit/visuals';
import type { StackRun, StackSlab } from './run';
export function iso(x: number, z: number, layer: number, camera = 0) { return { x: 420 + (x - z) * 0.8, y: 635 + (x + z) * 0.4 - layer * 26 + camera }; }
const SLAB_COLORS = [ ['#c6b1ed', '#8d76bd', '#66568f'], ['#9df0d7', '#4eaaa5', '#30767c'], ['#ffc0ac', '#d37d79', '#945d6b'], ['#f2d594', '#b18e53', '#7c643c'] ];
function slab(ctx: CanvasRenderingContext2D, s: StackSlab, camera: number, art: ArcadeArt, fall = 0, alpha = 1): void {
  const a = iso(s.x, s.z, s.layer, camera), b = iso(s.x + s.w, s.z, s.layer, camera), c = iso(s.x + s.w, s.z + s.d, s.layer, camera), d = iso(s.x, s.z + s.d, s.layer, camera), colors = SLAB_COLORS[s.color % 4];
  const thickness = 24; for (const p of [a, b, c, d]) p.y += fall;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y + thickness); ctx.lineTo(d.x, d.y + thickness); ctx.closePath(); ctx.fillStyle = colors[1]; ctx.fill(); ctx.strokeStyle = '#eddfbd44'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y + thickness); ctx.lineTo(b.x, b.y + thickness); ctx.closePath(); ctx.fillStyle = colors[2]; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  const gradient = ctx.createLinearGradient(a.x, a.y, c.x, c.y); gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]); ctx.fillStyle = gradient; ctx.fill();
  ctx.save(); ctx.clip(); ctx.globalAlpha = alpha * 0.27; sprite(ctx, art, s.color % 4, (a.x + c.x) / 2, (a.y + c.y) / 2 + 12, Math.max(1, b.x - d.x) * 1.12, Math.max(1, c.y - a.y) * 1.5); ctx.restore();
  ctx.strokeStyle = s.perfect ? '#fff4cb' : '#f8ead7aa'; ctx.lineWidth = s.perfect ? 2.5 : 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(d.x + 2, d.y + thickness - 3); ctx.lineTo(c.x, c.y + thickness - 3); ctx.lineTo(b.x - 2, b.y + thickness - 3); ctx.strokeStyle = '#e4c89188'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
export function drawStack(ctx: CanvasRenderingContext2D, run: StackRun, art: ArcadeArt, fx: ArcadeEffects, reduced: boolean): void {
  const colors = palette(run.config.palette), sky = ctx.createLinearGradient(0, 0, 0, 800); sky.addColorStop(0, '#34354e'); sky.addColorStop(0.55, '#9383a5'); sky.addColorStop(1, '#e7b69d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 840, 800); coverWash(ctx, art, 840, 800, 0.37);
  ctx.fillStyle = '#3b3d5755'; for (let i = 0; i < 10; i++) { const x = i * 100 - 40, y = 400 + (i * 77 % 230); ctx.fillRect(x, y, 44, 800 - y); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y - 22); ctx.lineTo(x + 44, y); ctx.fill(); }
  for (let i = 0; i < 5; i++) { const x = (i * 230 + (reduced ? 0 : fx.time * (3 + i))) % 1100 - 100, y = 540 + i % 3 * 70 + run.camera * 0.2; ctx.globalAlpha = 0.09; ctx.fillStyle = '#ffefd6'; ctx.beginPath(); ctx.ellipse(x, y, 150, 30, 0, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
  ctx.fillStyle = '#2b25402e'; ctx.beginPath(); ctx.ellipse(420, 730 + run.camera, 230, 45, 0, 0, Math.PI * 2); ctx.fill();
  sprite(ctx, art, 4, 420, 685 + run.camera, 520, 280);
  for (const s of run.slabs) slab(ctx, s, run.camera, art);
  for (const f of run.falling) slab(ctx, f.slab, run.camera, art, f.fall, Math.max(0, 1 - f.age / 2.4));
  if (run.phase === 'playing') {
    const top = run.slabs[run.slabs.length - 1];
    if (top) { ctx.save(); ctx.globalAlpha = 0.4; const target = { ...top, layer: run.moving.layer, perfect: true }; slab(ctx, target, run.camera, art); ctx.restore(); }
    slab(ctx, run.moving, run.camera, art);
    if (run.focus > 0) { ctx.strokeStyle = colors.accent; ctx.lineWidth = 3; const a = iso(run.moving.x, run.moving.z, run.moving.layer, run.camera); ctx.beginPath(); ctx.arc(a.x, a.y - 40, 25, -Math.PI / 2, -Math.PI / 2 + run.focus / 3 * Math.PI * 2); ctx.stroke(); }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6df'; ctx.font = 'bold 23px monospace'; ctx.shadowColor = '#382d48'; ctx.shadowBlur = 12; ctx.fillText(run.streak > 1 ? `PERFECT STREAK ×${run.streak}` : 'ONE MOMENT. ONE MORE FLOOR.', 420, 57); ctx.shadowBlur = 0;
  if (run.streak > 0) sprite(ctx, art, run.streak >= 3 ? 7 : 5, 420, 110, 55, 55);
  if (run.phase === 'playing' && run.placed === 0 && !reduced) { ctx.fillStyle = '#fff4d5'; ctx.font = 'bold 18px monospace'; ctx.globalAlpha = 0.7 + Math.sin(fx.time * 3) * 0.2; ctx.fillText('TAP WHEN THE EDGES ALIGN', 420, 755); ctx.globalAlpha = 1; }
}
