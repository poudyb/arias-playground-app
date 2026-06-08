// Gentle hint nudge for the "wrong answer" modes. After a couple of wrong
// taps or a stretch of inactivity on the current round, it repeatedly draws
// the child's eye to the correct answer with a soft pulse until they solve
// it. The caller decides WHAT to flash (via onFlash); this only decides WHEN.
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
    isActive
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

  function flash() {
    if (active() && onFlash) onFlash();
  }

  function startNudging() {
    if (nudging || !active()) return;
    nudging = true;
    flash();
    flashTimer = setInterval(flash, flashEveryMs);
  }

  function armIdle() {
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(startNudging, idleMs);
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
      if (misses >= missThreshold) startNudging();
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
