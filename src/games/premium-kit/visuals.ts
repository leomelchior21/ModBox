import type { ArcadeCue } from './core';

export interface SpriteRegion { x: number; y: number; w: number; h: number }
export interface ArcadeArt { cover: HTMLImageElement; background: HTMLImageElement; sprites: HTMLImageElement; regions: SpriteRegion[] }
export const PALETTES: Record<string, { accent: string; warm: string; dark: string }> = {
  azure: { accent: '#2585f4', warm: '#ffd061', dark: '#142b52' },
  teal: { accent: '#67e4d0', warm: '#ffbf78', dark: '#102c2c' }, amber: { accent: '#ffcf80', warm: '#a7eee2', dark: '#30251e' }, violet: { accent: '#c0a2ff', warm: '#ffc394', dark: '#261e3c' },
  jade: { accent: '#a0efb3', warm: '#f9d17b', dark: '#0c2925' }, orchid: { accent: '#daa2f7', warm: '#a1edcc', dark: '#281c36' }, gold: { accent: '#ffe091', warm: '#95e6d7', dark: '#30291d' },
  neon: { accent: '#8aebff', warm: '#ff87bc', dark: '#16152f' }, sunset: { accent: '#ffb797', warm: '#d4b7ff', dark: '#2c1c2c' }, ice: { accent: '#c5efff', warm: '#a7bbff', dark: '#132b38' },
  candy: { accent: '#c2b1ff', warm: '#9defda', dark: '#201c35' }, mint: { accent: '#a6efdb', warm: '#ffc89d', dark: '#162c2e' }, coral: { accent: '#ffb7aa', warm: '#cbb7ff', dark: '#33212d' },
};
export const palette = (name: string) => PALETTES[name] ?? PALETTES.teal;
export function loadArcadeArt(game: string): ArcadeArt {
  const art: ArcadeArt = { cover: new Image(), background: new Image(), sprites: new Image(), regions: [] };
  art.cover.src = `/art/${game}/cover.webp`;
  art.background.src = `/art/${game}/background.webp`;
  art.sprites.onload = () => {
    // Trim transparent cell padding once so all actors retain their proportions.
    const canvas = document.createElement('canvas'); canvas.width = art.sprites.naturalWidth; canvas.height = art.sprites.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
    ctx.drawImage(art.sprites, 0, 0);
    try {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height), split = Math.floor(canvas.height * (game === 'makita-slingers' ? 0.45 : 0.5));
      const lowerColumns = game === 'makita-slingers' ? [0, 0.245, 0.435, 0.725, 1] : game === 'pinballerz' ? [0, 0.285, 0.585, 0.815, 1] : game === 'naja-run' ? [0, 0.27, 0.5, 0.75, 1] : [0, 0.25, 0.5, 0.75, 1];
      for (let i = 0; i < 8; i++) {
        const column = i % 4, edges = i < 4 ? [0, 0.25, 0.5, 0.75, 1] : lowerColumns;
        const ox = Math.floor(edges[column] * canvas.width), cw = Math.floor(edges[column + 1] * canvas.width) - ox;
        const oy = i < 4 ? 0 : split, ch = i < 4 ? split : canvas.height - split; let left = cw, top = ch, right = 0, bottom = 0;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (data[((oy + y) * canvas.width + ox + x) * 4 + 3] > 32) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
        art.regions.push(right > left && bottom > top ? { x: ox + left, y: oy + top, w: right - left + 1, h: bottom - top + 1 } : { x: ox, y: oy, w: cw, h: ch });
      }
    } catch { /* Fallback shapes keep the game playable if an image cannot load. */ }
  };
  art.sprites.src = `/art/${game}/sprites.webp`; return art;
}
export function sprite(ctx: CanvasRenderingContext2D, art: ArcadeArt, index: number, x: number, y: number, w: number, h: number, angle = 0): boolean {
  const r = art.regions[index]; if (!r || !art.sprites.naturalWidth) return false;
  const scale = Math.min(w / r.w, h / r.h); ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.drawImage(art.sprites, r.x, r.y, r.w, r.h, -r.w * scale / 2, -r.h * scale / 2, r.w * scale, r.h * scale); ctx.restore(); return true;
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
export function coverWash(ctx: CanvasRenderingContext2D, art: ArcadeArt, w: number, h: number, opacity = 0.22): void {
  const background = art.background;
  if (!background.naturalWidth) return;
  const scale = Math.max(w / background.naturalWidth, h / background.naturalHeight); ctx.save(); ctx.globalAlpha = opacity;
  ctx.drawImage(background, (w - background.naturalWidth * scale) / 2, (h - background.naturalHeight * scale) / 2, background.naturalWidth * scale, background.naturalHeight * scale); ctx.restore();
}
export interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string }
export interface Floater { x: number; y: number; text: string; age: number; color: string }
export class ArcadeEffects {
  time = 0; particles: Particle[] = []; floaters: Floater[] = []; shake = 0;
  reset(): void { this.time = 0; this.particles = []; this.floaters = []; this.shake = 0; }
  step(dt: number): void {
    this.time += dt; this.shake = Math.max(0, this.shake - dt);
    for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 190 * dt; }
    for (const f of this.floaters) f.age += dt;
    this.particles = this.particles.filter(p => p.age < p.life); this.floaters = this.floaters.filter(f => f.age < 1.1);
  }
  consume(cues: ArcadeCue[], accent: string, reduced: boolean): void {
    if (reduced) { this.particles = []; this.shake = 0; }
    for (const cue of cues) {
      const color = cue.color ?? (cue.kind === 'lose' ? '#ff9d94' : cue.kind === 'perfect' || cue.kind === 'clear' ? '#ffdf9b' : accent);
      if (cue.text) this.floaters.push({ x: cue.x, y: cue.y, text: cue.text, age: 0, color });
      if (reduced) continue;
      if (cue.kind === 'hit' || cue.kind === 'lose') this.shake = 0.13;
      const count = cue.kind === 'clear' ? 42 : cue.kind === 'perfect' ? 24 : cue.kind === 'score' ? 10 : 14;
      for (let i = 0; i < count; i++) { const angle = i * 2.4 + this.time, speed = 40 + i % 7 * 23; this.particles.push({ x: cue.x, y: cue.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50, age: 0, life: 0.4 + i % 5 * 0.13, color }); }
    }
    this.particles = this.particles.slice(-240); this.floaters = this.floaters.slice(-18);
  }
  draw(ctx: CanvasRenderingContext2D, reduced: boolean): void {
    for (const p of this.particles) { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = 'bold 23px monospace'; ctx.lineWidth = 5;
    for (const f of this.floaters) { ctx.globalAlpha = Math.min(1, (1.1 - f.age) * 4); ctx.strokeStyle = '#081420'; const y = f.y - 25 - (reduced ? 0 : f.age * 45); ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y); }
    ctx.globalAlpha = 1;
  }
}
export class ArcadeSound {
  private context: AudioContext | null = null; private last = -1; muted = false;
  unlock(): void { if (!window.AudioContext) return; try { this.context ??= new window.AudioContext(); if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined); } catch { this.context = null; } }
  play(kind: ArcadeCue['kind']): void {
    const ctx = this.context; if (!ctx || this.muted || ctx.state !== 'running' || ctx.currentTime - this.last < 0.04) return; this.last = ctx.currentTime;
    const frequencies = { launch: 240, hit: 150, score: 560, perfect: 820, lose: 100, clear: 990, ability: 660 };
    const osc = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime, duration = kind === 'clear' ? 0.4 : 0.16;
    osc.type = kind === 'hit' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(frequencies[kind], now); osc.frequency.exponentialRampToValueAtTime(frequencies[kind] * (kind === 'lose' ? 0.5 : 1.6), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(ctx.destination); osc.onended = () => { osc.disconnect(); gain.disconnect(); }; osc.start(now); osc.stop(now + duration + 0.02);
  }
  destroy(): void { if (this.context) void this.context.close().catch(() => undefined); this.context = null; }
}
