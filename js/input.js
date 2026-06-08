/* Hybrid input: keyboard (arrows / A-D), touch (drag/swipe), mouse.
   Exposes a normalized horizontal target [0..1] across the play area,
   plus discrete left/right intents. All fallbacks run in parallel so
   no code changes are needed per platform. */
(function (global) {
  'use strict';

  var Input = {
    // -1 = full left, +1 = full right (analog target for steering)
    axis: 0,
    // pointer-based absolute target (0..1 of width) when dragging
    pointerActive: false,
    pointerX01: 0.5,
    keyLeft: false,
    keyRight: false,
    _canvas: null,

    attach: function (canvas) {
      this._canvas = canvas;
      var self = this;

      // ---- Keyboard ----
      global.addEventListener('keydown', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { self.keyLeft = true; }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') { self.keyRight = true; }
        if (e.code === 'Space' || e.code === 'Enter') { self._fire('action'); }
        if (e.code === 'KeyP' || e.code === 'Escape') { self._fire('pause'); }
        if (['ArrowLeft','ArrowRight','Space'].indexOf(e.code) >= 0) e.preventDefault();
      }, { passive: false });
      global.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') self.keyLeft = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') self.keyRight = false;
      });

      // ---- Pointer (covers touch + mouse via Pointer Events) ----
      var rect = function () { return canvas.getBoundingClientRect(); };
      function setFromClient(clientX) {
        var r = rect();
        self.pointerX01 = Utils.clamp((clientX - r.left) / r.width, 0, 1);
      }
      canvas.addEventListener('pointerdown', function (e) {
        self.pointerActive = true; setFromClient(e.clientX);
        self._fire('action');
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', function (e) {
        if (self.pointerActive) setFromClient(e.clientX);
      });
      function release() { self.pointerActive = false; }
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('pointerleave', release);
    },

    // Compute steering: pointer drag takes precedence; else keyboard.
    // playerX01 is current player position (0..1) for relative steering toward pointer.
    update: function (playerX01) {
      if (this.pointerActive) {
        // Steer toward where the finger/mouse is.
        var d = this.pointerX01 - playerX01;
        this.axis = Utils.clamp(d * 6, -1, 1);
      } else if (this.keyLeft && !this.keyRight) {
        this.axis = -1;
      } else if (this.keyRight && !this.keyLeft) {
        this.axis = 1;
      } else {
        this.axis = 0;
      }
      return this.axis;
    },

    // Simple event callback registry for action/pause.
    _cbs: {},
    on: function (name, fn) { (this._cbs[name] = this._cbs[name] || []).push(fn); },
    _fire: function (name) {
      var list = this._cbs[name]; if (!list) return;
      for (var i = 0; i < list.length; i++) list[i]();
    }
  };

  global.GameInput = Input;
})(window);
