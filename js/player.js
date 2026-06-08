/* Player: a glowing neon orb with a comet trail. Steers left/right.
   Position is x01 in [0..1] across the full screen width (resolution independent). */
(function (global) {
  'use strict';

  function Player() { this.reset(); }

  Player.prototype.reset = function () {
    this.x01 = 0.5;
    this.vx = 0;
    this.skinColor = '#00f0ff';
    this.tilt = 0;
  };

  Player.prototype.update = function (dt, axis) {
    this.vx += axis * CONFIG.MOVE_SPEED * dt * 0.02;
    this.vx *= 0.80;                 // drift friction
    this.x01 += this.vx;

    var margin = 0.04;
    if (this.x01 < margin) { this.x01 = margin; this.vx *= -0.25; }
    if (this.x01 > 1 - margin) { this.x01 = 1 - margin; this.vx *= -0.25; }

    this.tilt = Utils.clamp(this.vx * 18, -0.5, 0.5);
  };

  // Draw in screen pixels. view supplies playerY and r.
  Player.prototype.draw = function (ctx, view) {
    var px = this.x01 * view.w;
    var py = view.playerY;
    var r = view.r;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.tilt);

    // outer glow
    ctx.shadowColor = this.skinColor;
    ctx.shadowBlur = 28;
    var grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, this.skinColor);
    grad.addColorStop(1, this.skinColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // crisp ring
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    return px;
  };

  global.Player = Player;
})(window);
