/**
 * ONE TAP — core gameplay engine (SDK-agnostic, no DOM, no ads).
 * Portrait one-tap precision: tap = single upward impulse to thread the
 * next gap. Difficulty ramps INVISIBLY; levels 1-3 are unloseable.
 *
 * Pure simulation: update(dt) + state. Rendering & ads live elsewhere.
 */

export const STATE = Object.freeze({
  READY: 'READY',
  PLAYING: 'PLAYING',
  DEAD: 'DEAD',     // freeze-frame window
  CARD: 'CARD',
});

// Reference design height; all physics scale from this for device parity.
const REF_H = 720;
const PIPES_PER_LEVEL = 4;     // pass 4 gaps -> next level
const NEAR_MISS_PX = 12;       // crash within this of the gap edge => "SO CLOSE"
const UNLOSEABLE_UNTIL = 3;    // levels 1..3 cannot be lost (huge gaps, slow)

export class Game {
  constructor() {
    this.reset(1, 1);
    this.w = 360; this.h = 720; this.scale = 1;
  }

  resize(w, h) {
    this.w = w; this.h = h; this.scale = h / REF_H;
    if (this.state === STATE.READY) this._placeBird();
  }

  _placeBird() {
    this.bird.x = this.w * 0.32;
    this.bird.y = this.h * 0.42;
    this.bird.vy = 0;
  }

  reset() {
    const s = this.scale || 1;
    this.state = STATE.READY;
    this.score = 0;
    this.level = 1;
    this.passed = 0;
    this.pipes = [];
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.deadT = 0;
    this.nearMiss = false;
    this.invuln = 0;
    this.spawnX = 0;
    this.bird = { x: 0, y: 0, vy: 0, r: 13 * s, rot: 0 };
    this._placeBird();
  }

  // ---- difficulty curve (hidden ramp) ----
  gapHeight() {
    // huge & forgiving early, tightens after level 3, floored so it's always fair
    if (this.level <= UNLOSEABLE_UNTIL) return this.h * 0.46;
    const t = this.level - UNLOSEABLE_UNTIL;
    return Math.max(this.h * 0.20, this.h * 0.42 - t * this.h * 0.018);
  }
  pipeSpeed() {
    const base = this.w * 0.62; // px/sec
    if (this.level <= UNLOSEABLE_UNTIL) return base * 0.78;
    const t = this.level - UNLOSEABLE_UNTIL;
    return Math.min(this.w * 1.25, base * (1 + t * 0.045));
  }
  spawnGap() {
    // horizontal distance between pipes (shrinks slightly with level)
    const t = Math.max(0, this.level - UNLOSEABLE_UNTIL);
    return Math.max(this.w * 0.62, this.w * 0.92 - t * this.w * 0.02);
  }
  gravity() { return this.h * 1.9; }
  impulse() { return -this.h * 0.62; }

  start() {
    if (this.state !== STATE.READY) return;
    this.state = STATE.PLAYING;
    this.invuln = 0.4;
    this._spawnPipe(this.w * 1.05);
    this.flap();
  }

  flap() {
    if (this.state !== STATE.PLAYING) return;
    this.bird.vy = this.impulse();
  }

  /** Resume after a rewarded revive: clear nearby pipes, brief shield. */
  revive() {
    this.state = STATE.PLAYING;
    this.bird.vy = this.impulse() * 0.6;
    this.invuln = 1.3;
    this.flash = 0;
    // clear pipes immediately around the bird so revive is fair
    this.pipes = this.pipes.filter((p) => p.x > this.bird.x + this.w * 0.5);
    if (this.pipes.length === 0) this._spawnPipe(this.w * 1.1);
  }

  _spawnPipe(x) {
    const gh = this.gapHeight();
    const margin = this.h * 0.10;
    const gapTop = margin + Math.random() * (this.h - gh - margin * 2);
    this.pipes.push({ x, w: this.w * 0.17, gapTop, gapH: gh, scored: false });
  }

  update(dt) {
    // particles & screen effects always decay
    this.shake = Math.max(0, this.shake - dt * 60);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this._updateParticles(dt);

    if (this.state === STATE.DEAD) { this.deadT += dt; return; }
    if (this.state !== STATE.PLAYING) return;

    if (this.invuln > 0) this.invuln -= dt;

    // bird physics
    const b = this.bird;
    b.vy += this.gravity() * dt;
    b.y += b.vy * dt;
    b.rot = Math.max(-0.5, Math.min(1.2, b.vy / (this.h * 0.9)));

    // move pipes
    const sp = this.pipeSpeed();
    for (const p of this.pipes) p.x -= sp * dt;

    // spawn cadence: new pipe enters from the right once the last one has
    // travelled the level-scaled horizontal gap inward from the edge.
    const last = this.pipes[this.pipes.length - 1];
    if (!last || last.x <= this.w - this.spawnGap()) this._spawnPipe(this.w);

    // cull + scoring
    for (const p of this.pipes) {
      if (!p.scored && p.x + p.w < b.x) {
        p.scored = true;
        this._onPass();
      }
    }
    this.pipes = this.pipes.filter((p) => p.x + p.w > -10);

    // collisions
    this._checkCollision();
  }

  _onPass() {
    this.score += 1;
    this.passed += 1;
    this.emitScore && this.emitScore();
    const newLevel = Math.floor(this.passed / PIPES_PER_LEVEL) + 1;
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.emitLevel && this.emitLevel(this.level);
    }
    // success sparkle at the gap
    this._burst(this.bird.x + this.bird.r, this.bird.y, 6, '#27e3a7');
  }

  _checkCollision() {
    const b = this.bird;
    // ceiling / floor
    if (b.y - b.r < 0) { b.y = b.r; b.vy = 0; }
    if (b.y + b.r > this.h) { this._die(false, this.h); return; }

    if (this.level <= UNLOSEABLE_UNTIL || this.invuln > 0) return;

    for (const p of this.pipes) {
      const withinX = b.x + b.r > p.x && b.x - b.r < p.x + p.w;
      if (!withinX) continue;
      const gapBottom = p.gapTop + p.gapH;
      const topOverlap = (p.gapTop) - (b.y - b.r);     // >0 means into top wall
      const botOverlap = (b.y + b.r) - gapBottom;       // >0 means into bottom wall
      if (topOverlap > 0 || botOverlap > 0) {
        const overlap = Math.max(topOverlap, botOverlap);
        const near = overlap <= NEAR_MISS_PX;
        this._die(near, b.y);
        return;
      }
    }
  }

  _die(near) {
    this.state = STATE.DEAD;
    this.deadT = 0;
    this.nearMiss = near;
    this.shake = near ? 26 : 18;
    this.flash = 1;
    this._burst(this.bird.x, this.bird.y, 26, near ? '#ff2d6b' : '#ff5a3c');
    this.onDie && this.onDie(near);
  }

  finalizeCard() { this.state = STATE.CARD; }

  // ---- particles ----
  _burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (Math.random() * 0.5 + 0.3) * this.w;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, color, r: (Math.random() * 3 + 1.5) * (this.scale || 1),
      });
    }
  }
  _updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt * 1.8;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += this.h * 0.9 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  /** Percentile heuristic (client-side, no backend). Honest: it's a curve,
   *  not a real leaderboard. Higher level => higher (capped) percentile. */
  percentile() {
    const lvl = this.level;
    if (lvl <= 1) return 12;
    const v = Math.min(99, Math.round(35 + Math.log2(lvl) * 22));
    return v;
  }
}
