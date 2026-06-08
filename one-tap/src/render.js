/**
 * RENDERER — pure Canvas neon primitives (rule 2/7). No images.
 * Handles DPR scaling (capped for low-end Android), screen shake, red flash,
 * parallax starfield, glowing pipes, bird with trail, particles.
 */
import { STATE } from './game.js';
import { skinById } from './skins.js';

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // cap for perf
    this.stars = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w; this.h = h;
    this.game.resize(w, h);
    this._initStars();
  }

  _initStars() {
    this.stars = [];
    const n = Math.round((this.w * this.h) / 14000);
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random() * this.w, y: Math.random() * this.h,
        z: Math.random() * 0.8 + 0.2, r: Math.random() * 1.4 + 0.3,
      });
    }
  }

  draw(dt) {
    const ctx = this.ctx, g = this.game;
    ctx.save();

    // screen shake
    if (g.shake > 0) {
      const s = g.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // background
    ctx.fillStyle = '#05060a';
    ctx.fillRect(-40, -40, this.w + 80, this.h + 80);

    // starfield drift (only while playing for motion cue)
    const moving = g.state === STATE.PLAYING;
    ctx.fillStyle = 'rgba(120,160,200,0.5)';
    for (const st of this.stars) {
      if (moving) { st.x -= dt * g.pipeSpeed() * 0.18 * st.z; if (st.x < 0) st.x += this.w; }
      ctx.globalAlpha = 0.25 + st.z * 0.5;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const skin = skinById(this.game.skinId || 'cyan');

    // pipes
    for (const p of g.pipes) this._pipe(ctx, p);

    // bird (hide during pure READY handled by main showing overlay; draw anyway)
    this._bird(ctx, g.bird, skin, g);

    // particles
    for (const pt of g.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // red flash (full-screen, above shake)
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,45,107,${0.55 * g.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  _pipe(ctx, p) {
    const gapBottom = p.gapTop + p.gapH;
    const gradTop = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
    gradTop.addColorStop(0, '#0b3b46');
    gradTop.addColorStop(0.5, '#0e5563');
    gradTop.addColorStop(1, '#0b3b46');
    ctx.fillStyle = gradTop;
    ctx.shadowColor = 'rgba(0,240,255,0.55)';
    ctx.shadowBlur = 18;
    // top column
    ctx.fillRect(p.x, -20, p.w, p.gapTop + 20);
    // bottom column
    ctx.fillRect(p.x, gapBottom, p.w, this.h - gapBottom + 20);
    ctx.shadowBlur = 0;

    // bright gap-edge rims (the thing you "almost" clear)
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(p.x, p.gapTop - 4, p.w, 4);
    ctx.fillRect(p.x, gapBottom, p.w, 4);
  }

  _bird(ctx, b, skin, g) {
    // trail
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = skin.trail;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(b.x - i * b.r * 0.6, b.y - b.vy * 0.002 * i, b.r * (1 - i * 0.15), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot * 0.5);
    ctx.shadowColor = skin.body;
    ctx.shadowBlur = 22;
    ctx.fillStyle = skin.body;
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 7); ctx.fill();
    // inner core
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-b.r * 0.25, -b.r * 0.25, b.r * 0.35, 0, 7); ctx.fill();
    // invuln ring
    if (g.invuln > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, b.r + 6, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}
