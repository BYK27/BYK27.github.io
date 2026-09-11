// Each sound is a list of [frequency Hz, start offset s, duration s].
const SOUNDS = {
  move: [[880, 0, 0.045]],
  confirm: [[660, 0, 0.06], [990, 0.06, 0.09]],
  back: [[520, 0, 0.06], [350, 0.06, 0.09]],
  start: [[523, 0, 0.07], [659, 0.07, 0.07], [784, 0.14, 0.07], [1047, 0.21, 0.16]],
};

export class Sfx {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  play(name) {
    if (!this.enabled || !SOUNDS[name]) return;
    const ctx = this.context();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (const [freq, offset, duration] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;

      // Short attack and exponential release avoid clicks.
      const t0 = now + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.045, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }
  }

  context() {
    // Browsers only allow audio after a user gesture, so the context is created lazily.
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
}
