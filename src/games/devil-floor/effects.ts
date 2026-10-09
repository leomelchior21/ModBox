export type FloorCueKind = 'jump' | 'doubleJump' | 'land' | 'crystal' | 'hit' | 'shield' | 'checkpoint' | 'crumble' | 'respawn' | 'clear';
export interface FloorCue { kind: FloorCueKind; x: number; y: number; text?: string; power?: number }
interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: string; gravity: number }
interface Ring { x: number; y: number; age: number; life: number; color: string; kind: FloorCueKind }
interface Floater { x: number; y: number; age: number; life: number; text: string; color: string }
export interface FloorNotice { id: number; kind: FloorCueKind; text: string }

/** Presentation owns its clock and particles; it never changes the game physics. */
export class FloorEffects {
  time = 0;
  particles: Particle[] = [];
  rings: Ring[] = [];
  floaters: Floater[] = [];
  trail: { x: number; y: number; age: number }[] = [];
  shake = 0;
  damage = 0;
  squash = 0;
  scorePulse = 0;
  lifePulse = 0;
  notice: FloorNotice | null = null;
  private noticeLife = 0;
  private serial = 0;
  private seed = 71;
  reset(): void {
    this.particles = []; this.rings = []; this.floaters = []; this.trail = [];
    this.shake = this.damage = this.squash = this.scorePulse = this.lifePulse = 0;
    this.notice = null; this.noticeLife = 0;
  }
  consume(cues: readonly FloorCue[], suitColor: string, reducedMotion: boolean): void {
    for (const cue of cues) {
      const color = cue.kind === 'hit' || cue.kind === 'crumble' ? '#ff744b'
        : cue.kind === 'crystal' ? '#9ff5ec' : cue.kind === 'checkpoint' || cue.kind === 'shield' || cue.kind === 'clear' ? '#e5e9a5' : suitColor;
      const count = cue.kind === 'clear' ? 38 : cue.kind === 'hit' || cue.kind === 'crumble' ? 26 : cue.kind === 'land' ? 10 : 16;
      if (!reducedMotion) for (let i = 0; i < count; i++) {
        const angle = this.random() * Math.PI * 2, speed = 25 + this.random() * (cue.kind === 'hit' ? 140 : 85);
        this.particles.push({ x: cue.x + (cue.kind === 'crumble' ? (this.random() - 0.5) * (cue.power ?? 170) : 0), y: cue.y, vx: Math.cos(angle) * speed,
          vy: cue.kind === 'land' || cue.kind === 'crumble' ? -15 - this.random() * 65 : Math.sin(angle) * speed - 35,
          age: 0, life: 0.3 + this.random() * 0.6, size: cue.kind === 'crumble' ? 3 + this.random() * 7 : 1 + this.random() * 3,
          color: cue.kind === 'crumble' && i % 3 ? '#788164' : color,
          gravity: cue.kind === 'crystal' || cue.kind === 'shield' ? 25 : 190 });
      }
      this.particles = this.particles.slice(-180);
      this.rings.push({ x: cue.x, y: cue.y, age: 0, life: reducedMotion ? 0.22 : 0.55, color, kind: cue.kind });
      this.rings = this.rings.slice(-16);
      if (cue.text) this.floaters.push({ x: cue.x, y: cue.y - 15, age: 0, life: 1.15, text: cue.text, color });
      this.floaters = this.floaters.slice(-12);
      if (cue.kind === 'crystal' || cue.kind === 'clear') this.scorePulse = 1;
      if (cue.kind === 'hit') { this.damage = 1; this.lifePulse = 1; this.shake = reducedMotion ? 0 : 6; }
      if (cue.kind === 'land') { this.squash = reducedMotion ? 0 : Math.min(1, (cue.power ?? 200) / 500); }
      if (cue.kind === 'crumble') this.shake = reducedMotion ? 0 : 2.5;
      if (cue.kind === 'checkpoint' || cue.kind === 'shield' || cue.kind === 'hit' || cue.kind === 'clear' || cue.kind === 'doubleJump') {
        this.notice = { id: ++this.serial, kind: cue.kind, text: cue.text ?? cue.kind.toUpperCase() }; this.noticeLife = 2;
      }
    }
  }
  step(dt: number): void {
    dt = Math.max(0, Math.min(dt, 0.1)); this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18); this.damage = Math.max(0, this.damage - dt * 2.8);
    this.squash = Math.max(0, this.squash - dt * 5); this.scorePulse = Math.max(0, this.scorePulse - dt * 2.5); this.lifePulse = Math.max(0, this.lifePulse - dt * 2);
    for (const p of this.particles) { p.age += dt; p.vy += p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.particles = this.particles.filter(p => p.age < p.life);
    for (const ring of this.rings) ring.age += dt;
    this.rings = this.rings.filter(r => r.age < r.life);
    for (const floater of this.floaters) floater.age += dt;
    this.floaters = this.floaters.filter(f => f.age < f.life);
    for (const point of this.trail) point.age += dt;
    this.trail = this.trail.filter(p => p.age < 0.22);
    this.noticeLife -= dt; if (this.noticeLife <= 0) this.notice = null;
  }
  follow(x: number, y: number, moving: boolean, reducedMotion: boolean): void {
    if (moving && !reducedMotion) this.trail = [...this.trail, { x, y, age: 0 }].slice(-14);
  }
  private random(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
}
