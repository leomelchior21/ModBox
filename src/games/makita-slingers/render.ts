import type { ArcadeArt, ArcadeEffects } from '../premium-kit/visuals';
import { coverWash, palette, roundRect, sprite } from '../premium-kit/visuals';
import { SLING, FLOOR, type SlingersRun } from './run';

export function drawSlingers(ctx: CanvasRenderingContext2D, run: SlingersRun, art: ArcadeArt, fx: ArcadeEffects, reduced: boolean): void {
  const colors = palette(run.config.palette), sky = ctx.createLinearGradient(0, 0, 0, 640); sky.addColorStop(0, '#234b50'); sky.addColorStop(0.65, '#d2aa76'); sky.addColorStop(1, '#284f40'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 640);
  coverWash(ctx, art, 1000, 640, 0.43);
  ctx.fillStyle = '#163d4166'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * 200 - 100, FLOOR); ctx.lineTo(i * 200 + 50, 200 + i % 3 * 55); ctx.lineTo(i * 200 + 260, FLOOR); ctx.fill(); }
  ctx.strokeStyle = '#1a434859'; ctx.lineWidth = 7; for (const x of [360, 830]) { ctx.beginPath(); ctx.moveTo(x, 380); ctx.lineTo(x, 110); ctx.lineTo(x + 135, 140); ctx.moveTo(x, 110); ctx.lineTo(x - 70, 155); ctx.moveTo(x + 110, 140); ctx.lineTo(x + 110, 210); ctx.stroke(); }
  roundRect(ctx, 0, FLOOR, 1000, 78, 0, '#273e30'); ctx.fillStyle = '#d7c18a'; ctx.fillRect(0, FLOOR, 1000, 5);
  for (let i = 0; i < 30; i++) { ctx.fillStyle = i % 2 ? '#425441' : '#162f2a'; ctx.fillRect(i * 38, FLOOR + 30 + i % 4 * 10, 20, 4); }
  ctx.strokeStyle = '#e7d6a5'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(SLING.x - 20, FLOOR); ctx.lineTo(SLING.x - 12, SLING.y - 24); ctx.moveTo(SLING.x + 22, FLOOR); ctx.lineTo(SLING.x + 18, SLING.y - 24); ctx.stroke();
  sprite(ctx, art, 7, SLING.x, SLING.y + 44, 95, 185);
  const pull = run.dragging ? run.aim : { x: 0, y: 0 }, bx = SLING.x + pull.x, by = SLING.y + pull.y;
  ctx.strokeStyle = '#563e2c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(SLING.x - 17, SLING.y - 13); ctx.lineTo(bx, by); ctx.lineTo(SLING.x + 21, SLING.y - 10); ctx.stroke();
  if (!run.blade && run.lives > 0) {
    if (!sprite(ctx, art, 0, bx, by, 52, 52, reduced ? 0 : fx.time * 0.8)) { ctx.fillStyle = '#e7e8d1'; ctx.beginPath(); ctx.arc(bx, by, 23, 0, Math.PI * 2); ctx.fill(); }
    if (run.config.assist) { const v = run.velocity(); for (let i = 1; i < 31; i++) { const t = i * 0.05, x = SLING.x + v.x * t, y = SLING.y + v.y * t + run.config.gravity * t * t / 2; if (y > FLOOR || x > 995) break; ctx.globalAlpha = 0.75 - i * 0.017; ctx.fillStyle = colors.accent; ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 5 : 3, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
  }
  for (const body of [...run.bodies].sort((a, b) => a.y - b.y)) {
    ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.angle); ctx.fillStyle = '#0d302650'; ctx.beginPath(); ctx.ellipse(0, body.h / 2 + 2, body.w * 0.55, 6, 0, 0, Math.PI * 2); ctx.fill();
    const robot = body.kind === 'robot' || body.kind === 'helmet';
    if (robot) { if (!sprite(ctx, art, body.kind === 'robot' ? 2 : 3, 0, 0, body.w + 12, body.h + 10)) roundRect(ctx, -body.w / 2, -body.h / 2, body.w, body.h, 12, '#e4a159', '#ffe4a3'); }
    else {
      roundRect(ctx, -body.w / 2, -body.h / 2, body.w, body.h, 4, body.kind === 'steel' ? '#478f8b' : body.kind === 'crate' ? '#9b6d3b' : '#bd945b', body.kind === 'steel' ? '#a8e3d1' : '#e9c288');
      if (body.kind === 'wood' || body.kind === 'steel') {
        const vertical = body.h >= body.w;
        sprite(ctx, art, body.kind === 'steel' ? 5 : 4, 0, 0, vertical ? body.w + 4 : body.h + 4, vertical ? body.h : body.w, vertical ? 0 : Math.PI / 2);
      }
      ctx.strokeStyle = body.kind === 'steel' ? '#16454e' : '#734d2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-body.w / 2 + 4, -body.h / 2 + 5); ctx.lineTo(body.w / 2 - 4, body.h / 2 - 5); if (body.kind === 'crate') { ctx.moveTo(body.w / 2 - 4, -body.h / 2 + 5); ctx.lineTo(-body.w / 2 + 4, body.h / 2 - 5); } ctx.stroke();
      if (body.kind === 'crate') { sprite(ctx, art, 6, 0, 0, body.w, body.h); ctx.fillStyle = '#ffe09b'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ϟ', 0, 8); }
      for (const [x, y] of [[-body.w / 2 + 5, -body.h / 2 + 5], [body.w / 2 - 5, body.h / 2 - 5]]) { ctx.fillStyle = '#e8d9a3'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (body.flash > 0) { ctx.globalAlpha = body.flash * 2; ctx.fillStyle = '#fffbd4'; ctx.fillRect(-body.w / 2, -body.h / 2, body.w, body.h); ctx.globalAlpha = 1; }
    if (body.hp < body.maxHp) { ctx.fillStyle = '#092a27'; ctx.fillRect(-20, -body.h / 2 - 10, 40, 5); ctx.fillStyle = colors.warm; ctx.fillRect(-20, -body.h / 2 - 10, 40 * body.hp / body.maxHp, 5); }
    ctx.restore();
  }
  if (run.blade) {
    const blade = run.blade;
    if (!reduced) for (let i = 0; i < blade.trail.length; i++) { ctx.globalAlpha = i / blade.trail.length * 0.45; ctx.fillStyle = colors.accent; ctx.beginPath(); ctx.arc(blade.trail[i].x, blade.trail[i].y, 2 + i / blade.trail.length * 7, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
    ctx.shadowColor = colors.accent; ctx.shadowBlur = 15;
    if (!sprite(ctx, art, run.config.overdrive ? 1 : 0, blade.x, blade.y, 48, 48, reduced ? 0 : fx.time * 24)) { ctx.fillStyle = '#f3eaca'; ctx.beginPath(); ctx.arc(blade.x, blade.y, 19, 0, Math.PI * 2); ctx.fill(); } ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#f4edc5'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillText('SCRAPYARD ' + String(run.level).padStart(2, '0'), 26, 35);
  ctx.font = '13px monospace'; ctx.fillStyle = '#e6e6c5'; ctx.fillText(run.config.overdrive ? 'BLAST BLADE ARMED' : 'DISMANTLE EVERY ROBOT', 26, 58);
}
