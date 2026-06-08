/**
 * AUDIO — WebAudio synthesis only, ZERO asset files (rule 2).
 * Sound-on "juice" (rule 6). Must be unlocked by a user gesture on mobile.
 */
import { Store } from './store.js';

let ctx = null;
let master = null;
let ready = false;

export const Audio = {
  unlock() {
    if (ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      if (ctx.state === 'suspended') ctx.resume();
      ready = true;
    } catch {}
  },

  get muted() { return Store.get('muted'); },
  toggleMute() { Store.set('muted', !Store.get('muted')); },

  _beep(freq, dur, type = 'sine', vol = 0.5, slideTo = null) {
    if (!ready || Store.get('muted')) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch {}
  },

  flap()  { this._beep(520, 0.09, 'triangle', 0.35, 760); },
  score() { this._beep(880, 0.10, 'square', 0.25, 1240); },
  level() { this._beep(660, 0.12, 'sawtooth', 0.3, 990); setTimeout(() => this._beep(990, 0.14, 'sawtooth', 0.3, 1320), 90); },
  crash() { this._beep(180, 0.30, 'sawtooth', 0.5, 60); },
  nearMiss() { this._beep(140, 0.45, 'square', 0.55, 48); },
  reward() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._beep(f, 0.14, 'square', 0.3), i * 70)); },
  tickUp() { this._beep(1200, 0.04, 'square', 0.18); },
};
