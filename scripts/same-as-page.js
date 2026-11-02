const catBtns = document.querySelectorAll('.cat-btn');
const refCard = document.getElementById('ref-card');
const refArt = document.getElementById('ref-art');

const CHOICES = [
  { btn: document.getElementById('choice-left'), art: document.getElementById('choice-left-art') },
  { btn: document.getElementById('choice-middle'), art: document.getElementById('choice-middle-art') },
  { btn: document.getElementById('choice-right'), art: document.getElementById('choice-right-art') }
];

const PROMPT_SAY = 'Which one is the same as this?';
const CONFETTI_HEX = ['#00838f', '#26c6da', '#b2ebf2', '#e53935', '#43a047', '#8e24aa', '#ff9800', '#1e88e5'];
const SAME_AS_SESSION_KEY = 'ariaSameAsSession';
const SAME_AS_MODES = ['animals', 'shapes', 'memory'];

const matchBoardEl = document.getElementById('match-board');
const memoryBoardEl = document.getElementById('memory-board');
const memoryGridEl = document.getElementById('memory-grid');

let category = 'animals';
let pool = ANIMALS;
let targetIndex = -1;
let lastTargetKey = null;
let correctChoiceIdx = 0;
let roundLocked = false;
let delayedNextTimer = null;

function renderSummary(board, stats) {
  const playedMatch = stats.usedAnimals || stats.usedShapes;

  if (playedMatch || !stats.usedMemory) {
    const correct = stats.matchCorrect;
    const wrong = stats.matchWrong;
    appendScoreSection(board, {
      icon: '🧩',
      title: 'Matches',
      body: correct === 0 && wrong === 0
        ? 'Tap the picture that looks just like the one on top!'
        : 'Nice matching - ' + correct + ' correct' + (wrong ? ', ' + wrong + ' oops taps' : '') + '!'
    });
  }

  if (stats.usedMemory) {
    const pairs = stats.memoryMatches;
    const cleared = stats.memoryLevelsCleared;
    const body = createIntroBody(pairs === 0
      ? 'Flip two cards and find the pictures that match!'
      : 'You matched ' + pairs + ' pair' + (pairs === 1 ? '' : 's') +
        (cleared ? ' and finished ' + cleared + ' board' + (cleared === 1 ? '' : 's') + '!' : '!'));
    // For the grown-up: how the board size moves, which she is never told.
    appendBodyNote(body, 'Now on boards of ' + (MEMORY_LEVELS[memoryLevelIdx].pairs * 2) + ' cards. ' +
      'A board with no wasted picks moves her up a size. Picking a card she had already seen, ' +
      'in a way that couldn\'t match, is let go once a board; the second time ends it' +
      (stats.memoryBoardsFailed ? ' (' + stats.memoryBoardsFailed + ' ended that way today)' : '') + '.');
    appendScoreSection(board, { icon: '🧠', title: 'Memory', body: body });
  }

  const modes = [];
  if (stats.usedAnimals) modes.push('animals');
  if (stats.usedShapes) modes.push('shapes');
  if (stats.usedMemory) modes.push('memory');
  if (modes.length) {
    appendScoreSection(board, {
      icon: '🎯',
      title: 'Modes tried',
      body: 'You practiced with: ' + modes.join(' and ') + '.'
    });
  }

  cancelSpeech();
}

const session = createTimedSession({
  sessionKey: SAME_AS_SESSION_KEY,
  statsKey: 'ariaSameAsStats',
  defaultStats: createSameAsStats,
  normalizeStats: normalizeSameAsStats,
  stopGame: stopMatchGame,
  renderSummary
});

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

// The row of three rests after a wrong pick (createWrongPause in feedback.js).
const wrongPause = createWrongPause();
const choiceRow = CHOICES[0].btn.parentElement;

const hint = createHintNudge({
  onFlash: function() { flashHintEl(CHOICES[correctChoiceIdx].btn); },
  isActive: function() { return !session.isSessionEnded(); }
});

// The prompt is said a beat after a round is dealt, on a timer. Switching to
// Memory inside that beat used to let it fire anyway and talk over the first
// card she turned, so it is tracked, cancelled on the way out, and checks it's
// still on a match board.
let promptTimer = null;

function speakPrompt() {
  if (session.isSessionEnded() || category === 'memory') return;
  speakText(PROMPT_SAY, { rate: 0.88 });
}

function promptSoon() {
  clearTimeout(promptTimer);
  promptTimer = window.setTimeout(function() {
    promptTimer = null;
    speakPrompt();
  }, 280);
}

function renderArt(el, item) {
  el.innerHTML = '';
  if (category === 'shapes' && item.svgMarkup) {
    el.innerHTML = item.svgMarkup;
    return;
  }
  const span = document.createElement('span');
  span.textContent = item.emoji;
  span.setAttribute('aria-hidden', 'true');
  el.appendChild(span);
}

function pickWrongIndices(target, count) {
  const picked = [];
  let guard = 0;
  while (picked.length < count && guard < 200) {
    const candidate = Math.floor(Math.random() * pool.length);
    if (candidate !== target && picked.indexOf(candidate) === -1) {
      picked.push(candidate);
    }
    guard++;
  }
  return picked;
}

function struggleIdForIndex(index) {
  const item = pool[index];
  return (category === 'animals' ? 'a:' : 's:') + item.key;
}

function setCategory(nextCategory) {
  if (session.isSessionEnded()) return;
  if (SAME_AS_MODES.indexOf(nextCategory) === -1) nextCategory = 'animals';
  category = nextCategory;
  rememberSessionMode(SAME_AS_SESSION_KEY, category);
  catBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });

  if (category === 'memory') {
    // Leaving the match board: silence its prompts, timers and hints.
    cancelSpeech();
    clearTimeout(delayedNextTimer);
    delayedNextTimer = null;
    clearTimeout(promptTimer);
    promptTimer = null;
    wrongPause.stop();
    hint.stop();
    thumbsDown.hide();
    matchBoardEl.hidden = true;
    memoryBoardEl.hidden = false;
    startMemory();
    return;
  }

  stopMemory();
  memoryBoardEl.hidden = true;
  matchBoardEl.hidden = false;
  saveRoundState(ROUND_STATE_KEY, null);
  pool = category === 'animals' ? ANIMALS : SHAPES;
  if (session.shouldTrackStats()) {
    session.mutateStats(function(stats) {
      if (category === 'animals') stats.usedAnimals = true;
      else stats.usedShapes = true;
    });
  }
  startRound();
}

const ROUND_STATE_KEY = SAME_AS_SESSION_KEY + ':round';

function applyRoundState(ti, ci, choiceItemIndices) {
  targetIndex = ti;
  lastTargetKey = struggleIdForIndex(targetIndex);
  correctChoiceIdx = ci;
  CHOICES.forEach(function(c, i) {
    const itemIndex = choiceItemIndices[i];
    renderArt(c.art, pool[itemIndex]);
    const label = pool[itemIndex].name + (itemIndex === targetIndex ? ' - matches top' : '');
    c.btn.setAttribute('aria-label', label);
  });
  renderArt(refArt, pool[targetIndex]);
}

function startRound() {
  if (session.isSessionEnded()) return;

  clearTimeout(delayedNextTimer);
  delayedNextTimer = null;
  wrongPause.stop();
  roundLocked = false;
  CHOICES.forEach(function(c) {
    c.btn.classList.remove('match-choice--locked', 'pop');
    c.btn.disabled = false;
  });
  thumbsDown.hide();

  const saved = loadRoundState(ROUND_STATE_KEY);
  if (saved && saved.category === category &&
      isValidIndex(saved.targetIndex, pool.length) &&
      isValidIndex(saved.correctChoiceIdx, CHOICES.length) &&
      isValidIndexArray(saved.choiceItemIndices, CHOICES.length, pool.length)) {
    applyRoundState(saved.targetIndex, saved.correctChoiceIdx, saved.choiceItemIndices);
    cancelSpeech();
    promptSoon();
    hint.reset();
    return;
  }

  let nextTargetIndex;
  let tries = 0;
  do {
    nextTargetIndex = Math.floor(Math.random() * pool.length);
    tries++;
  } while (pool.length > 1 && lastTargetKey != null && struggleIdForIndex(nextTargetIndex) === lastTargetKey && tries < 50);

  const newCorrectChoiceIdx = Math.floor(Math.random() * CHOICES.length);
  const wrongIndices = pickWrongIndices(nextTargetIndex, CHOICES.length - 1);
  let wrongCursor = 0;
  const choiceItemIndices = CHOICES.map(function(_, i) {
    return i === newCorrectChoiceIdx ? nextTargetIndex : wrongIndices[wrongCursor++];
  });

  saveRoundState(ROUND_STATE_KEY, { category: category, targetIndex: nextTargetIndex, correctChoiceIdx: newCorrectChoiceIdx, choiceItemIndices: choiceItemIndices });
  applyRoundState(nextTargetIndex, newCorrectChoiceIdx, choiceItemIndices);

  cancelSpeech();
  promptSoon();
  hint.reset();
}

function onChoiceTap(idx) {
  if (session.isSessionEnded() || roundLocked || wrongPause.isResting()) return;
  const btn = CHOICES[idx].btn;

  if (idx === correctChoiceIdx) {
    roundLocked = true;
    hint.stop();
    saveRoundState(ROUND_STATE_KEY, null);
    session.mutateStats(function(stats) {
      stats.matchCorrect++;
    });
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
    CHOICES.forEach(function(c) { c.btn.classList.add('match-choice--locked'); });
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
      if (!session.isSessionEnded()) startRound();
    }, 1900);
    return;
  }

  session.mutateStats(function(stats) {
    stats.matchWrong++;
    const struggleId = struggleIdForIndex(targetIndex);
    if (struggleId) pushUniqueStruggle(stats.struggled, struggleId);
  });
  thumbsDown.show();
  audio.playBuzzer();
  hint.registerMiss();
  wrongPause.start(choiceRow);
}

function stopMatchGame() {
  cancelSpeech();
  clearTimeout(delayedNextTimer);
  delayedNextTimer = null;
  clearTimeout(promptTimer);
  promptTimer = null;
  wrongPause.stop();
  thumbsDown.hide();
  hint.stop();
  stopMemory();
}

// ---------------------------------------------------------------------------
// Memory mode: a concentration game over the Spelling picture pool. Only a
// board played without a slip grows the deck; a slip is a pick she had the
// information to avoid (see shared/memory-logic.js). One slip per board gets
// the buzzer and a shake; a second ends the board. Honest first looks at new
// cards never count against her and only get the soft tone.
//
// Cards she has never turned over shimmer, a slow sheen across the back, so
// the board itself shows where there is still something to find.
// ---------------------------------------------------------------------------

const MEMORY_LEVEL_KEY = SAME_AS_SESSION_KEY + ':memory';

// pairs on the board + the grid shape. Level 1 is a single pair, so the very
// first board is impossible to get wrong - it just teaches "find the two that
// match". The last entry is the cap: clearing the top board re-deals at size.
const MEMORY_LEVELS = [
  { pairs: 1, cols: 2, rows: 1 },   // 2 cards
  { pairs: 2, cols: 2, rows: 2 },   // 4 cards
  { pairs: 3, cols: 3, rows: 2 },   // 6 cards
  { pairs: 4, cols: 4, rows: 2 },   // 8 cards
  { pairs: 5, cols: 4, rows: 3 },   // 10 cards, with the last pair centred
  { pairs: 6, cols: 4, rows: 3 },   // 12 cards
  { pairs: 8, cols: 4, rows: 4 }    // 16 cards
];

// The deck is the Spelling game's whole picture pool (data/spelling.js), so it
// grows whenever Spelling does. It used to be a hand-picked 30 chosen so no two
// cards shared a silhouette or colour, a rule carried over from the shape pool
// (red circle beside red square). Pictures of different things turned out not
// to need it: dog and ram, both brown and both in profile, sat side by side for
// months without ever being confused, so the extra list was only maintenance.
//
// No preload: each board's pictures are fetched when its cards are built, face
// down, and they are cached from the first board on. Fetching the whole pool up
// front bought nothing a 2-second look at the card backs doesn't already buy.
const MEMORY_DECK = SPELLING_WORDS.map(function(w) {
  return { key: w.word, name: w.word, img: 'assets/spelling/' + w.img };
});
const MEMORY_KEYS = {};
MEMORY_DECK.forEach(function(card) { MEMORY_KEYS[card.key] = true; });

let memoryActive = false;
let memoryLevelIdx = 0;
let memoryCards = [];
let memoryFirstIdx = -1;
let memoryWordTimer = null;
let memoryLocked = false;
let memorySlips = 0;
let memoryFailStreak = 0;
let memoryMatchedPairs = 0;
let memoryTimer = null;
let memoryIntroTimer = null;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// Every board avoids the pictures that were on the one before it, so clearing
// a board always brings new faces rather than the same ones shuffled. The deck
// is far bigger than the largest board (8 pairs), so a fresh deal always fits.
let memoryLastKeys = [];
function pickMemoryItems(count) {
  return dealAvoiding(MEMORY_DECK, count, memoryLastKeys, function(card) { return card.key; });
}

function renderMemoryArt(el, card) {
  el.innerHTML = '';
  const img = document.createElement('img');
  img.src = card.img;
  img.alt = '';
  img.decoding = 'async';
  el.appendChild(img);
}

function createMemoryCard(card, index, cols) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'memory-card is-fresh';
  // The shimmer crosses the board as one diagonal wave, top-left first.
  btn.style.setProperty('--shimmer-delay', (((index % cols) + Math.floor(index / cols)) * 0.14) + 's');
  btn.setAttribute('aria-label', 'Memory card, face down');

  const inner = document.createElement('span');
  inner.className = 'memory-card__inner';

  const back = document.createElement('span');
  back.className = 'memory-card__face memory-card__back';
  back.setAttribute('aria-hidden', 'true');

  const front = document.createElement('span');
  front.className = 'memory-card__face memory-card__front';
  const art = document.createElement('span');
  art.className = 'memory-card__art';
  renderMemoryArt(art, card);
  front.appendChild(art);
  const name = document.createElement('span');
  name.className = 'picture-card__name';
  name.textContent = card.name;
  front.appendChild(name);

  inner.appendChild(back);
  inner.appendChild(front);
  btn.appendChild(inner);

  btn.addEventListener('click', function() { onMemoryCardTap(index); });

  return { key: card.key, name: card.name, el: btn, artEl: art, faceUp: false, matched: false, seen: false };
}

function clearMemoryTimers() {
  if (memoryTimer != null) {
    clearTimeout(memoryTimer);
    memoryTimer = null;
  }
  if (memoryIntroTimer != null) {
    clearTimeout(memoryIntroTimer);
    memoryIntroTimer = null;
  }
  if (memoryWordTimer != null) {
    clearTimeout(memoryWordTimer);
    memoryWordTimer = null;
  }
}

// Returns the utterance for the name it just said, so a match can wait for the
// word to finish before it celebrates (null when nothing was spoken).
//
// The second card of a turn waits for the first card's name rather than cutting
// it off, and is never dropped for being the same word: "cat … cat" is the
// match, and she should hear both halves of it. The first card of a turn
// replaces whatever was being said (the intro, a cheer) — her tap wins.
function flipMemoryUp(card, isSecond, silent) {
  card.faceUp = true;
  card.el.classList.remove('is-fresh');
  card.el.classList.add('is-flipped');
  card.el.setAttribute('aria-label', card.name + ', face up');
  // Say what was revealed so the child sees it and hears it named.
  if (session.isSessionEnded() || silent) return null;
  return speakText(card.name, { rate: 0.9, queue: isSecond });
}

function flipMemoryDown(card) {
  card.faceUp = false;
  card.el.classList.remove('is-flipped', 'shake');
  card.el.setAttribute('aria-label', 'Memory card, face down');
}

function shakeMemoryCard(card) {
  card.el.classList.remove('shake');
  void card.el.offsetWidth;
  card.el.classList.add('shake');
}

function buildMemoryBoard() {
  clearMemoryTimers();
  memoryFirstIdx = -1;
  memoryLocked = false;
  memorySlips = 0;
  memoryMatchedPairs = 0;

  const level = MEMORY_LEVELS[memoryLevelIdx];
  const picks = pickMemoryItems(level.pairs);
  memoryLastKeys = picks.map(function(p) { return p.key; });
  // Remembered with the level so a board dealt after a reload also avoids the
  // one that was on screen when the page went away.
  saveMemoryLevel();
  const deck = [];
  picks.forEach(function(p) {
    deck.push(p);
    deck.push(p);
  });
  shuffleInPlace(deck);

  memoryGridEl.style.setProperty('--cols', String(level.cols));
  memoryGridEl.style.setProperty('--rows', String(level.rows));
  memoryGridEl.classList.toggle('memory-grid--center-last-pair', deck.length === 10);

  memoryGridEl.innerHTML = '';
  memoryCards = deck.map(function(card, i) {
    const node = createMemoryCard(card, i, level.cols);
    memoryGridEl.appendChild(node.el);
    return node;
  });

  cancelSpeech();
  memoryIntroTimer = window.setTimeout(function() {
    memoryIntroTimer = null;
    if (memoryActive && !session.isSessionEnded() && memoryFirstIdx === -1) {
      speakText('Find the ones that match!', { rate: 0.9 });
    }
  }, 360);
}

function spawnMemoryConfetti(el) {
  const rect = el.getBoundingClientRect();
  const left = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
  const top = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
  spawnConfetti({
    colors: CONFETTI_HEX,
    count: 16,
    originLeft: left + 'vw',
    originTop: top + 'vh',
    minDistance: 10,
    distanceJitter: 22,
    minDuration: 0.7,
    durationJitter: 0.5
  });
}

function popMemoryArt(card) {
  card.artEl.classList.remove('pop');
  void card.artEl.offsetWidth;
  card.artEl.classList.add('pop');
}

function onMemoryCardTap(index) {
  if (!memoryActive || session.isSessionEnded() || memoryLocked) return;
  const card = memoryCards[index];
  if (!card || card.matched || card.faceUp) return;

  // The child is engaging - drop the intro nudge so it can't talk over a card.
  if (memoryIntroTimer != null) {
    clearTimeout(memoryIntroTimer);
    memoryIntroTimer = null;
  }

  const spoken = flipMemoryUp(card, memoryFirstIdx !== -1);

  if (memoryFirstIdx === -1) {
    memoryFirstIdx = index;
    return;
  }

  const first = memoryCards[memoryFirstIdx];
  memoryFirstIdx = -1;

  // Judged on what she knew before this turn, then both count as seen.
  const outcome = classifyMemoryTurn(first, card);
  first.seen = true;
  card.seen = true;

  if (outcome === 'match') {
    resolveMemoryMatch(first, card, spoken);
  } else {
    resolveMemoryMismatch(first, card, outcome === 'slip');
  }
}

// Run `go` once the card's name has finished being spoken. Speech can also
// finish without telling us — no voice installed, the device muted, or the
// utterance dropped because the first card of the pair is still saying the very
// same word — so a timer always backs it up.
function afterMemoryWord(utterance, go) {
  let ran = false;
  function run() {
    if (ran) return;
    ran = true;
    if (memoryWordTimer != null) {
      clearTimeout(memoryWordTimer);
      memoryWordTimer = null;
    }
    if (!memoryActive || session.isSessionEnded()) return;
    go();
  }
  if (utterance) {
    utterance.addEventListener('end', run);
    utterance.addEventListener('error', run);
    memoryWordTimer = window.setTimeout(run, 2200);
  } else {
    // Nothing to listen to, but still leave a beat so the celebration doesn't
    // land on top of the word.
    memoryWordTimer = window.setTimeout(run, 850);
  }
}

function resolveMemoryMatch(a, b, spoken) {
  memoryLocked = true;
  a.matched = true;
  b.matched = true;
  memoryMatchedPairs += 1;

  session.mutateStats(function(stats) {
    stats.usedMemory = true;
    stats.memoryMatches += 1;
  });

  popMemoryArt(a);
  popMemoryArt(b);

  // Name first, celebration second. The two used to happen together, which
  // talked over the word she had just earned. Now the pair bursts and goes in
  // the same instant, so the confetti reads as the cards themselves popping
  // rather than as decoration sprayed across the board.
  const total = MEMORY_LEVELS[memoryLevelIdx].pairs;
  afterMemoryWord(spoken, function() {
    audio.playChime();
    spawnMemoryConfetti(a.el);
    spawnMemoryConfetti(b.el);
    a.el.classList.add('is-matched');
    b.el.classList.add('is-matched');
    memoryTimer = window.setTimeout(function() {
      memoryTimer = null;
      if (memoryMatchedPairs >= total) completeMemoryLevel();
      else memoryLocked = false;
    }, 620);
  });
}

function resolveMemoryMismatch(a, b, slip) {
  memoryLocked = true;

  if (slip) {
    memorySlips += 1;
    session.mutateStats(function(stats) {
      stats.usedMemory = true;
      stats.memoryUnforced += 1;
      pushUniqueStruggle(stats.struggled, b.key);
    });
  }
  const failed = memoryBoardFailed(memorySlips);

  // Hold both faces up long enough to see and hear them, then react. An honest
  // miss gets the soft tone. The first slip gets the buzzer and a small shake
  // (no big X): a warning. The second ends the board.
  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    if (failed) {
      failMemoryBoard(a, b);
      return;
    }
    if (slip) {
      audio.playBuzzer();
      shakeMemoryCard(a);
      shakeMemoryCard(b);
    } else {
      audio.playSoftTone();
    }
    memoryTimer = window.setTimeout(function() {
      memoryTimer = null;
      flipMemoryDown(a);
      flipMemoryDown(b);
      memoryLocked = false;
    }, slip ? 520 : 280);
  }, 1500);
}

// A second slip: this is an answer she gave knowing better, so it gets the big
// red X and the buzzer like any wrong answer. Then every card turns over to show
// where they all were, and a new board is dealt — the same size, or one smaller
// after two failed boards in a row.
function failMemoryBoard(a, b) {
  thumbsDown.show();
  audio.playBuzzer();
  shakeMemoryCard(a);
  shakeMemoryCard(b);
  session.mutateStats(function(stats) {
    stats.usedMemory = true;
    stats.memoryBoardsFailed += 1;
  });
  const next = nextMemoryLevel(memoryLevelIdx, 'failed', memoryFailStreak, MEMORY_LEVELS.length);
  memoryLevelIdx = next.level;
  memoryFailStreak = next.failStreak;
  saveMemoryLevel();

  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    memoryCards.forEach(function(card) {
      if (!card.matched && !card.faceUp) flipMemoryUp(card, false, true);
    });
    memoryTimer = window.setTimeout(function() {
      memoryTimer = null;
      if (memoryActive && !session.isSessionEnded()) buildMemoryBoard();
    }, 2200);
  }, 900);
}

function completeMemoryLevel() {
  // Only a board with no slip moves her up; one slip keeps her on this size
  // (see nextMemoryLevel). Either way she finished it, and that's celebrated.
  const next = nextMemoryLevel(memoryLevelIdx, memorySlips === 0 ? 'clean' : 'slipped',
    memoryFailStreak, MEMORY_LEVELS.length);

  session.mutateStats(function(stats) {
    stats.usedMemory = true;
    stats.memoryLevelsCleared += 1;
  });

  // Warm and simple - she lights up at "Hooray, you did it!", so lean on the
  // voice and a tasteful confetti burst instead of a pile of emojis.
  spawnConfetti({
    colors: CONFETTI_HEX,
    count: 80,
    originTop: '45vh',
    minDistance: 40,
    distanceJitter: 55,
    minDuration: 1.0,
    durationJitter: 0.8
  });
  audio.playFanfare();
  cancelSpeech();
  window.setTimeout(function() {
    if (memoryActive && !session.isSessionEnded()) speakText('Hooray! You did it!', { rate: 0.95 });
  }, 240);

  memoryLevelIdx = next.level;
  memoryFailStreak = next.failStreak;
  saveMemoryLevel();

  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    if (memoryActive && !session.isSessionEnded()) buildMemoryBoard();
  }, 2400);
}

function saveMemoryLevel() {
  saveRoundState(MEMORY_LEVEL_KEY, { level: memoryLevelIdx, failStreak: memoryFailStreak, lastKeys: memoryLastKeys });
}

function loadMemoryLevel() {
  const saved = loadRoundState(MEMORY_LEVEL_KEY);
  memoryLastKeys = (saved && Array.isArray(saved.lastKeys))
    ? saved.lastKeys.filter(function(k) { return MEMORY_KEYS[k] === true; })
    : [];
  memoryFailStreak = saved && typeof saved.failStreak === 'number' ? saved.failStreak : 0;
  if (saved && isValidIndex(saved.level, MEMORY_LEVELS.length)) return saved.level;
  return 0;
}

function startMemory() {
  memoryActive = true;
  memoryLevelIdx = loadMemoryLevel();
  session.mutateStats(function(stats) { stats.usedMemory = true; });
  buildMemoryBoard();
}

function stopMemory() {
  memoryActive = false;
  clearMemoryTimers();
  memoryFirstIdx = -1;
  memoryLocked = false;
}

CHOICES.forEach(function(c, i) {
  c.btn.addEventListener('click', function() { onChoiceTap(i); });
});

refCard.addEventListener('click', function() {
  speakPrompt();
  refCard.blur();
});

catBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (btn.dataset.cat === category) return;
    cancelSpeech();
    setCategory(btn.dataset.cat);
    btn.blur();
  });
});

initGamePage({
  session: session,
  stop: stopMatchGame,
  start: function() { setCategory(readSessionMode(SAME_AS_SESSION_KEY, 'animals')); },
  onResume: function() {
    stopMatchGame();
    setCategory(category);
  }
});
