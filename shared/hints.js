// Gentle hint nudge for the "wrong answer" modes. After a couple of wrong
// taps or a stretch of inactivity on the current round, it repeatedly draws
// the child's eye to the correct answer with a soft pulse until they solve
// it. The caller decides WHAT to flash (via onFlash); this only decides WHEN.
//
// onFlash receives a `speak` flag: true on the first flash of a nudge (and,
// when voiceOnMiss is set, on each wrong tap), false on the repeating pulses.
// Callers that voice a hint should only do so when speak is true, so the
// repeat is visual-only and never drones on audibly.
//
//   reset()        - start a fresh round (clear misses, arm the idle timer)
//   poke()         - a non-solving interaction happened; restart idle countdown
//   registerMiss() - a wrong attempt happened
//   stop()         - round solved, mode left, or game stopped
function createHintNudge(options = {}) {
  const {
    missThreshold = 2,
    idleMs = 7000,
    flashEveryMs = 2500,
    onFlash,
    isActive,
    voiceOnMiss = false
  } = options;

  let misses = 0;
  let nudging = false;
  let idleTimer = null;
  let flashTimer = null;

  function active() {
    return !isActive || isActive();
  }

  function clearTimers() {
    if (idleTimer != null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (flashTimer != null) {
      clearInterval(flashTimer);
      flashTimer = null;
    }
  }

  function flash(speak) {
    if (active() && onFlash) onFlash(speak);
  }

  function startNudging(speak) {
    if (!active()) return;
    if (nudging) {
      // Already pulsing — re-voice the hint only when this trigger warrants it.
      if (speak && voiceOnMiss) flash(true);
      return;
    }
    nudging = true;
    flash(speak);
    // The repeating pulse is visual-only (speak = false) so it never drones.
    flashTimer = setInterval(function() { flash(false); }, flashEveryMs);
  }

  function armIdle() {
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(function() { startNudging(true); }, idleMs);
  }

  return {
    reset: function() {
      misses = 0;
      nudging = false;
      clearTimers();
      armIdle();
    },
    poke: function() {
      if (!nudging) armIdle();
    },
    registerMiss: function() {
      misses += 1;
      if (misses >= missThreshold) startNudging(true);
      else if (voiceOnMiss) { flash(true); armIdle(); }
      else armIdle();
    },
    stop: function() {
      misses = 0;
      nudging = false;
      clearTimers();
    }
  };
}

// Replay a one-shot CSS animation by toggling the class with a reflow between.
function flashHintEl(el) {
  if (!el) return;
  el.classList.remove('hint-flash');
  void el.offsetWidth;
  el.classList.add('hint-flash');
}
