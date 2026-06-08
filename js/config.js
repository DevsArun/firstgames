/* Global config + tunables. Single source of truth. */
(function (global) {
  'use strict';

  var CONFIG = {
    // Set false before submitting to platforms (strips console logs).
    DEBUG: false,

    // Logical design resolution (canvas auto-scales to fit screen).
    BASE_W: 480,
    BASE_H: 800,

    // Player
    PLAYER_RADIUS: 16,
    PLAYER_Y_RATIO: 0.78,      // player sits at 78% down the screen
    MOVE_SPEED: 0.9,           // horizontal accel responsiveness

    // World / difficulty
    START_SPEED: 5.0,          // px per frame (at 60fps baseline)
    MAX_SPEED: 14.0,
    SPEED_RAMP: 0.0018,        // speed gained per frame
    OBSTACLE_MIN_GAP: 220,     // vertical gap between obstacle rows (px)
    OBSTACLE_MAX_GAP: 340,
    LANES: 5,

    // Scoring
    METERS_PER_PX: 0.1,
    COINS_PER_METER: 0.02,

    // Juice
    MAX_PARTICLES: 140,        // capped for low-end devices

    // Retention
    REVIVE_ENABLED: true
  };

  global.CONFIG = CONFIG;
})(window);
