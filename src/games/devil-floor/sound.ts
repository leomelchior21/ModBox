import type { FloorEvent } from './run';

export class FloorSound {
  private context: AudioContext | null = null;
  muted = false;
  unlock(): void {
    if (!window.AudioContext) return;
    try { this.context ??= new window.AudioContext(); if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined); }
    catch { this.context = null; }
  }
  play(event: FloorEvent): void {
    const ctx = this.context;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const tone = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
    const frequency = { jump: 260, crystal: 800, hit: 90, shield: 480, checkpoint: 600, clear: 980 }[event];
    tone.type = event === 'hit' ? 'triangle' : 'sine';
    tone.frequency.setValueAtTime(frequency, now); tone.frequency.exponentialRampToValueAtTime(frequency * (event === 'hit' ? 0.5 : 1.6), now + 0.13);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.07, now + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    tone.connect(gain); gain.connect(ctx.destination); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    tone.start(now); tone.stop(now + 0.19);
  }
  destroy(): void { if (this.context) void this.context.close().catch(() => undefined); this.context = null; }
}
