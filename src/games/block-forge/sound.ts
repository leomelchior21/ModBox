export class ForgeSound {
  private context: AudioContext | null = null;
  muted = false;
  play(lines: number, combo = 0): void {
    if (this.muted || !window.AudioContext) return;
    try {
      this.context ??= new window.AudioContext();
      const ctx = this.context; if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const notes = lines ? [392, 494, 587, combo > 1 ? 988 : 784] : [220, 330];
      notes.forEach((frequency, i) => {
        const tone = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + i * 0.045;
        tone.type = 'sine'; tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.045, start + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        tone.connect(gain); gain.connect(ctx.destination); tone.onended = () => { tone.disconnect(); gain.disconnect(); }; tone.start(start); tone.stop(start + 0.24);
      });
    } catch { /* Sound is optional; the board always responds. */ }
  }
  destroy(): void { if (this.context) void this.context.close().catch(() => undefined); this.context = null; }
}
