const modeBtns = document.querySelectorAll('.mode-btn');
const memoryGridEl = document.getElementById('memory-grid');

const MEMORY_SESSION_KEY = 'ariaMemorySession';
const MEMORY_LEVEL_KEY = MEMORY_SESSION_KEY + ':level';
const CONFETTI_HEX = ['#00838f', '#26c6da', '#b2ebf2', '#e53935', '#43a047', '#8e24aa', '#ff9800', '#1e88e5'];
const BOARD_PROMPT = 'Find the ones that match!';

let mode = null;

function matchedSentence(pairs, boards) {
  return 'You matched ' + pairs + ' pair' + (pairs === 1 ? '' : 's') +
    (boards ? ' and finished ' + boards + ' board' + (boards === 1 ? '' : 's') + '!' : '!');
}

function renderSummary(board, stats) {
  if (stats.usedFreeplay) {
    appendScoreSection(board, {
      icon: '🎨',
      title: 'Free Play',
      body: stats.freeMatches === 0
        ? 'You opened Free Play - tap two that are the same next time!'
        : matchedSentence(stats.freeMatches, stats.freeBoards)
    });
  }

  if (stats.usedFlip) {
    const body = createIntroBody(stats.flipMatches === 0
      ? 'Flip two cards and find the pictures that match!'
      : matchedSentence(stats.flipMatches, stats.flipBoards));
    // For the grown-up: how the board size moves, which she is never told.
    appendBodyNote(body, 'Now on boards of ' + (MEMORY_LEVELS[savedMemoryLevelIdx()].pairs * 2) + ' cards. ' +
      'A board with no wasted picks moves her up a size. Turning over a card she had already ' +
      'seen when it couldn\'t be the match gets the X; going back to a seen card first is let go ' +
      'once a board. Boards are never cut short; two messy boards in a row make the next one smaller' +
      (stats.flipBoardsFailed ? ' (' + stats.flipBoardsFailed + ' messy today)' : '') + '.');
    appendScoreSection(board, { icon: '🧠', title: 'Flip It', body: body });
  }

  cancelSpeech();
}

const session = createTimedSession({
  sessionKey: MEMORY_SESSION_KEY,
  statsKey: 'ariaMemoryStats',
  defaultStats: createMemoryStats,
  normalizeStats: normalizeMemoryStats,
  stopGame: stopMemoryGame,
  renderSummary
});

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

// ---------------------------------------------------------------------------
// Flip It: a concentration game over the Spelling picture pool. Only a
// board played without a slip grows the deck; a slip is a pick she had the
// information to avoid (see shared/memory-logic.js). Turning over a card she'd
// already seen, as the second card, when it isn't the match gets the big X;
// going back to a seen card first is milder, the first one let go and later
// ones a buzzer and a shake. The board never ends early: slips only decide
// the size of the next one. Honest first looks at new cards never count
// against her and only get the soft tone.
//
// Cards she has never turned over shimmer, a slow sheen across the back, so
// the board itself shows where there is still something to find.
//
// Free Play deals the same cards face up, one 8-card board at a time: she
// taps a card and its twin, and the pair goes. Nothing she taps is wrong.
// ---------------------------------------------------------------------------

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

const FREE_PLAY_BOARD = { pairs: 4, cols: 4, rows: 2 };

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

let memoryCards = [];
let memoryFirstIdx = -1;
let memoryLocked = false;
let memoryMatchedPairs = 0;
let memoryTimer = null;
let memoryIntroTimer = null;
let memoryCheerTimer = null;
let memoryWordTimer = null;
let boardSerial = 0;

let memoryLevelIdx = 0;
let memoryKnownSlips = 0;
let memoryGambles = 0;
let memoryFailStreak = 0;
let memoryLastKeys = [];
let freeLastKeys = [];

const hint = createHintNudge({
  onFlash: function() {
    freePlayHintIndices(memoryCards, memoryFirstIdx).forEach(function(i) {
      flashHintEl(memoryCards[i].el);
    });
  },
  isActive: function() { return mode === 'freeplay' && !memoryLocked && !session.isSessionEnded(); }
});

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
function pickMemoryItems(count, lastKeys) {
  return dealAvoiding(MEMORY_DECK, count, lastKeys, function(card) { return card.key; });
}

function renderMemoryArt(el, card) {
  el.innerHTML = '';
  const img = document.createElement('img');
  img.src = card.img;
  img.alt = '';
  img.decoding = 'async';
  el.appendChild(img);
}

function createMemoryCard(card, index, cols, faceUp) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = faceUp ? 'memory-card is-flipped' : 'memory-card is-fresh';
  // The shimmer crosses the board as one diagonal wave, top-left first.
  btn.style.setProperty('--shimmer-delay', (((index % cols) + Math.floor(index / cols)) * 0.14) + 's');
  btn.setAttribute('aria-label', faceUp ? card.name : 'Memory card, face down');

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

  btn.addEventListener('click', function() { MODES[mode].tap(index); });

  return { key: card.key, name: card.name, el: btn, artEl: art, faceUp: faceUp, matched: false, seen: false };
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
  if (memoryCheerTimer != null) {
    clearTimeout(memoryCheerTimer);
    memoryCheerTimer = null;
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
function flipMemoryUp(card, isSecond) {
  card.faceUp = true;
  card.el.classList.remove('is-fresh');
  card.el.classList.add('is-flipped');
  card.el.setAttribute('aria-label', card.name + ', face up');
  // Say what was revealed so the child sees it and hears it named.
  if (session.isSessionEnded()) return null;
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

function dealBoard(level, picks, faceUp) {
  clearMemoryTimers();
  boardSerial += 1;
  memoryFirstIdx = -1;
  memoryLocked = false;
  memoryMatchedPairs = 0;

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
    const node = createMemoryCard(card, i, level.cols, faceUp);
    memoryGridEl.appendChild(node.el);
    return node;
  });

  cancelSpeech();
  memoryIntroTimer = window.setTimeout(function() {
    memoryIntroTimer = null;
    if (!session.isSessionEnded() && memoryFirstIdx === -1) {
      speakText(BOARD_PROMPT, { rate: 0.9 });
    }
  }, 360);
}

function buildFlipBoard() {
  memoryKnownSlips = 0;
  memoryGambles = 0;
  const level = MEMORY_LEVELS[memoryLevelIdx];
  const picks = pickMemoryItems(level.pairs, memoryLastKeys);
  memoryLastKeys = picks.map(function(p) { return p.key; });
  // Remembered with the level so a board dealt after a reload also avoids the
  // one that was on screen when the page went away.
  saveMemoryLevel();
  dealBoard(level, picks, false);
}

function buildFreeBoard() {
  const picks = pickMemoryItems(FREE_PLAY_BOARD.pairs, freeLastKeys);
  freeLastKeys = picks.map(function(p) { return p.key; });
  dealBoard(FREE_PLAY_BOARD, picks, true);
  hint.reset();
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

// The child is engaging - drop the intro nudge so it can't talk over a card.
function dropIntroPrompt() {
  if (memoryIntroTimer != null) {
    clearTimeout(memoryIntroTimer);
    memoryIntroTimer = null;
  }
}

function onFlipTap(index) {
  if (session.isSessionEnded() || memoryLocked) return;
  const card = memoryCards[index];
  if (!card || card.matched || card.faceUp) return;

  dropIntroPrompt();

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
    resolveMemoryMismatch(first, card, outcome);
  }
}

function onFreeplayTap(index) {
  if (session.isSessionEnded() || memoryLocked) return;
  const card = memoryCards[index];
  if (!card || card.matched) return;

  dropIntroPrompt();

  const lifted = memoryFirstIdx;
  const action = freePlayTap(memoryCards, lifted, index);
  switch (action) {
    case 'again':
      speakText(card.name, { rate: 0.9 });
      hint.poke();
      return;
    case 'match':
      memoryFirstIdx = -1;
      card.el.classList.add('is-picked');
      hint.stop();
      session.mutateStats(function(stats) { stats.freeMatches += 1; });
      celebratePair(memoryCards[lifted], card, speakText(card.name, { rate: 0.9, queue: true }), function() {
        if (memoryMatchedPairs >= FREE_PLAY_BOARD.pairs) {
          finishFreeBoard();
        } else {
          memoryLocked = false;
          hint.reset();
        }
      });
      return;
    case 'swap':
      memoryCards[lifted].el.classList.remove('is-picked');
      hint.registerMiss();
      break;
    case 'lift':
      hint.poke();
      break;
    default:
      throw new Error('Unknown Free Play tap: ' + action);
  }
  card.el.classList.add('is-picked');
  memoryFirstIdx = index;
  speakText(card.name, { rate: 0.9 });
}

// Run `go` once the card's name has finished being spoken. Speech can also
// finish without telling us — no voice installed, the device muted, or the
// utterance dropped because the first card of the pair is still saying the very
// same word — so a timer always backs it up.
function afterMemoryWord(utterance, go) {
  const serial = boardSerial;
  let ran = false;
  function run() {
    if (ran) return;
    ran = true;
    if (memoryWordTimer != null) {
      clearTimeout(memoryWordTimer);
      memoryWordTimer = null;
    }
    if (serial !== boardSerial || session.isSessionEnded()) return;
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

function celebratePair(a, b, spoken, then) {
  memoryLocked = true;
  a.matched = true;
  b.matched = true;
  memoryMatchedPairs += 1;

  popMemoryArt(a);
  popMemoryArt(b);

  // Name first, celebration second. The two used to happen together, which
  // talked over the word she had just earned. Now the pair bursts and goes in
  // the same instant, so the confetti reads as the cards themselves popping
  // rather than as decoration sprayed across the board.
  afterMemoryWord(spoken, function() {
    audio.playChime();
    spawnMemoryConfetti(a.el);
    spawnMemoryConfetti(b.el);
    [a, b].forEach(function(card) {
      card.el.classList.remove('is-picked');
      card.el.classList.add('is-matched');
    });
    memoryTimer = window.setTimeout(function() {
      memoryTimer = null;
      then();
    }, 620);
  });
}

function resolveMemoryMatch(a, b, spoken) {
  session.mutateStats(function(stats) { stats.flipMatches += 1; });
  const total = MEMORY_LEVELS[memoryLevelIdx].pairs;
  celebratePair(a, b, spoken, function() {
    if (memoryMatchedPairs >= total) completeMemoryLevel();
    else memoryLocked = false;
  });
}

// `kind` is classifyMemoryTurn's verdict: 'honest', 'gamble' or 'known'.
function resolveMemoryMismatch(a, b, kind) {
  memoryLocked = true;

  if (kind === 'known') memoryKnownSlips += 1;
  if (kind === 'gamble') memoryGambles += 1;
  // How loudly this miss is answered:
  //   'x'    - a known slip: the big red X and the buzzer, the wrong-answer
  //            feedback every game uses. She knew that card wasn't it.
  //   'buzz' - a gamble past the first: the buzzer and a small shake.
  //   'soft' - an honest miss, or the first gamble on the board, let go:
  //            just the soft "your turn again" tone.
  const feedback = kind === 'known' ? 'x'
    : kind === 'gamble' && memoryGambleCounts(memoryGambles) ? 'buzz'
    : 'soft';

  // Hold both faces up long enough to see and hear them, then react and turn
  // them back. Nothing here ever ends the board.
  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    if (feedback === 'soft') {
      audio.playSoftTone();
    } else {
      if (feedback === 'x') thumbsDown.show();
      audio.playBuzzer();
      shakeMemoryCard(a);
      shakeMemoryCard(b);
    }
    memoryTimer = window.setTimeout(function() {
      memoryTimer = null;
      flipMemoryDown(a);
      flipMemoryDown(b);
      memoryLocked = false;
    }, feedback === 'soft' ? 280 : 620);
  }, 1500);
}

function celebrateBoard(dealNext) {
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
  memoryCheerTimer = window.setTimeout(function() {
    memoryCheerTimer = null;
    if (!session.isSessionEnded()) speakText('Hooray! You did it!', { rate: 0.95 });
  }, 240);

  memoryTimer = window.setTimeout(function() {
    memoryTimer = null;
    if (!session.isSessionEnded()) dealNext();
  }, 2400);
}

function completeMemoryLevel() {
  // How the board went decides the next one's size (see memoryBoardOutcome
  // and nextMemoryLevel): only a clean board moves her up. Whatever happened,
  // she finished it, and that's celebrated the same.
  const outcome = memoryBoardOutcome(memoryKnownSlips, memoryGambles);
  const next = nextMemoryLevel(memoryLevelIdx, outcome, memoryFailStreak, MEMORY_LEVELS.length);

  session.mutateStats(function(stats) {
    stats.flipBoards += 1;
    if (outcome === 'failed') stats.flipBoardsFailed += 1;
  });

  memoryLevelIdx = next.level;
  memoryFailStreak = next.failStreak;
  saveMemoryLevel();

  celebrateBoard(buildFlipBoard);
}

function finishFreeBoard() {
  session.mutateStats(function(stats) { stats.freeBoards += 1; });
  celebrateBoard(buildFreeBoard);
}

function saveMemoryLevel() {
  saveRoundState(MEMORY_LEVEL_KEY, { level: memoryLevelIdx, failStreak: memoryFailStreak, lastKeys: memoryLastKeys });
}

function savedMemoryLevelIdx() {
  const saved = loadRoundState(MEMORY_LEVEL_KEY);
  return saved && isValidIndex(saved.level, MEMORY_LEVELS.length) ? saved.level : 0;
}

function loadMemoryLevel() {
  const saved = loadRoundState(MEMORY_LEVEL_KEY);
  memoryLastKeys = (saved && Array.isArray(saved.lastKeys))
    ? saved.lastKeys.filter(function(k) { return MEMORY_KEYS[k] === true; })
    : [];
  memoryFailStreak = saved && typeof saved.failStreak === 'number' ? saved.failStreak : 0;
  return savedMemoryLevelIdx();
}

function startFlip() {
  memoryLevelIdx = loadMemoryLevel();
  buildFlipBoard();
}

function stopMemoryGame() {
  boardSerial += 1;
  clearMemoryTimers();
  hint.stop();
  thumbsDown.hide();
  cancelSpeech();
  memoryFirstIdx = -1;
  memoryLocked = false;
}

const MODES = {
  freeplay: { start: buildFreeBoard, tap: onFreeplayTap, usedField: 'usedFreeplay' },
  flip: { start: startFlip, tap: onFlipTap, usedField: 'usedFlip' }
};

function setMode(name) {
  if (session.isSessionEnded()) return;
  stopMemoryGame();
  mode = MODES[name] ? name : 'freeplay';
  rememberSessionMode(MEMORY_SESSION_KEY, mode);
  modeBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  session.mutateStats(function(stats) { stats[MODES[mode].usedField] = true; });
  MODES[mode].start();
}

modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (btn.dataset.mode === mode) return;
    setMode(btn.dataset.mode);
    btn.blur();
  });
});

initGamePage({
  session: session,
  stop: stopMemoryGame,
  start: function() { setMode(readSessionMode(MEMORY_SESSION_KEY, 'freeplay')); },
  onResume: function() { setMode(mode); }
});
