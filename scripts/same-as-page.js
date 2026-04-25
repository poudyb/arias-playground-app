const catBtns = document.querySelectorAll('.cat-btn');
const refArt = document.getElementById('ref-art');
const choiceLeft = document.getElementById('choice-left');
const choiceRight = document.getElementById('choice-right');
const choiceLeftArt = document.getElementById('choice-left-art');
const choiceRightArt = document.getElementById('choice-right-art');
const promptReplay = document.getElementById('prompt-replay');
const thumbsDownEl = document.getElementById('thumbs-down');

const PROMPT_SAY = 'Which one is the same as this?';
const CONFETTI_HEX = ['#00838f', '#26c6da', '#b2ebf2', '#e53935', '#43a047', '#8e24aa', '#ff9800', '#1e88e5'];

let category = 'animals';
let pool = ANIMALS;
let targetIndex = -1;
let wrongIndex = -1;
let correctIsLeft = true;
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
  sessionKey: 'ariaSameAsSession',
  statsKey: 'ariaSameAsStats',
  defaultStats: createSameAsStats,
  normalizeStats: normalizeSameAsStats,
  stopGame: stopMatchGame,
  renderSummary
});

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController(thumbsDownEl, {
  animationName: 'td-shake',
  hideAfterMs: 750
});

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

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

function pickWrongIndex(target) {
  let candidate;
  let guard = 0;
  do {
    candidate = Math.floor(Math.random() * pool.length);
    guard++;
  } while (candidate === target && pool.length > 1 && guard < 50);
  return candidate;
}

function struggleIdForIndex(index) {
  const item = pool[index];
  return (category === 'animals' ? 'a:' : 's:') + item.key;
}

function setCategory(nextCategory) {
  if (session.isSessionEnded()) return;
  category = nextCategory;
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

function startRound() {
  if (session.isSessionEnded()) return;

  clearTimeout(delayedNextTimer);
  delayedNextTimer = null;
  roundLocked = false;
  choiceLeft.classList.remove('match-choice--locked', 'pop');
  choiceRight.classList.remove('match-choice--locked', 'pop');
  choiceLeft.disabled = false;
  choiceRight.disabled = false;
  thumbsDown.hide();

  targetIndex = Math.floor(Math.random() * pool.length);
  wrongIndex = pickWrongIndex(targetIndex);
  correctIsLeft = Math.random() < 0.5;

  const leftIndex = correctIsLeft ? targetIndex : wrongIndex;
  const rightIndex = correctIsLeft ? wrongIndex : targetIndex;

  renderArt(refArt, pool[targetIndex]);
  renderArt(choiceLeftArt, pool[leftIndex]);
  renderArt(choiceRightArt, pool[rightIndex]);

  const leftLabel = pool[leftIndex].name + (leftIndex === targetIndex ? ' - matches top' : '');
  const rightLabel = pool[rightIndex].name + (rightIndex === targetIndex ? ' - matches top' : '');
  choiceLeft.setAttribute('aria-label', leftLabel);
  choiceRight.setAttribute('aria-label', rightLabel);

  cancelSpeech();
  window.setTimeout(function() {
    if (!session.isSessionEnded()) speakPrompt();
  }, 280);
}

function onChoiceTap(isLeft) {
  if (session.isSessionEnded() || roundLocked) return;
  const correct = isLeft === correctIsLeft;
  const btn = isLeft ? choiceLeft : choiceRight;

  if (correct) {
    roundLocked = true;
    session.mutateStats(function(stats) {
      stats.matchCorrect++;
    });
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
    choiceLeft.classList.add('match-choice--locked');
    choiceRight.classList.add('match-choice--locked');
    spawnConfetti({
      colors: CONFETTI_HEX,
      count: 48,
      originTop: '45vh',
      minDistance: 35,
      distanceJitter: 50,
      minDuration: 0.9,
      durationJitter: 0.7
    });
    showCelebrationEmojis({
      positions: [
        { left: '12vw', top: '22vh' },
        { right: '12vw', top: '22vh' }
      ]
    });
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
}

function stopMatchGame() {
  cancelSpeech();
  clearTimeout(delayedNextTimer);
  delayedNextTimer = null;
  thumbsDown.hide();
}

choiceLeft.addEventListener('click', function() { onChoiceTap(true); });
choiceRight.addEventListener('click', function() { onChoiceTap(false); });

promptReplay.addEventListener('click', function() {
  speakPrompt();
  promptReplay.blur();
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
setCategory('animals');

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
