/* Player: a neon orb that steers left/right. Smooth, lag-free movement.
   Position stored as x01 (0..1 across play area) for resolution independence. */
(function (global) {
  'use strict';

  function Player() {
    this.reset();
  }

  Player.prototype.reset = function () {
    this.x01 = 0.5;       // center
    this.vx = 0;          // horizontal velocity (in 0..1 space)
    this.skinColor = '#00f0ff';
    this.trailTimer = 0;
    this.tilt = 0;        // visual lean
  };

  Player.prototype.update = function (dt, axis) {
    // Accelerate toward steering axis, with friction for a drifty feel.
    var accel = axis * CONFIG.MOVE_SPEED * dt;
    this.vx += accel;
    this.vx *= 0.82;                 // drift friction
    this.x01 += this.vx;

    // Walls (with a little bounce so hugging edges feels alive).
    if (this.x01 < 0.06) { this.x01 = 0.06; this.vx *= -0.3; }
    if (this.x01 > 0.94) { this.x01 = 0.94; this.vx *= -0.3; }

    // Visual tilt based on velocity.
    this.tilt = Utils.clamp(this.vx * 12, -0.5, 0.5);
  };

  Player.prototype.draw = function (ctx, playW, playX, y, r) {
    var px = playX + this.x01 * playW;
    ctx.save();
    ctx.translate(px, y);
    ctx.rotate(this.tilt);
    // glow
    ctx.shadowColor = this.skinColor;
    ctx.shadowBlur = 22;
    ctx.fillStyle = this.skinColor;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // inner highlight
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return px; // screen x for trail/particles
  };

  global.Player = Player;
})(window);
