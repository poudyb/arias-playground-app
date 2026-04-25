const modeBtns = document.querySelectorAll('.mode-btn');
const viewFreeplay = document.getElementById('view-freeplay');
const appMain = document.getElementById('app-main');
const shapeGrid = document.getElementById('shape-grid');
const modeHint = document.getElementById('mode-hint');
const quizTop = document.getElementById('quiz-top');
const quizReplayBtn = document.getElementById('quiz-replay-btn');
const chaseArena = document.getElementById('chase-arena');
const thumbsDownEl = document.getElementById('thumbs-down');

let activity = null;

function renderShapePill(pill, key) {
  pill.textContent = shapeEmojiForKey(key);
  pill.setAttribute('title', key);
}

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, buildModeSummaryConfig({
    freeplay: {
      countField: 'freeShapes',
      emptyMessage: 'You opened Free play - next time, tap shapes to hear colors and names! 🔷',
      countMessage: function(count) {
        return 'You explored shapes ' + count + ' ' + (count === 1 ? 'time' : 'times') + '! 🔷';
      }
    },
    quiz: {
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return 'You opened Quiz - match the voice to the shape next time! 🧩';
      },
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These took an extra try (you got them!):'
          : 'These shapes needed another try:';
      },
      renderPill: renderShapePill
    },
    chase: {
      message: function(info) {
        if (info.correct > 0) {
          return 'You caught the target ' + info.correct + ' ' + (info.correct === 1 ? 'time' : 'times') + '!';
        }
        if (info.struggled.length > 0) return 'You were chasing - nice effort!';
        return 'You opened Chase - tap the moving shape next time! 🎯';
      },
      perfectMessage: 'No mix-ups - sharp tapping! 🎯',
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These targets needed another tap or two:'
          : 'These targets were tricky to catch:';
      },
      renderPill: renderShapePill
    }
  }));
  cancelSpeech();
}

function stopShapesGame() {
  if (activity) activity.stop();
}

const session = createTimedSession({
  sessionKey: 'ariaShapesSession',
  statsKey: 'ariaShapesStats',
  defaultStats: function() { return createModeStats('freeShapes'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeShapes', ['freeAnimals']); },
  stopGame: stopShapesGame,
  renderSummary
});

function speakShapePrompt(shapeIndex) {
  if (session.isSessionEnded()) return;
  const item = SHAPES[shapeIndex];
  if (!item) return;
  speakText(item.say || item.name, { rate: 0.88 });
}

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController(thumbsDownEl, {
  animationName: 'shape-shake'
});

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

activity = createCollectionActivity({
  items: SHAPES,
  session,
  feedback: {
    audio,
    showCelebrationEmojis,
    spawnConfetti
  },
  promptItem: speakShapePrompt,
  stopPrompt: cancelSpeech,
  freeplayHintText: 'Tap a shape!',
  freeplayStatField: 'freeShapes',
  getTargetKey: function(item) { return item.key; },
  renderTile: function(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shape-tile';
    btn.setAttribute('aria-label', item.name);

    const art = document.createElement('span');
    art.className = 'shape-tile__emoji';
    art.setAttribute('aria-hidden', 'true');
    if (item.svgMarkup) art.innerHTML = item.svgMarkup;
    else art.textContent = item.emoji;

    const name = document.createElement('span');
    name.className = 'shape-tile__name';
    name.textContent = item.name;

    btn.appendChild(art);
    btn.appendChild(name);
    return btn;
  },
  createChaseElement: function(item) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chase-shape' + (item.svgMarkup ? ' chase-shape--svg' : '');
    el.setAttribute('aria-label', item.name);
    if (item.svgMarkup) el.innerHTML = item.svgMarkup;
    else el.textContent = item.emoji;
    return el;
  },
  sizeChaseElement: function(el, params) {
    el.style.fontSize = params.fontSize + 'vmin';
  },
  getChaseParams: function(difficulty) {
    const count = Math.min(3 + Math.floor(difficulty / 2), 8);
    return {
      count: Math.min(count, SHAPES.length),
      speed: 100 + difficulty * 10,
      fontSize: Math.max(12, 22 - count * 1.2)
    };
  },
  gridQuizClass: 'shape-grid--quiz',
  thumbsDown,
  confetti: { colors: RAINBOW_PALETTE },
  dom: {
    modeBtns,
    viewFreeplay,
    appMain,
    grid: shapeGrid,
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
  stopShapesGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});

window.addEventListener('pagehide', stopShapesGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) activity.reset();
});
