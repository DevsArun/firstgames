/* Achievements + skins definitions and persistence.
   Achievements unlock via in-run/lifetime stats and grant coin rewards. */
(function (global) {
  'use strict';

  var SKINS = [
    { id: 'cyan',   name: 'Cyan',   color: '#00f0ff', price: 0 },
    { id: 'magenta',name: 'Magenta',color: '#ff2bd6', price: 150 },
    { id: 'lime',   name: 'Lime',   color: '#7CFC00', price: 250 },
    { id: 'gold',   name: 'Gold',   color: '#ffd700', price: 500 },
    { id: 'orange', name: 'Ember',  color: '#ff7a00', price: 400 },
    { id: 'violet', name: 'Violet', color: '#b14bff', price: 350 }
  ];

  var ACHS = [
    { id: 'first',   desc: 'Play your first run',     reward: 20,  test: function (s) { return s.runs >= 1; } },
    { id: 'm500',    desc: 'Reach 500 m',             reward: 50,  test: function (s) { return s.bestDistance >= 500; } },
    { id: 'm1000',   desc: 'Reach 1000 m',            reward: 100, test: function (s) { return s.bestDistance >= 1000; } },
    { id: 'coins100',desc: 'Collect 100 coins total', reward: 50,  test: function (s) { return s.totalCoins >= 100; } },
    { id: 'near25',  desc: '25 near-misses total',    reward: 60,  test: function (s) { return s.totalNearMiss >= 25; } },
    { id: 'runs10',  desc: 'Play 10 runs',            reward: 80,  test: function (s) { return s.runs >= 10; } }
  ];

  var KEY = 'nds_save_v1';

  var Save = {
    data: null,
    load: function () {
      this.data = Utils.Storage.get(KEY, null) || {
        bestDistance: 0,
        totalCoins: 0,
        coinsBalance: 0,
        runs: 0,
        totalNearMiss: 0,
        unlockedSkins: ['cyan'],
        selectedSkin: 'cyan',
        unlockedAchs: [],
        lastPlayDay: null,
        streak: 1
      };
      this._updateStreak();
      return this.data;
    },
    save: function () { Utils.Storage.set(KEY, this.data); },

    _updateStreak: function () {
      var today = new Date().toDateString();
      var last = this.data.lastPlayDay;
      if (last !== today) {
        if (last) {
          var diff = (new Date(today) - new Date(last)) / 86400000;
          if (diff === 1) this.data.streak = (this.data.streak || 1) + 1;
          else if (diff > 1) this.data.streak = 1;
        }
        this.data.lastPlayDay = today;
        this.save();
      }
    },

    // Check all achievements; return list of newly unlocked.
    checkAchievements: function () {
      var newly = [];
      for (var i = 0; i < ACHS.length; i++) {
        var a = ACHS[i];
        if (this.data.unlockedAchs.indexOf(a.id) >= 0) continue;
        if (a.test(this.data)) {
          this.data.unlockedAchs.push(a.id);
          this.data.coinsBalance += a.reward;
          newly.push(a);
        }
      }
      if (newly.length) this.save();
      return newly;
    },

    buySkin: function (id) {
      var skin = SKINS.filter(function (s) { return s.id === id; })[0];
      if (!skin) return false;
      if (this.data.unlockedSkins.indexOf(id) >= 0) return true;
      if (this.data.coinsBalance < skin.price) return false;
      this.data.coinsBalance -= skin.price;
      this.data.unlockedSkins.push(id);
      this.save();
      return true;
    },
    selectSkin: function (id) {
      if (this.data.unlockedSkins.indexOf(id) < 0) return false;
      this.data.selectedSkin = id; this.save(); return true;
    },
    getSkinColor: function () {
      var sel = this.data.selectedSkin;
      var s = SKINS.filter(function (x) { return x.id === sel; })[0];
      return s ? s.color : '#00f0ff';
    }
  };

  global.SKINS = SKINS;
  global.Save = Save;
})(window);
