/* Core engine: responsive canvas, fixed-timestep loop, state machine,
   and run orchestration (scoring, ads, juice, retention). */
(function (global) {
  'use strict';

  var STATE = { LOADING: 'loading', MENU: 'menu', PLAY: 'play', PAUSED: 'paused', OVER: 'over', SKINS: 'skins' };

  function Game() {
    this.canvas = null;
    this.ctx = null;
    this.state = STATE.LOADING;
    this.dpr = 1;
    this.viewW = CONFIG.BASE_W;
    this.viewH = CONFIG.BASE_H;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.player = new Player();
    this.world = new World();
    this.particles = new Particles();

    this.muted = false;
    this.shake = 0;
    this.flash = 0;
    this.speedLines = [];

    // run stats
    this.distanceM = 0;
    this.runCoins = 0;
    this.runNearMiss = 0;
    this.combo = 0;
    this.reviveUsed = false;
    this.tutorialShown = false;
    this.runStartTime = 0;

    // fixed timestep
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
    this.muted = !!Utils.Storage.get('nds_muted', false);
    GameAudio.setMuted(this.muted);

    var self = this;
    GameInput.on('pause', function () { if (self.state === STATE.PLAY) self.pause(); });
    GameInput.on('action', function () {
      // first tap dismisses tutorial + resumes audio (autoplay policy)
      GameAudio.resume();
      if (self.state === STATE.PLAY && self.tutorialShown) {
        self.tutorialShown = false; UI.showTutorial(false);
      }
    });

    UI.init(this);
    this._resize();
    global.addEventListener('resize', function () { self._resize(); });
    global.addEventListener('orientationchange', function () { setTimeout(function () { self._resize(); }, 200); });

    // pause when tab/app loses focus (protects state around backgrounding)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === STATE.PLAY) self.pause();
    });

    // quick simulated load for a smooth first paint
    var p = 0;
    var tick = setInterval(function () {
      p += 0.25; UI.setLoaderProgress(Math.min(1, p));
      if (p >= 1) { clearInterval(tick); self.toMenu(); }
    }, 80);

    this._last = performance.now();
    requestAnimationFrame(this._frame.bind(this));
  };

  // ---- Responsive canvas: fit BASE_W x BASE_H, letterbox, crisp on HiDPI ----
  Game.prototype._resize = function () {
    var w = global.innerWidth, h = global.innerHeight;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2); // cap DPR for perf
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    // scale so the 480x800 design fits inside the screen (contain)
    this.scale = Math.min(w / CONFIG.BASE_W, h / CONFIG.BASE_H);
    this.viewW = w; this.viewH = h;
    this.offsetX = (w - CONFIG.BASE_W * this.scale) / 2;
    this.offsetY = (h - CONFIG.BASE_H * this.scale) / 2;
  };

  // ---- State transitions ----
  Game.prototype.toMenu = function () {
    this.state = STATE.MENU;
    UI.showHud(false);
    UI.updateMenu(Save.data.bestDistance, Save.data.streak);
    UI.setMuteIcon(this.muted);
    UI.show('menu');
  };

  Game.prototype.startRun = function () {
    this.player.reset();
    this.player.skinColor = Save.getSkinColor();
    this.world.reset();
    this.particles.clear();
    this.distanceM = 0; this.runCoins = 0; this.runNearMiss = 0;
    this.combo = 0; this.reviveUsed = false; this.shake = 0; this.flash = 0;
    this.speedLines = [];
    this.runStartTime = performance.now();

    this.state = STATE.PLAY;
    UI.show('');            // hide all overlays
    UI.showHud(true);
    UI.setDistance(0); UI.setCoins(0);

    // show tutorial only for first-ever runs
    this.tutorialShown = Save.data.runs < 2;
    UI.showTutorial(this.tutorialShown);
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
    this._last = performance.now(); // avoid dt spike
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
      if (Save.buySkin(id)) { Save.selectSkin(id); GameAudio.coin(); }
      else { GameAudio.crash(); } // not enough coins feedback
    }
    UI.renderSkins(Save);
  };

  // ---- Game over + revive ----
  Game.prototype._gameOver = function () {
    this.state = STATE.OVER;
    GameAudio.crash();
    this.shake = 18; this.flash = 1;

    // persist stats
    var dist = Math.floor(this.distanceM);
    var newBest = dist > Save.data.bestDistance;
    if (newBest) Save.data.bestDistance = dist;
    Save.data.totalCoins += this.runCoins;
    Save.data.coinsBalance += this.runCoins;
    Save.data.runs += 1;
    Save.data.totalNearMiss += this.runNearMiss;
    Save.save();

    var newly = Save.checkAchievements();

    var self = this;
    // First interstitial only after a couple of runs and not too early in session.
    var elapsed = (performance.now() - this.runStartTime) / 1000;
    var showInter = Save.data.runs > 2 && Save.data.runs % 3 === 0 && elapsed > 20;

    function finish() {
      UI.setReviveAvailable(CONFIG.REVIVE_ENABLED && !self.reviveUsed && dist > 150);
      UI.showGameOver(dist, Save.data.bestDistance, newBest, self.runCoins);
      // surface achievement toasts after the panel
      newly.forEach(function (a, i) {
        setTimeout(function () { GameAudio.achieve(); UI.toast(a.desc + '  +' + a.reward); }, 500 + i * 700);
      });
    }

    if (showInter) {
      // pause-safe: state already OVER, loop won't advance gameplay
      Utils.Ads.showInterstitial('gameover').then(finish);
    } else {
      finish();
    }
  };

  Game.prototype.requestRevive = function () {
    if (this.reviveUsed) return;
    var self = this;
    GameAudio.click();
    Utils.Ads.showRewarded('revive').then(function (r) {
      if (!r.success) return;
      self.reviveUsed = true;
      GameAudio.revive();
      // clear nearby obstacles so player isn't instantly re-killed
      self.world.obstacles = self.world.obstacles.filter(function (o) {
        return Math.abs(o.y - CONFIG.BASE_H * CONFIG.PLAYER_Y_RATIO) > 200;
      });
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
    if (dt > 0.1) dt = 0.1; // clamp after tab switch

    if (this.state === STATE.PLAY) {
      this._acc += dt;
      while (this._acc >= this._step) {
        this._update(this._step);
        this._acc -= this._step;
      }
    }
    this._render();
    requestAnimationFrame(this._frame.bind(this));
  };

  Game.prototype._update = function (dt) {
    var step60 = dt * 60; // normalize to "frames" for tuned constants

    var axis = GameInput.update(this.player.x01);
    this.player.update(step60, axis);
    this.world.update(step60);

    var playerY = CONFIG.BASE_H * CONFIG.PLAYER_Y_RATIO;
    var r = CONFIG.PLAYER_RADIUS;
    var res = this.world.checkCollisions(this.player.x01, playerY, r, CONFIG.BASE_W, 0);

    // scoring
    this.distanceM = this.world.distancePx * CONFIG.METERS_PER_PX;
    UI.setDistance(Math.floor(this.distanceM));

    if (res.coinsGot) {
      this.runCoins += res.coinsGot;
      UI.setCoins(this.runCoins);
      GameAudio.coin();
      var px = 0 + this.player.x01 * CONFIG.BASE_W;
      this.particles.emit(px, playerY, 6, { color: '#ffe600', minSpeed: 1, maxSpeed: 4, minLife: 0.2, maxLife: 0.5 });
    }

    if (res.nearMiss) {
      this.runNearMiss++;
      this.combo++;
      GameAudio.near();
      if (this.combo > 0 && this.combo % 5 === 0) {
        GameAudio.combo();
        UI.popCombo('COMBO x' + this.combo + '!');
        this.shake = Math.min(this.shake + 6, 14);
      }
    }

    // trail
    var trailX = this.player.x01 * CONFIG.BASE_W;
    this.particles.emit(trailX, playerY + r, 1, {
      color: this.player.skinColor, angle: Math.PI / 2,
      minSpeed: 0.5, maxSpeed: 1.5, minLife: 0.2, maxLife: 0.4, minSize: 2, maxSize: 4
    });

    this.particles.update(dt);

    // decay juice
    if (this.shake > 0) this.shake = Math.max(0, this.shake - step60 * 1.2);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - step60 * 0.08);

    if (res.crash) {
      var pxc = this.player.x01 * CONFIG.BASE_W;
      this.particles.emit(pxc, playerY, 30, {
        color: this.player.skinColor, minSpeed: 2, maxSpeed: 9, minLife: 0.4, maxLife: 1.0, minSize: 2, maxSize: 6, gravity: 0.2
      });
      this._gameOver();
    }
  };

  // ---- Rendering ----
  Game.prototype._render = function () {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // clear full screen (letterbox bg)
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    // map design space -> screen with letterbox + screen shake
    var sx = (Math.random() - 0.5) * this.shake;
    var sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(this.offsetX + sx, this.offsetY + sy);
    ctx.scale(this.scale, this.scale);

    // clip to play area
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.BASE_W, CONFIG.BASE_H);
    ctx.clip();

    // play-area background
    var grad = ctx.createLinearGradient(0, 0, 0, CONFIG.BASE_H);
    grad.addColorStop(0, '#0d0d2a');
    grad.addColorStop(1, '#070716');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.BASE_W, CONFIG.BASE_H);

    // speed lines scale with world speed (juice)
    this._drawSpeedLines(ctx);

    if (this.state === STATE.PLAY || this.state === STATE.PAUSED || this.state === STATE.OVER) {
      this.world.draw(ctx, CONFIG.BASE_W, 0);
      this.particles.draw(ctx);
      var playerY = CONFIG.BASE_H * CONFIG.PLAYER_Y_RATIO;
      if (this.state !== STATE.OVER) {
        this.player.draw(ctx, CONFIG.BASE_W, 0, playerY, CONFIG.PLAYER_RADIUS);
      }
    } else {
      // idle menu backdrop: gentle drifting particles
      if (Math.random() < 0.3) {
        this.particles.emit(Utils.rand(0, CONFIG.BASE_W), CONFIG.BASE_H + 10, 1, {
          color: '#1b2a6b', angle: -Math.PI / 2, minSpeed: 1, maxSpeed: 2.5, minLife: 1.2, maxLife: 2, minSize: 2, maxSize: 4
        });
      }
      this.particles.update(this._step);
      this.particles.draw(ctx);
    }

    // crash flash
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.5) + ')';
      ctx.fillRect(0, 0, CONFIG.BASE_W, CONFIG.BASE_H);
    }

    ctx.restore();
  };

  Game.prototype._drawSpeedLines = function (ctx) {
    var spd = this.world.speed || CONFIG.START_SPEED;
    var intensity = (spd - CONFIG.START_SPEED) / (CONFIG.MAX_SPEED - CONFIG.START_SPEED);
    if (this.state !== STATE.PLAY || intensity < 0.05) return;
    ctx.strokeStyle = 'rgba(0,240,255,' + (0.05 + intensity * 0.15) + ')';
    ctx.lineWidth = 2;
    var n = Math.floor(4 + intensity * 8);
    for (var i = 0; i < n; i++) {
      var x = (Math.sin((Date.now() * 0.005) + i * 13.3) * 0.5 + 0.5) * CONFIG.BASE_W;
      var len = 30 + intensity * 60;
      var y = ((Date.now() * (0.3 + intensity) + i * 120) % (CONFIG.BASE_H + 100));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
  };

  global.Game = Game;
  global.STATE = STATE;
})(window);
