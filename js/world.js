/* World: endless scrolling obstacle field with progressive difficulty.
   Obstacle rows are lane-based gates with one or more safe gaps.
   Coins spawn in safe gaps to pull the player into near-misses. */
(function (global) {
  'use strict';

  function World() {
    this.reset();
  }

  World.prototype.reset = function () {
    this.speed = CONFIG.START_SPEED;
    this.scrollY = 0;          // total distance scrolled (px)
    this.obstacles = [];       // {y, gaps:[laneIndices safe], passed:bool}
    this.coins = [];           // {x01, y, taken:bool}
    this.nextSpawnY = -200;    // spawn ahead of screen top
    this.distancePx = 0;
  };

  // Spawn obstacle rows to fill ahead of the visible top.
  World.prototype._spawnAhead = function (topY) {
    while (this.nextSpawnY > topY - 400) {
      var lanes = CONFIG.LANES;
      // number of safe gaps shrinks slightly as speed rises (harder)
      var t = (this.speed - CONFIG.START_SPEED) / (CONFIG.MAX_SPEED - CONFIG.START_SPEED);
      var gapCount = this.distancePx < 600 ? 3 : (t > 0.6 ? 1 : 2);
      var gaps = [];
      while (gaps.length < gapCount) {
        var g = Utils.randInt(0, lanes - 1);
        if (gaps.indexOf(g) < 0) gaps.push(g);
      }
      var row = { y: this.nextSpawnY, gaps: gaps, passed: false };
      this.obstacles.push(row);

      // place a coin in one of the safe gaps sometimes
      if (Math.random() < 0.7) {
        var gl = Utils.choice(gaps);
        var x01 = (gl + 0.5) / lanes;
        this.coins.push({ x01: x01, y: this.nextSpawnY, taken: false });
      }

      var gap = Utils.rand(CONFIG.OBSTACLE_MIN_GAP, CONFIG.OBSTACLE_MAX_GAP);
      // gaps get tighter (vertically) with speed
      gap *= Utils.lerp(1, 0.7, t);
      this.nextSpawnY -= gap;
    }
  };

  World.prototype.update = function (dt) {
    // ramp speed
    this.speed = Utils.clamp(this.speed + CONFIG.SPEED_RAMP * dt * 60, CONFIG.START_SPEED, CONFIG.MAX_SPEED);
    var move = this.speed * dt;
    this.scrollY += move;
    this.distancePx += move;

    // move rows down (in world space we move things down by increasing y)
    for (var i = 0; i < this.obstacles.length; i++) this.obstacles[i].y += move;
    for (var j = 0; j < this.coins.length; j++) this.coins[j].y += move;

    // recycle off-screen (below)
    this.obstacles = this.obstacles.filter(function (o) { return o.y < CONFIG.BASE_H + 100; });
    this.coins = this.coins.filter(function (c) { return c.y < CONFIG.BASE_H + 100 && !c.taken; });

    // top of where we need obstacles (in this downward scheme, spawn at small/neg y)
    // We track nextSpawnY relative to scroll; simplest: spawn until we have rows above screen.
    this._ensureAhead();
  };

  // Maintain a buffer of rows above the visible area.
  World.prototype._ensureAhead = function () {
    // find the highest (smallest y) obstacle
    var minY = CONFIG.BASE_H;
    for (var i = 0; i < this.obstacles.length; i++) if (this.obstacles[i].y < minY) minY = this.obstacles[i].y;
    while (minY > -200) {
      var lanes = CONFIG.LANES;
      var t = (this.speed - CONFIG.START_SPEED) / (CONFIG.MAX_SPEED - CONFIG.START_SPEED);
      var gapCount = this.distancePx < 600 ? 3 : (t > 0.6 ? 1 : 2);
      var gaps = [];
      while (gaps.length < gapCount) {
        var g = Utils.randInt(0, lanes - 1);
        if (gaps.indexOf(g) < 0) gaps.push(g);
      }
      var gapV = Utils.rand(CONFIG.OBSTACLE_MIN_GAP, CONFIG.OBSTACLE_MAX_GAP) * Utils.lerp(1, 0.7, t);
      minY -= gapV;
      this.obstacles.push({ y: minY, gaps: gaps, passed: false });
      if (Math.random() < 0.7) {
        var gl = Utils.choice(gaps);
        this.coins.push({ x01: (gl + 0.5) / lanes, y: minY, taken: false });
      }
    }
  };

  // Returns {crash:bool, coinsGot:int, nearMiss:bool, passedRow:bool}
  World.prototype.checkCollisions = function (playerX01, playerY, playerR, playW, playX) {
    var res = { crash: false, coinsGot: 0, nearMiss: false, passedRow: false };
    var lanes = CONFIG.LANES;
    var laneW01 = 1 / lanes;
    var rowH = 26; // obstacle bar thickness

    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      // collision band around player's y
      if (o.y + rowH >= playerY - playerR && o.y <= playerY + playerR) {
        // which lane is the player in?
        var lane = Math.floor(playerX01 / laneW01);
        if (lane < 0) lane = 0; if (lane >= lanes) lane = lanes - 1;
        var safe = o.gaps.indexOf(lane) >= 0;
        if (!safe) { res.crash = true; }
        else {
          // near-miss detection: player close to a blocked lane edge
          for (var b = 0; b < lanes; b++) {
            if (o.gaps.indexOf(b) < 0) {
              var edge = (b + (b < lane ? 1 : 0)) * laneW01;
              if (Math.abs(playerX01 - edge) < laneW01 * 0.4) { res.nearMiss = true; break; }
            }
          }
        }
      }
      // scored when row passes below player
      if (!o.passed && o.y > playerY) { o.passed = true; res.passedRow = true; }
    }

    // coin pickup
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.taken) continue;
      var cy = coin.y;
      if (Math.abs(cy - playerY) < playerR + 12 && Math.abs(coin.x01 - playerX01) < 0.12) {
        coin.taken = true; res.coinsGot++;
      }
    }
    return res;
  };

  World.prototype.draw = function (ctx, playW, playX) {
    var lanes = CONFIG.LANES;
    var laneW = playW / lanes;
    var rowH = 26;

    // lane guide lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    for (var l = 1; l < lanes; l++) {
      var lx = playX + l * laneW;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, CONFIG.BASE_H); ctx.stroke();
    }

    // obstacles
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      for (var b = 0; b < lanes; b++) {
        if (o.gaps.indexOf(b) >= 0) continue; // safe gap, no bar
        var bx = playX + b * laneW;
        ctx.save();
        ctx.shadowColor = '#ff2bd6';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ff2bd6';
        roundRect(ctx, bx + 3, o.y, laneW - 6, rowH, 6);
        ctx.fill();
        ctx.restore();
      }
    }

    // coins
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.taken) continue;
      var cx = playX + coin.x01 * playW;
      ctx.save();
      ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(cx, coin.y, 7, 0, Math.PI * 2); ctx.fill();
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
