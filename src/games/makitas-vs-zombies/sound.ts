import type { YardEvent } from './run';
export class YardSound {
  private context: AudioContext | null = null; private lastShot = -1; muted = false;
  unlock(): void {
    if (!window.AudioContext) return;
    try { this.context ??= new window.AudioContext(); if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined); } catch { this.context = null; }
  }
  play(event: YardEvent): void {
    const ctx = this.context; if (!ctx || this.muted || ctx.state !== 'running') return;
    if (event === 'shoot' && ctx.currentTime - this.lastShot < 0.12) return;
    if (event === 'shoot') this.lastShot = ctx.currentTime;
    const frequency = { place: 300, shoot: 130, hit: 90, kill: 360, charge: 750, wave: 180, breach: 65, upgrade: 640, clear: 900, error: 110, sweep: 240 }[event];
    const tone = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime, duration = event === 'wave' || event === 'clear' ? 0.35 : 0.12;
    tone.type = event === 'shoot' || event === 'hit' ? 'sawtooth' : 'triangle';
    tone.frequency.setValueAtTime(frequency, now); tone.frequency.exponentialRampToValueAtTime(frequency * (event === 'breach' ? 0.5 : 1.6), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(event === 'shoot' || event === 'hit' ? 0.018 : 0.045, now + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    tone.connect(gain); gain.connect(ctx.destination); tone.onended = () => { tone.disconnect(); gain.disconnect(); }; tone.start(now); tone.stop(now + duration + 0.01);
  }
  destroy(): void { if (this.context) void this.context.close().catch(() => undefined); this.context = null; }
}
