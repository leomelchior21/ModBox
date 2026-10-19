import { ArcadeRun, clamp, type ArcadeAction } from '../premium-kit/core';
import { monsterCatalog } from './catalog';

export interface TrackSection { start: number; end: number; from: number; to: number; kind: 'grass' | 'ramp' | 'bridge' | 'rock'; checkpoint?: boolean }
export const MONSTER_TRACK: readonly TrackSection[] = [
  { start: -8, end: 18, from: 0, to: 0, kind: 'grass', checkpoint: true },
  { start: 18, end: 24, from: 0, to: 1.8, kind: 'ramp' },
  { start: 28, end: 44, from: 1.8, to: 1.8, kind: 'grass', checkpoint: true },
  { start: 44, end: 65, from: 1.8, to: 1.8, kind: 'bridge' },
  { start: 65, end: 82, from: 1.8, to: 2.2, kind: 'rock', checkpoint: true },
  { start: 82, end: 88, from: 2.2, to: 4.1, kind: 'ramp' },
  { start: 93, end: 109, from: 3.2, to: 3.2, kind: 'grass', checkpoint: true },
  { start: 109, end: 121, from: 3.2, to: 5.1, kind: 'ramp' },
  { start: 121, end: 138, from: 5.1, to: 5.1, kind: 'grass', checkpoint: true },
];
export function trackHeight(x: number, time = 0, level = 1): number | null {
  const s = MONSTER_TRACK.find(t => x >= t.start && x <= t.end); if (!s) return null;
  const t = (x - s.start) / (s.end - s.start), height = s.from + (s.to - s.from) * t;
  return height + (s.kind === 'bridge' ? -Math.sin(t * Math.PI) * (.65 + Math.sin(time * 1.9) * .08) : s.kind === 'rock' ? Math.sin(t * Math.PI * 6) * (.18 + Math.min(.18, level * .02)) : 0);
}
export class MonsterRun extends ArcadeRun {
  x = 2; y = 1; vy = 0; velocity = 0; pitch = 0; pitchVelocity = 0; grounded = true; wheelSpin = 0;
  turbo = 0; turboCooldown = 0; hopCooldown = 0; invulnerable = 0; suspension = 0; airtime = 0;
  coins = [12, 34, 49, 72, 99, 116, 130].map(x => ({ x, taken: false }));
  private safeX = 2; private flipped = 0;
  private pointers = new Map<number, 'left' | 'right'>();
  constructor(checkpoint?: unknown) { super('monster-strider', monsterCatalog.defaults, monsterCatalog.schema, checkpoint); }
  get goal() { return 133; }
  protected setup(): void {
    this.x = 2; this.y = 1; this.vy = 0; this.velocity = 0; this.pitch = 0; this.pitchVelocity = 0; this.grounded = true; this.wheelSpin = 0; this.safeX = 2;
    this.turbo = 0; this.turboCooldown = 0; this.hopCooldown = 0; this.invulnerable = 1; this.flipped = 0; this.airtime = 0; this.suspension = 0; this.pointers.clear();
    this.coins.forEach(c => { c.taken = false; }); this.notice = 'Hold GO / Right to accelerate. BRAKE / Left reverses. Build speed for the ramps.';
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'primary' && this.grounded && this.hopCooldown <= 0) { this.vy = 5; this.grounded = false; this.hopCooldown = 3; this.metrics.actions++; this.cue('launch', 0, 0, 'HOP'); }
    if (action === 'ability' && this.config.overdrive && this.turboCooldown <= 0) { this.turbo = 2.5; this.turboCooldown = 11; this.metrics.actions++; this.cue('ability', 0, 0, 'NITRO!'); }
    if (['left', 'right', 'up', 'down'].includes(action)) { this.metrics.actions++; this.velocity = clamp(this.velocity + (action === 'right' || action === 'up' ? 1.8 : -1.8), -5, this.config.power * .76); }
  }
  protected tick(dt: number): void {
    this.turbo = this.config.overdrive ? Math.max(0, this.turbo - dt) : 0; this.turboCooldown = Math.max(0, this.turboCooldown - dt); this.hopCooldown = Math.max(0, this.hopCooldown - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    const throttle = Number(this.input.right || this.input.up) - Number(this.input.left || this.input.down), power = this.config.power * (this.turbo > 0 ? 1.65 : 1);
    const front = trackHeight(this.x + 1, this.elapsed, this.level), back = trackHeight(this.x - 1, this.elapsed, this.level), under = trackHeight(this.x, this.elapsed, this.level);
    const slope = front !== null && back !== null ? Math.atan2(front - back, 2) : this.pitch;
    this.velocity += (throttle * power * .55 - this.velocity * (this.grounded ? .45 : .1) - (this.grounded ? Math.sin(slope) * this.config.gravity * .42 : 0)) * dt;
    this.velocity = clamp(this.velocity, -5, power * .76); this.x = Math.max(-5, this.x + this.velocity * dt); this.wheelSpin += this.velocity * dt / .55;
    const nowUnder = trackHeight(this.x, this.elapsed, this.level), support = nowUnder === null ? null : nowUnder + 1;
    if (this.grounded && under !== null && (support === null || this.y > support + .25)) { this.grounded = false; this.vy = this.velocity * Math.sin(slope); }
    if (!this.grounded) {
      this.airtime += dt; this.vy -= this.config.gravity * dt; this.y += this.vy * dt;
      this.pitchVelocity += (throttle * (this.config.assist ? .5 : -1.2) - this.pitchVelocity * (this.config.assist ? 5 : .5) - (this.config.assist ? this.pitch * 9 : 0)) * dt;
      this.pitch += this.pitchVelocity * dt;
      if (support !== null && this.y <= support && this.vy <= 0 && this.y > support - 2.2) {
        const impact = -this.vy; this.y = support; this.grounded = true; this.vy = 0; this.suspension = Math.min(.25, impact * .015);
        if (this.airtime > .18) { this.metrics.perfects++; if (this.config.assist) this.metrics.assisted++; this.addScore(25 + Math.round(this.airtime * 25), 0, 0, 'LANDED!'); this.cue('hit', 0, 0); }
        this.airtime = 0; this.notice = 'Nice landing. Ease the throttle before the rough section.';
      }
    } else {
      if (support !== null) { this.y = support; this.pitch += (slope - this.pitch) * Math.min(1, dt * (this.config.assist ? 14 : 8)); this.pitchVelocity *= Math.max(0, 1 - dt * 6); }
      else this.grounded = false;
      this.suspension = Math.max(0, this.suspension - dt * .8);
    }
    if (Math.abs(this.pitch) > 1.45 && this.grounded) this.flipped += dt; else this.flipped = 0;
    if (this.y < -5 || this.flipped > .35) { this.recover(this.y < -5 ? 'SPLASH. Build speed before the ramp; HOP can help.' : 'ROLLED OVER. Brake on landing or try autoBalance.'); return; }
    for (const s of MONSTER_TRACK) if (s.checkpoint && this.grounded && this.x > s.start + 2 && this.x < s.end - 3 && this.x > this.safeX && Math.abs(this.pitch) < .8) this.safeX = Math.max(this.safeX, s.start + 3);
    for (const coin of this.coins) if (!coin.taken && Math.abs(this.x - coin.x) < 1.2 && this.y >= (trackHeight(coin.x, this.elapsed, this.level) ?? 0) + .4) { coin.taken = true; this.addScore(this.config.bonus, 0, 0); }
    if (this.x >= this.goal && this.grounded) { this.addScore(300 + this.lives * 50, 0, 0, 'TRAIL CONQUERED'); this.clear(0, 0); }
  }
  private recover(message: string): void {
    if (this.invulnerable > 0) return; this.lose(0, 0, message);
    if (this.phase === 'playing') { this.x = this.safeX; this.y = (trackHeight(this.x, this.elapsed, this.level) ?? 0) + 1; this.vy = 0; this.velocity = 0; this.pitch = 0; this.pitchVelocity = 0; this.grounded = true; this.invulnerable = 1.5; this.airtime = 0; this.flipped = 0; }
  }
  releaseInput(): void { super.releaseInput(); this.pointers?.clear(); }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, _y: number, pointerId = 0): void {
    if (phase === 'cancel') { this.pointers.clear(); this.input.left = false; this.input.right = false; return; }
    if (this.phase !== 'playing') return;
    if (phase === 'down') { this.pointers.set(pointerId, x < 500 ? 'left' : 'right'); this.metrics.actions++; }
    if (phase === 'up') this.pointers.delete(pointerId);
    this.input.left = [...this.pointers.values()].includes('left'); this.input.right = [...this.pointers.values()].includes('right');
  }
  protected runtime() { return { distance: Math.floor(this.x), velocity: Math.round(Math.abs(this.velocity)), airborne: this.grounded ? 0 : 1 }; }
  protected stageSummary() { return { lives: this.lives, coins: this.coins.reduce((mask, coin, i) => mask | (coin.taken ? 1 << i : 0), 0) }; }
  protected restoreSummary(summary: Readonly<Record<string, number>>) { this.x = this.goal; this.y = (trackHeight(this.x, 0, this.level) ?? 0) + 1; this.lives = Math.floor(summary.lives ?? this.config.lives); this.coins.forEach((coin, i) => { coin.taken = Boolean((summary.coins ?? 0) & 1 << i); }); }
  stats() { return [{ label: 'TRAIL', value: `${Math.max(0, Math.floor(this.x))}m` }, { label: 'SPEED', value: `${Math.round(Math.abs(this.velocity) * 3.6)} km/h` }, { label: 'TRUCKS', value: this.lives }]; }
}
