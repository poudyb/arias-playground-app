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
const SAME_AS_MODES = ['animals', 'shapes'];

let category = 'animals';
let pool = ANIMALS;
let targetIndex = -1;
let lastTargetKey = null;
let correctChoiceIdx = 0;
let roundLocked = false;
let delayedNextTimer = null;

function renderSummary(board, stats) {
  const correct = stats.matchCorrect;
  const wrong = stats.matchWrong;

  appendScoreSection(board, {
    icon: '🧩',
    title: 'Matches',
    body: correct === 0 && wrong === 0
      ? 'Tap the picture that looks just like the one on top!'
      : 'Nice matching - ' + correct + ' correct' + (wrong ? ', ' + wrong + ' oops taps' : '') + '!'
  });

  const modes = [];
  if (stats.usedAnimals) modes.push('animals');
  if (stats.usedShapes) modes.push('shapes');
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
  saveRoundState(ROUND_STATE_KEY, null);
  pool = category === 'animals' ? ANIMALS : SHAPES;
  catBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });
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

session.initPlaySession();
session.startSessionTimerIfNeeded();
setCategory(readSessionMode(SAME_AS_SESSION_KEY, 'animals'));

document.getElementById('link-home').addEventListener('click', function() {
  stopMatchGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});

window.addEventListener('pagehide', stopMatchGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    stopMatchGame();
    setCategory(category);
  }
});
