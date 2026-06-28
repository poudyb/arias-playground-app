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
    appendScoreSection(board, {
      icon: '🧠',
      title: 'Memory',
      body: pairs === 0
        ? 'Flip two cards and find the pictures that match!'
        : 'You matched ' + pairs + ' pair' + (pairs === 1 ? '' : 's') +
          (cleared ? ' and finished ' + cleared + ' board' + (cleared === 1 ? '' : 's') + '!' : '!')
    });
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

const hint = createHintNudge({
  onFlash: function() { flashHintEl(CHOICES[correctChoiceIdx].btn); },
  isActive: function() { return !session.isSessionEnded(); }
});

function speakPrompt() {
  if (session.isSessionEnded()) return;
  speakText(PROMPT_SAY, { rate: 0.88 });
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
    window.setTimeout(function() { if (!session.isSessionEnded()) speakPrompt(); }, 280);
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
  window.setTimeout(function() {
    if (!session.isSessionEnded()) speakPrompt();
  }, 280);
  hint.reset();
}

function onChoiceTap(idx) {
  if (session.isSessionEnded() || roundLocked) return;
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
}

function stopMatchGame() {
  cancelSpeech();
  clearTimeout(delayedNextTimer);
  delayedNextTimer = null;
  thumbsDown.hide();
  hint.stop();
  stopMemory();
}

// ---------------------------------------------------------------------------
// Memory mode: a concentration game over the same animal + shape pool. Clearing
// a board grows the deck (chase-style levels); the buzzer and any demotion are
// reserved for repeated *unforced* errors (re-picking a card already known not
// to match) so honest first-look misses never feel like mistakes.
// ---------------------------------------------------------------------------

const MEMORY_LEVEL_KEY = SAME_AS_SESSION_KEY + ':memory';
// True errors within one board needed to drop a level. Like chase, the level
// only changes when the board is finished - never an immediate mid-board demote.
const MEMORY_DEMOTE_THRESHOLD = 10;

// pairs on the board + the grid shape. Level 1 is a single pair, so the very
// first board is impossible to get wrong - it just teaches "find the two that
// match". The last entry is the cap: clearing the top board re-deals at size.
const MEMORY_LEVELS = [
  { pairs: 1, cols: 2, rows: 1 },   // 2 cards
  { pairs: 2, cols: 2, rows: 2 },   // 4 cards
  { pairs: 3, cols: 3, rows: 2 },   // 6 cards
  { pairs: 4, cols: 4, rows: 2 },   // 8 cards
  { pairs: 5, cols: 5, rows: 2 },   // 10 cards
  { pairs: 6, cols: 4, rows: 3 },   // 12 cards
  { pairs: 8, cols: 4, rows: 4 }    // 16 cards
];

// Hand-picked ARASAAC picture cards (shared with the Spelling game). Every entry
// is visually distinct from the others - no two share a silhouette or dominant
// colour - so a board can never show two cards a young child could mix up (the
// reason the old shape pool, e.g. red circle vs red square, was dropped here).
const MEMORY_WORDS = [
  'dog', 'cat', 'cow', 'pig', 'owl', 'bee', 'bat', 'ram',
  'egg', 'pie', 'nut', 'eye', 'ear', 'lip', 'cup', 'jar',
  'pot', 'car', 'key', 'pen', 'fan', 'saw', 'map', 'sun',
  'bed', 'top', 'gem', 'hat', 'zip', 'net'
];
const MEMORY_DECK = MEMORY_WORDS.map(function(word) {
  return { key: word, name: word, img: 'assets/spelling/' + word + '.png' };
});

const memoryPreloadCache = [];
function preloadMemoryImages() {
  if (memoryPreloadCache.length) return;
  MEMORY_DECK.forEach(function(card) {
    const img = new Image();
    img.src = card.img;
    memoryPreloadCache.push(img); // retain so the fetch isn't GC-cancelled
  });
}

let memoryActive = false;
let memoryLevelIdx = 0;
let memoryCards = [];
let memoryFirstIdx = -1;
let memoryLocked = false;
let memoryUnforced = 0;
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

function pickMemoryItems(count) {
  return shuffleInPlace(MEMORY_DECK.slice()).slice(0, count);
}

function renderMemoryArt(el, card) {
  el.innerHTML = '';
  const img = document.createElement('img');
  img.src = card.img;
  img.alt = '';
  img.decoding = 'async';
  el.appendChild(img);
}

function createMemoryCard(card, index) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'memory-card';
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
}

function flipMemoryUp(card) {
  card.faceUp = true;
  card.el.classList.add('is-flipped');
  card.el.setAttribute('aria-label', card.name + ', face up');
  // Say what was revealed so the child sees it and hears it named.
  if (!session.isSessionEnded()) speakText(card.name, { rate: 0.9 });
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
  memoryUnforced = 0;
  memoryMatchedPairs = 0;

  const level = MEMORY_LEVELS[memoryLevelIdx];
  const picks = pickMemoryItems(level.pairs);
  const deck = [];
  picks.forEach(function(p) {
    deck.push(p);
    deck.push(p);
  });
  shuffleInPlace(deck);

  memoryGridEl.style.setProperty('--cols', String(level.cols));
  memoryGridEl.style.setProperty('--rows', String(level.rows));

  memoryGridEl.innerHTML = '';
  memoryCards = deck.map(function(card, i) {
    const node = createMemoryCard(card, i);
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

  flipMemoryUp(card);

  if (memoryFirstIdx === -1) {
    memoryFirstIdx = index;
    return;
  }

  const first = memoryCards[memoryFirstIdx];
  memoryFirstIdx = -1;

  if (first.key === card.key) {
    resolveMemoryMatch(first, card);
  } else {
    resolveMemoryMismatch(first, card);
  }
}

function resolveMemoryMatch(a, b) {
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
  audio.playChime();
  spawnMemoryConfetti(a.el);
  spawnMemoryConfetti(b.el);

  // Let the matched pair sit face-up for a beat so the child takes it in before
  // it fades away.
  const total = MEMORY_LEVELS[memoryLevelIdx].pairs;
  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    a.el.classList.add('is-matched');
    b.el.classList.add('is-matched');
    if (memoryMatchedPairs >= total) {
      memoryTimer = window.setTimeout(function() {
        memoryTimer = null;
        completeMemoryLevel();
      }, 560);
    } else {
      memoryLocked = false;
    }
  }, 1050);
}

function resolveMemoryMismatch(a, b) {
  memoryLocked = true;

  // A true error is picking, as your second card, one you had ALREADY revealed
  // earlier this board - you knew its face and that it wasn't the match, but
  // chose it anyway. A first look at a card you hadn't seen is honest
  // exploration: no buzzer, just the gentle "your turn again" tone. Tallied per
  // board; demotion happens later, at the end of the board (see complete
  // MemoryLevel) - never an immediate mid-board drop.
  const unforced = b.seen;
  a.seen = true;
  b.seen = true;

  if (unforced) {
    memoryUnforced += 1;
    session.mutateStats(function(stats) {
      stats.usedMemory = true;
      stats.memoryUnforced += 1;
      pushUniqueStruggle(stats.struggled, b.key);
    });
  }

  // Hold both faces up long enough to see and hear them, then react and flip
  // back. Wrong-on-purpose gets a buzzer plus a small shake (no big red X);
  // an honest miss just gets the soft tone.
  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    if (unforced) {
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
    }, unforced ? 520 : 280);
  }, 1500);
}

function completeMemoryLevel() {
  // The board is always finished; the next one grows unless this board took a
  // lot of true errors, in which case it eases back a level (chase-style, only
  // at the end of the board, never below the first one).
  const demote = memoryUnforced >= MEMORY_DEMOTE_THRESHOLD && memoryLevelIdx > 0;

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

  if (demote) memoryLevelIdx -= 1;
  else if (memoryLevelIdx < MEMORY_LEVELS.length - 1) memoryLevelIdx += 1;
  saveMemoryLevel();

  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    if (memoryActive && !session.isSessionEnded()) buildMemoryBoard();
  }, 2400);
}

function saveMemoryLevel() {
  saveRoundState(MEMORY_LEVEL_KEY, { level: memoryLevelIdx });
}

function loadMemoryLevel() {
  const saved = loadRoundState(MEMORY_LEVEL_KEY);
  if (saved && isValidIndex(saved.level, MEMORY_LEVELS.length)) return saved.level;
  return 0;
}

function startMemory() {
  memoryActive = true;
  preloadMemoryImages();
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
