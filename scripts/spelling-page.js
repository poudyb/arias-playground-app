// Spelling game. Free Play (this file) lets a child build any valid 3-letter
// word on a prefix-constrained QWERTY keyboard, then speaks it and shows the
// picture. Quiz (pick-the-picture) and Spell It (type-from-picture) arrive in
// later commits — their buttons currently show a placeholder.

const modeBtns = document.querySelectorAll('.mode-btn');
const spellHint = document.getElementById('spell-hint');
const spellPicture = document.getElementById('spell-picture');
const spellImg = document.getElementById('spell-img');
const spellSlots = document.getElementById('spell-slots');
const spellChoices = document.getElementById('spell-choices');
const keyboardEl = document.getElementById('keyboard');

const SPELLING_SESSION_KEY = 'ariaSpellingSession';
const SPELLING_STATS_KEY = 'ariaSpellingStats';
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const WORD_LEN = 3;
const FREEPLAY_HINT = 'Tap letters to make a word!';

const WORDS = SPELLING_WORDS.map(function(w) { return w.word.toUpperCase(); });
const IMG_FOR = {};
SPELLING_WORDS.forEach(function(w) { IMG_FOR[w.word.toUpperCase()] = 'assets/spelling/' + w.img; });

let mode = 'freeplay';
let typed = '';
let locked = false;
let resetTimer = null;

function renderSummary(board, stats) {
  appendScoreSection(board, {
    modClass: 'score-section--free',
    icon: '✏️',
    title: 'Free Play',
    body: stats.freeWords > 0
      ? 'You spelled ' + stats.freeWords + ' ' + (stats.freeWords === 1 ? 'word' : 'words') + '! 🎉'
      : 'You opened Free Play - tap letters to build words next time!'
  });
  cancelSpeech();
}

function stopGame() {
  cancelSpeech();
  if (resetTimer != null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  thumbsDown.hide();
}

const session = createTimedSession({
  sessionKey: SPELLING_SESSION_KEY,
  statsKey: SPELLING_STATS_KEY,
  defaultStats: createSpellingStats,
  normalizeStats: normalizeSpellingStats,
  stopGame: stopGame,
  renderSummary: renderSummary
});

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController();
setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

// Letters that can extend `prefix` toward some valid word.
function allowedNext(prefix) {
  const set = {};
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i];
    if (w.length > prefix.length && w.startsWith(prefix)) {
      set[w[prefix.length]] = true;
    }
  }
  return set;
}

const keyEls = {};
function buildKeyboard() {
  keyboardEl.innerHTML = '';
  KEY_ROWS.forEach(function(rowStr, rowIdx) {
    const row = document.createElement('div');
    row.className = 'key-row';
    rowStr.split('').forEach(function(ch) {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.textContent = ch;
      btn.dataset.key = ch;
      btn.addEventListener('click', function() { pressLetter(ch); });
      keyEls[ch] = btn;
      row.appendChild(btn);
    });
    if (rowIdx === KEY_ROWS.length - 1) {
      const back = document.createElement('button');
      back.className = 'key key--back';
      back.textContent = '⌫';
      back.dataset.key = 'BACK';
      back.addEventListener('click', pressBack);
      keyEls.BACK = back;
      row.appendChild(back);
    }
    keyboardEl.appendChild(row);
  });
}

function renderSlots() {
  spellSlots.innerHTML = '';
  for (let i = 0; i < WORD_LEN; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (i < typed.length) {
      slot.classList.add('filled');
      slot.textContent = typed[i];
    } else if (i === typed.length && !locked) {
      slot.classList.add('active');
    }
    spellSlots.appendChild(slot);
  }
}

function updateKeys() {
  const allow = allowedNext(typed);
  KEY_ROWS.forEach(function(rowStr) {
    rowStr.split('').forEach(function(ch) {
      keyEls[ch].classList.toggle('disabled', locked || !allow[ch]);
    });
  });
  keyEls.BACK.classList.toggle('disabled', locked || typed.length === 0);
}

function pressLetter(ch) {
  if (locked || mode !== 'freeplay') return;
  if (!allowedNext(typed)[ch]) return;
  typed += ch;
  renderSlots();
  if (typed.length === WORD_LEN) {
    completeWord(typed);
  } else {
    updateKeys();
  }
}

function pressBack() {
  if (locked || typed.length === 0) return;
  typed = typed.slice(0, -1);
  renderSlots();
  updateKeys();
}

function completeWord(word) {
  locked = true;
  renderSlots();
  updateKeys();
  spellImg.src = IMG_FOR[word];
  spellImg.alt = word.toLowerCase();
  spellPicture.classList.add('is-visible');
  spellPicture.setAttribute('aria-hidden', 'false');
  spellHint.textContent = '';
  audio.playChime();
  speakText(word.toLowerCase(), { rate: 0.85 });
  showCelebrationEmojis();
  spawnConfetti();
  session.mutateStats(function(stats) {
    stats.freeWords += 1;
    stats.usedFreeplay = true;
  });
  resetTimer = window.setTimeout(function() {
    resetTimer = null;
    typed = '';
    locked = false;
    spellPicture.classList.remove('is-visible');
    spellPicture.setAttribute('aria-hidden', 'true');
    spellHint.textContent = FREEPLAY_HINT;
    renderSlots();
    updateKeys();
  }, 2200);
}

function enterFreeplay() {
  typed = '';
  locked = false;
  spellPicture.classList.remove('is-visible');
  spellPicture.setAttribute('aria-hidden', 'true');
  spellChoices.classList.remove('is-visible');
  spellChoices.setAttribute('aria-hidden', 'true');
  keyboardEl.style.display = '';
  spellHint.textContent = FREEPLAY_HINT;
  renderSlots();
  updateKeys();
}

function enterPlaceholder(label) {
  typed = '';
  locked = false;
  spellPicture.classList.remove('is-visible');
  spellPicture.setAttribute('aria-hidden', 'true');
  spellChoices.classList.remove('is-visible');
  spellChoices.setAttribute('aria-hidden', 'true');
  spellSlots.innerHTML = '';
  keyboardEl.style.display = 'none';
  spellHint.textContent = label + ' is coming soon! ✨';
}

function setMode(next) {
  if (resetTimer != null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  cancelSpeech();
  thumbsDown.hide();
  mode = next;
  rememberSessionMode(SPELLING_SESSION_KEY, mode);
  modeBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  session.mutateStats(function(stats) {
    if (mode === 'freeplay') stats.usedFreeplay = true;
    else if (mode === 'quiz') stats.usedQuiz = true;
    else if (mode === 'spell') stats.usedSpell = true;
  });
  if (mode === 'freeplay') enterFreeplay();
  else if (mode === 'quiz') enterPlaceholder('Quiz');
  else enterPlaceholder('Spell It');
}

buildKeyboard();
modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (session.isSessionEnded()) return;
    setMode(btn.dataset.mode);
  });
});

session.initPlaySession();
session.startSessionTimerIfNeeded();
setMode(readSessionMode(SPELLING_SESSION_KEY, 'freeplay'));

document.addEventListener('keydown', function(event) {
  if (session.isSessionEnded()) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.key === 'Backspace') {
    pressBack();
    event.preventDefault();
    return;
  }
  const k = event.key.toUpperCase();
  if (k.length === 1 && k >= 'A' && k <= 'Z') {
    pressLetter(k);
    event.preventDefault();
  }
});

window.addEventListener('pagehide', stopGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    stopGame();
    setMode(mode);
  }
});

document.getElementById('link-home').addEventListener('click', function() {
  stopGame();
  session.clearPlaySessionStorage(false);
});
document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});
