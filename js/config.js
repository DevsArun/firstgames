/* Global config + tunables. Single source of truth.
   The game renders FULL-SCREEN (fills the viewport), not a fixed letterboxed box.
   All gameplay sizes are expressed relative to a reference height so the feel
   stays consistent across phones, tablets and desktop. */
(function (global) {
  'use strict';

  var CONFIG = {
    // Set false before submitting to platforms (strips console logs).
    DEBUG: false,

    // Reference height used to scale gameplay constants to any screen.
    REF_H: 800,

    // Player (values are in reference-pixels, scaled at runtime)
    PLAYER_RADIUS: 18,
    PLAYER_Y_RATIO: 0.80,      // player sits at 80% down the screen
    MOVE_SPEED: 0.95,          // horizontal steering responsiveness

    // World / difficulty (reference-pixels / reference-frame)
    START_SPEED: 5.5,
    MAX_SPEED: 15.0,
    SPEED_RAMP: 0.0019,        // speed gained per frame
    OBSTACLE_MIN_GAP: 230,     // vertical gap between obstacle rows
    OBSTACLE_MAX_GAP: 360,
    OBSTACLE_THICK: 30,        // bar thickness
    // lanes adapt to aspect: phones get fewer, wide desktop gets more
    LANES_MIN: 5,
    LANES_MAX: 9,
    LANE_REF_WIDTH: 95,        // target px per lane -> drives lane count by width

    // Scoring
    METERS_PER_PX: 0.1,

    // Juice
    MAX_PARTICLES: 160,        // capped for low-end devices

    // Retention
    REVIVE_ENABLED: true
  };

  global.CONFIG = CONFIG;
})(window);
