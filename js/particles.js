/* Particle system - pooled + capped for low-end devices (keeps 60fps).
   Used for trail, crash burst, coin sparkle. */
(function (global) {
  'use strict';

  function Particles(max) {
    this.max = max || CONFIG.MAX_PARTICLES;
    this.pool = [];
    for (var i = 0; i < this.max; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
    }
  }

  Particles.prototype._get = function () {
    for (var i = 0; i < this.max; i++) if (!this.pool[i].active) return this.pool[i];
    return null; // capped: silently drop when full
  };

  Particles.prototype.emit = function (x, y, count, opts) {
    opts = opts || {};
    for (var i = 0; i < count; i++) {
      var p = this._get(); if (!p) return;
      p.active = true;
      p.x = x; p.y = y;
      var ang = opts.angle != null ? opts.angle + Utils.rand(-0.5, 0.5) : Utils.rand(0, Math.PI * 2);
      var spd = Utils.rand(opts.minSpeed || 1, opts.maxSpeed || 5);
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.maxLife = p.life = Utils.rand(opts.minLife || 0.3, opts.maxLife || 0.8);
      p.size = Utils.rand(opts.minSize || 2, opts.maxSize || 5);
      p.color = opts.color || '#00f0ff';
      p.gravity = opts.gravity || 0;
    }
  };

  Particles.prototype.update = function (dt) {
    for (var i = 0; i < this.max; i++) {
      var p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.96; p.vy *= 0.96;
    }
  };

  Particles.prototype.draw = function (ctx) {
    for (var i = 0; i < this.max; i++) {
      var p = this.pool[i];
      if (!p.active) continue;
      var a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Particles.prototype.clear = function () {
    for (var i = 0; i < this.max; i++) this.pool[i].active = false;
  };

  global.Particles = Particles;
})(window);
