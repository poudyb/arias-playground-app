const hint = document.getElementById('hint');
const letter = document.getElementById('letter');
const modeBtns = document.querySelectorAll('.mode-btn');
const touchGrid = document.getElementById('touch-grid');
const displayArea = document.getElementById('display-area');
const chaseArena = document.getElementById('chase-arena');
const isTouch = window.matchMedia('(pointer: coarse)').matches;

const SYMBOL_CONFIG = LEARNING_SYMBOLS_CONFIG;
const FREEPLAY_HINT = isTouch ? SYMBOL_CONFIG.touchHint : SYMBOL_CONFIG.keyboardHint;
const SYMBOL_ITEMS = SYMBOL_CONFIG.items;
const MODE_SESSION_KEY = SYMBOL_CONFIG.sessionKey;

// Only the alphabet defines this — numbers stay plain digits.
const CASE_CONFIG = SYMBOL_CONFIG.caseProgression || null;
const caseProgression = CASE_CONFIG ? createStreakProgression({
  storageKey: CASE_CONFIG.storageKey,
  promoteAfter: CASE_CONFIG.promoteAfter,
  demoteAfter: CASE_CONFIG.demoteAfter
}) : null;

let lastColor = '';
let fadeTimer = null;
let chaseRoundColors = [];
let activity = null;
let shownChar = null;

function isCasePaired() {
  return !!(caseProgression && caseProgression.isOn());
}

// What a letter looks like right now: "A" normally, "Aa" once she's earned it.
function itemText(ch) {
  return isCasePaired() ? CASE_CONFIG.pairText(ch) : ch;
}

// Re-paint everything that spells a letter out. Called when the pairing flips
// mid-game so the change shows up with the celebration, not on the next round.
function applyCasePairing() {
  touchGrid.classList.toggle('is-pair', isCasePaired());
  if (activity) activity.refreshTiles();
  if (shownChar && letter.style.display === 'block') showChar(shownChar, lastColor);
}

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, buildModeSummaryConfig({
    freeplay: {
      countField: SYMBOL_CONFIG.freeplayStatField,
      emptyMessage: SYMBOL_CONFIG.summary.freeplayEmpty,
      countMessage: SYMBOL_CONFIG.summary.freeplayCount
    },
    quiz: {
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return SYMBOL_CONFIG.summary.quizEmpty;
      },
      struggledLabel: SYMBOL_CONFIG.summary.quizStruggled,
      renderPill: function(pill, value) { pill.textContent = value; }
    },
    chase: {
      message: function(info) {
        if (info.correct > 0) {
          return 'You caught the target ' + info.correct + ' ' + (info.correct === 1 ? 'time' : 'times') + '!';
        }
        if (info.struggled.length > 0) return 'You were chasing - nice effort!';
        return SYMBOL_CONFIG.summary.chaseEmpty;
      },
      perfectMessage: 'No mix-ups - sharp tapping! 🎯',
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These targets needed another tap or two:'
          : 'These targets were tricky to catch:';
      },
      renderPill: function(pill, value) { pill.textContent = value; }
    }
  }));
  cancelSpeech();
}

function stopSymbolsGame() {
  cancelSpeech();
  if (fadeTimer != null) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  thumbsDown.hide();
  if (activity) activity.stop();
}

const session = createTimedSession({
  sessionKey: SYMBOL_CONFIG.sessionKey,
  statsKey: SYMBOL_CONFIG.statsKey,
  defaultStats: SYMBOL_CONFIG.defaultStats,
  normalizeStats: SYMBOL_CONFIG.normalizeStats,
  stopGame: stopSymbolsGame,
  renderSummary
});

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

function pickColor() {
  let color;
  do {
    color = RAINBOW_PALETTE[Math.floor(Math.random() * RAINBOW_PALETTE.length)];
  } while (color === lastColor);
  lastColor = color;
  return color;
}

function showChar(ch, color) {
  if (fadeTimer != null) clearTimeout(fadeTimer);
  shownChar = ch;
  hint.style.display = 'none';
  letter.style.display = 'block';
  letter.style.opacity = '1';
  letter.textContent = itemText(ch);
  letter.classList.toggle('is-pair', isCasePaired());
  letter.style.color = color;
  letter.classList.remove('pop', 'fade-out');
  void letter.offsetWidth;
  letter.classList.add('pop');
}

function scheduleFade() {
  if (fadeTimer != null) clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(function() {
    fadeTimer = null;
    letter.classList.add('fade-out');
  }, 1500);
}

function speakChar(ch) {
  speakText(SYMBOL_CONFIG.speakItem(ch), { rate: 0.9 });
}

activity = createCollectionActivity({
  items: SYMBOL_ITEMS,
  session,
  feedback: { audio, showCelebrationEmojis, spawnConfetti },
  promptItem: function(index) { speakChar(SYMBOL_ITEMS[index]); },
  stopPrompt: cancelSpeech,
  freeplayStatField: SYMBOL_CONFIG.freeplayStatField,
  getTargetKey: function(item) { return item; },
  renderTile: function(ch) {
    const btn = document.createElement('button');
    btn.className = 'grid-btn';
    btn.dataset.key = ch;
    btn.textContent = itemText(ch);
    return btn;
  },
  createChaseElement: function(ch, position) {
    if (position === 0) {
      chaseRoundColors = RAINBOW_PALETTE.slice();
      for (let i = chaseRoundColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = chaseRoundColors[i];
        chaseRoundColors[i] = chaseRoundColors[j];
        chaseRoundColors[j] = tmp;
      }
    }
    const el = document.createElement('div');
    el.className = 'chase-char';
    el.textContent = ch;
    el.style.color = chaseRoundColors[position % chaseRoundColors.length];
    return el;
  },
  sizeChaseElement: function(el, params) {
    el.style.fontSize = params.fontSize + 'vmin';
  },
  getChaseParams: function(difficulty) {
    if (SYMBOL_CONFIG.getChaseParams) return SYMBOL_CONFIG.getChaseParams(difficulty);
    const count = Math.min(3 + Math.floor(difficulty / 2), 8);
    return {
      count,
      speed: Math.min(100 + difficulty * 10, 160),
      fontSize: Math.max(10, 18 - count)
    };
  },
  chasePool: SYMBOL_CONFIG.chasePool,
  chaseItemWeight: SYMBOL_CONFIG.chaseItemWeight,
  chaseDifficultyMax: SYMBOL_CONFIG.chaseDifficultyMax,
  speakChase: function(item) { speakChar(item); },
  thumbsDown,
  confetti: { colors: RAINBOW_PALETTE },
  modeSessionKey: MODE_SESSION_KEY,
  dom: {
    modeBtns,
    grid: touchGrid,
    chaseArena
  },
  onModeEnter: function(mode) {
    displayArea.style.display = mode === 'chase' ? 'none' : '';
    if (mode === 'freeplay') {
      letter.style.display = 'none';
      hint.style.display = 'block';
      hint.textContent = FREEPLAY_HINT;
    }
  },
  onFreeplayInteract: function(item) {
    showChar(item, pickColor());
    scheduleFade();
  },
  onQuizStart: function(item) {
    showChar(item, pickColor());
  },
  onQuizRoundResolved: function(round) {
    if (!caseProgression) return;
    // A round she waited out until the hint pointed at the answer proves
    // nothing either way, so it neither promotes nor breaks a streak.
    const outcome = !round.firstTry ? 'missed' : round.hinted ? 'assisted' : 'clean';
    if (caseProgression.recordRound(outcome)) applyCasePairing();
  }
});

touchGrid.classList.toggle('is-pair', isCasePaired());

document.addEventListener('keydown', function(event) {
  if (session.isSessionEnded()) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const key = event.key.toUpperCase();
  if (activity.triggerItemByKey(key)) event.preventDefault();
});

initGamePage({
  session: session,
  stop: stopSymbolsGame,
  start: function() { activity.setMode(readSessionMode(MODE_SESSION_KEY, 'freeplay')); },
  onResume: function() {
    stopSymbolsGame();
    activity.setMode(activity.getMode());
  }
});
