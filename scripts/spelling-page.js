// Spelling game — four modes, all in this file:
//   Free Play — build any valid 3-letter word on a prefix-constrained QWERTY
//               keyboard (keys disable to only those extending toward a real
//               word), then speak it and show the picture.
//   Quiz      — show a word, pick the matching picture from three choices.
//   Read It   — show a picture and say the word, pick the matching written
//               word from three choices (Quiz's inverse). Distractors avoid
//               look-alike spellings, like Clock's Quiz avoids near times.
//   Spell It  — show a picture and say the word; child types it with gentle
//               per-letter feedback that keeps correct progress.

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
let readTargetIndex = -1;
let readLocked = false;

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
  if (stats.usedRead || stats.readCorrect > 0) {
    appendScoreSection(board, {
      modClass: 'score-section--read',
      icon: '📖',
      title: 'Read It',
      body: stats.readCorrect > 0
        ? 'You read ' + stats.readCorrect + ' ' + (stats.readCorrect === 1 ? 'word' : 'words') + '!'
        : 'You opened Read It - pick the word that matches the picture next time!'
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

// Says the word, spells it letter by letter, then says the word again:
// "dad … d a d … dad". The separate utterances give the pauses between each.
function speakWordThenSpell(word) {
  const w = word.toLowerCase();
  const parts = [w].concat(w.split('')).concat([w]);
  speakSequence(parts, {
    rates: parts.map(function(_, i) {
      return (i === 0 || i === parts.length - 1) ? 0.85 : 0.7;
    })
  });
}

// The visual pulse repeats; the spoken word only fires when `speak` is true
// (first nudge + each wrong tap) so the hint never drones on audibly.
function flashSpellingHint(speak) {
  if (mode === 'quiz') {
    flashHintEl(spellChoices.querySelector('[data-word="' + WORDS[quizTargetIndex] + '"]'));
    if (speak) speakWordThenSpell(WORDS[quizTargetIndex]);
  } else if (mode === 'read') {
    flashHintEl(spellChoices.querySelector('[data-word="' + WORDS[readTargetIndex] + '"]'));
    if (speak) speakWordThenSpell(WORDS[readTargetIndex]);
  } else if (mode === 'spell') {
    flashHintEl(keyEls[WORDS[spellTargetIndex][typed.length]]);
  }
}

const hint = createHintNudge({
  onFlash: flashSpellingHint,
  voiceOnMiss: true,
  isActive: function() {
    return !session.isSessionEnded() && (mode === 'quiz' || mode === 'spell' || mode === 'read');
  }
});

// allowedNext(prefix, words) and isLookAlike(a, b) live in shared/word-logic.js
// so they can be unit-tested; this script is loaded after it.

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
  // Keep the keyboard glow color in sync with the slot being filled.
  keyboardEl.dataset.pos = typed.length;
  spellSlots.innerHTML = '';
  // In Spell It, preview the next letter as faint "ghost" text so a child who
  // can't spell yet still knows which letter to look for.
  const ghostWord = (mode === 'spell' && spellTargetIndex >= 0) ? WORDS[spellTargetIndex] : null;
  for (let i = 0; i < WORD_LEN; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (i < typed.length) {
      slot.classList.add('filled');
      slot.textContent = typed[i];
    } else if (i === typed.length && !locked) {
      slot.classList.add('active');
      if (ghostWord) {
        slot.classList.add('ghost');
        slot.textContent = ghostWord[i];
      }
    }
    spellSlots.appendChild(slot);
  }
  updateNextKeyHint();
}

// Glow the next letter's key on the on-screen keyboard (Spell It only) so a
// child can match the ghost letter to the key they need to tap.
function updateNextKeyHint() {
  KEY_LETTERS.split('').forEach(function(ch) { keyEls[ch].classList.remove('next-key'); });
  if (mode !== 'spell' || locked || spellTargetIndex < 0 || typed.length >= WORD_LEN) return;
  const ch = WORDS[spellTargetIndex][typed.length];
  if (keyEls[ch]) keyEls[ch].classList.add('next-key');
}

function updateKeys() {
  const allow = allowedNext(typed, WORDS);
  KEY_LETTERS.split('').forEach(function(ch) {
    keyEls[ch].classList.toggle('disabled', locked || !allow[ch]);
  });
}

function pressLetter(ch) {
  if (locked) return;
  if (mode === 'freeplay') {
    if (!allowedNext(typed, WORDS)[ch]) return;
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
  session.mutateStats(function(stats) {
    stats.freeWords += 1;
    stats.usedFreeplay = true;
  });
  // The third letter was just spoken like the first two. Saying the whole word
  // right away would cancel that letter's speech (the child never hears it), so
  // hold a beat first, THEN reveal the picture and say the word.
  resetTimer = window.setTimeout(function() {
    resetTimer = null;
    revealFreeplayWord(word);
  }, 950);
}

function revealFreeplayWord(word) {
  spellImg.src = IMG_FOR[word];
  spellImg.alt = word.toLowerCase();
  spellPicture.classList.add('is-visible');
  spellPicture.setAttribute('aria-hidden', 'false');
  spellHint.textContent = '';
  speakText(word.toLowerCase(), { rate: 0.85 });
  // No celebration in Free Play: the chime, confetti, and 🎉 always travel
  // together and are reserved for answering a question right (Quiz, Read It,
  // Spell It). Free Play isn't a question — it just shows the word it built
  // and says it.
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

const QUIZ_STATE_KEY = SPELLING_SESSION_KEY + ':quiz';
const SPELL_STATE_KEY = SPELLING_SESSION_KEY + ':spell';
const READ_STATE_KEY = SPELLING_SESSION_KEY + ':read';

function startQuizRound() {
  if (session.isSessionEnded() || mode !== 'quiz') return;
  quizLocked = false;
  thumbsDown.hide();

  const saved = loadRoundState(QUIZ_STATE_KEY);
  if (saved && isValidIndex(saved.targetIndex, WORDS.length) &&
      isValidIndexArray(saved.choiceIndices, 3, WORDS.length)) {
    quizTargetIndex = saved.targetIndex;
    const target = WORDS[quizTargetIndex];
    renderWord(target);
    renderChoices(saved.choiceIndices, target);
    spellHint.textContent = 'Find the picture!';
    speakWordThenSpell(target);
    hint.reset();
    return;
  }

  let next;
  do {
    next = Math.floor(Math.random() * WORDS.length);
  } while (WORDS.length > 1 && next === quizTargetIndex);
  quizTargetIndex = next;
  const choiceIndices = buildChoiceIndices(quizTargetIndex);
  saveRoundState(QUIZ_STATE_KEY, { targetIndex: quizTargetIndex, choiceIndices: choiceIndices });
  const target = WORDS[quizTargetIndex];
  renderWord(target);
  renderChoices(choiceIndices, target);
  spellHint.textContent = 'Find the picture!';
  speakWordThenSpell(target);
  hint.reset();
}

function onChoice(word, btn, target) {
  if (quizLocked || mode !== 'quiz') return;
  if (word === target) {
    quizLocked = true;
    hint.stop();
    saveRoundState(QUIZ_STATE_KEY, null);
    btn.classList.add('correct');
    audio.playChime();
    speakText(target.toLowerCase(), { rate: 0.85 });
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

// ---- Read It (Quiz's inverse: picture prompt → pick the written word) ----

// isLookAlike (a 1-letter-different word, like cat/can/rat) comes from
// shared/word-logic.js. We avoid those as distractors so a child reads the
// whole word, not just one letter — the same spirit as Clock's Quiz rejecting
// near times. With 73 words and at most a handful of look-alikes, there are
// always plenty of clearly-different distractors left.
function buildWordChoiceIndices(targetIdx) {
  const target = WORDS[targetIdx];
  const idxs = [targetIdx];
  let tries = 0;
  while (idxs.length < 3 && tries < 500) {
    tries++;
    const r = Math.floor(Math.random() * WORDS.length);
    if (idxs.indexOf(r) !== -1 || isLookAlike(target, WORDS[r])) continue;
    idxs.push(r);
  }
  // Safety net for tiny/degenerate word lists: fill with anything distinct.
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

function renderWordChoices(indices, target) {
  spellChoices.innerHTML = '';
  indices.forEach(function(idx) {
    const word = WORDS[idx];
    const btn = document.createElement('button');
    btn.className = 'choice choice--word';
    btn.dataset.word = word;
    btn.textContent = word;
    btn.addEventListener('click', function() { onWordChoice(word, btn, target); });
    spellChoices.appendChild(btn);
  });
}

// Show the picture + say the word (but don't spell it aloud — that would give
// the letters away). The struggling-child hint does spell it out.
function showReadPrompt(target) {
  spellSlots.innerHTML = '';
  spellImg.src = IMG_FOR[target];
  spellImg.alt = '';
  spellPicture.classList.add('is-visible');
  spellPicture.setAttribute('aria-hidden', 'false');
  spellHint.textContent = 'Find the word!';
  speakText(target.toLowerCase(), { rate: 0.85 });
  hint.reset();
}

function startReadRound() {
  if (session.isSessionEnded() || mode !== 'read') return;
  readLocked = false;
  thumbsDown.hide();

  const saved = loadRoundState(READ_STATE_KEY);
  if (saved && isValidIndex(saved.targetIndex, WORDS.length) &&
      isValidIndexArray(saved.choiceIndices, 3, WORDS.length)) {
    readTargetIndex = saved.targetIndex;
    const target = WORDS[readTargetIndex];
    renderWordChoices(saved.choiceIndices, target);
    showReadPrompt(target);
    return;
  }

  let next;
  do {
    next = Math.floor(Math.random() * WORDS.length);
  } while (WORDS.length > 1 && next === readTargetIndex);
  readTargetIndex = next;
  const choiceIndices = buildWordChoiceIndices(readTargetIndex);
  saveRoundState(READ_STATE_KEY, { targetIndex: readTargetIndex, choiceIndices: choiceIndices });
  const target = WORDS[readTargetIndex];
  renderWordChoices(choiceIndices, target);
  showReadPrompt(target);
}

function onWordChoice(word, btn, target) {
  if (readLocked || mode !== 'read') return;
  if (word === target) {
    readLocked = true;
    hint.stop();
    saveRoundState(READ_STATE_KEY, null);
    btn.classList.add('correct');
    audio.playChime();
    speakText(target.toLowerCase(), { rate: 0.85 });
    spawnConfetti();
    session.mutateStats(function(stats) {
      stats.readCorrect += 1;
      stats.usedRead = true;
    });
    resetTimer = window.setTimeout(startReadRound, 2000);
  } else {
    btn.classList.add('wrong');
    window.setTimeout(function() { btn.classList.remove('wrong'); }, 500);
    thumbsDown.show();
    audio.playBuzzer();
    session.mutateStats(function(stats) {
      stats.readWrong += 1;
      pushUniqueStruggle(stats.readStruggled, target);
    });
    hint.registerMiss();
  }
}

function enterRead() {
  typed = '';
  locked = false;
  keyboardEl.style.display = 'none';
  spellChoices.classList.add('is-visible');
  spellChoices.setAttribute('aria-hidden', 'false');
  startReadRound();
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
  saveRoundState(SPELL_STATE_KEY, null);
  renderSlots();
  session.mutateStats(function(stats) {
    stats.spellCorrect += 1;
    stats.usedSpell = true;
  });
  // The third letter was just spoken like the first two. Celebrating right away
  // would cancel that letter's speech (the child never hears it), so hold a beat
  // first — the same treatment as Free Play — THEN chime, confetti, and say the
  // whole word.
  resetTimer = window.setTimeout(function() {
    resetTimer = null;
    audio.playChime();
    speakText(target.toLowerCase(), { rate: 0.85 });
    spawnConfetti();
    resetTimer = window.setTimeout(startSpellRound, 2200);
  }, 950);
}

function startSpellRound() {
  if (session.isSessionEnded() || mode !== 'spell') return;
  locked = false;
  typed = '';
  thumbsDown.hide();

  const saved = loadRoundState(SPELL_STATE_KEY);
  if (saved && isValidIndex(saved.targetIndex, WORDS.length)) {
    spellTargetIndex = saved.targetIndex;
  } else {
    let next;
    do {
      next = Math.floor(Math.random() * WORDS.length);
    } while (WORDS.length > 1 && next === spellTargetIndex);
    spellTargetIndex = next;
    saveRoundState(SPELL_STATE_KEY, { targetIndex: spellTargetIndex });
  }

  const target = WORDS[spellTargetIndex];
  spellImg.src = IMG_FOR[target];
  spellImg.alt = '';
  spellPicture.classList.add('is-visible');
  spellPicture.setAttribute('aria-hidden', 'false');
  renderSlots();
  spellHint.textContent = 'Spell the word!';
  // Just say the word — don't spell it out. Each letter is spoken as the child
  // types it (and the ghost letter previews the next one), so spelling it aloud
  // up front would be redundant. Tap the picture to hear the word again.
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
  keyboardEl.dataset.mode = mode;
  // Only Spell It lets you tap the picture to replay the word + spelling.
  spellPicture.classList.toggle('spell-picture--speakable', mode === 'spell');
  rememberSessionMode(SPELLING_SESSION_KEY, mode);
  modeBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  session.mutateStats(function(stats) {
    if (mode === 'freeplay') stats.usedFreeplay = true;
    else if (mode === 'quiz') stats.usedQuiz = true;
    else if (mode === 'read') stats.usedRead = true;
    else if (mode === 'spell') stats.usedSpell = true;
  });
  if (mode === 'freeplay') enterFreeplay();
  else if (mode === 'quiz') enterQuiz();
  else if (mode === 'read') enterRead();
  else enterSpell();
}

// Tap the picture (Spell It only) to hear the word again, instead of a reminder
// that repeats on a timer — like Clock's tappable face.
function replaySpellPrompt() {
  if (session.isSessionEnded() || mode !== 'spell' || spellTargetIndex < 0) return;
  speakText(WORDS[spellTargetIndex].toLowerCase(), { rate: 0.85 });
  spellPicture.classList.remove('is-speaking');
  void spellPicture.offsetWidth;
  spellPicture.classList.add('is-speaking');
}
spellPicture.addEventListener('click', replaySpellPrompt);
spellPicture.addEventListener('animationend', function(ev) {
  if (ev.animationName === 'spell-tap-pulse') spellPicture.classList.remove('is-speaking');
});

buildKeyboard();
modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (session.isSessionEnded()) return;
    setMode(btn.dataset.mode);
  });
});

document.addEventListener('keydown', function(event) {
  if (session.isSessionEnded()) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const k = event.key.toUpperCase();
  if (k.length === 1 && k >= 'A' && k <= 'Z') {
    pressLetter(k);
    event.preventDefault();
  }
});

initGamePage({
  session: session,
  stop: stopGame,
  start: function() { setMode(readSessionMode(SPELLING_SESSION_KEY, 'freeplay')); },
  onResume: function() {
    stopGame();
    setMode(mode);
  }
});
