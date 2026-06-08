/* Core engine: FULL-SCREEN responsive canvas, fixed-timestep loop,
   state machine, and run orchestration (scoring, ads, juice, retention). */
(function (global) {
  'use strict';

  var STATE = { LOADING: 'loading', MENU: 'menu', PLAY: 'play', PAUSED: 'paused', OVER: 'over', SKINS: 'skins', GUIDE: 'guide' };

  function Game() {
    this.canvas = null;
    this.ctx = null;
    this.state = STATE.LOADING;
    this.dpr = 1;

    // live view (recomputed on resize) - everything renders against this
    this.view = { w: 0, h: 0, scale: 1, lanes: 5, laneW: 0, playerY: 0, r: 18 };

    this.player = new Player();
    this.world = new World();
    this.particles = new Particles();

    this.muted = false;
    this.shake = 0;
    this.flash = 0;
    this.bgScroll = 0;

    this.distanceM = 0;
    this.runCoins = 0;
    this.runNearMiss = 0;
    this.combo = 0;
    this.reviveUsed = false;
    this.tutorialShown = false;
    this.runStartTime = 0;

    this._acc = 0;
    this._last = 0;
    this._step = 1 / 60;
  }

  Game.prototype.boot = function () {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    GameAudio.init();
    GameInput.attach(this.canvas);

    Save.load();
    Viral.init();
    this.muted = !!Utils.Storage.get('nds_muted', false);
    GameAudio.setMuted(this.muted);

    var self = this;
    GameInput.on('pause', function () { if (self.state === STATE.PLAY) self.pause(); });
    GameInput.on('action', function () {
      GameAudio.resume();
      if (self.state === STATE.PLAY && self.tutorialShown) {
        self.tutorialShown = false; UI.showTutorial(false);
      }
    });

    UI.init(this);
    this._resize();
    global.addEventListener('resize', function () { self._resize(); });
    global.addEventListener('orientationchange', function () { setTimeout(function () { self._resize(); }, 250); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === STATE.PLAY) self.pause();
    });

    var p = 0;
    var tick = setInterval(function () {
      p += 0.2; UI.setLoaderProgress(Math.min(1, p));
      if (p >= 1) {
        clearInterval(tick);
        // first-time players see the guide before the menu
        if (Save.data.runs === 0 && !Utils.Storage.get('nds_seen_guide', false)) self.openGuide(true);
        else self.toMenu();
      }
    }, 70);

    this._last = performance.now();
    requestAnimationFrame(this._frame.bind(this));
  };

  // ---- FULL-SCREEN responsive: canvas fills viewport; compute lanes + scale ----
  Game.prototype._resize = function () {
    var w = global.innerWidth, h = global.innerHeight;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    var v = this.view;
    v.w = w; v.h = h;
    v.scale = h / CONFIG.REF_H;                       // gameplay scales to height
    // lane count adapts to width so phones & wide desktops both feel right
    var lanes = Math.round(w / CONFIG.LANE_REF_WIDTH);
    v.lanes = Utils.clamp(lanes, CONFIG.LANES_MIN, CONFIG.LANES_MAX);
    v.laneW = w / v.lanes;
    v.playerY = h * CONFIG.PLAYER_Y_RATIO;
    v.r = CONFIG.PLAYER_RADIUS * v.scale;
  };

  // ---- State transitions ----
  Game.prototype.toMenu = function () {
    this.state = STATE.MENU;
    UI.showHud(false);
    UI.updateMenu(Save.data.bestDistance, Save.data.streak);
    UI.setMuteIcon(this.muted);
    UI.setMenuSkin(Save.getSkinColor());
    UI.showChallengeBanner(Viral.challenge);
    UI.show('menu');
  };

  Game.prototype.openGuide = function (firstTime) {
    this.state = STATE.GUIDE;
    this._guideFirstTime = !!firstTime;
    UI.show('guide');
  };
  Game.prototype.closeGuide = function () {
    Utils.Storage.set('nds_seen_guide', true);
    GameAudio.click();
    this.toMenu();
  };

  Game.prototype.openLeaderboard = function () {
    this.state = STATE.MENU;
    UI.renderLeaderboard(Viral.getLeaderboard());
    UI.show('leaderboard');
  };

  // ---- Viral share actions ----
  Game.prototype.shareScore = function () {
    GameAudio.click();
    var score = Math.max(Math.floor(this.distanceM), Save.data.bestDistance);
    Viral.shareScore(score, { challenge: false }).then(function (r) {
      if (r.method === 'clipboard') UI.info('\uD83D\uDCCB Copied! Paste it anywhere to share');
      else if (r.method === 'manual') UI.info('Share: ' + r.text);
      else UI.info('\uD83D\uDE80 Thanks for sharing!');
    });
  };
  Game.prototype.shareChallenge = function () {
    GameAudio.click();
    var score = Math.max(Math.floor(this.distanceM), Save.data.bestDistance);
    Viral.shareScore(score, { challenge: true, name: 'I' }).then(function (r) {
      if (r.method === 'clipboard') UI.info('\u2694\uFE0F Challenge link copied! Send it to a friend');
      else if (r.method === 'manual') UI.info('Challenge: ' + r.text);
      else UI.info('\u2694\uFE0F Challenge sent!');
    });
  };

  Game.prototype.startRun = function () {
    this.player.reset();
    this.player.skinColor = Save.getSkinColor();
    this.world.reset();
    this.particles.clear();
    this.distanceM = 0; this.runCoins = 0; this.runNearMiss = 0;
    this.combo = 0; this.reviveUsed = false; this.shake = 0; this.flash = 0;
    this.runStartTime = performance.now();

    this.state = STATE.PLAY;
    UI.show('');
    UI.showHud(true);
    UI.setDistance(0); UI.setCoins(0);

    if (Viral.challenge) UI.setChaseTag('\u2694\uFE0F Beat ' + Viral.challenge.name + ': ' + Viral.challenge.score + 'm');
    else if (Save.data.bestDistance > 0) UI.setChaseTag('\uD83C\uDFAF Best: ' + Save.data.bestDistance + 'm');
    else UI.setChaseTag(null);

    this.tutorialShown = Save.data.runs < 3;
    UI.showTutorial(this.tutorialShown);
    this._last = performance.now();
  };

  Game.prototype.pause = function () {
    if (this.state !== STATE.PLAY) return;
    this.state = STATE.PAUSED;
    GameAudio.setMuted(true);
    UI.show('pause');
  };
  Game.prototype.resume = function () {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAY;
    GameAudio.setMuted(this.muted);
    UI.show('');
    this._last = performance.now();
  };

  Game.prototype.toggleMute = function () {
    this.muted = !this.muted;
    GameAudio.setMuted(this.muted);
    Utils.Storage.set('nds_muted', this.muted);
    UI.setMuteIcon(this.muted);
  };

  Game.prototype.openSkins = function () {
    this.state = STATE.SKINS;
    UI.renderSkins(Save);
    UI.show('skins');
  };
  Game.prototype.onSkinClick = function (id) {
    var owned = Save.data.unlockedSkins.indexOf(id) >= 0;
    if (owned) { Save.selectSkin(id); GameAudio.click(); }
    else {
      if (Save.buySkin(id)) { Save.selectSkin(id); GameAudio.coin(); UI.info('\uD83C\uDFA8 Skin unlocked!'); }
      else { GameAudio.crash(); UI.info('Not enough coins \u2014 keep playing!'); }
    }
    // live-apply to player + previews
    this.player.skinColor = Save.getSkinColor();
    UI.setMenuSkin(Save.getSkinColor());
    UI.renderSkins(Save);
  };

  // ---- Game over + revive ----
  Game.prototype._gameOver = function () {
    this.state = STATE.OVER;
    GameAudio.crash();
    this.shake = 20; this.flash = 1;

    var dist = Math.floor(this.distanceM);
    var newBest = dist > Save.data.bestDistance;
    if (newBest) Save.data.bestDistance = dist;
    Save.data.totalCoins += this.runCoins;
    Save.data.coinsBalance += this.runCoins;
    Save.data.runs += 1;
    Save.data.totalNearMiss += this.runNearMiss;
    Save.save();

    var newly = Save.checkAchievements();
    var rank = Viral.submitScore(Save.data.bestDistance, 'You');
    var beatPct = Viral.beatPercent(dist);

    var self = this;
    var elapsed = (performance.now() - this.runStartTime) / 1000;
    var showInter = Save.data.runs > 2 && Save.data.runs % 3 === 0 && elapsed > 20;

    function finish() {
      UI.setReviveAvailable(CONFIG.REVIVE_ENABLED && !self.reviveUsed && dist > 150);
      UI.showGameOver({
        score: dist, best: Save.data.bestDistance, newBest: newBest,
        coinsGot: self.runCoins, rank: rank, beatPct: beatPct, challenge: Viral.challenge
      });
      newly.forEach(function (a, i) {
        setTimeout(function () { GameAudio.achieve(); UI.toast(a.desc + '  +' + a.reward); }, 500 + i * 700);
      });
    }
    if (showInter) Utils.Ads.showInterstitial('gameover').then(finish);
    else finish();
  };

  Game.prototype.requestRevive = function () {
    if (this.reviveUsed) return;
    var self = this;
    GameAudio.click();
    Utils.Ads.showRewarded('revive').then(function (r) {
      if (!r.success) return;
      self.reviveUsed = true;
      GameAudio.revive();
      // clear obstacles near the player so they aren't instantly re-killed
      var py = self.view.playerY;
      self.world.obstacles = self.world.obstacles.filter(function (o) { return Math.abs(o.y - py) > 220 * self.view.scale; });
      self.player.vx = 0;
      self.state = STATE.PLAY;
      UI.show(''); UI.showHud(true);
      self._last = performance.now();
    });
  };

  // ---- Main frame (fixed timestep) ----
  Game.prototype._frame = function (now) {
    var dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.1) dt = 0.1;

    if (this.state === STATE.PLAY) {
      this._acc += dt;
      var guard = 0;
      while (this._acc >= this._step && guard < 5) { this._update(this._step); this._acc -= this._step; guard++; }
    }
    this._render();
    requestAnimationFrame(this._frame.bind(this));
  };

  Game.prototype._update = function (dt) {
    var step60 = dt * 60;
    var v = this.view;

    var axis = GameInput.update(this.player.x01);
    this.player.update(step60, axis);
    this.world.update(step60, v);
    this.bgScroll += this.world.speed * dt * v.scale;

    var res = this.world.checkCollisions(this.player.x01, v);

    this.distanceM = this.world.distancePx * CONFIG.METERS_PER_PX;
    UI.setDistance(Math.floor(this.distanceM));

    var px = this.player.x01 * v.w;
    if (res.coinsGot) {
      this.runCoins += res.coinsGot;
      UI.setCoins(this.runCoins);
      GameAudio.coin();
      this.particles.emit(px, v.playerY, 8, { color: '#ffe600', minSpeed: 1, maxSpeed: 5, minLife: 0.2, maxLife: 0.5, minSize: 2, maxSize: 4 * v.scale });
    }
    if (res.nearMiss) {
      this.runNearMiss++; this.combo++;
      GameAudio.near();
      if (this.combo % 5 === 0) {
        GameAudio.combo();
        UI.popCombo('COMBO x' + this.combo + '!');
        this.shake = Math.min(this.shake + 6, 14);
      }
    }
    // comet trail
    this.particles.emit(px, v.playerY + v.r, 1, {
      color: this.player.skinColor, angle: Math.PI / 2,
      minSpeed: 0.5, maxSpeed: 1.5, minLife: 0.2, maxLife: 0.45, minSize: 2, maxSize: 4 * v.scale
    });

    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - step60 * 1.2);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - step60 * 0.08);

    if (res.crash) {
      this.particles.emit(px, v.playerY, 36, {
        color: this.player.skinColor, minSpeed: 2, maxSpeed: 11, minLife: 0.4, maxLife: 1.0, minSize: 2, maxSize: 7 * v.scale, gravity: 0.25
      });
      this._gameOver();
    }
  };

  // ---- Rendering (full screen) ----
  Game.prototype._render = function () {
    var ctx = this.ctx, v = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // background gradient (fills entire viewport)
    var grad = ctx.createLinearGradient(0, 0, 0, v.h);
    grad.addColorStop(0, '#0d0d2a');
    grad.addColorStop(1, '#070716');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, v.w, v.h);

    // moving perspective floor lines (depth)
    this._drawFloor(ctx, v);

    var playing = (this.state === STATE.PLAY || this.state === STATE.PAUSED || this.state === STATE.OVER);

    ctx.save();
    var sx = (Math.random() - 0.5) * this.shake;
    var sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(sx, sy);

    if (playing) {
      this.world.draw(ctx, v);
      this.particles.draw(ctx);
      if (this.state !== STATE.OVER) this.player.draw(ctx, v);
    } else {
      // ambient drifting particles behind menus
      if (Math.random() < 0.25) {
        this.particles.emit(Utils.rand(0, v.w), v.h + 10, 1, {
          color: '#22357a', angle: -Math.PI / 2, minSpeed: 1, maxSpeed: 2.5, minLife: 1.4, maxLife: 2.4, minSize: 2, maxSize: 4
        });
      }
      this.particles.update(this._step);
      this.particles.draw(ctx);
    }
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.5) + ')';
      ctx.fillRect(0, 0, v.w, v.h);
    }
  };

  Game.prototype._drawFloor = function (ctx, v) {
    var spacing = 60 * v.scale;
    var off = this.bgScroll % spacing;
    ctx.strokeStyle = 'rgba(0,240,255,0.06)';
    ctx.lineWidth = 1;
    for (var y = off; y < v.h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(v.w, y); ctx.stroke();
    }
    // speed glow at bottom when fast
    if (this.state === STATE.PLAY) {
      var t = Utils.clamp((this.world.speed - CONFIG.START_SPEED) / (CONFIG.MAX_SPEED - CONFIG.START_SPEED), 0, 1);
      if (t > 0.05) {
        var gg = ctx.createLinearGradient(0, v.h, 0, v.h - 160 * v.scale);
        gg.addColorStop(0, 'rgba(0,240,255,' + (0.10 * t) + ')');
        gg.addColorStop(1, 'rgba(0,240,255,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(0, v.h - 160 * v.scale, v.w, 160 * v.scale);
      }
    }
  };

  global.Game = Game;
  global.STATE = STATE;
})(window);
