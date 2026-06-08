/* UI layer: shows/hides DOM screens and wires buttons.
   Keeps DOM concerns out of the game loop. */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var UI = {
    el: {},
    game: null,

    init: function (game) {
      this.game = game;
      this.el = {
        loading: $('loading-screen'),
        loaderFill: document.querySelector('.loader-fill'),
        menu: $('menu-screen'),
        menuBest: $('menu-best-score'),
        streakCount: $('streak-count'),
        hud: $('hud'),
        hudDistance: $('hud-distance'),
        hudCoins: $('hud-coins'),
        tutorial: $('tutorial-hint'),
        combo: $('combo-popup'),
        pause: $('pause-screen'),
        gameover: $('gameover-screen'),
        goScore: $('go-score'),
        goBest: $('go-best'),
        goNewBest: $('go-newbest'),
        goCoins: $('go-coins'),
        reviveBtn: $('revive-btn'),
        skins: $('skins-screen'),
        skinsGrid: $('skins-grid'),
        skinsCoins: $('skins-coins'),
        achToast: $('ach-toast'),
        achDesc: $('ach-desc'),
        muteBtn: $('mute-btn')
      };
      this._wire();
    },

    _wire: function () {
      var g = this.game;
      $('play-btn').onclick = function () { GameAudio.click(); g.startRun(); };
      $('pause-btn').onclick = function () { g.pause(); };
      $('resume-btn').onclick = function () { GameAudio.click(); g.resume(); };
      $('quit-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      $('retry-btn').onclick = function () { GameAudio.click(); g.startRun(); };
      $('menu-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      $('revive-btn').onclick = function () { g.requestRevive(); };
      $('skins-btn').onclick = function () { GameAudio.click(); g.openSkins(); };
      $('skins-back-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      this.el.muteBtn.onclick = function () { g.toggleMute(); };
    },

    show: function (name) {
      ['loading', 'menu', 'pause', 'gameover', 'skins'].forEach(function (k) {
        if (UI.el[k]) UI.el[k].classList.add('hidden');
      });
      if (this.el[name]) this.el[name].classList.remove('hidden');
    },

    showHud: function (on) { this.el.hud.classList.toggle('hidden', !on); },
    setDistance: function (m) { this.el.hudDistance.textContent = m; },
    setCoins: function (c) { this.el.hudCoins.textContent = c; },

    showTutorial: function (on) { this.el.tutorial.classList.toggle('hidden', !on); },

    popCombo: function (text) {
      var el = this.el.combo;
      el.textContent = text;
      el.classList.remove('show');
      void el.offsetWidth; // reflow to restart animation
      el.classList.add('show');
    },

    updateMenu: function (best, streak) {
      this.el.menuBest.textContent = best;
      this.el.streakCount.textContent = streak;
    },

    showGameOver: function (score, best, newBest, coinsGot) {
      this.el.goScore.textContent = score;
      this.el.goBest.textContent = best;
      this.el.goNewBest.classList.toggle('hidden', !newBest);
      this.el.goCoins.textContent = '\u25CF +' + coinsGot;
      this.show('gameover');
    },

    setReviveAvailable: function (on) {
      this.el.reviveBtn.classList.toggle('hidden', !on);
    },

    toast: function (desc) {
      var t = this.el.achToast;
      this.el.achDesc.textContent = desc;
      t.classList.remove('hidden');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(function () { t.classList.add('hidden'); }, 2600);
    },

    setMuteIcon: function (muted) {
      this.el.muteBtn.innerHTML = muted ? '&#128263;' : '&#128266;';
    },

    setLoaderProgress: function (p) {
      if (this.el.loaderFill) this.el.loaderFill.style.width = (p * 100) + '%';
    },

    renderSkins: function (save) {
      var grid = this.el.skinsGrid;
      this.el.skinsCoins.textContent = save.data.coinsBalance;
      grid.innerHTML = '';
      SKINS.forEach(function (skin) {
        var unlocked = save.data.unlockedSkins.indexOf(skin.id) >= 0;
        var selected = save.data.selectedSkin === skin.id;
        var cell = document.createElement('div');
        cell.className = 'skin-cell' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked');
        var label = unlocked ? (selected ? 'EQUIPPED' : 'SELECT')
          : ('\u25CF ' + skin.price);
        cell.innerHTML = '<div class="skin-swatch" style="background:' + skin.color +
          ';box-shadow:0 0 14px ' + skin.color + '"></div>' +
          '<div class="skin-name">' + skin.name + '</div>' +
          '<div class="skin-price">' + label + '</div>';
        cell.onclick = function () { UI.game.onSkinClick(skin.id); };
        grid.appendChild(cell);
      });
    }
  };

  global.UI = UI;
})(window);
