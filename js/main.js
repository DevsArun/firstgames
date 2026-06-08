/* Boot entry. Waits for DOM, then starts the game engine. */
(function (global) {
  'use strict';
  function start() {
    var game = new Game();
    global.__NDS = game; // handy for debugging in dev
    game.boot();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
