import type { MazeEvent } from './run';

/** Small synthesized signals; audio starts only from a player gesture. */
export class MazeSound {
  private context: AudioContext | null = null;
  muted = false;
  unlock(): void {
    const Audio = window.AudioContext;
    if (!Audio) return;
    try {
      this.context ??= new Audio();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch { this.context = null; }
  }
  play(event: MazeEvent): void {
    const context = this.context;
    if (!context || this.muted || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const frequencies = { core: 740, phase: 230, hit: 90, shield: 480, clear: 980 };
    const now = context.currentTime;
    oscillator.type = event === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[event], now);
    oscillator.frequency.exponentialRampToValueAtTime(frequencies[event] * (event === 'hit' ? 0.5 : 1.6), now + 0.13);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.08, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now); oscillator.stop(now + 0.19);
  }
  destroy(): void {
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
