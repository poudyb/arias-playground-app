// Calculator — two modes, both on the same pretend calculator:
//   Free Play — a calculator that only does what she means: a number, plus or
//               minus, a number, equals. At each step only that step's keys
//               are lit; everything else (a second number in a row, a minus
//               first, a minus that goes to zero or below, a second operator,
//               equals again) is greyed out and does nothing. See
//               shared/calc-logic.js. There is no 0 and no C.
//   Make It   — a number to make ("Make 7!") and the calculator to make it
//               with. Pressing = is her answer. Climbs a ladder (MAKE_RUNGS).
//
// Beside the calculator, every number she types is drawn as dots: orange for
// the first, blue for the second. When she presses = the blue dots slide over
// to join the orange ones (plus), or the ones being taken away float off
// (minus), and what is left is the answer. Tapping the dots counts them out
// loud.

const CALC_SESSION_KEY = 'ariaCalcSession';
const CALC_STATS_KEY = 'ariaCalcStats';
const CALC_MODES = ['play', 'make'];
const MAKE_STATE_KEY = CALC_SESSION_KEY + ':make';
// How many different Free Play sums the parent summary keeps.
const PLAY_SEEN_CAP = 12;
const CONFETTI_HEX = ['#ff8f3a', '#3a8dff', '#ffd54f', '#66bb6a', '#ba68c8', '#4dd0e1'];

// The dots' timing. LEAVE_MS matches dot-leave in calculator.css; GATHER_MS is
// how long the dots take to slide into the answer.
const LEAVE_MS = 450;
const GATHER_MS = 520;
const GATHER_STAGGER_MS = 22;
// Free Play holds the keys after = until the answer has landed and been said,
// then a short rest before the next sum can start; never longer than the
// maximum, in case the speech doesn't report back.
const ANSWER_REST_MS = 350;
const ANSWER_HOLD_MAX_MS = 4500;

// Where Make It sits on its ladder: three clean rounds climb a rung, two with
// a miss drop one, a round she only got after the hint passes through. Read
// only when a round starts, never shown to her.
const makeLadder = createLadderProgression({
  storageKey: 'ariaCalcMakeRung',
  rungs: MAKE_RUNGS.length,
  promoteAfter: 3,
  demoteAfter: 2
});

const appMain = document.getElementById('app-main');
const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController();
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

let currentMode = null;
let activeMode = null;

// Laid out like the calculator she already has: 7-8-9 along the top, and down
// the right the keys she presses in order: minus, plus, equals. Every key is the
// same colour: whether it's lit or grey is the only thing colour says here. (A
// green = and a red C, on top of lit-or-grey, were too many meanings at once,
// and red read to her as "interesting", so C was the key she pressed most.)
// Once a sum is whole, = is the only key lit, so it is found by elimination
// rather than by knowing what it's for.
const KEY_LAYOUT = [
  ['7'], ['8'], ['9'], ['-', '−', 'calc-key--op'],
  ['4'], ['5'], ['6'], ['+', '+', 'calc-key--op'],
  ['1'], ['2'], ['3'], ['=', '=', 'calc-key--op']
];
const KEY_NAMES = { '+': 'plus', '-': 'minus', '=': 'equals' };

function opSign(op) {
  return op === '-' ? '−' : '+';
}

function restartAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function toArray(list) {
  return Array.prototype.slice.call(list);
}

// Whether the dots are being counted aloud, which any key press interrupts.
let countingAloud = false;

// Each key says itself as it's pressed, so the sum is heard as it's built. The
// first number of a sum replaces whatever was being said; the operator and the
// second number wait their turn behind it, so a quick "3 + 3" is heard whole
// ("three plus three") rather than as its last word, and the second "three"
// isn't dropped for being the same word as the first.
function speakKey(key, next) {
  if (countingAloud) {
    countingAloud = false;
    cancelSpeech();
  }
  // Equals is said with its answer, by the page.
  if (key === '=') return;
  const word = KEY_NAMES[key] || CALC_NUMBER_WORDS[Number(key)];
  const startsSum = next && calcPhase(next) === 'first';
  if (word) speakText(word, { rate: 0.9, queue: !startsSum });
}

// Run `go` once `utterance` has finished being said (or at once if nothing was
// said). The caller keeps its own fallback timer.
function whenSpoken(utterance, go) {
  if (!utterance) { go(); return; }
  let done = false;
  function once() { if (!done) { done = true; go(); } }
  utterance.addEventListener('end', once);
  utterance.addEventListener('error', once);
}

// ---- The calculator --------------------------------------------------------

function buildCalculator(options) {
  const el = document.createElement('div');
  el.className = 'calc';

  // The screen shows the whole sum, not just the last number the way a real
  // one does: "3 + 4 = 7" stays up, so she can read back what she did.
  const screen = document.createElement('div');
  screen.className = 'calc-screen';
  screen.setAttribute('role', 'button');
  screen.setAttribute('tabindex', '0');
  screen.setAttribute('aria-label', 'Hear the sum');
  const cells = {};
  ['a', 'op', 'b', 'eq', 'r'].forEach(function(name) {
    const cell = document.createElement('span');
    cell.className = 'calc-cell calc-cell--' + name;
    screen.appendChild(cell);
    cells[name] = cell;
  });
  const cursor = document.createElement('span');
  cursor.className = 'calc-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  screen.appendChild(cursor);
  el.appendChild(screen);

  const keysEl = document.createElement('div');
  keysEl.className = 'calc-keys';
  const keyEls = {};
  KEY_LAYOUT.forEach(function(spec) {
    const key = spec[0];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calc-key ' + (spec[2] || 'calc-key--digit');
    btn.textContent = spec[1] || key;
    btn.dataset.key = key;
    btn.setAttribute('aria-label', KEY_NAMES[key] || CALC_NUMBER_WORDS[Number(key)]);
    btn.addEventListener('click', function() {
      press(key);
      btn.blur();
    });
    // Take the one-shot glows off once played, or the hint's would sit on top
    // of the breathing "next" glow for good.
    btn.addEventListener('animationend', function(ev) {
      if (ev.animationName === 'calc-key-hint') btn.classList.remove('hint-flash');
    });
    btn.addEventListener('transitionend', function() { btn.classList.remove('is-pressed'); });
    keysEl.appendChild(btn);
    keyEls[key] = btn;
  });
  el.appendChild(keysEl);

  let state = emptyCalc();
  let locked = false;

  // A key that can't do anything right now is a real disabled button, drawn
  // flat and grey, so a tap on it is never a tap that silently does nothing.
  // The next step along the sum (the operators after a first number, equals
  // after a second) breathes gently, to show the way through.
  function render() {
    const phase = calcPhase(state);
    cells.a.textContent = state.a == null ? '' : String(state.a);
    cells.op.textContent = state.op ? opSign(state.op) : '';
    cells.b.textContent = state.b == null ? '' : String(state.b);
    cells.eq.textContent = state.result == null ? '' : '=';
    cells.r.textContent = state.result == null ? '' : String(state.result);
    screen.dataset.phase = phase;
    const rules = options.getRules();
    CALC_KEYS.forEach(function(key) {
      const on = !locked && isKeyEnabled(state, key, rules);
      const btn = keyEls[key];
      btn.disabled = !on;
      btn.classList.toggle('is-next', on && (
        (phase === 'first' && (key === '+' || key === '-')) ||
        (phase === 'second' && key === '=')));
    });
  }

  function press(key) {
    if (locked || session.isSessionEnded()) return false;
    const prev = state;
    const next = calcPress(state, key, options.getRules());
    if (next === prev) return false;
    state = next;
    render();
    // The answer arrives with a little bounce.
    if (key === '=') restartAnimation(cells.r, 'is-new');
    options.onPress(key, prev, next);
    return true;
  }

  function speakScreen() {
    if (session.isSessionEnded()) return;
    const words = equationWords(state);
    if (!words) return;
    speakText(words, { rate: 0.9 });
    restartAnimation(screen, 'is-speaking');
  }

  screen.addEventListener('click', function() {
    speakScreen();
    screen.blur();
  });
  screen.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.stopPropagation();
      speakScreen();
    }
  });
  screen.addEventListener('animationend', function() { screen.classList.remove('is-speaking'); });

  render();

  return {
    el: el,
    keyEls: keyEls,
    press: press,
    getState: function() { return state; },
    isLocked: function() { return locked; },
    reset: function() { state = emptyCalc(); render(); },
    setLocked: function(value) { locked = value; render(); },
    render: render
  };
}

// ---- The dots --------------------------------------------------------------
//
// Two trays side by side while she types (first number, sign, second number),
// and an answer tray they all gather into on =. In Make It the answer tray is
// there from the start as a row of empty rings, one per dot the number needs,
// and the dots drop into them.

function buildDotsBoard(options) {
  const el = document.createElement('div');
  el.className = 'dots-board';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', 'Count the dots');

  const work = document.createElement('div');
  work.className = 'dots-work';
  const trayA = document.createElement('div');
  trayA.className = 'tray tray--a';
  const sign = document.createElement('div');
  sign.className = 'dots-sign';
  const trayB = document.createElement('div');
  trayB.className = 'tray tray--b';
  work.appendChild(trayA);
  work.appendChild(sign);
  work.appendChild(trayB);

  const result = document.createElement('div');
  result.className = 'tray tray--result';

  el.appendChild(work);
  el.appendChild(result);

  const timers = [];
  let rings = 0;

  function later(fn, ms) {
    const id = window.setTimeout(function() {
      const i = timers.indexOf(id);
      if (i !== -1) timers.splice(i, 1);
      fn();
    }, ms);
    timers.push(id);
  }

  function cancel() {
    timers.forEach(function(id) { clearTimeout(id); });
    timers.length = 0;
  }

  function makeDot(kind, i) {
    const dot = document.createElement('span');
    dot.className = 'dot dot--' + kind;
    // They pop in one after another, so a number arrives as a count.
    dot.style.animationDelay = (i * 70) + 'ms';
    return dot;
  }

  function fillTray(tray, n, kind) {
    tray.innerHTML = '';
    for (let i = 0; i < n; i++) tray.appendChild(makeDot(kind, i));
    setCols(tray, n);
    tray.classList.add('is-set');
  }

  // Rows of five, like a ten-frame, but a plate no wider than it needs: three
  // dots sit on a plate for three.
  function setCols(tray, n) {
    tray.style.setProperty('--cols', String(Math.max(1, Math.min(5, n))));
  }

  function buildSlots(n) {
    setCols(result, n);
    result.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const slot = document.createElement('span');
      slot.className = 'slot' + (i < rings ? ' slot--ring' : '');
      result.appendChild(slot);
    }
  }

  function clear() {
    cancel();
    clearCounting();
    el.classList.remove('is-resolved');
    [trayA, trayB].forEach(function(tray) {
      tray.innerHTML = '';
      tray.classList.remove('is-set');
    });
    sign.textContent = '';
    result.classList.remove('is-full', 'is-short', 'is-over');
    buildSlots(rings);
  }

  function setRings(n) {
    rings = n;
    el.classList.toggle('has-rings', n > 0);
    clear();
  }

  // Follow the calculator one key at a time. Equals is left to resolve(), which
  // the page calls so it can act once the dots have landed.
  function onPress(key, prev, next) {
    clearCounting();
    if (key === '=') return;
    if (key === '+' || key === '-') {
      sign.textContent = opSign(key);
      return;
    }
    const before = calcPhase(prev);
    if (before !== 'op') {
      clear();
      fillTray(trayA, next.a, 'a');
      return;
    }
    if (next.op === '+') {
      fillTray(trayB, next.b, 'b');
      return;
    }
    // Minus: the last few of her dots get a blue ring, the colour of the
    // number taking them away. They're still there until she presses =.
    const dots = trayA.children;
    for (let i = next.a - next.b, k = 0; i < next.a; i++, k++) {
      dots[i].classList.add('dot--leaving');
      dots[i].style.animationDelay = (k * 70) + 'ms';
    }
  }

  // Slide the dots that stay into the answer tray. Measured before and after
  // the move, then each one is played back from where it was, so they glide
  // across rather than jump.
  function gather(dots) {
    const first = dots.map(function(d) { return d.getBoundingClientRect(); });
    buildSlots(Math.max(rings, dots.length));
    dots.forEach(function(d, i) {
      // A moved element restarts its CSS animation; the pop-in has been seen.
      d.classList.add('dot--settled');
      result.children[i].appendChild(d);
    });
    sign.textContent = '';
    el.classList.add('is-resolved');
    if (reduceMotion || dots.length === 0 || typeof dots[0].animate !== 'function') return;
    dots.forEach(function(d, i) {
      const last = d.getBoundingClientRect();
      const dx = first[i].left - last.left;
      const dy = first[i].top - last.top;
      if (!dx && !dy) return;
      d.animate([
        { transform: 'translate(' + dx + 'px, ' + dy + 'px)' },
        { transform: 'translate(0, 0)' }
      ], {
        duration: GATHER_MS,
        delay: i * GATHER_STAGGER_MS,
        easing: 'cubic-bezier(0.3, 0.8, 0.3, 1)',
        fill: 'backwards'
      });
    });
  }

  function resolve(done) {
    cancel();
    clearCounting();
    const leaving = toArray(trayA.querySelectorAll('.dot--leaving'));
    const staying = toArray(trayA.querySelectorAll('.dot:not(.dot--leaving)'))
      .concat(toArray(trayB.querySelectorAll('.dot')));
    leaving.forEach(function(d) {
      d.style.animationDelay = '';
      d.classList.add('dot--gone');
    });
    later(function() {
      leaving.forEach(function(d) { d.remove(); });
      gather(staying);
      const settle = reduceMotion ? 0 : GATHER_MS + staying.length * GATHER_STAGGER_MS;
      later(function() {
        if (rings > 0) {
          result.classList.toggle('is-full', staying.length === rings);
          result.classList.toggle('is-short', staying.length < rings);
          result.classList.toggle('is-over', staying.length > rings);
        }
        if (done) done(staying.length);
      }, settle);
    }, leaving.length && !reduceMotion ? LEAVE_MS : 0);
  }

  // What a tap on the board counts: the answer once there is one, otherwise
  // the dots she has (not the ones about to be taken away), and with nothing
  // typed yet the rings, so she can count how many she's making.
  function countable() {
    if (el.classList.contains('is-resolved')) return toArray(result.querySelectorAll('.dot'));
    const dots = toArray(trayA.querySelectorAll('.dot:not(.dot--leaving)'))
      .concat(toArray(trayB.querySelectorAll('.dot')));
    if (dots.length > 0) return dots;
    return toArray(result.querySelectorAll('.slot--ring'));
  }

  function markCounted(item, n) {
    item.textContent = String(n);
    item.classList.add('is-counted');
  }

  function clearCounting() {
    toArray(el.querySelectorAll('.is-counted')).forEach(function(item) {
      item.classList.remove('is-counted');
      item.textContent = '';
    });
  }

  function onTap() {
    if (options && options.onCount) options.onCount();
  }

  el.addEventListener('click', function() {
    onTap();
    el.blur();
  });
  el.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.stopPropagation();
      onTap();
    }
  });

  buildSlots(0);

  return {
    el: el,
    onPress: onPress,
    resolve: resolve,
    clear: clear,
    setRings: setRings,
    countable: countable,
    markCounted: markCounted,
    clearCounting: clearCounting,
    cancel: cancel
  };
}

// Count the dots aloud, a number appearing on each one as it's said.
function countAloud(board) {
  if (session.isSessionEnded()) return;
  const items = board.countable();
  if (items.length === 0) return;
  board.clearCounting();
  countingAloud = true;
  speakSequence(items.map(function(_, i) { return CALC_NUMBER_WORDS[i + 1]; }), {
    rates: items.map(function() { return 1; }),
    onPart: function(i) { board.markCounted(items[i], i + 1); },
    onEnd: function() { countingAloud = false; }
  });
}

function buildStage(modClass) {
  const stage = document.createElement('div');
  stage.className = 'calc-stage ' + modClass;
  const side = document.createElement('div');
  side.className = 'calc-side';
  stage.appendChild(side);
  appMain.appendChild(stage);
  return { stage: stage, side: side };
}

// ---- Free Play ---------------------------------------------------------------

function enterPlay() {
  const ui = buildStage('calc-stage--play');
  const board = buildDotsBoard({ onCount: function() { countAloud(board); } });
  ui.side.appendChild(board.el);

  const calc = buildCalculator({
    getRules: function() { return FREE_RULES; },
    onPress: function(key, prev, next) {
      board.onPress(key, prev, next);
      speakKey(key, next);
      if (key !== '=') return;
      session.mutateStats(function(stats) {
        stats.playSums += 1;
        if (stats.playSeen.length < PLAY_SEEN_CAP) pushUniqueStruggle(stats.playSeen, equationText(next));
      });
      // The answer is the reward, so it gets seen and heard in full: every key
      // stays grey until the dots have landed and "equals seven" has been said.
      // Tapping on quickly used to start the next sum straight away and cut
      // both off.
      calc.setLocked(true);
      const spoken = speakText('equals ' + CALC_NUMBER_WORDS[next.result], { rate: 0.9, queue: true });
      let landed = false;
      let said = false;
      function unlockWhenDone() {
        if (!landed || !said || answerHold == null) return;
        clearTimeout(answerHold);
        answerHold = window.setTimeout(function() {
          answerHold = null;
          calc.setLocked(false);
        }, ANSWER_REST_MS);
      }
      // A fallback in case the speech never reports back (no voice, muted,
      // dropped): the keys always come back.
      answerHold = window.setTimeout(function() {
        landed = true;
        said = true;
        unlockWhenDone();
      }, ANSWER_HOLD_MAX_MS);
      whenSpoken(spoken, function() { said = true; unlockWhenDone(); });
      board.resolve(function() {
        audio.playChime();
        landed = true;
        unlockWhenDone();
      });
    }
  });
  ui.stage.appendChild(calc.el);
  let answerHold = null;

  return {
    calc: calc,
    teardown: function() {
      clearTimeout(answerHold);
      answerHold = null;
      board.cancel();
      cancelSpeech();
    }
  };
}

// ---- Make It -------------------------------------------------------------------

function enterMake() {
  const ui = buildStage('calc-stage--make');

  const goal = document.createElement('div');
  goal.className = 'make-goal';
  const goalWord = document.createElement('span');
  goalWord.className = 'make-goal__word';
  goalWord.textContent = 'Make';
  const goalNum = document.createElement('span');
  goalNum.className = 'make-goal__num';
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'calc-replay-btn';
  replay.setAttribute('aria-label', 'Hear the number again');
  replay.textContent = '🔊';
  goal.appendChild(goalWord);
  goal.appendChild(goalNum);
  goal.appendChild(replay);
  ui.side.appendChild(goal);

  const board = buildDotsBoard({ onCount: function() { countAloud(board); hint.poke(); } });
  board.el.classList.add('dots-board--goal');
  ui.side.appendChild(board.el);

  let round = null;
  let rung = makeRung(0);
  let rules = makeRules(rung);
  let roundMissed = false;
  let roundHinted = false;
  const timers = [];

  function later(fn, ms) {
    const id = window.setTimeout(function() {
      const i = timers.indexOf(id);
      if (i !== -1) timers.splice(i, 1);
      fn();
    }, ms);
    timers.push(id);
  }

  function clearTimers() {
    timers.forEach(function(id) { clearTimeout(id); });
    timers.length = 0;
  }

  const calc = buildCalculator({
    getRules: function() { return rules; },
    onPress: onPress
  });
  ui.stage.appendChild(calc.el);

  // After two wrong answers or a long pause, the next key along a sum that
  // works glows — picking up from whatever she has typed, and pointing at a
  // better first number if hers can't get there. Never while an answer is
  // being shown.
  const hint = createHintNudge({
    isActive: function() { return currentMode === 'make' && !session.isSessionEnded(); },
    onFlash: function() {
      if (!round || calc.isLocked()) return;
      const key = hintKeyFor(calc.getState(), round.target, rules);
      if (!key || !calc.keyEls[key] || calc.keyEls[key].disabled) return;
      roundHinted = true;
      flashHintEl(calc.keyEls[key]);
    }
  });

  // `afterSum`: after a wrong answer the number to make waits for her sum to
  // finish being read out, rather than cutting it off halfway.
  function sayTarget(afterSum) {
    if (session.isSessionEnded() || !round) return;
    speakText('Make ' + CALC_NUMBER_WORDS[round.target] + '!', { rate: 0.88, queue: afterSum === true });
  }

  function isSavedRound(saved, level) {
    if (!saved || saved.rung !== level || typeof saved.target !== 'number') return false;
    const r = makeRung(level);
    return saved.target >= r.min && saved.target <= r.max;
  }

  // The rung is read here and only here, so a round never changes under her.
  function newRound() {
    clearTimers();
    roundMissed = false;
    roundHinted = false;
    thumbsDown.hide();

    const level = makeLadder.getRung();
    rung = makeRung(level);
    rules = makeRules(rung);
    const saved = loadRoundState(MAKE_STATE_KEY);
    if (isSavedRound(saved, level)) {
      round = { rung: level, target: saved.target };
    } else {
      round = { rung: level, target: makeTarget(rung, Math.random, round ? round.target : null) };
      saveRoundState(MAKE_STATE_KEY, round);
    }

    goalNum.textContent = String(round.target);
    restartAnimation(goal, 'is-new');
    board.setRings(rung.rings ? round.target : 0);
    calc.setLocked(false);
    calc.reset();
    cancelSpeech();
    later(sayTarget, 280);
    hint.reset();
  }

  function onPress(key, prev, next) {
    board.onPress(key, prev, next);
    speakKey(key, next);
    if (key !== '=') {
      hint.poke();
      return;
    }
    // Her answer. Nothing more can be pressed until it has been answered.
    calc.setLocked(true);
    speakText('equals ' + CALC_NUMBER_WORDS[next.result], { rate: 0.9, queue: true });
    board.resolve(function() {
      if (session.isSessionEnded()) return;
      if (next.result === round.target) onRight();
      else onWrong();
    });
  }

  function onRight() {
    hint.stop();
    saveRoundState(MAKE_STATE_KEY, null);
    session.mutateStats(function(stats) { stats.makeCorrect += 1; });
    makeLadder.recordRound(roundMissed ? 'missed' : roundHinted ? 'assisted' : 'clean');
    // A right answer straight after a wrong one mustn't celebrate under the X.
    thumbsDown.hide();
    restartAnimation(goal, 'is-made');
    spawnConfetti({
      colors: CONFETTI_HEX,
      count: 48,
      originTop: '45vh',
      minDistance: 35,
      distanceJitter: 50,
      minDuration: 0.9,
      durationJitter: 0.7
    });
    showCelebrationEmojis();
    audio.playChime();
    later(function() {
      if (!session.isSessionEnded()) newRound();
    }, 2600);
  }

  // The dots have landed and she can see it doesn't fit: a gap in the rings,
  // or one left over. Then the X, and a clean calculator to try again on.
  function onWrong() {
    roundMissed = true;
    session.mutateStats(function(stats) {
      stats.makeWrong += 1;
      pushUniqueStruggle(stats.makeStruggled, round.target);
    });
    thumbsDown.show();
    audio.playBuzzer();
    hint.registerMiss();
    later(function() {
      if (session.isSessionEnded()) return;
      board.clear();
      calc.reset();
      calc.setLocked(false);
      sayTarget(true);
      hint.poke();
    }, 1800);
  }

  replay.addEventListener('click', function() {
    sayTarget();
    hint.poke();
    replay.blur();
  });

  newRound();

  return {
    calc: calc,
    teardown: function() {
      clearTimers();
      board.cancel();
      hint.stop();
      cancelSpeech();
      thumbsDown.hide();
    }
  };
}

// ---- Summary, modes, page ------------------------------------------------------

function renderSummary(boardEl, stats) {
  if (stats.usedPlay) {
    const body = createIntroBody(stats.playSums > 0
      ? 'You did ' + stats.playSums + ' ' + (stats.playSums === 1 ? 'sum' : 'sums') + ' on the calculator!'
      : 'You opened Free Play - press a number, plus or minus, and another number next time!');
    if (stats.playSeen.length > 0) {
      appendBodyNote(body, 'Some she tried:').style.fontWeight = '600';
      body.appendChild(createPillWrap(stats.playSeen, function(pill, text) { pill.textContent = text; }));
    }
    appendScoreSection(boardEl, { modClass: 'score-section--free', icon: '🧮', title: 'Free Play', body: body });
  }

  if (stats.usedMake) {
    const intro = stats.makeCorrect === 0 && stats.makeWrong === 0
      ? 'You opened Make It - make the number with the calculator next time!'
      : 'Make It: ' + stats.makeCorrect + ' made' + (stats.makeWrong ? ', ' + stats.makeWrong + ' oops' : '') + '.';
    const body = createIntroBody(intro);
    // Where she is on the ladder, in words: the only place it is ever said.
    appendBodyNote(body, makeRung(makeLadder.getRung()).note);
    if (stats.makeStruggled.length > 0) {
      appendBodyNote(body, stats.makeCorrect > 0 ? 'These took another try:' : 'These were tricky:').style.fontWeight = '600';
      body.appendChild(createPillWrap(stats.makeStruggled, function(pill, n) { pill.textContent = String(n); }));
    }
    appendScoreSection(boardEl, { modClass: 'score-section--quiz', icon: '🎯', title: 'Make It', body: body });
  }

  cancelSpeech();
}

function stopCalcGame() {
  cancelSpeech();
  if (activeMode && activeMode.teardown) activeMode.teardown();
  activeMode = null;
  thumbsDown.hide();
}

const session = createTimedSession({
  sessionKey: CALC_SESSION_KEY,
  statsKey: CALC_STATS_KEY,
  defaultStats: createCalcStats,
  normalizeStats: normalizeCalcStats,
  stopGame: stopCalcGame,
  renderSummary: renderSummary
});

function setMode(name) {
  if (session.isSessionEnded()) return;
  if (CALC_MODES.indexOf(name) === -1) name = 'play';
  if (currentMode === name && activeMode != null) return;
  currentMode = name;
  rememberSessionMode(CALC_SESSION_KEY, currentMode);
  document.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === name);
  });

  if (activeMode && activeMode.teardown) activeMode.teardown();
  activeMode = null;
  appMain.innerHTML = '';
  cancelSpeech();
  thumbsDown.hide();

  session.mutateStats(function(stats) {
    if (name === 'play') stats.usedPlay = true;
    else if (name === 'make') stats.usedMake = true;
  });

  activeMode = name === 'make' ? enterMake() : enterPlay();
}

document.querySelectorAll('.mode-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    setMode(btn.dataset.mode);
    btn.blur();
  });
});

// A keyboard works too, for a grown-up at a laptop. Only keys that are on do
// anything, exactly as with taps.
const KEYBOARD_KEYS = { '+': '+', '-': '-', '=': '=', Enter: '=' };

document.addEventListener('keydown', function(ev) {
  if (!activeMode || !activeMode.calc || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  // Enter or space on a focused button already clicks it.
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.closest &&
      ev.target.closest('button, [role="button"]')) return;
  const key = /^[1-9]$/.test(ev.key) ? ev.key : KEYBOARD_KEYS[ev.key];
  if (!key) return;
  ev.preventDefault();
  if (activeMode.calc.press(key)) restartAnimation(activeMode.calc.keyEls[key], 'is-pressed');
});

initGamePage({
  session: session,
  stop: stopCalcGame,
  start: function() { setMode(readSessionMode(CALC_SESSION_KEY, 'play')); },
  onResume: function() {
    stopCalcGame();
    const mode = currentMode || 'play';
    currentMode = null;
    setMode(mode);
  }
});
