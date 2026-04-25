const modeBtns = document.querySelectorAll('.mode-btn');
const viewFreeplay = document.getElementById('view-freeplay');
const appMain = document.getElementById('app-main');
const colorGrid = document.getElementById('color-grid');
const modeHint = document.getElementById('mode-hint');
const quizTop = document.getElementById('quiz-top');
const quizReplayBtn = document.getElementById('quiz-replay-btn');
const chaseArena = document.getElementById('chase-arena');
const thumbsDownEl = document.getElementById('thumbs-down');

let activity = null;

function renderColorPill(pill, key) {
  pill.style.background = colorFillForKey(key);
  pill.setAttribute('title', key);
}

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, buildModeSummaryConfig({
    freeplay: {
      countField: 'freeColors',
      emptyMessage: 'You opened Free play - tap colors to hear their names next time!',
      countMessage: function(count) {
        return 'You tapped colors ' + count + ' ' + (count === 1 ? 'time' : 'times') + '!';
      }
    },
    quiz: {
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return 'You opened Quiz - tap the color you hear next time!';
      },
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These took an extra try (you got them!):'
          : 'These colors needed another try:';
      },
      renderPill: renderColorPill
    },
    chase: {
      message: function(info) {
        if (info.correct > 0) {
          return 'You caught the target ' + info.correct + ' ' + (info.correct === 1 ? 'time' : 'times') + '!';
        }
        if (info.struggled.length > 0) return 'You were chasing - nice effort!';
        return 'You opened Chase - tap the moving color next time!';
      },
      perfectMessage: 'Sharp tapping! 🎯',
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These targets needed another tap or two:'
          : 'These targets were tricky to catch:';
      },
      renderPill: renderColorPill
    }
  }));
  cancelSpeech();
}

function stopColorsGame() {
  if (activity) activity.stop();
}

const session = createTimedSession({
  sessionKey: 'ariaColorsSession',
  statsKey: 'ariaColorsStats',
  defaultStats: function() { return createModeStats('freeColors'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeColors', ['freeShapes']); },
  stopGame: stopColorsGame,
  renderSummary
});

function speakColorPrompt(colorIndex) {
  if (session.isSessionEnded()) return;
  const item = COLORS_DATA[colorIndex];
  if (!item) return;
  speakText(item.say || item.name, { rate: 0.85 });
}

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController(thumbsDownEl, {
  animationName: 'color-shake'
});

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

activity = createCollectionActivity({
  items: COLORS_DATA,
  session,
  feedback: {
    audio,
    showCelebrationEmojis,
    spawnConfetti
  },
  promptItem: speakColorPrompt,
  stopPrompt: cancelSpeech,
  freeplayHintText: 'Tap a color!',
  freeplayStatField: 'freeColors',
  getTargetKey: function(item) { return item.key; },
  renderTile: function(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-tile';
    btn.setAttribute('aria-label', item.name);

    const swatch = document.createElement('span');
    swatch.className = 'color-tile__swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = item.fill;

    const name = document.createElement('span');
    name.className = 'color-tile__name';
    name.textContent = item.name;

    btn.appendChild(swatch);
    btn.appendChild(name);
    return btn;
  },
  createChaseElement: function(item) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chase-color';
    el.style.background = item.fill;
    el.setAttribute('aria-label', item.name);
    return el;
  },
  sizeChaseElement: function(el, params) {
    el.style.width = params.dotVmin + 'vmin';
    el.style.height = params.dotVmin + 'vmin';
  },
  getChaseParams: function(difficulty) {
    const count = Math.min(3 + Math.floor(difficulty / 2), 6);
    return {
      count: Math.min(count, COLORS_DATA.length),
      speed: 100 + difficulty * 10,
      dotVmin: Math.max(10, 20 - count * 1.2)
    };
  },
  gridQuizClass: 'color-grid--quiz',
  thumbsDown,
  confetti: {
    colors: COLOR_CONFETTI_HEX,
    count: 50
  },
  dom: {
    modeBtns,
    viewFreeplay,
    appMain,
    grid: colorGrid,
    modeHint,
    quizTop,
    quizReplayBtn,
    chaseArena
  }
});

session.initPlaySession();
session.startSessionTimerIfNeeded();
activity.setMode('freeplay');

document.getElementById('link-home').addEventListener('click', function() {
  stopColorsGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});

window.addEventListener('pagehide', stopColorsGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) activity.reset();
});
