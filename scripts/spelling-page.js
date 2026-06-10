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
const KEY_LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const WORD_LEN = 3;
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const FREEPLAY_HINT = isTouch ? 'Tap letters to make a word!' : 'Type the letters to make a word!';

const WORDS = SPELLING_WORDS.map(function(w) { return w.word.toUpperCase(); });
const IMG_FOR = {};
SPELLING_WORDS.forEach(function(w) { IMG_FOR[w.word.toUpperCase()] = 'assets/spelling/' + w.img; });

let mode = 'freeplay';
let typed = '';
let locked = false;
let resetTimer = null;
let quizTargetIndex = -1;
let quizLocked = false;
let spellTargetIndex = -1;

function renderSummary(board, stats) {
  appendScoreSection(board, {
    modClass: 'score-section--free',
    icon: '✏️',
    title: 'Free Play',
    body: stats.freeWords > 0
      ? 'You spelled ' + stats.freeWords + ' ' + (stats.freeWords === 1 ? 'word' : 'words') + '! 🎉'
      : 'You opened Free Play - tap letters to build words next time!'
  });
  if (stats.usedQuiz || stats.quizCorrect > 0) {
    appendScoreSection(board, {
      modClass: 'score-section--quiz',
      icon: '🧩',
      title: 'Quiz',
      body: stats.quizCorrect > 0
        ? 'You found ' + stats.quizCorrect + ' ' + (stats.quizCorrect === 1 ? 'picture' : 'pictures') + '!'
        : 'You opened Quiz - match the word to its picture next time!'
    });
  }
  if (stats.usedSpell || stats.spellCorrect > 0) {
    appendScoreSection(board, {
      modClass: 'score-section--spell',
      icon: '✏️',
      title: 'Spell It',
      body: stats.spellCorrect > 0
        ? 'You spelled ' + stats.spellCorrect + ' ' + (stats.spellCorrect === 1 ? 'word' : 'words') + ' from pictures!'
        : 'You opened Spell It - sound out the word next time!'
    });
  }
  cancelSpeech();
}

function stopGame() {
  cancelSpeech();
  if (resetTimer != null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  thumbsDown.hide();
  hint.stop();
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

// Speaks the word then spells it letter by letter as queued utterances.
function speakWordThenSpell(word) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  cancelSpeech();
  const w = word.toLowerCase();
  const parts = [w].concat(w.split(''));
  const utterances = parts.map(function(part, i) {
    const u = new SpeechSynthesisUtterance(part);
    u.rate = i === 0 ? 0.85 : 0.7;
    return u;
  });
  const last = utterances[utterances.length - 1];
  function release() { if (activeUtterance === utterances[0]) activeUtterance = null; }
  last.addEventListener('end', release);
  last.addEventListener('error', release);
  function go() {
    activeUtterance = utterances[0];
    utterances.forEach(function(u) { synth.speak(u); });
  }
  if (synth.getVoices().length > 0) {
    go();
  } else {
    synth.addEventListener('voiceschanged', function onV() {
      synth.removeEventListener('voiceschanged', onV);
      go();
    });
  }
}

function flashSpellingHint() {
  if (mode === 'quiz') {
    flashHintEl(spellChoices.querySelector('[data-word="' + WORDS[quizTargetIndex] + '"]'));
    speakWordThenSpell(WORDS[quizTargetIndex]);
  } else if (mode === 'spell') {
    flashHintEl(keyEls[WORDS[spellTargetIndex][typed.length]]);
  }
}

const hint = createHintNudge({
  onFlash: flashSpellingHint,
  isActive: function() {
    return !session.isSessionEnded() && (mode === 'quiz' || mode === 'spell');
  }
});

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
  KEY_LETTERS.split('').forEach(function(ch) {
    const btn = document.createElement('button');
    btn.className = 'key';
    btn.textContent = ch;
    btn.dataset.key = ch;
    btn.addEventListener('click', function() { pressLetter(ch); });
    keyEls[ch] = btn;
    keyboardEl.appendChild(btn);
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
  KEY_LETTERS.split('').forEach(function(ch) {
    keyEls[ch].classList.toggle('disabled', locked || !allow[ch]);
  });
}

function pressLetter(ch) {
  if (locked) return;
  if (mode === 'freeplay') {
    if (!allowedNext(typed)[ch]) return;
    typed += ch;
    speakText(ch.toLowerCase(), { rate: 0.85 });
    renderSlots();
    if (typed.length === WORD_LEN) completeWord(typed);
    else updateKeys();
  } else if (mode === 'spell') {
    spellPressLetter(ch);
  }
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

// Render a word as static (non-typed) filled slots — used as the Quiz prompt.
function renderWord(word) {
  spellSlots.innerHTML = '';
  for (let i = 0; i < WORD_LEN; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot shown';
    slot.textContent = word[i];
    spellSlots.appendChild(slot);
  }
}

function buildChoiceIndices(targetIdx) {
  const idxs = [targetIdx];
  while (idxs.length < 3 && idxs.length < WORDS.length) {
    const r = Math.floor(Math.random() * WORDS.length);
    if (idxs.indexOf(r) === -1) idxs.push(r);
  }
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = idxs[i];
    idxs[i] = idxs[j];
    idxs[j] = tmp;
  }
  return idxs;
}

function renderChoices(indices, target) {
  spellChoices.innerHTML = '';
  indices.forEach(function(idx) {
    const word = WORDS[idx];
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.dataset.word = word;
    const img = document.createElement('img');
    img.src = IMG_FOR[word];
    img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', function() { onChoice(word, btn, target); });
    spellChoices.appendChild(btn);
  });
}

function startQuizRound() {
  if (session.isSessionEnded() || mode !== 'quiz') return;
  quizLocked = false;
  thumbsDown.hide();
  let next;
  do {
    next = Math.floor(Math.random() * WORDS.length);
  } while (WORDS.length > 1 && next === quizTargetIndex);
  quizTargetIndex = next;
  const target = WORDS[quizTargetIndex];
  renderWord(target);
  renderChoices(buildChoiceIndices(quizTargetIndex), target);
  spellHint.textContent = 'Find the picture!';
  speakWordThenSpell(target);
  hint.reset();
}

function onChoice(word, btn, target) {
  if (quizLocked || mode !== 'quiz') return;
  if (word === target) {
    quizLocked = true;
    hint.stop();
    btn.classList.add('correct');
    audio.playChime();
    speakText(target.toLowerCase(), { rate: 0.85 });
    showCelebrationEmojis();
    spawnConfetti();
    session.mutateStats(function(stats) {
      stats.quizCorrect += 1;
      stats.usedQuiz = true;
    });
    resetTimer = window.setTimeout(startQuizRound, 2000);
  } else {
    btn.classList.add('wrong');
    window.setTimeout(function() { btn.classList.remove('wrong'); }, 500);
    thumbsDown.show();
    audio.playBuzzer();
    session.mutateStats(function(stats) {
      stats.quizWrong += 1;
      pushUniqueStruggle(stats.quizStruggled, target);
    });
    hint.registerMiss();
  }
}

function enterQuiz() {
  typed = '';
  locked = false;
  spellPicture.classList.remove('is-visible');
  spellPicture.setAttribute('aria-hidden', 'true');
  keyboardEl.style.display = 'none';
  spellChoices.classList.add('is-visible');
  spellChoices.setAttribute('aria-hidden', 'false');
  startQuizRound();
}

function enableAllKeys() {
  KEY_LETTERS.split('').forEach(function(ch) { keyEls[ch].classList.remove('disabled'); });
}

function flashSlotWrong(pos) {
  const slot = spellSlots.children[pos];
  if (!slot) return;
  slot.classList.remove('wrong');
  void slot.offsetWidth;
  slot.classList.add('wrong');
  window.setTimeout(function() { slot.classList.remove('wrong'); }, 450);
}

function spellPressLetter(ch) {
  if (locked) return;
  const target = WORDS[spellTargetIndex];
  if (ch === target[typed.length]) {
    typed += ch;
    speakText(ch.toLowerCase(), { rate: 0.85 });
    renderSlots();
    if (typed.length === WORD_LEN) completeSpell(target);
    else hint.poke();
  } else {
    // Gentle, located per-letter feedback: shake the active slot + a soft
    // buzz, keep all correct progress. No full-screen X (too harsh while
    // sounding a word out one letter at a time).
    flashSlotWrong(typed.length);
    audio.playBuzzer();
    session.mutateStats(function(stats) {
      pushUniqueStruggle(stats.spellStruggled, target);
    });
    hint.registerMiss();
  }
}

function completeSpell(target) {
  locked = true;
  hint.stop();
  renderSlots();
  audio.playChime();
  speakText(target.toLowerCase(), { rate: 0.85 });
  showCelebrationEmojis();
  spawnConfetti();
  session.mutateStats(function(stats) {
    stats.spellCorrect += 1;
    stats.usedSpell = true;
  });
  resetTimer = window.setTimeout(startSpellRound, 2200);
}

function startSpellRound() {
  if (session.isSessionEnded() || mode !== 'spell') return;
  locked = false;
  typed = '';
  thumbsDown.hide();
  let next;
  do {
    next = Math.floor(Math.random() * WORDS.length);
  } while (WORDS.length > 1 && next === spellTargetIndex);
  spellTargetIndex = next;
  const target = WORDS[spellTargetIndex];
  spellImg.src = IMG_FOR[target];
  spellImg.alt = '';
  spellPicture.classList.add('is-visible');
  spellPicture.setAttribute('aria-hidden', 'false');
  renderSlots();
  spellHint.textContent = 'Spell the word!';
  speakText(target.toLowerCase(), { rate: 0.85 });
  hint.reset();
}

function enterSpell() {
  typed = '';
  locked = false;
  spellChoices.classList.remove('is-visible');
  spellChoices.setAttribute('aria-hidden', 'true');
  keyboardEl.style.display = '';
  enableAllKeys();
  startSpellRound();
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

function setMode(next) {
  if (resetTimer != null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  cancelSpeech();
  thumbsDown.hide();
  hint.stop();
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
  else if (mode === 'quiz') enterQuiz();
  else enterSpell();
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
