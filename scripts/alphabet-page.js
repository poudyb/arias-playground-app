const hint = document.getElementById('hint');
const letter = document.getElementById('letter');
const modeBtns = document.querySelectorAll('.mode-btn');
const thumbsDownEl = document.getElementById('thumbs-down');
const touchGrid = document.getElementById('touch-grid');
const displayArea = document.getElementById('display-area');
const chaseArena = document.getElementById('chase-arena');
const isTouch = window.matchMedia('(pointer: coarse)').matches;

const FREEPLAY_HINT = isTouch ? 'Tap any letter or number!' : 'Press any letter or number!';
const CHAR_ITEMS = CHARS.split('');

let lastColor = '';
let fadeTimer = null;
let chaseRoundColors = [];
let activity = null;

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, buildModeSummaryConfig({
    freeplay: {
      countField: 'freeChars',
      emptyMessage: 'You opened Free play - next time, tap lots of letters and numbers to fill the rainbow! 🌈',
      countMessage: function(count) {
        return 'You explored ' + count + ' ' + (count === 1 ? 'letter or number' : 'letters & numbers') + '! 🌈';
      }
    },
    quiz: {
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return 'You opened Quiz - try solving puzzles next time! 🧩';
      },
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These took an extra try (you got them!):'
          : 'These letters or numbers needed another try:';
      },
      renderPill: function(pill, value) { pill.textContent = value; }
    },
    chase: {
      message: function(info) {
        if (info.correct > 0) {
          return 'You caught the target ' + info.correct + ' ' + (info.correct === 1 ? 'time' : 'times') + '!';
        }
        if (info.struggled.length > 0) return 'You were chasing - nice effort!';
        return 'You opened Chase - tap the right letter next time! 🎯';
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

function stopAlphabetsGame() {
  cancelSpeech();
  if (fadeTimer != null) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  thumbsDown.hide();
  if (activity) activity.stop();
}

const session = createTimedSession({
  sessionKey: 'ariaAlphabetSession',
  statsKey: 'ariaAlphabetStats',
  defaultStats: function() { return createModeStats('freeChars'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeChars'); },
  stopGame: stopAlphabetsGame,
  renderSummary
});

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController(thumbsDownEl, {
  animationName: 'shake',
  useAriaHidden: false
});

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
  speakText(NUMBER_WORDS[ch] || ch.toLowerCase(), { rate: 0.9 });
}

activity = createCollectionActivity({
  items: CHAR_ITEMS,
  session,
  feedback: { audio, showCelebrationEmojis, spawnConfetti },
  promptItem: function(index) { speakChar(CHAR_ITEMS[index]); },
  stopPrompt: cancelSpeech,
  freeplayStatField: 'freeChars',
  getTargetKey: function(item) { return item; },
  renderTile: function(ch) {
    const btn = document.createElement('button');
    btn.className = 'grid-btn';
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
      speed: 100 + difficulty * 10,
      fontSize: Math.max(10, 18 - count)
    };
  },
  thumbsDown,
  confetti: { colors: RAINBOW_PALETTE },
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
activity.setMode('freeplay');

document.addEventListener('keydown', function(event) {
  if (session.isSessionEnded()) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const key = event.key.toUpperCase();
  if (!/^[A-Z0-9]$/.test(key)) return;
  event.preventDefault();
  activity.triggerItemByKey(key);
});

window.addEventListener('pagehide', stopAlphabetsGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    stopAlphabetsGame();
    activity.setMode('freeplay');
  }
});

document.getElementById('link-home').addEventListener('click', function() {
  stopAlphabetsGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});
