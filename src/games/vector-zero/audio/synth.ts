/* ============================================================================
   VECTOR ZERO — ORIGINAL SOUND SYNTHESIS
   Everything is generated from oscillators and noise at runtime: no assets,
   no downloads, no copyright. Audio is created on the first user gesture so
   browser autoplay rules are respected.
   ========================================================================== */

export type SoundName =
  | 'laser'
  | 'hit'
  | 'break'
  | 'death'
  | 'shield'
  | 'unlock'
  | 'success'
  | 'wave'
  | 'ui';

type Ctx = AudioContext;

export class Synth {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private lastPlayed = new Map<SoundName, number>();
  private mutedFlag = false;

  /** Safe to call often; only creates audio on the first real gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.mutedFlag ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    const frames = Math.floor(this.ctx.sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  get muted(): boolean {
    return this.mutedFlag;
  }

  play(name: SoundName): void {
    if (!this.ctx || !this.master || this.mutedFlag) return;
    const now = this.ctx.currentTime;
    const throttle = name === 'laser' ? 0.045 : name === 'hit' ? 0.03 : 0;
    if (throttle) {
      const last = this.lastPlayed.get(name) ?? -1;
      if (now - last < throttle) return;
      this.lastPlayed.set(name, now);
    }
    if (this.voices > 22) return;
    this.voices += 1;
    window.setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
    }, 700);

    switch (name) {
      case 'laser':
        this.blip(760, 210, 0.09, 'square', 0.065);
        break;
      case 'hit':
        this.blip(300, 150, 0.07, 'triangle', 0.05);
        this.burst(0.05, 0.035, 1800);
        break;
      case 'break':
        this.burst(0.22, 0.11, 900);
        this.blip(180, 60, 0.18, 'sawtooth', 0.035);
        break;
      case 'death':
        this.blip(320, 40, 0.62, 'sawtooth', 0.09);
        this.burst(0.5, 0.09, 500);
        break;
      case 'shield':
        this.tone(330, 0.28, 0.05, 0);
        this.tone(494, 0.3, 0.045, 0.04);
        break;
      case 'unlock':
        this.tone(660, 0.16, 0.06, 0);
        this.tone(990, 0.22, 0.05, 0.09);
        break;
      case 'success':
        this.tone(523, 0.16, 0.05, 0);
        this.tone(659, 0.16, 0.05, 0.08);
        this.tone(784, 0.26, 0.05, 0.16);
        break;
      case 'wave':
        this.tone(196, 0.3, 0.05, 0);
        this.tone(294, 0.4, 0.045, 0.1);
        break;
      case 'ui':
        this.tone(880, 0.06, 0.03, 0);
        break;
    }
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }

  /* --------------------------------------------------------------- primitives */

  private blip(from: number, to: number, duration: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private tone(frequency: number, duration: number, gain: number, delay: number): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private burst(duration: number, gain: number, cutoff: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), now + duration);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }
}

export const synth = new Synth();
