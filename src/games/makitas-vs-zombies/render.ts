import { COLS, ROWS, UNIT_INFO, ZOMBIE_INFO, type UnitKind, type YardRun, type YardTool } from './run';
import type { YardEffects } from './effects';

export const VIEW = { width: 1080, height: 760, x: 92, y: 178, cw: 98, ch: 86 };
export const TOOL_COLORS: Record<string, string> = { teal: '#64e7d5', amber: '#ffca70', violet: '#c4a0ff', lime: '#ccf18a' };
export interface YardArt { yard: HTMLImageElement; sprites: HTMLImageElement }
const ready = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0;
const px = (x: number) => VIEW.x + x * VIEW.cw;
const py = (row: number) => VIEW.y + (row + 0.5) * VIEW.ch;

export function drawBlade(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number, color: string, geometry = { x: 1, y: 1 }): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(geometry.x, geometry.y); ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, r = i % 2 ? radius * 0.8 : radius; if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = '#dae5df'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2); ctx.strokeStyle = '#728980'; ctx.stroke();
  ctx.fillStyle = '#214b43'; ctx.beginPath(); ctx.arc(0, 0, radius * 0.23, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function atlas(ctx: CanvasRenderingContext2D, art: YardArt, index: number, x: number, y: number, width: number, height: number, flip = false): boolean {
  if (!ready(art.sprites)) return false;
  const w = art.sprites.naturalWidth / 4, h = art.sprites.naturalHeight / 2;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(art.sprites, index % 4 * w, Math.floor(index / 4) * h, w, h, -width / 2, -height / 2, width, height); ctx.restore(); return true;
}
function fallbackUnit(ctx: CanvasRenderingContext2D, kind: UnitKind, x: number, y: number, color: string): void {
  ctx.fillStyle = kind === 'wall' ? '#9e794a' : '#177e76'; ctx.fillRect(x - 25, y - 28, 50, 46);
  ctx.fillStyle = '#152c29'; ctx.fillRect(x - 28, y + 18, 56, 12);
  if (kind === 'charger') { ctx.fillStyle = '#ffdc74'; ctx.fillRect(x - 9, y - 19, 18, 31); }
  else if (kind !== 'wall') drawBlade(ctx, x + 14, y - 13, 22, 0, color);
}
export function drawYard(ctx: CanvasRenderingContext2D, run: YardRun, art: YardArt, effects: YardEffects, width: number, height: number, reduced: boolean, hover: { row: number; col: number } | null, selected: YardTool): void {
  ctx.save(); ctx.scale(width / VIEW.width, height / VIEW.height);
  ctx.fillStyle = '#183c2d'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (ready(art.yard)) ctx.drawImage(art.yard, 0, 0, VIEW.width, VIEW.height);
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW.height); shade.addColorStop(0, '#061b18dc'); shade.addColorStop(0.25, '#08261b16'); shade.addColorStop(0.77, '#0a29191a'); shade.addColorStop(1, '#051d18f5');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (!reduced && effects.shake) ctx.translate(Math.sin(effects.time * 70) * 2, Math.cos(effects.time * 50) * 2);
  const color = TOOL_COLORS[run.config.toolColor] ?? TOOL_COLORS.teal;
  // The board fills its panel, but the painted sprites and blades keep their aspect ratio.
  const fit = Math.min(width / VIEW.width, height / VIEW.height);
  const geometry = { x: fit / (width / VIEW.width), y: fit / (height / VIEW.height) };
  const sprite = (index: number, x: number, y: number, w: number, h: number, flip = false) => atlas(ctx, art, index, x, y, w * geometry.x, h * geometry.y, flip);
  const blade = (x: number, y: number, radius: number, angle: number, tint: string) => drawBlade(ctx, x, y, radius, angle, tint, geometry);
  ctx.fillStyle = '#0b241840'; ctx.fillRect(VIEW.x - 5, VIEW.y - 5, COLS * VIEW.cw + 10, ROWS * VIEW.ch + 10);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = px(col), y = VIEW.y + row * VIEW.ch;
      ctx.fillStyle = (col + row) % 2 ? '#7aa94a20' : '#182f2230'; ctx.fillRect(x + 1, y + 1, VIEW.cw - 2, VIEW.ch - 2);
      ctx.strokeStyle = '#b3cb732b'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, VIEW.cw - 1, VIEW.ch - 1);
      for (let i = 0; i < 3; i++) { const gx = x + 17 + (i * 29 + row * 13) % 75, gy = y + 64 + i * 4; ctx.strokeStyle = '#a1b86020'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 5); ctx.lineTo(gx + 2, gy - 2); ctx.stroke(); }
    }
    ctx.fillStyle = '#d5d9a3'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(row + 1).padStart(2, '0'), VIEW.x - 44, py(row) + 5);
    const sweep = run.sweepers[row];
    if (!sweep.used || sweep.active) { const x = sweep.active ? px(sweep.x) : VIEW.x - 15; ctx.fillStyle = '#2e8472'; ctx.fillRect(x - 22, py(row) - 13, 36, 26); blade(x + 7, py(row), 19, reduced ? 0 : effects.time * (sweep.active ? 30 : 2), '#ffd585'); }
    else { ctx.strokeStyle = '#89967c50'; ctx.beginPath(); ctx.moveTo(VIEW.x - 27, py(row) - 8); ctx.lineTo(VIEW.x - 8, py(row) + 8); ctx.stroke(); }
  }
  if (hover && run.phase === 'playing') {
    const unit = run.units.find(u => u.row === hover.row && u.col === hover.col), action = selected === 'upgrade' || selected === 'recycle';
    const valid = action ? Boolean(unit) : !unit && run.power >= UNIT_INFO[selected].cost;
    ctx.strokeStyle = valid ? color : '#ff9b80'; ctx.lineWidth = 3; ctx.fillStyle = valid ? `${color}20` : '#ff826b24';
    ctx.fillRect(px(hover.col) + 2, VIEW.y + hover.row * VIEW.ch + 2, VIEW.cw - 4, VIEW.ch - 4); ctx.strokeRect(px(hover.col) + 3, VIEW.y + hover.row * VIEW.ch + 3, VIEW.cw - 6, VIEW.ch - 6);
    if (!action && !unit) { ctx.globalAlpha = 0.45; if (!sprite(UNIT_INFO[selected].sprite, px(hover.col + 0.5), py(hover.row) - 9, 82, 98, true)) fallbackUnit(ctx, selected, px(hover.col + 0.5), py(hover.row), color); ctx.globalAlpha = 1; }
  }
  for (let row = 0; row < ROWS; row++) {
    for (const u of run.units.filter(u => u.row === row)) {
      const x = px(u.col + 0.5), y = py(row), pulse = reduced ? 0 : Math.sin(effects.time * 5 + u.id) * 1;
      ctx.fillStyle = '#03170d70'; ctx.beginPath(); ctx.ellipse(x, y + 27, 29, 9, 0, 0, Math.PI * 2); ctx.fill();
      if (!sprite(UNIT_INFO[u.kind].sprite, x, y - 8 + pulse, 88, 100, true)) fallbackUnit(ctx, u.kind, x, y, color);
      if (u.kind === 'saw' || u.kind === 'frost') { ctx.shadowColor = u.kind === 'frost' ? '#a6edff' : color; ctx.shadowBlur = u.flash > 0 ? 14 : 3; blade(x + 21 * geometry.x, y - 8 - 8 * geometry.y + pulse, 19, reduced ? 0 : effects.time * (u.flash > 0 ? 40 : 8), u.kind === 'frost' ? '#a6edff' : color); ctx.shadowBlur = 0; }
      if (u.flash > 0) { ctx.fillStyle = '#fff3b52a'; ctx.beginPath(); ctx.arc(x, y - 8, 34, 0, Math.PI * 2); ctx.fill(); }
      if (u.hp < u.maxHp) bar(ctx, x, y + 34, u.hp / u.maxHp, '#80d1ae');
      if (u.level > 1) { ctx.fillStyle = '#ffdc87'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('★'.repeat(u.level - 1), x, y + 45); }
    }
    for (const z of run.zombies.filter(z => z.row === row)) {
      const x = px(z.x), y = py(row), brute = z.kind === 'brute';
      const bob = reduced ? 0 : Math.sin(effects.time * (z.chewing ? 11 : z.kind === 'sprinter' ? 12 : 6) + z.id) * (z.chewing ? 1.5 : 3);
      ctx.fillStyle = '#03170d70'; ctx.beginPath(); ctx.ellipse(x, y + 27, brute ? 34 : 22, 9, 0, 0, Math.PI * 2); ctx.fill();
      if (z.slowed > 0) { ctx.strokeStyle = '#a1e9ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 24, 27, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (z.flash > 0) ctx.globalAlpha = 0.5;
      if (!sprite(ZOMBIE_INFO[z.kind].sprite, x, y - (brute ? 14 : 9) + bob, brute ? 110 : 80, brute ? 126 : 103)) {
        ctx.fillStyle = '#829b5e'; ctx.fillRect(x - 15, y - 34 + bob, 30, 32); ctx.fillStyle = '#c18140'; ctx.fillRect(x - 18, y - 5, 32, 27); ctx.fillStyle = '#fff1c2'; ctx.fillRect(x - 17, y - 25 + bob, 7, 8);
      }
      ctx.globalAlpha = 1;
      if (z.hp < z.maxHp || brute) bar(ctx, x, y - (brute ? 67 : 51) * geometry.y, z.hp / z.maxHp, z.slowed > 0 ? '#a4e6ff' : '#f2b36f');
    }
  }
  for (const b of run.blades) { ctx.shadowBlur = 8; ctx.shadowColor = b.frost ? '#a7e9ff' : color; blade(px(b.x), py(b.row) - 14, 14, reduced ? 0 : effects.time * 35 + b.id, b.frost ? '#a7e9ff' : color); ctx.shadowBlur = 0; }
  for (const p of effects.particles) { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.color; ctx.fillRect(px(p.x), py(p.row) - 12, 4, 3); }
  ctx.globalAlpha = 1; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
  for (const f of effects.floaters) { const y = py(f.row) - 32 - (reduced ? 0 : f.age * 25); ctx.globalAlpha = Math.min(1, (1.25 - f.age) * 3); ctx.strokeStyle = '#08251a'; ctx.strokeText(f.text, px(f.x), y); ctx.fillStyle = f.color; ctx.fillText(f.text, px(f.x), y); }
  ctx.restore();
}
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, fraction: number, color: string): void {
  ctx.fillStyle = '#081c17d9'; ctx.fillRect(x - 22, y, 44, 5); ctx.fillStyle = color; ctx.fillRect(x - 21, y + 1, 42 * Math.max(0, fraction), 3);
}
