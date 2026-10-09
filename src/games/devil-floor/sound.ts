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
    const frequency = { jump: 260, crystal: 800, hit: 90, shield: 480, checkpoint: 600, clear: 980, land: 110, crumble: 60 }[event];
    tone.type = event === 'hit' || event === 'land' || event === 'crumble' ? 'triangle' : 'sine';
    tone.frequency.setValueAtTime(frequency, now); tone.frequency.exponentialRampToValueAtTime(frequency * (event === 'hit' ? 0.5 : 1.6), now + 0.13);
    const duration = event === 'land' ? 0.09 : event === 'crumble' ? 0.3 : 0.18;
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(event === 'land' ? 0.025 : 0.07, now + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    tone.connect(gain); gain.connect(ctx.destination); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    tone.start(now); tone.stop(now + duration + 0.01);
  }
  destroy(): void { if (this.context) void this.context.close().catch(() => undefined); this.context = null; }
}
