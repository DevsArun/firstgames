/* WebAudio synth SFX - zero asset files (keeps bundle tiny + instant load).
   All sounds generated procedurally. Mutes on pause/ad. */
(function (global) {
  'use strict';

  var Audio = {
    ctx: null,
    muted: false,
    _master: null,

    init: function () {
      if (this.ctx) return;
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._master = this.ctx.createGain();
        this._master.gain.value = 0.5;
        this._master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },

    // Must be called from a user gesture (browser autoplay policy).
    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMuted: function (m) {
      this.muted = m;
      if (this._master) this._master.gain.value = m ? 0 : 0.5;
    },

    _tone: function (freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain); gain.connect(this._master);
      osc.start(t); osc.stop(t + dur + 0.02);
    },

    _noise: function (dur, vol) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime;
      var n = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = this.ctx.createBufferSource(); src.buffer = buf;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.4;
      src.connect(g); g.connect(this._master);
      src.start(t);
    },

    // --- Named SFX ---
    coin:  function () { this._tone(880, 0.08, 'square', 0.22, 1320); },
    near:  function () { this._tone(1200, 0.06, 'sine', 0.18, 1600); },
    combo: function () { this._tone(660, 0.12, 'triangle', 0.25, 1100); },
    crash: function () { this._noise(0.35, 0.5); this._tone(160, 0.4, 'sawtooth', 0.3, 40); },
    click: function () { this._tone(420, 0.05, 'square', 0.2); },
    achieve: function () { this._tone(700, 0.1, 'triangle', 0.25, 1050); var s=this; setTimeout(function(){ s._tone(1050,0.14,'triangle',0.25,1400); },90); },
    revive: function () { this._tone(300, 0.2, 'sine', 0.25, 900); }
  };

  global.GameAudio = Audio;
})(window);
