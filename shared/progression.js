// A single difficulty step that turns itself on and off from how the rounds
// are going, and is remembered between visits.
//
// The alphabet game uses it to decide when to start showing "Aa" pairs
// instead of bare capitals: once the child solves a few quiz rounds in a row
// on the first try, lowercase letters join in; if the harder look starts
// costing her rounds, it steps back down on its own.
//
//   recordRound('clean')    - solved on the first try, unaided
//   recordRound('missed')   - took at least one wrong answer
//   recordRound('assisted') - solved, but only after the game flashed a hint
//
// `promoteAfter` clean rounds switch the step on; `demoteAfter` missed rounds
// switch it back off. Each of those clears the opposite streak, so one
// fat-fingered tap never undoes a good run — it just restarts the count.
//
// An 'assisted' round counts for neither: it leaves both streaks exactly as
// they were. Waiting out the hint and then tapping what was pointed at isn't
// evidence she recognizes the symbol, so it must not earn a promotion — but
// it isn't a mistake either, so it shouldn't cost her a streak she's built.
// The clean rounds that promote therefore need not be back-to-back; hinted
// rounds simply pass through. Any unrecognized outcome is treated the same
// neutral way.
//
// recordRound returns true only when the step actually flipped, so the caller
// knows when to re-render.
//
// State lives in localStorage (not sessionStorage like the play-session data)
// precisely because it should outlive the visit.
function createStreakProgression(options) {
  const {
    storageKey,
    promoteAfter = 3,
    demoteAfter = 3,
    storage = defaultProgressionStorage()
  } = options;

  const state = { on: false, hits: 0, misses: 0 };

  function load() {
    if (!storage) return;
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      state.on = !!parsed.on;
      state.hits = toProgressionCount(parsed.hits);
      state.misses = toProgressionCount(parsed.misses);
    } catch (_) {}
  }

  function save() {
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {}
  }

  load();

  return {
    isOn: function() { return state.on; },
    recordRound: function(outcome) {
      if (outcome !== 'clean' && outcome !== 'missed') return false;
      const wasOn = state.on;
      if (outcome === 'clean') {
        state.misses = 0;
        state.hits += 1;
        if (!state.on && state.hits >= promoteAfter) {
          state.on = true;
          state.hits = 0;
        }
      } else {
        state.hits = 0;
        state.misses += 1;
        if (state.on && state.misses >= demoteAfter) {
          state.on = false;
          state.misses = 0;
        }
      }
      save();
      return state.on !== wasOn;
    },
    getState: function() { return { on: state.on, hits: state.hits, misses: state.misses }; }
  };
}

// The same streak rules over a ladder of more than two settings: instead of
// one step turning on and off, a rung index walks up and down a list.
//
// The clock's Match mode uses it to take the scaffolding away a piece at a
// time — first the board that starts already filled in, then the red that
// marks a wrong line straight away, and at the top nothing but the chime when
// the time comes right. Every rung is one thing less to lean on.
//
// Outcomes mean exactly what they mean for the two-step version above:
// `promoteAfter` clean rounds climb a rung, `demoteAfter` missed rounds drop
// one, each clears the other's streak, and 'assisted' — solved, but only after
// the game pointed — passes through without counting either way. That last one
// carries real weight on a ladder whose middle rungs ARE a hint: a board she
// finished once the red started flashing is not evidence she's ready for the
// rung where it never does.
//
// Climbing off either end is a no-op, and recordRound returns true only when
// the rung actually moved, so the caller knows when to re-render.
//
// Kept separate from createStreakProgression rather than generalising it: that
// one has {on, hits, misses} already written into children's browsers, and
// reshaping what's on disk to save a few lines here would cost them the
// progress they've built.
function createLadderProgression(options) {
  const {
    storageKey,
    rungs,
    promoteAfter = 3,
    demoteAfter = 3,
    storage = defaultProgressionStorage()
  } = options;

  const top = Math.max(0, rungs - 1);
  const state = { rung: 0, hits: 0, misses: 0 };

  function clampRung(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Math.floor(value), top));
  }

  function load() {
    if (!storage) return;
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      state.rung = clampRung(parsed.rung);
      state.hits = toProgressionCount(parsed.hits);
      state.misses = toProgressionCount(parsed.misses);
    } catch (_) {}
  }

  function save() {
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {}
  }

  load();

  return {
    getRung: function() { return state.rung; },
    recordRound: function(outcome) {
      if (outcome !== 'clean' && outcome !== 'missed') return false;
      const was = state.rung;
      if (outcome === 'clean') {
        state.misses = 0;
        state.hits += 1;
        if (state.hits >= promoteAfter) {
          // Nothing left to take away at the top, so the streak is capped
          // there rather than counting up forever.
          if (state.rung < top) {
            state.rung += 1;
            state.hits = 0;
          } else {
            state.hits = promoteAfter;
          }
        }
      } else {
        state.hits = 0;
        state.misses += 1;
        if (state.misses >= demoteAfter) {
          if (state.rung > 0) {
            state.rung -= 1;
            state.misses = 0;
          } else {
            state.misses = demoteAfter;
          }
        }
      }
      save();
      return state.rung !== was;
    },
    getState: function() { return { rung: state.rung, hits: state.hits, misses: state.misses }; }
  };
}

function toProgressionCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function defaultProgressionStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (_) {
    return null;
  }
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createStreakProgression, createLadderProgression };
}
