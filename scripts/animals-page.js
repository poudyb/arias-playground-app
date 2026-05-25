const modeBtns = document.querySelectorAll('.mode-btn');
const viewFreeplay = document.getElementById('view-freeplay');
const appMain = document.getElementById('app-main');
const animalGrid = document.getElementById('animal-grid');
const modeHint = document.getElementById('mode-hint');
const quizTop = document.getElementById('quiz-top');
const quizReplayBtn = document.getElementById('quiz-replay-btn');
const chaseArena = document.getElementById('chase-arena');
const thumbsDownEl = document.getElementById('thumbs-down');
const MODE_SESSION_KEY = 'ariaAnimalsSession';

const audioBuffers = new Array(ANIMALS.length).fill(null);
let currentSource = null;
let animalPlaying = false;
let activity = null;

function renderAnimalPill(pill, key) {
  pill.textContent = animalEmojiForKey(key);
  pill.setAttribute('title', key);
}

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, buildModeSummaryConfig({
    freeplay: {
      countField: 'freeAnimals',
      emptyMessage: 'You opened Free play - next time, tap lots of animals to hear every sound! 🌿',
      countMessage: function(count) {
        return 'You tapped animals ' + count + ' ' + (count === 1 ? 'time' : 'times') + '! 🌿';
      }
    },
    quiz: {
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return 'You opened Quiz - match sounds to animals next time! 🧩';
      },
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These took an extra try (you got them!):'
          : 'These animals needed another try:';
      },
      renderPill: renderAnimalPill
    },
    chase: {
      message: function(info) {
        if (info.correct > 0) {
          return 'You caught the target ' + info.correct + ' ' + (info.correct === 1 ? 'time' : 'times') + '!';
        }
        if (info.struggled.length > 0) return 'You were chasing - nice effort!';
        return 'You opened Chase - tap the moving animal next time! 🎯';
      },
      perfectMessage: 'No mix-ups - sharp tapping! 🎯',
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These targets needed another tap or two:'
          : 'These targets were tricky to catch:';
      },
      renderPill: renderAnimalPill
    }
  }));
  cancelSpeech();
}

function stopAnimalsGame() {
  if (activity) activity.stop();
}

const session = createTimedSession({
  sessionKey: MODE_SESSION_KEY,
  statsKey: 'ariaAnimalsStats',
  defaultStats: function() { return createModeStats('freeAnimals'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeAnimals'); },
  stopGame: stopAnimalsGame,
  renderSummary
});

function decodeBuffer(ctx, arrayBuffer) {
  return new Promise(function(resolve, reject) {
    const ret = ctx.decodeAudioData(arrayBuffer, resolve, reject);
    if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
  });
}

function loadAnimalSounds() {
  const ctx = audio.getAudioCtx();
  ANIMALS.forEach(function(item, index) {
    fetch('assets/animals/sounds/' + item.key + '.m4a')
      .then(function(r) { return r.arrayBuffer(); })
      .then(function(buf) { return decodeBuffer(ctx, buf); })
      .then(function(decoded) { audioBuffers[index] = decoded; })
      .catch(function(err) { console.warn('animal sound failed: ' + item.key, err); });
  });
}

function stopAnimalSound() {
  if (!animalPlaying) return;
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
      currentSource.disconnect();
    } catch (_) {}
    currentSource = null;
  }
  animalPlaying = false;
}

function playAnimalSound(animalIndex) {
  if (session.isSessionEnded()) return;
  if (animalPlaying) return;
  const buffer = audioBuffers[animalIndex];
  if (!buffer) return;
  cancelSpeech();

  const ctx = audio.getAudioCtx();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = function() {
    if (currentSource === source) {
      currentSource = null;
      animalPlaying = false;
    }
  };
  currentSource = source;
  animalPlaying = true;
  source.start(0);
}

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController(thumbsDownEl, {
  animationName: 'animal-shake'
});

loadAnimalSounds();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

document.addEventListener('visibilitychange', function() {
  if (document.hidden) stopAnimalSound();
});

activity = createCollectionActivity({
  items: ANIMALS,
  session,
  feedback: {
    audio,
    showCelebrationEmojis,
    spawnConfetti
  },
  promptItem: playAnimalSound,
  stopPrompt: function() {
    cancelSpeech();
    stopAnimalSound();
  },
  freeplayHintText: 'Tap an animal!',
  freeplayStatField: 'freeAnimals',
  getTargetKey: function(item) { return item.key; },
  renderTile: function(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'animal-tile';
    btn.setAttribute('aria-label', item.name);

    const emoji = document.createElement('span');
    emoji.className = 'animal-tile__emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = item.emoji;

    const name = document.createElement('span');
    name.className = 'animal-tile__name';
    name.textContent = item.name;

    btn.appendChild(emoji);
    btn.appendChild(name);
    return btn;
  },
  createChaseElement: function(item) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chase-animal';
    el.textContent = item.emoji;
    el.setAttribute('aria-label', item.name);
    return el;
  },
  sizeChaseElement: function(el, params) {
    el.style.fontSize = params.fontSize + 'vmin';
  },
  getChaseParams: function(difficulty) {
    const count = Math.min(3 + Math.floor(difficulty / 2), 8);
    return {
      count: Math.min(count, ANIMALS.length),
      speed: Math.min(100 + difficulty * 10, 160),
      fontSize: Math.max(12, 22 - count * 1.2)
    };
  },
  gridQuizClass: 'animal-grid--quiz',
  thumbsDown,
  confetti: { colors: RAINBOW_PALETTE },
  modeSessionKey: MODE_SESSION_KEY,
  dom: {
    modeBtns,
    viewFreeplay,
    appMain,
    grid: animalGrid,
    modeHint,
    quizTop,
    quizReplayBtn,
    chaseArena
  }
});

session.initPlaySession();
session.startSessionTimerIfNeeded();
activity.setMode(readSessionMode(MODE_SESSION_KEY, 'freeplay'));

document.getElementById('link-home').addEventListener('click', function() {
  stopAnimalsGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});

window.addEventListener('pagehide', stopAnimalsGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) activity.setMode(activity.getMode());
});
