/* World: endless scrolling obstacle field, FULL-SCREEN responsive.
   Works directly in screen pixels via a `view` object computed by the engine:
     view = { w, h, scale, lanes, laneW, playerY, r }
   Obstacle rows are lane gates with one or more safe gaps. Coins sit in gaps. */
(function (global) {
  'use strict';

  function World() { this.reset(); }

  World.prototype.reset = function () {
    this.speed = CONFIG.START_SPEED;
    this.distancePx = 0;
    this.obstacles = [];   // {y, gaps:[laneIdx safe]}
    this.coins = [];       // {lane, y, taken}
    this._seeded = false;
  };

  World.prototype._difficulty = function () {
    return Utils.clamp((this.speed - CONFIG.START_SPEED) / (CONFIG.MAX_SPEED - CONFIG.START_SPEED), 0, 1);
  };

  World.prototype._makeRow = function (view, y) {
    var lanes = view.lanes;
    var t = this._difficulty();
    // start easy (more gaps), tighten as speed grows
    var gapCount;
    if (this.distancePx < 700) gapCount = Math.max(3, lanes - 2);
    else if (t > 0.6) gapCount = Math.max(1, Math.floor(lanes * 0.35));
    else gapCount = Math.max(2, Math.floor(lanes * 0.5));

    var gaps = [];
    while (gaps.length < gapCount) {
      var g = Utils.randInt(0, lanes - 1);
      if (gaps.indexOf(g) < 0) gaps.push(g);
    }
    this.obstacles.push({ y: y, gaps: gaps });
    if (Math.random() < 0.72) {
      this.coins.push({ lane: Utils.choice(gaps), y: y, taken: false });
    }
  };

  // Fill rows above the visible top so the field never runs out.
  World.prototype._ensureAhead = function (view) {
    var sc = view.scale;
    var minY = Infinity;
    for (var i = 0; i < this.obstacles.length; i++) if (this.obstacles[i].y < minY) minY = this.obstacles[i].y;
    if (minY === Infinity) minY = view.h * 0.5; // first row starts mid-screen-ish

    var t = this._difficulty();
    while (minY > -120) {
      var gapV = Utils.rand(CONFIG.OBSTACLE_MIN_GAP, CONFIG.OBSTACLE_MAX_GAP) * Utils.lerp(1, 0.72, t) * sc;
      minY -= gapV;
      this._makeRow(view, minY);
    }
  };

  World.prototype.update = function (dt, view) {
    this.speed = Utils.clamp(this.speed + CONFIG.SPEED_RAMP * dt * 60, CONFIG.START_SPEED, CONFIG.MAX_SPEED);
    var move = this.speed * dt * view.scale;   // scale movement to screen
    this.distancePx += this.speed * dt;        // score uses reference units (consistent)

    for (var i = 0; i < this.obstacles.length; i++) this.obstacles[i].y += move;
    for (var j = 0; j < this.coins.length; j++) this.coins[j].y += move;

    var h = view.h;
    this.obstacles = this.obstacles.filter(function (o) { return o.y < h + 120; });
    this.coins = this.coins.filter(function (c) { return c.y < h + 120 && !c.taken; });

    this._ensureAhead(view);
  };

  // playerX01 in [0..1] across full width. Returns collision result.
  World.prototype.checkCollisions = function (playerX01, view) {
    var res = { crash: false, coinsGot: 0, nearMiss: false };
    var lanes = view.lanes;
    var playerY = view.playerY;
    var r = view.r;
    var rowH = CONFIG.OBSTACLE_THICK * view.scale;
    var lane = Utils.clamp(Math.floor(playerX01 * lanes), 0, lanes - 1);

    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.y + rowH >= playerY - r && o.y <= playerY + r) {
        var safe = o.gaps.indexOf(lane) >= 0;
        if (!safe) { res.crash = true; }
        else {
          // near-miss: an adjacent lane is blocked and we're close to its edge
          var leftBlocked = lane > 0 && o.gaps.indexOf(lane - 1) < 0;
          var rightBlocked = lane < lanes - 1 && o.gaps.indexOf(lane + 1) < 0;
          var within = (playerX01 * lanes) - lane; // 0..1 inside lane
          if ((leftBlocked && within < 0.32) || (rightBlocked && within > 0.68)) res.nearMiss = true;
        }
      }
    }

    var laneCenter01 = (lane + 0.5) / lanes;
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.taken) continue;
      var coin01 = (coin.lane + 0.5) / lanes;
      if (Math.abs(coin.y - playerY) < r + 14 * view.scale && Math.abs(coin01 - playerX01) < (0.5 / lanes)) {
        coin.taken = true; res.coinsGot++;
      }
    }
    return res;
  };

  World.prototype.draw = function (ctx, view) {
    var lanes = view.lanes, laneW = view.laneW, h = view.h;
    var rowH = CONFIG.OBSTACLE_THICK * view.scale;

    // lane guide lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1.5;
    for (var l = 1; l < lanes; l++) {
      var lx = l * laneW;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, h); ctx.stroke();
    }

    // obstacles
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      for (var b = 0; b < lanes; b++) {
        if (o.gaps.indexOf(b) >= 0) continue;
        var bx = b * laneW;
        ctx.save();
        ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 16;
        var g = ctx.createLinearGradient(bx, o.y, bx, o.y + rowH);
        g.addColorStop(0, '#ff5be0'); g.addColorStop(1, '#c01a9e');
        ctx.fillStyle = g;
        roundRect(ctx, bx + laneW * 0.06, o.y, laneW * 0.88, rowH, 7 * view.scale);
        ctx.fill();
        ctx.restore();
      }
    }

    // coins
    var pulse = 1 + Math.sin(Date.now() * 0.006) * 0.12;
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.taken) continue;
      var cx = (coin.lane + 0.5) * laneW;
      ctx.save();
      ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(cx, coin.y, 8 * view.scale * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(cx - 2.5 * view.scale, coin.y - 2.5 * view.scale, 3 * view.scale, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.World = World;
})(window);
