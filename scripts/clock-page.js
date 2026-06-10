const SVG_NS = 'http://www.w3.org/2000/svg';

const SEGMENTS_FOR_DIGIT = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
};

const SEGMENT_POLYGONS = {
  a: '12,4 48,4 52,8 48,12 12,12 8,8',
  b: '48,12 52,8 56,12 56,40 52,44 48,40',
  c: '48,60 52,56 56,60 56,88 52,92 48,88',
  d: '12,88 48,88 52,92 48,96 12,96 8,92',
  e: '4,60 8,56 12,60 12,88 8,92 4,88',
  f: '4,12 8,8 12,12 12,40 8,44 4,40',
  g: '12,46 48,46 52,50 48,54 12,54 8,50'
};

const SEGMENT_HIT_POLYGONS = {
  a: '0,0 60,0 46,14 14,14',
  b: '60,0 60,45 40,45 40,14 46,14',
  c: '60,55 60,100 46,86 40,86 40,55',
  d: '0,100 14,86 46,86 60,100',
  e: '0,55 20,55 20,86 14,86 0,100',
  f: '0,0 14,14 20,14 20,45 0,45',
  g: '0,45 60,45 60,55 0,55'
};

const SEG_LABELS = {
  a: 'top',
  b: 'top right',
  c: 'bottom right',
  d: 'bottom',
  e: 'bottom left',
  f: 'top left',
  g: 'middle'
};

const POSITION_LABELS = {
  h1: 'hours tens',
  h2: 'hours ones',
  m1: 'minutes tens',
  m2: 'minutes ones'
};

const NUMBER_WORDS_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];
const NUMBER_WORDS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

const CONFETTI_HEX = ['#ff7043', '#ffb74d', '#80deea', '#64b5f6', '#ba68c8', '#aed581'];
const CLOCK_SESSION_KEY = 'ariaClockSession';
const CLOCK_MODES = ['watch', 'match', 'quiz', 'next'];

function numberToWords(n) {
  if (n < 20) return NUMBER_WORDS_ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return NUMBER_WORDS_TENS[tens];
  return NUMBER_WORDS_TENS[tens] + '-' + NUMBER_WORDS_ONES[ones];
}

function timeToWords(h, m) {
  const hourPart = NUMBER_WORDS_ONES[h];
  if (m === 0) return hourPart + " o'clock";
  if (m < 10) return hourPart + ' oh ' + NUMBER_WORDS_ONES[m];
  return hourPart + ' ' + numberToWords(m);
}

function formatTwo(n) {
  return n < 10 ? '0' + n : String(n);
}

function get12Hour(date) {
  let h = date.getHours() % 12;
  if (h === 0) h = 12;
  return h;
}

function createDigitSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 100');
  svg.setAttribute('class', 'clock-digit-svg');
  svg.setAttribute('aria-hidden', 'true');
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(function(seg) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', SEGMENT_POLYGONS[seg]);
    poly.setAttribute('class', 'seg seg-' + seg);
    poly.setAttribute('data-seg', seg);
    svg.appendChild(poly);
  });
  return svg;
}

function setDigitState(svgEl, segmentSet) {
  const segs = svgEl.querySelectorAll('.seg');
  for (let i = 0; i < segs.length; i++) {
    const name = segs[i].getAttribute('data-seg');
    const isOn = segmentSet instanceof Set ? segmentSet.has(name) : segmentSet.indexOf(name) !== -1;
    if (isOn) segs[i].classList.add('on');
    else segs[i].classList.remove('on');
  }
}

function renderDigit(svgEl, value) {
  setDigitState(svgEl, SEGMENTS_FOR_DIGIT[value] || []);
}

function createColonEl() {
  const colon = document.createElement('span');
  colon.className = 'clock-colon';
  const top = document.createElement('span');
  top.className = 'clock-colon__dot';
  const bottom = document.createElement('span');
  bottom.className = 'clock-colon__dot';
  colon.appendChild(top);
  colon.appendChild(bottom);
  return colon;
}

function buildClockFace(opts) {
  const face = document.createElement('div');
  face.className = 'clock-face' + (opts.sizeClass ? ' ' + opts.sizeClass : '');
  const slots = {};
  const colons = [];

  ['h1', 'h2'].forEach(function(name) {
    const svg = createDigitSvg();
    svg.setAttribute('data-pos', name);
    face.appendChild(svg);
    slots[name] = svg;
  });

  const colon1 = createColonEl();
  face.appendChild(colon1);
  colons.push(colon1);

  ['m1', 'm2'].forEach(function(name) {
    const svg = createDigitSvg();
    svg.setAttribute('data-pos', name);
    face.appendChild(svg);
    slots[name] = svg;
  });

  if (opts.showSeconds) {
    const colon2 = createColonEl();
    colon2.classList.add('clock-colon--dim');
    face.appendChild(colon2);
    colons.push(colon2);
    ['s1', 's2'].forEach(function(name) {
      const svg = createDigitSvg();
      svg.setAttribute('data-pos', name);
      svg.classList.add('clock-digit-svg--dim');
      face.appendChild(svg);
      slots[name] = svg;
    });
  }

  face._slots = slots;
  face._colons = colons;
  return face;
}

function renderClockTime(face, h, m, s, opts) {
  const slots = face._slots;
  const mm = formatTwo(m);
  if (h < 10) {
    setDigitState(slots.h1, []);
    renderDigit(slots.h2, h);
  } else {
    renderDigit(slots.h1, Math.floor(h / 10));
    renderDigit(slots.h2, h % 10);
  }
  renderDigit(slots.m1, Number(mm[0]));
  renderDigit(slots.m2, Number(mm[1]));
  if (slots.s1 && slots.s2 && s != null) {
    const ss = formatTwo(s);
    renderDigit(slots.s1, Number(ss[0]));
    renderDigit(slots.s2, Number(ss[1]));
  }

  if (opts && opts.colorCycling) {
    const mf = opts.msFraction || 0;
    const secondsVal = s == null ? 0 : s;
    const elapsed = h * 3600 + m * 60 + secondsVal + mf;
    const hue = (elapsed * 360 / 600) % 360;
    slots.h1.style.setProperty('--led-hue', String(hue));
    slots.h2.style.setProperty('--led-hue', String(hue));
    slots.m1.style.setProperty('--led-hue', String(hue));
    slots.m2.style.setProperty('--led-hue', String(hue));
    if (slots.s1) slots.s1.style.setProperty('--led-hue', String(hue));
    if (slots.s2) slots.s2.style.setProperty('--led-hue', String(hue));
    const colonPhase = ((secondsVal % 2) + mf) / 2;
    const colonOpacity = 0.35 + 0.65 * Math.abs(Math.cos(colonPhase * Math.PI));
    face._colons.forEach(function(c) {
      c.style.setProperty('--colon-opacity', String(colonOpacity));
    });
  }
}

function segsForDigitArray(value) {
  return SEGMENTS_FOR_DIGIT[value] || [];
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  let equal = true;
  a.forEach(function(x) { if (!b.has(x)) equal = false; });
  return equal;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function randomHour() { return Math.floor(Math.random() * 12) + 1; }
function randomMinute() { return Math.floor(Math.random() * 60); }

function minutesShareDigit(a, b) {
  const da = formatTwo(a);
  const db = formatTwo(b);
  return da[0] === db[0] || da[0] === db[1] || da[1] === db[0] || da[1] === db[1];
}

function keyForTime(h, m) { return h + ':' + (m < 10 ? '0' + m : m); }

function parseTimeKey(key) {
  const parts = key.split(':');
  return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
}

function nextMinuteOf(h, m) {
  let nm = m + 1;
  let nh = h;
  if (nm >= 60) {
    nm = 0;
    nh = nh + 1;
    if (nh > 12) nh = 1;
  }
  return { h: nh, m: nm };
}

const appMain = document.getElementById('app-main');
const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

let currentMode = null;
let tickId = null;
let activeMode = null;

function startTickLoop(onTick) {
  stopTickLoop();
  function tick() {
    const now = new Date();
    onTick(now);
  }
  tick();
  tickId = setInterval(tick, 200);
}

function stopTickLoop() {
  if (tickId != null) {
    clearInterval(tickId);
    tickId = null;
  }
}

function realClockOpts(now) {
  return { colorCycling: true, msFraction: now.getMilliseconds() / 1000 };
}

function renderTimePill(pill, key) {
  const parsed = parseTimeKey(key);
  const face = buildClockFace({ showSeconds: false, sizeClass: 'clock-face--off' });
  renderClockTime(face, parsed.h, parsed.m, null, {});
  pill.appendChild(face);
}

function buildModeBody(intro, struggled, struggledLabel) {
  const body = document.createElement('div');
  const introDiv = document.createElement('div');
  introDiv.textContent = intro;
  body.appendChild(introDiv);
  if (struggled.length > 0) {
    const sub = document.createElement('div');
    sub.style.marginTop = '0.45rem';
    sub.style.fontWeight = '600';
    sub.textContent = struggledLabel;
    body.appendChild(sub);
    body.appendChild(createPillWrap(struggled, renderTimePill));
  }
  return body;
}

function renderSummary(board, stats) {
  if (stats.usedMatch) {
    const intro = stats.matchSuccesses > 0
      ? 'You matched the clock ' + stats.matchSuccesses + ' ' + (stats.matchSuccesses === 1 ? 'time' : 'times') + '!'
      : 'Tap segments to match the clock!';
    appendScoreSection(board, { icon: '🧩', title: 'Match', body: intro });
  }

  if (stats.usedQuiz) {
    const intro = stats.quizCorrect === 0 && stats.quizWrong === 0
      ? 'You opened Quiz - listen and pick the time next time!'
      : 'Quiz: ' + stats.quizCorrect + ' correct' + (stats.quizWrong ? ', ' + stats.quizWrong + ' oops taps' : '') + '.';
    const label = stats.quizCorrect > 0 ? 'These took an extra try (you got them!):' : 'These were tricky:';
    appendScoreSection(board, {
      icon: '❓',
      title: 'Quiz',
      body: buildModeBody(intro, stats.quizStruggled, label)
    });
  }

  if (stats.usedNext) {
    const intro = stats.nextCorrect === 0 && stats.nextWrong === 0
      ? 'You opened Which one is next? - try guessing next time!'
      : 'Next minute: ' + stats.nextCorrect + ' correct' + (stats.nextWrong ? ', ' + stats.nextWrong + ' off' : '') + '.';
    appendScoreSection(board, {
      icon: '⏭️',
      title: 'Which one is next?',
      body: buildModeBody(intro, stats.nextStruggled, 'These needed another look:')
    });
  }

  const modes = [];
  if (stats.usedWatch) modes.push('watch');
  if (stats.usedMatch) modes.push('match');
  if (stats.usedQuiz) modes.push('quiz');
  if (stats.usedNext) modes.push('next');
  if (modes.length > 0) {
    appendScoreSection(board, {
      icon: '🎯',
      title: 'Modes tried',
      body: 'You explored: ' + modes.join(', ') + '.'
    });
  }

  cancelSpeech();
}

function stopClockGame() {
  cancelSpeech();
  stopTickLoop();
  if (activeMode && activeMode.teardown) {
    activeMode.teardown();
    activeMode = null;
  }
  thumbsDown.hide();
  hint.stop();
}

const session = createTimedSession({
  sessionKey: CLOCK_SESSION_KEY,
  statsKey: 'ariaClockStats',
  defaultStats: createClockStats,
  normalizeStats: normalizeClockStats,
  stopGame: stopClockGame,
  renderSummary
});

// Hints only for Quiz (pick the matching time). Not for Next: that's a
// predict-then-wait game where flashing the correct future time would spoil
// the puzzle and idle is the normal state.
const hint = createHintNudge({
  onFlash: function() { flashHintEl(appMain.querySelector('.clock-option[data-correct="1"]')); },
  isActive: function() { return currentMode === 'quiz' && !session.isSessionEnded(); }
});

function setMode(name) {
  if (session.isSessionEnded()) return;
  if (CLOCK_MODES.indexOf(name) === -1) name = 'watch';
  if (currentMode === name && activeMode != null) return;
  currentMode = name;
  rememberSessionMode(CLOCK_SESSION_KEY, currentMode);
  document.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === name);
  });

  if (activeMode && activeMode.teardown) activeMode.teardown();
  stopTickLoop();
  appMain.innerHTML = '';
  cancelSpeech();
  thumbsDown.hide();
  hint.stop();

  if (session.shouldTrackStats()) {
    session.mutateStats(function(stats) {
      if (name === 'watch') stats.usedWatch = true;
      else if (name === 'match') stats.usedMatch = true;
      else if (name === 'quiz') stats.usedQuiz = true;
      else if (name === 'next') stats.usedNext = true;
    });
  }

  if (name === 'watch') activeMode = enterWatch();
  else if (name === 'match') activeMode = enterMatch();
  else if (name === 'quiz') activeMode = enterQuiz();
  else if (name === 'next') activeMode = enterNext();
}

function enableSpeakOnTap(face) {
  face.classList.add('clock-face--speakable');
  face.setAttribute('role', 'button');
  face.setAttribute('tabindex', '0');
  face.setAttribute('aria-label', 'Tap to hear the time');

  function speakNow() {
    if (session.isSessionEnded()) return;
    const now = new Date();
    speakText(timeToWords(get12Hour(now), now.getMinutes()), { rate: 0.88 });
    face.classList.remove('is-speaking');
    void face.offsetWidth;
    face.classList.add('is-speaking');
  }

  face.addEventListener('click', speakNow);
  face.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      speakNow();
    }
  });
  face.addEventListener('animationend', function(ev) {
    if (ev.animationName === 'clock-speak-pulse') face.classList.remove('is-speaking');
  });
}

function enterWatch() {
  const wrap = document.createElement('div');
  wrap.className = 'watch-wrap';
  const face = buildClockFace({ showSeconds: true, sizeClass: 'clock-face--real clock-face--big' });
  enableSpeakOnTap(face);
  wrap.appendChild(face);
  appMain.appendChild(wrap);

  startTickLoop(function(now) {
    renderClockTime(face, get12Hour(now), now.getMinutes(), now.getSeconds(), realClockOpts(now));
  });

  return {
    teardown: function() { stopTickLoop(); cancelSpeech(); }
  };
}

function enterMatch() {
  const wrap = document.createElement('div');
  wrap.className = 'match-wrap';

  const realFace = buildClockFace({ showSeconds: true, sizeClass: 'clock-face--real' });
  const manualFace = buildClockFace({ showSeconds: true, sizeClass: 'clock-face--manual' });
  enableSpeakOnTap(realFace);

  // Stack both clocks left-aligned so HH lines up under HH and MM under MM.
  // (Centering each face independently would offset the narrower manual clock.)
  const stack = document.createElement('div');
  stack.className = 'match-stack';
  stack.appendChild(realFace);
  stack.appendChild(manualFace);
  wrap.appendChild(stack);
  appMain.appendChild(wrap);

  const manualState = { h1: new Set(), h2: new Set(), m1: new Set(), m2: new Set() };
  let isMatching = false;

  function evaluateMatch() {
    const now = new Date();
    const h = get12Hour(now);
    const m = now.getMinutes();
    const mm = formatTwo(m);
    const targets = {
      h1: h < 10 ? new Set() : new Set(segsForDigitArray(Math.floor(h / 10))),
      h2: new Set(segsForDigitArray(h % 10)),
      m1: new Set(segsForDigitArray(Number(mm[0]))),
      m2: new Set(segsForDigitArray(Number(mm[1])))
    };
    const matches =
      setsEqual(manualState.h1, targets.h1) &&
      setsEqual(manualState.h2, targets.h2) &&
      setsEqual(manualState.m1, targets.m1) &&
      setsEqual(manualState.m2, targets.m2);

    if (matches && !isMatching) {
      isMatching = true;
      manualFace.classList.add('matching');
      session.mutateStats(function(stats) { stats.matchSuccesses++; });
      audio.playMatchTone();
    } else if (!matches && isMatching) {
      isMatching = false;
      manualFace.classList.remove('matching');
    }
  }

  function toggleSeg(pos, segName) {
    if (session.isSessionEnded()) return;
    const set = manualState[pos];
    if (set.has(segName)) set.delete(segName);
    else set.add(segName);
    setDigitState(manualFace._slots[pos], set);
    evaluateMatch();
  }

  ['h1', 'h2', 'm1', 'm2'].forEach(function(pos) {
    const svg = manualFace._slots[pos];
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(function(segName) {
      const hit = document.createElementNS(SVG_NS, 'polygon');
      hit.setAttribute('points', SEGMENT_HIT_POLYGONS[segName]);
      hit.setAttribute('class', 'seg-hit');
      hit.setAttribute('data-seg', segName);
      hit.setAttribute('role', 'button');
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('aria-label', POSITION_LABELS[pos] + ', ' + SEG_LABELS[segName]);
      hit.addEventListener('click', function() { toggleSeg(pos, segName); });
      hit.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggleSeg(pos, segName);
        }
      });
      svg.appendChild(hit);
    });
  });

  startTickLoop(function(now) {
    renderClockTime(realFace, get12Hour(now), now.getMinutes(), now.getSeconds(), realClockOpts(now));
    const ss = formatTwo(now.getSeconds());
    renderDigit(manualFace._slots.s1, Number(ss[0]));
    renderDigit(manualFace._slots.s2, Number(ss[1]));
    evaluateMatch();
  });

  return {
    teardown: function() { stopTickLoop(); cancelSpeech(); }
  };
}

function enterQuiz() {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-wrap';

  const prompt = document.createElement('p');
  prompt.className = 'clock-prompt';
  prompt.textContent = 'Which time did you hear?';
  wrap.appendChild(prompt);

  const optRow = document.createElement('div');
  optRow.className = 'option-row';
  wrap.appendChild(optRow);

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'clock-replay-btn';
  replay.setAttribute('aria-label', 'Replay the time');
  replay.textContent = '🔊';
  wrap.appendChild(replay);

  appMain.appendChild(wrap);

  let target = null;
  let roundLocked = false;
  let delayedNextTimer = null;

  function speakRound() {
    if (session.isSessionEnded() || !target) return;
    speakText(timeToWords(target.h, target.m), { rate: 0.88 });
  }

  const QUIZ_STATE_KEY = CLOCK_SESSION_KEY + ':quiz';

  function renderOpts(opts) {
    optRow.innerHTML = '';
    opts.forEach(function(opt) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clock-option';
      btn.setAttribute('aria-label', timeToWords(opt.h, opt.m));
      btn.dataset.h = String(opt.h);
      btn.dataset.m = String(opt.m);
      btn.dataset.correct = opt.correct ? '1' : '0';
      const face = buildClockFace({ showSeconds: false, sizeClass: 'clock-face--option' });
      renderClockTime(face, opt.h, opt.m, null, {});
      btn.appendChild(face);
      btn.addEventListener('click', function() { onOptionTap(btn, opt); });
      optRow.appendChild(btn);
    });
  }

  function newRound() {
    clearTimeout(delayedNextTimer);
    delayedNextTimer = null;
    roundLocked = false;
    thumbsDown.hide();

    const saved = loadRoundState(QUIZ_STATE_KEY);
    if (saved && saved.target && Array.isArray(saved.opts) && saved.opts.length === 3) {
      target = saved.target;
      renderOpts(saved.opts);
      cancelSpeech();
      window.setTimeout(speakRound, 280);
      hint.reset();
      return;
    }

    const prev = target;
    let h, m;
    let tries = 0;
    do {
      h = randomHour();
      m = randomMinute();
      tries++;
    } while (prev && prev.h === h && prev.m === m && tries < 50);
    target = { h: h, m: m };

    function pickWrong(exclude) {
      let wh, wm;
      let wtries = 0;
      do {
        wh = randomHour();
        wm = randomMinute();
        wtries++;
        if (wtries > 200) break;
      } while (
        wh === h ||
        minutesShareDigit(wm, m) ||
        exclude.some(function(e) { return e.h === wh && e.m === wm; })
      );
      return { h: wh, m: wm };
    }

    const wrong1 = pickWrong([]);
    const wrong2 = pickWrong([wrong1]);

    const opts = shuffleInPlace([
      { h: h, m: m, correct: true },
      { h: wrong1.h, m: wrong1.m, correct: false },
      { h: wrong2.h, m: wrong2.m, correct: false }
    ]);

    saveRoundState(QUIZ_STATE_KEY, { target: target, opts: opts });
    renderOpts(opts);
    cancelSpeech();
    window.setTimeout(speakRound, 280);
    hint.reset();
  }

  function onOptionTap(btn, opt) {
    if (session.isSessionEnded() || roundLocked) return;
    if (opt.correct) {
      roundLocked = true;
      hint.stop();
      saveRoundState(QUIZ_STATE_KEY, null);
      session.mutateStats(function(stats) { stats.quizCorrect++; });
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
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
      delayedNextTimer = window.setTimeout(function() {
        delayedNextTimer = null;
        if (!session.isSessionEnded()) newRound();
      }, 1900);
      return;
    }

    session.mutateStats(function(stats) {
      stats.quizWrong++;
      pushUniqueStruggle(stats.quizStruggled, keyForTime(target.h, target.m));
    });
    thumbsDown.show();
    audio.playBuzzer();
    hint.registerMiss();
  }

  replay.addEventListener('click', function() {
    speakRound();
    replay.blur();
  });

  newRound();

  return {
    teardown: function() {
      cancelSpeech();
      clearTimeout(delayedNextTimer);
      delayedNextTimer = null;
    }
  };
}

function enterNext() {
  const wrap = document.createElement('div');
  wrap.className = 'next-wrap';

  const prompt = document.createElement('p');
  prompt.className = 'clock-prompt';
  prompt.textContent = 'Which time comes next?';
  wrap.appendChild(prompt);

  const realFace = buildClockFace({ showSeconds: true, sizeClass: 'clock-face--real' });
  enableSpeakOnTap(realFace);
  wrap.appendChild(realFace);

  const optRow = document.createElement('div');
  optRow.className = 'option-row';
  wrap.appendChild(optRow);

  appMain.appendChild(wrap);

  let roundOptions = [];
  let selection = null;
  let lastMinute = null;

  function buildRound() {
    const now = new Date();
    const curH = get12Hour(now);
    const curM = now.getMinutes();
    const correct = nextMinuteOf(curH, curM);

    let altH = randomHour();
    while (altH === correct.h) altH = randomHour();
    let altM = randomMinute();
    while (altM === correct.m) altM = randomMinute();

    roundOptions = shuffleInPlace([
      { h: correct.h, m: correct.m, correct: true },
      { h: altH, m: correct.m, correct: false },
      { h: correct.h, m: altM, correct: false }
    ]);
    selection = null;

    optRow.innerHTML = '';
    roundOptions.forEach(function(opt, idx) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clock-option';
      btn.setAttribute('aria-label', timeToWords(opt.h, opt.m));
      btn.dataset.h = String(opt.h);
      btn.dataset.m = String(opt.m);
      btn.dataset.correct = opt.correct ? '1' : '0';
      const face = buildClockFace({ showSeconds: false, sizeClass: 'clock-face--option' });
      renderClockTime(face, opt.h, opt.m, null, {});
      btn.appendChild(face);
      btn.addEventListener('click', function() {
        if (session.isSessionEnded()) return;
        selection = idx;
        const btns = optRow.querySelectorAll('.clock-option');
        for (let i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
        btn.classList.add('selected');
      });
      optRow.appendChild(btn);
    });
  }

  function revealAndRoll() {
    const now = new Date();
    const curH = get12Hour(now);
    const curM = now.getMinutes();
    if (selection != null) {
      const sel = roundOptions[selection];
      if (sel.h === curH && sel.m === curM) {
        session.mutateStats(function(stats) { stats.nextCorrect++; });
        const btn = optRow.querySelectorAll('.clock-option')[selection];
        if (btn) {
          btn.classList.remove('pop');
          void btn.offsetWidth;
          btn.classList.add('pop');
        }
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
      } else {
        session.mutateStats(function(stats) {
          stats.nextWrong++;
          pushUniqueStruggle(stats.nextStruggled, keyForTime(curH, curM));
        });
        thumbsDown.show();
        audio.playBuzzer();
      }
    }
    buildRound();
  }

  buildRound();

  startTickLoop(function(now) {
    renderClockTime(realFace, get12Hour(now), now.getMinutes(), now.getSeconds(), realClockOpts(now));
    const minute = now.getMinutes();
    if (lastMinute != null && minute !== lastMinute) {
      revealAndRoll();
    }
    lastMinute = minute;
  });

  return {
    teardown: function() {
      stopTickLoop();
      cancelSpeech();
      thumbsDown.hide();
    },
    revealAndRoll: revealAndRoll,
    setSelection: function(idx) { selection = idx; }
  };
}

document.querySelectorAll('.mode-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    setMode(btn.dataset.mode);
    btn.blur();
  });
});

session.initPlaySession();
session.startSessionTimerIfNeeded();
setMode(readSessionMode(CLOCK_SESSION_KEY, 'watch'));

document.getElementById('link-home').addEventListener('click', function() {
  stopClockGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});

window.addEventListener('pagehide', stopClockGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    stopClockGame();
    setMode(currentMode || 'watch');
  }
});
