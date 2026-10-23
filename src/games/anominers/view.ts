import type { ArcadeCue } from '../premium-kit/core';
import type { WorldView } from '../three-kit/types';
import { AnominersRun, EMPTY, ROCK, HARD, COPPER, CRYSTAL, GOLD, TECH, MAGMA, ICE, VOID, HARDNESS } from './run';
import { SECTORS } from './worlds';

/**
 * ANOMINERS is drawn like an old home computer: a small canvas (about 220 lines) in two inks, scaled up with crisp
 * pixels. Every line is plotted pixel by pixel, so ships rotate without blurry edges. The asteroid lives in its own
 * layer and only the cells that changed are redrawn.
 */
const CELL = 4;
interface Bit { x: number; y: number; vx: number; vy: number; t: number; c: number }
const DIGITS: Record<string, string[]> = { 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'] };
/** Ship outlines (pointing right, in pixels): closed polygons plus extra strokes and a cockpit pixel. */
const SHIPS: Record<string, { polys: [number, number][][]; strokes: [number, number, number, number][]; cockpit: [number, number] }> = {
  original: { polys: [[[-3, -3], [1, -4], [3, -2], [3, 2], [1, 4], [-3, 3], [-4, 0]]], strokes: [[3, 0, 6, 0], [6, -1, 6, 1], [-4, -2, -6, -3], [-4, 2, -6, 3]], cockpit: [0, 0] },
  whale: { polys: [[[-6, -2], [-2, -4], [4, -3], [6, 0], [4, 3], [-2, 4], [-6, 2]]], strokes: [[-6, -2, -8, -4], [-6, 2, -8, 4], [6, 0, 8, 0]], cockpit: [3, -1] },
  saucer: { polys: [[[-5, 0], [-3, -2], [3, -2], [5, 0], [3, 2], [-3, 2]], [[-2, -2], [0, -4], [2, -2]]], strokes: [[5, 0, 7, 0]], cockpit: [0, -3] },
  rocket: { polys: [[[-4, -2], [3, -2], [6, 0], [3, 2], [-4, 2]]], strokes: [[-4, -2, -6, -4], [-4, 2, -6, 4], [-4, 0, -6, 0]], cockpit: [2, 0] },
  beetle: { polys: [[[-4, -2], [-1, -3], [3, -2], [4, 0], [3, 2], [-1, 3], [-4, 2]]], strokes: [[-1, -3, -2, -5], [2, -2, 3, -4], [-1, 3, -2, 5], [2, 2, 3, 4], [4, -1, 6, -2], [4, 1, 6, 2]], cockpit: [1, 0] },
};

export class AnominersView implements WorldView {
  private ctx: CanvasRenderingContext2D; private layer = document.createElement('canvas'); private lctx: CanvasRenderingContext2D;
  private w = 320; private h = 200; private camX = 0; private camY = 0; private revision = -1; private sector = ''; private scanner = false;
  private time = 0; private bits: Bit[] = []; private shake = 0; private shot: string | null = null; private shotKey = ''; private flash = 0;
  private stars: { x: number; y: number; z: number }[] = [];
  private press: { id: number; x: number; y: number; t: number; moved: boolean } | null = null;
  constructor(readonly canvas: HTMLCanvasElement, readonly run: AnominersRun) {
    this.ctx = canvas.getContext('2d')!; this.lctx = this.layer.getContext('2d')!; canvas.style.imageRendering = 'pixelated';
    for (let i = 0; i < 260; i++) this.stars.push({ x: (i * 97.31) % 1, y: (i * 61.73 + .37 * i * i) % 1, z: .15 + (i % 7) / 14 });
  }
  resize(width: number, height: number): void {
    const scale = Math.max(2, Math.min(6, height / 168)); this.w = Math.max(160, Math.round(width / scale)); this.h = Math.max(100, Math.round(height / scale));
    this.canvas.width = this.w; this.canvas.height = this.h; this.ctx.imageSmoothingEnabled = false;
  }
  /** Hold a finger (or the mouse) to fly toward it; a quick tap blasts. */
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId: number): void {
    const world = { x: (this.camX + (x - .5) * this.w) / CELL, y: (this.camY + (y - .5) * this.h) / CELL };
    if (phase === 'down') { this.press = { id: pointerId, x, y, t: performance.now(), moved: false }; this.run.steerTo = world; return; }
    const p = this.press; if (!p || p.id !== pointerId) return;
    if (phase === 'move') { if (Math.hypot(x - p.x, y - p.y) > .02) p.moved = true; this.run.steerTo = world; return; }
    if (phase === 'up' && !p.moved && performance.now() - p.t < 260) this.run.blast();
    this.run.steerTo = null; this.press = null;
  }

  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void {
    const run = this.run, step = held ? 0 : dt, sec = SECTORS[run.config.worldTheme ?? 'classic'] ?? SECTORS.classic; this.time += step;
    const scanner = Boolean(run.config.revealMap);
    if (this.revision !== run.revision || this.sector !== sec.name || this.scanner !== scanner) { this.revision = run.revision; this.sector = sec.name; this.scanner = scanner; this.paintLayer(sec); this.bits = []; }
    for (const i of run.dirty) this.paintCell(i, sec); run.dirty = [];
    if (!reduced) for (const b of run.broken.splice(0)) for (let k = 0; k < 6; k++) this.bits.push({ x: b.x * CELL, y: b.y * CELL, vx: Math.cos(k * 1.7 + this.time) * 20, vy: Math.sin(k * 1.7 + this.time) * 20 - 6, t: .5 + (k % 3) * .15, c: b.kind === MAGMA || b.kind === VOID ? 1 : 0 }); else run.broken = [];
    for (const cue of cues) { if (cue.kind === 'hit' && Math.hypot(cue.x - run.x, cue.y - run.y) < 3) this.shake = .3; if (cue.kind === 'lose') this.shake = .6; if (cue.kind === 'ability') this.flash = .25; }
    this.shake = Math.max(0, this.shake - step); this.flash = Math.max(0, this.flash - step);
    // Camera: follows the ship, leaning the way it flies.
    const tx = run.x * CELL + run.vx * 3, ty = run.y * CELL + run.vy * 3, ease = held ? 0 : Math.min(1, dt * 5);
    if (!this.camX && !this.camY) { this.camX = tx; this.camY = ty; }
    this.camX += (tx - this.camX) * ease; this.camY += (ty - this.camY) * ease;
    const sx = Math.round(this.camX - this.w / 2 + (reduced ? 0 : Math.sin(this.time * 60) * this.shake * 3)), sy = Math.round(this.camY - this.h / 2);
    const c = this.ctx, ink = sec.ink, danger = sec.danger;
    c.fillStyle = sec.space; c.fillRect(0, 0, this.w, this.h);
    for (const s of this.stars) { const x = Math.floor(((s.x * 1400 - sx * s.z) % this.w + this.w) % this.w), y = Math.floor(((s.y * 900 - sy * s.z) % this.h + this.h) % this.h); c.fillStyle = s.z > .5 ? ink : sec.rock === sec.space ? ink : '#ffffff22'; c.fillRect(x, y, 1, 1); }
    c.drawImage(this.layer, -sx, -sy);
    // Lost technology blinks when the scanner can see it.
    if (scanner && Math.sin(this.time * 6) > 0) for (let i = 0; i < run.grid.length; i++) if (run.grid[i] === TECH) { c.fillStyle = danger; c.fillRect((i % run.w) * CELL - sx, Math.floor(i / run.w) * CELL - sy, CELL, CELL); }
    const P = (wx: number, wy: number) => [Math.round(wx * CELL - sx), Math.round(wy * CELL - sy)] as const;
    this.base(c, ...P(run.baseX, run.baseY), ink, danger);
    for (const ch of run.chunks) { const [x, y] = P(ch.x, ch.y); c.fillStyle = ch.kind === 'shard' ? danger : ink; if (ch.kind === 'tech') { if (Math.sin(this.time * 10) > 0) c.fillRect(x - 2, y - 2, 4, 4); c.fillStyle = sec.space; c.fillRect(x - 1, y - 1, 2, 2); } else if (ch.kind === 'gold') { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } else if (ch.kind === 'crystal') { c.fillRect(x, y - 1, 1, 1); c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x, y + 1, 1, 1); } else c.fillRect(x, y, 2, 2); }
    for (const d of run.drones) { const [x, y] = P(d.x, d.y); this.ring(c, x, y, 2, ink); if (Math.sin(this.time * 8 + d.id) > 0) { c.fillStyle = d.stun > 0 ? danger : ink; c.fillRect(x, y, 1, 1); } if (d.target >= 0 && d.carry < 4) { const [tx2, ty2] = P(d.target % run.w + .5, Math.floor(d.target / run.w) + .5); if (Math.hypot(tx2 - x, ty2 - y) < 6) this.line(c, x, y, tx2, ty2, ink, 2); } }
    if (run.beam && run.phase === 'playing') { const [x0, y0] = P(run.x, run.y), [x1, y1] = P(run.beam.x + .5, run.beam.y + .5); this.line(c, x0, y0, x1, y1, ink, reduced ? 0 : 2, Math.floor(this.time * 20)); c.fillStyle = ink; c.fillRect(x1 - 1, y1 - 1, 3, 3); }
    // Your ship (blinking while protected).
    if (!(run.invuln > 0 && run.hurt <= 0 && Math.sin(this.time * 30) > 0 && run.elapsed > .1) || run.phase !== 'playing') { const [x, y] = P(run.x, run.y); this.ship(c, x, y, run.angle, run.config.characterStyle ?? 'original', ink, sec.space); if (!reduced && (run.input.left || run.input.right || run.input.up || run.input.down || run.steerTo) && Math.sin(this.time * 40) > 0) { c.fillStyle = ink; c.fillRect(Math.round(x - Math.cos(run.angle) * 6), Math.round(y - Math.sin(run.angle) * 6), 1, 1); } }
    for (const b of run.bolts) { const [x, y] = P(b.x, b.y), l = Math.hypot(b.vx, b.vy); this.line(c, x, y, Math.round(x - b.vx / l * 3), Math.round(y - b.vy / l * 3), ink); }
    for (const g of run.glitches) { const [x, y] = P(g.x, g.y); c.fillStyle = danger; for (let k = 0; k < 7; k++) { const h = Math.sin(g.seed * 99 + k * 7 + Math.floor(this.time * 12) * 3.1); c.fillRect(x + Math.round(h * 3), y + Math.round(Math.cos(k * 2.3 + this.time * 9) * 3), 1 + (k % 2), 1); } c.fillStyle = sec.space; c.fillRect(x, y, 1, 1); }
    if (run.rift) {
      const [x, y] = P(run.rift.x, run.rift.y), r = Math.round(run.rift.r * CELL);
      this.ring(c, x, y, r, danger, 2, reduced ? 0 : this.time * 2); if (run.rift.core) { this.ring(c, x, y, r + 5, danger, 1, -this.time); c.fillStyle = danger; c.fillRect(x - 2, y - 2, 5, 5); c.fillStyle = sec.space; c.fillRect(x - 1 + Math.round(Math.cos(this.time) ), y - 1, 2, 2); }
      this.number(c, String(run.ast.threat), x - r - 2, y - r - 2, danger);
      const hpW = Math.round(r * 2 * run.rift.hp / run.rift.max); c.fillStyle = danger; c.fillRect(x - r, y + r + 4, hpW, 1);
    }
    for (const m of run.meteors) { const [x, y] = P(m.x, m.y); this.line(c, x, y, x - 6, y - 8, ink); c.fillStyle = ink; c.fillRect(x - 1, y - 1, 3, 3); }
    if (run.strike) { const [x, y] = P(run.strike.x, run.strike.y); let px = x + 12, py = 0; c.fillStyle = ink; for (let k = 0; k < 8; k++) { const nx = x + Math.round(Math.sin(k * 3.7 + this.time * 40) * 6) * (1 - k / 8), ny = Math.round(y * (k + 1) / 8); this.line(c, px, py, nx, ny, ink); px = nx; py = ny; } }
    // Debris bits.
    this.bits = this.bits.filter(b => (b.t -= step) > 0); for (const b of this.bits) { b.x += b.vx * step; b.y += b.vy * step; b.vy += 40 * step; c.fillStyle = b.c ? danger : ink; c.fillRect(Math.round(b.x - sx), Math.round(b.y - sy), 1, 1); }
    // Nebula: you only see what is near.
    const sight = run.weather.sight; if (sight) { const [x, y] = P(run.x, run.y); c.save(); c.beginPath(); c.rect(0, 0, this.w, this.h); c.arc(x, y, sight * CELL, 0, Math.PI * 2, true); c.fillStyle = sec.space + 'e6'; c.fill('evenodd'); c.restore(); }
    if (this.flash > 0 && !reduced) { c.fillStyle = ink + '33'; c.fillRect(0, 0, this.w, this.h); }
    if (run.hurt > 0) { c.fillStyle = danger; c.fillRect(0, 0, this.w, 1); c.fillRect(0, this.h - 1, this.w, 1); c.fillRect(0, 0, 1, this.h); c.fillRect(this.w - 1, 0, 1, this.h); }
    const key = `${run.revision}|${run.phase}`;
    if ((run.phase === 'cleared' || run.phase === 'gameover') && key !== this.shotKey) { this.shotKey = key; try { this.shot = this.canvas.toDataURL('image/png'); } catch { this.shot = null; } }
  }
  snapshot(): string | null { return this.shot; }

  // ---------------------------------------------------------------- the asteroid layer
  private paintLayer(sec: (typeof SECTORS)[string]) {
    const run = this.run; this.layer.width = run.w * CELL; this.layer.height = run.h * CELL; this.lctx.imageSmoothingEnabled = false;
    this.lctx.clearRect(0, 0, this.layer.width, this.layer.height); for (let i = 0; i < run.grid.length; i++) if (run.grid[i]) this.paintCell(i, sec);
  }
  private paintCell(i: number, sec: (typeof SECTORS)[string]) {
    const run = this.run, g = this.lctx; if (i < 0 || i >= run.grid.length) return;
    const cx = i % run.w, cy = Math.floor(i / run.w), x = cx * CELL, y = cy * CELL, k = run.grid[i];
    g.clearRect(x, y, CELL, CELL); if (k === EMPTY) return;
    const dot = (px: number, py: number, color = sec.ink) => { g.fillStyle = color; g.fillRect(x + px, y + py, 1, 1); };
    g.fillStyle = sec.rock; g.fillRect(x, y, CELL, CELL);
    const exposed = !run.at(cx - 1, cy) || !run.at(cx + 1, cy) || !run.at(cx, cy - 1) || !run.at(cx, cy + 1);
    const kind = k === TECH && !exposed && !this.scanner ? HARD : k;
    if (kind === ROCK && (cx * 7 + cy * 13) % 9 === 0) dot(1, 2, sec.ink + '55');
    if (kind === HARD) { dot(0, 2, sec.ink + '88'); dot(2, 0, sec.ink + '88'); }
    if (kind === COPPER) { dot(1, 1); dot(2, 2); dot(3, 0); }
    if (kind === CRYSTAL) { dot(2, 0); dot(1, 1); dot(3, 1); dot(2, 2); }
    if (kind === GOLD) { dot(1, 1); dot(2, 1); dot(1, 2); dot(2, 2); dot(0, 3); }
    if (kind === ICE) { g.fillStyle = sec.ink + '44'; g.fillRect(x, y, CELL, CELL); dot(1, 1); }
    if (kind === TECH) { g.fillStyle = sec.ink; g.strokeStyle = sec.ink; g.fillRect(x, y, CELL, 1); g.fillRect(x, y + 3, CELL, 1); g.fillRect(x, y, 1, CELL); g.fillRect(x + 3, y, 1, CELL); }
    if (kind === MAGMA) { dot(1, 1, sec.danger); dot(2, 2, sec.danger); dot(3, 0, sec.danger); dot(0, 3, sec.danger); }
    if (kind === VOID) { for (let d = 0; d < 4; d++) dot(d, d, sec.danger); dot(3, 0, sec.danger); }
    const ratio = run.hp[i] / HARDNESS[k]; if (ratio < .66) dot(3, 2, sec.space); if (ratio < .33) { dot(0, 1, sec.space); dot(2, 3, sec.space); }
    // Outline every face that looks into space.
    g.fillStyle = sec.ink;
    if (!run.at(cx, cy - 1)) g.fillRect(x, y, CELL, 1); if (!run.at(cx, cy + 1)) g.fillRect(x, y + CELL - 1, CELL, 1);
    if (!run.at(cx - 1, cy)) g.fillRect(x, y, 1, CELL); if (!run.at(cx + 1, cy)) g.fillRect(x + CELL - 1, y, 1, CELL);
  }

  // ---------------------------------------------------------------- pixel drawing
  private line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, dash = 0, phase = 0) {
    c.fillStyle = color; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    for (let guard = 0; guard < 2000; guard++) { if (!dash || (n + phase) % (dash * 2) < dash) c.fillRect(x0, y0, 1, 1); n++; if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  private ring(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, thick = 1, spin = 0) {
    c.fillStyle = color; const n = Math.max(12, Math.round(r * 7));
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + spin; if (spin && Math.sin(a * 3) > .85) continue; for (let t = 0; t < thick; t++) c.fillRect(Math.round(cx + Math.cos(a) * (r - t)), Math.round(cy + Math.sin(a) * (r - t)), 1, 1); }
  }
  private number(c: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
    c.fillStyle = color; [...text].forEach((ch, i) => (DIGITS[ch] ?? DIGITS[0]).forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') c.fillRect(x + i * 4 + rx, y + ry, 1, 1); })));
  }
  private ship(c: CanvasRenderingContext2D, x: number, y: number, angle: number, style: string, ink: string, space: string) {
    const s = SHIPS[style] ?? SHIPS.original, co = Math.cos(angle), si = Math.sin(angle), R = (px: number, py: number) => [Math.round(x + px * co - py * si), Math.round(y + px * si + py * co)] as const;
    for (const poly of s.polys) { const pts = poly.map(([px, py]) => R(px, py)); c.fillStyle = space; for (let k = 0; k < pts.length; k++) { const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length]; this.line(c, ax, ay, bx, by, ink); } }
    for (const [ax, ay, bx, by] of s.strokes) { const a = R(ax, ay), b = R(bx, by); this.line(c, a[0], a[1], b[0], b[1], ink); }
    const [cx, cy] = R(...s.cockpit); c.fillStyle = ink; c.fillRect(cx, cy, 1, 1);
  }
  private base(c: CanvasRenderingContext2D, x: number, y: number, ink: string, danger: string) {
    const run = this.run; c.fillStyle = ink;
    // A little station: hull box, antenna, landing pad lights; a warp ring when the asteroid is done.
    this.line(c, x - 9, y - 6, x + 9, y - 6, ink); this.line(c, x - 9, y + 6, x + 9, y + 6, ink); this.line(c, x - 9, y - 6, x - 9, y + 6, ink); this.line(c, x + 9, y - 6, x + 9, y - 2, ink); this.line(c, x + 9, y + 2, x + 9, y + 6, ink);
    this.line(c, x - 4, y - 6, x - 4, y - 11, ink); c.fillRect(x - 5, y - 12, 3, 1); c.fillRect(x - 6, y + 2, 2, 2); c.fillRect(x - 6, y - 3, 2, 2); c.fillRect(x - 2, y - 3, 2, 2);
    if (Math.sin(this.time * 4) > 0) { c.fillRect(x + 11, y - 1, 1, 1); c.fillRect(x + 11, y + 1, 1, 1); }
    if (run.ready) this.ring(c, x + 2, y, 14 + Math.round(Math.sin(this.time * 5) * 2), run.warp > 0 ? danger : ink, 1, this.time);
  }
  diagnostics(): Record<string, number> { return { width: this.w, height: this.h }; }
  dispose(): void { this.layer.width = this.layer.height = 0; }
}
