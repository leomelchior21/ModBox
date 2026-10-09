import type { YardCue } from './run';
export interface YardParticle { row: number; x: number; dx: number; dy: number; age: number; life: number; color: string }
export interface YardFloater { row: number; x: number; text: string; age: number; color: string }
export class YardEffects {
  time = 0; shake = 0; particles: YardParticle[] = []; floaters: YardFloater[] = [];
  reset(): void { this.time = 0; this.shake = 0; this.particles = []; this.floaters = []; }
  step(dt: number): void {
    this.time += dt; this.shake = Math.max(0, this.shake - dt);
    for (const p of this.particles) { p.age += dt; p.x += p.dx * dt; p.row += p.dy * dt; p.dy += dt * 2; }
    for (const f of this.floaters) f.age += dt;
    this.particles = this.particles.filter(p => p.age < p.life); this.floaters = this.floaters.filter(f => f.age < 1.25);
  }
  consume(cues: YardCue[], color: string, reduced: boolean): void {
    for (const cue of cues) {
      const tint = cue.kind === 'charge' ? '#ffde72' : cue.kind === 'kill' ? '#b7d86d' : cue.kind === 'breach' || cue.kind === 'error' ? '#ff8870' : cue.kind === 'hit' ? '#ffc776' : color;
      if (cue.text && cue.kind !== 'error' && cue.kind !== 'place' && cue.kind !== 'wave') this.floaters.push({ row: cue.row, x: cue.x, text: cue.text, age: 0, color: tint });
      if (reduced) continue;
      if (cue.kind === 'breach' || cue.kind === 'sweep') this.shake = 0.2;
      const count = cue.kind === 'shoot' ? 3 : cue.kind === 'error' ? 0 : cue.kind === 'kill' ? 14 : 9;
      for (let i = 0; i < count; i++) { const a = i * 2.4 + this.time, speed = 0.5 + i % 4 * 0.3;
        this.particles.push({ row: cue.row, x: cue.x, dx: Math.cos(a) * speed, dy: Math.sin(a) * speed - 0.5, age: 0, life: 0.3 + i % 5 * 0.13, color: tint });
      }
    }
    this.particles = this.particles.slice(-200); this.floaters = this.floaters.slice(-24);
  }
}
