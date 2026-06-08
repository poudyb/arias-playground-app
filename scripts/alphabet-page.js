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

let lastColor = '';
let fadeTimer = null;
let chaseRoundColors = [];
let activity = null;

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
  hint.style.display = 'none';
  letter.style.display = 'block';
  letter.style.opacity = '1';
  letter.textContent = ch;
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
    btn.textContent = ch;
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
    const count = Math.min(3 + Math.floor(difficulty / 2), 8);
    return {
      count,
      speed: Math.min(100 + difficulty * 10, 160),
      fontSize: Math.max(10, 18 - count)
    };
  },
  chasePool: SYMBOL_CONFIG.chasePool,
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
  }
});

session.initPlaySession();
session.startSessionTimerIfNeeded();
activity.setMode(readSessionMode(MODE_SESSION_KEY, 'freeplay'));

document.addEventListener('keydown', function(event) {
  if (session.isSessionEnded()) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const key = event.key.toUpperCase();
  if (activity.triggerItemByKey(key)) event.preventDefault();
});

window.addEventListener('pagehide', stopSymbolsGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    stopSymbolsGame();
    activity.setMode(activity.getMode());
  }
});

document.getElementById('link-home').addEventListener('click', function() {
  stopSymbolsGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});
