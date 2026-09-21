// A ladder of difficulty rungs that climbs and descends from how the rounds
// are going, and is remembered between visits.
//
// The clock's Match mode uses it to take the scaffolding away a piece at a
// time — first the board that starts already filled in, then the red that
// marks a wrong line straight away, and at the top nothing but the chime when
// the time comes right. Every rung is one thing less to lean on. The alphabet
// uses it the other way round, to hand out lowercase letters a few at a time:
// each rung pairs one more group of capitals with their small twins ("Cc").
//
//   recordRound('clean')    - solved on the first try, unaided
//   recordRound('missed')   - took at least one wrong answer
//   recordRound('assisted') - solved, but only after the game flashed a hint
//
// `promoteAfter` clean rounds climb a rung; `demoteAfter` missed rounds drop
// one. Each of those clears the opposite streak, so one fat-fingered tap never
// undoes a good run — it just restarts the count.
//
// An 'assisted' round counts for neither: it leaves both streaks exactly as
// they were. Waiting out the hint and then tapping what was pointed at isn't
// evidence she recognizes the symbol, so it must not earn a promotion — but
// it isn't a mistake either, so it shouldn't cost her a streak she's built.
// That carries real weight on a ladder whose middle rungs ARE a hint: a board
// she finished once the red started flashing is not evidence she's ready for
// the rung where it never does. The clean rounds that promote therefore need
// not be back-to-back; hinted rounds simply pass through, and so does any
// unrecognized outcome.
//
// Climbing off either end is a no-op, and recordRound returns true only when
// the rung actually moved, so the caller knows when to re-render.
//
// State lives in localStorage (not sessionStorage like the play-session data)
// precisely because it should outlive the visit.
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
  module.exports = { createLadderProgression };
}
