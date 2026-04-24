const hint = document.getElementById('hint');
const letter = document.getElementById('letter');
const modeBtns = document.querySelectorAll('.mode-btn');
const thumbsDownEl = document.getElementById('thumbs-down');
const touchGrid = document.getElementById('touch-grid');
const displayArea = document.getElementById('display-area');
const chaseArena = document.getElementById('chase-arena');
const isTouch = window.matchMedia('(pointer: coarse)').matches;

let lastColor = '';
let mode = 'freeplay';
let currentTarget = '';
let quizLocked = false;
let fadeTimer = null;
let delayedQuizTimer = null;
let delayedChaseTimer = null;

let chaseDifficulty = 0;
let chaseChars = [];
let chaseAnimId = null;
let chaseTarget = '';
let chasePaused = false;
let chaseRepeatId = null;
let lastFrameTime = 0;

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, {
    freeplay: {
      modClass: 'score-section--free',
      icon: '🎨',
      title: 'Free play',
      countField: 'freeChars',
      notVisitedMessage: 'This mode was not accessed during this play session.',
      emptyMessage: 'You opened Free play - next time, tap lots of letters and numbers to fill the rainbow! 🌈',
      countMessage: function(count) {
        return 'You explored ' + count + ' ' + (count === 1 ? 'letter or number' : 'letters & numbers') + '! 🌈';
      }
    },
    quiz: {
      modClass: 'score-section--quiz',
      icon: '🧠',
      title: 'Quiz',
      notVisitedMessage: 'This mode was not accessed during this play session.',
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return 'You opened Quiz - try solving puzzles next time! 🧩';
      },
      perfectMessage: 'Every answer was first try - you are a star! ⭐',
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These took an extra try (you got them!):'
          : 'These letters or numbers needed another try:';
      },
      renderPill: function(pill, value) {
        pill.textContent = value;
      }
    },
    chase: {
      modClass: 'score-section--chase',
      icon: '🏃',
      title: 'Chase',
      notVisitedMessage: 'This mode was not accessed during this play session.',
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
      renderPill: function(pill, value) {
        pill.textContent = value;
      }
    }
  });
  cancelSpeech();
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
    color = ALPHABET_COLORS[Math.floor(Math.random() * ALPHABET_COLORS.length)];
  } while (color === lastColor);
  lastColor = color;
  return color;
}

function showChar(ch, color) {
  clearTimeout(fadeTimer);
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
  clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(function() {
    fadeTimer = null;
    letter.classList.add('fade-out');
  }, 1500);
}

function speakChar(ch) {
  speakText(NUMBER_WORDS[ch] || ch.toLowerCase(), { rate: 0.9 });
}

function pickQuizTarget() {
  let next;
  do {
    next = CHARS[Math.floor(Math.random() * CHARS.length)];
  } while (next === currentTarget);
  currentTarget = next;
}

function startQuizRound() {
  if (session.isSessionEnded()) return;
  quizLocked = false;
  thumbsDown.hide();
  pickQuizTarget();
  showChar(currentTarget, pickColor());
  speakChar(currentTarget);
}

function getChaseParams() {
  const count = Math.min(3 + Math.floor(chaseDifficulty / 2), 8);
  return {
    count,
    speed: 100 + chaseDifficulty * 10,
    fontSize: Math.max(10, 18 - count)
  };
}

function startChaseRound() {
  if (session.isSessionEnded()) return;
  if (chaseAnimId != null) {
    cancelAnimationFrame(chaseAnimId);
    chaseAnimId = null;
  }

  chasePaused = false;
  thumbsDown.hide();
  chaseChars.forEach(function(entry) { entry.el.remove(); });
  chaseChars = [];

  const params = getChaseParams();
  const shuffled = CHARS.split('').sort(function() {
    return Math.random() - 0.5;
  }).slice(0, params.count);
  const colors = ALPHABET_COLORS.slice().sort(function() {
    return Math.random() - 0.5;
  });
  chaseTarget = shuffled[Math.floor(Math.random() * shuffled.length)];

  shuffled.forEach(function(ch, index) {
    const el = document.createElement('div');
    el.className = 'chase-char';
    el.textContent = ch;
    el.style.fontSize = params.fontSize + 'vmin';
    el.style.color = colors[index % colors.length];
    chaseArena.appendChild(el);
    chaseChars.push({ el, ch, x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0 });
  });

  requestAnimationFrame(function() {
    if (mode !== 'chase') return;
    chaseChars.forEach(function(entry) {
      entry.w = entry.el.offsetWidth;
      entry.h = entry.el.offsetHeight;
      entry.x = Math.random() * (window.innerWidth - entry.w);
      entry.y = Math.random() * (window.innerHeight - entry.h);
      const angle = Math.random() * Math.PI * 2;
      entry.vx = Math.cos(angle) * params.speed;
      entry.vy = Math.sin(angle) * params.speed;
      entry.el.style.left = entry.x + 'px';
      entry.el.style.top = entry.y + 'px';
    });
    lastFrameTime = 0;
    chaseAnimId = requestAnimationFrame(animateChase);
  });

  speakChar(chaseTarget);
  if (chaseRepeatId != null) clearInterval(chaseRepeatId);
  chaseRepeatId = setInterval(function() {
    if (chasePaused || session.isSessionEnded()) return;
    speakChar(chaseTarget);
  }, 5000);
}

function animateChase(timestamp) {
  if (mode !== 'chase' || chaseChars.length === 0) {
    chaseAnimId = null;
    return;
  }

  if (!lastFrameTime) lastFrameTime = timestamp;
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  if (!chasePaused) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    chaseChars.forEach(function(entry) {
      entry.x += entry.vx * dt;
      entry.y += entry.vy * dt;
      if (entry.x < 0) {
        entry.x = 0;
        entry.vx = Math.abs(entry.vx);
      }
      if (entry.y < 0) {
        entry.y = 0;
        entry.vy = Math.abs(entry.vy);
      }
      if (entry.x + entry.w > width) {
        entry.x = width - entry.w;
        entry.vx = -Math.abs(entry.vx);
      }
      if (entry.y + entry.h > height) {
        entry.y = height - entry.h;
        entry.vy = -Math.abs(entry.vy);
      }
      entry.el.style.left = entry.x + 'px';
      entry.el.style.top = entry.y + 'px';
    });

    for (let i = 0; i < chaseChars.length; i++) {
      for (let j = i + 1; j < chaseChars.length; j++) {
        const a = chaseChars[i];
        const b = chaseChars[j];
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const half = overlapX / 2;
          if (a.x < b.x) {
            a.x -= half;
            b.x += half;
          } else {
            a.x += half;
            b.x -= half;
          }
          const temp = a.vx;
          a.vx = b.vx;
          b.vx = temp;
        } else {
          const half = overlapY / 2;
          if (a.y < b.y) {
            a.y -= half;
            b.y += half;
          } else {
            a.y += half;
            b.y -= half;
          }
          const temp = a.vy;
          a.vy = b.vy;
          b.vy = temp;
        }

        a.el.style.left = a.x + 'px';
        a.el.style.top = a.y + 'px';
        b.el.style.left = b.x + 'px';
        b.el.style.top = b.y + 'px';
      }
    }
  }

  if (mode === 'chase' && chaseChars.length > 0) {
    chaseAnimId = requestAnimationFrame(animateChase);
  } else {
    chaseAnimId = null;
  }
}

function onChaseClick(event) {
  if (session.isSessionEnded() || chasePaused) return;

  const x = event.clientX;
  const y = event.clientY;
  const hits = chaseChars.filter(function(entry) {
    return x >= entry.x - 30 &&
      x <= entry.x + entry.w + 30 &&
      y >= entry.y - 30 &&
      y <= entry.y + entry.h + 30;
  });

  if (hits.length === 0) return;

  if (hits.some(function(entry) { return entry.ch === chaseTarget; })) {
    session.mutateStats(function(stats) {
      stats.chaseCorrect++;
    });
    chasePaused = true;
    chaseDifficulty = Math.min(chaseDifficulty + 1, 15);
    spawnConfetti({ colors: ALPHABET_COLORS });
    showCelebrationEmojis();
    audio.playChime();
    clearTimeout(delayedChaseTimer);
    delayedChaseTimer = window.setTimeout(function() {
      delayedChaseTimer = null;
      startChaseRound();
    }, 2000);
    return;
  }

  session.mutateStats(function(stats) {
    if (!stats.chaseStruggled.includes(chaseTarget)) stats.chaseStruggled.push(chaseTarget);
  });
  chaseDifficulty = Math.max(chaseDifficulty - 1, 0);
  thumbsDown.show();
  audio.playBuzzer();
}

function stopChase() {
  if (chaseAnimId != null) {
    cancelAnimationFrame(chaseAnimId);
    chaseAnimId = null;
  }
  if (chaseRepeatId != null) {
    clearInterval(chaseRepeatId);
    chaseRepeatId = null;
  }
  chaseChars.forEach(function(entry) { entry.el.remove(); });
  chaseChars = [];
}

function stopAlphabetsGame() {
  cancelSpeech();
  clearTimeout(fadeTimer);
  fadeTimer = null;
  clearTimeout(delayedQuizTimer);
  delayedQuizTimer = null;
  clearTimeout(delayedChaseTimer);
  delayedChaseTimer = null;
  thumbsDown.hide();
  stopChase();
}

function setMode(newMode) {
  if (session.isSessionEnded()) return;
  if (mode === 'chase') stopChase();

  mode = newMode;
  modeBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  thumbsDown.hide();
  quizLocked = false;

  const inChase = mode === 'chase';
  displayArea.style.display = inChase ? 'none' : '';
  touchGrid.style.display = inChase ? 'none' : '';
  chaseArena.style.display = inChase ? 'block' : 'none';

  if (mode === 'quiz') {
    startQuizRound();
  } else if (mode === 'chase') {
    chaseDifficulty = 0;
    startChaseRound();
  } else {
    letter.style.display = 'none';
    hint.style.display = 'block';
    hint.textContent = isTouch ? 'Tap any letter or number!' : 'Press any letter or number!';
    currentTarget = '';
    cancelSpeech();
  }

  if (session.shouldTrackStats()) {
    session.mutateStats(function(stats) {
      if (mode === 'freeplay') stats.visitedFreeplay = true;
      else if (mode === 'quiz') stats.visitedQuiz = true;
      else stats.visitedChase = true;
    });
  }
}

function handleChar(key) {
  if (session.isSessionEnded() || mode === 'chase') return;

  if (mode === 'freeplay') {
    session.mutateStats(function(stats) {
      stats.freeChars++;
      stats.visitedFreeplay = true;
    });
    showChar(key, pickColor());
    speakChar(key);
    scheduleFade();
    return;
  }

  if (quizLocked) return;
  if (key === currentTarget) {
    session.mutateStats(function(stats) {
      stats.quizCorrect++;
    });
    quizLocked = true;
    spawnConfetti({ colors: ALPHABET_COLORS });
    showCelebrationEmojis();
    audio.playChime();
    clearTimeout(delayedQuizTimer);
    delayedQuizTimer = window.setTimeout(function() {
      delayedQuizTimer = null;
      startQuizRound();
    }, 2000);
    return;
  }

  session.mutateStats(function(stats) {
    if (!stats.quizStruggled.includes(currentTarget)) stats.quizStruggled.push(currentTarget);
  });
  thumbsDown.show();
  audio.playBuzzer();
}

modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    setMode(btn.dataset.mode);
    btn.blur();
  });
});

CHARS.split('').forEach(function(ch) {
  const btn = document.createElement('button');
  btn.className = 'grid-btn';
  btn.textContent = ch;
  btn.addEventListener('click', function() {
    handleChar(ch);
  });
  touchGrid.appendChild(btn);
});

if (isTouch) hint.textContent = 'Tap any letter or number!';

chaseArena.addEventListener('click', onChaseClick);

session.initPlaySession();
session.startSessionTimerIfNeeded();
setMode('freeplay');

document.addEventListener('keydown', function(event) {
  if (session.isSessionEnded()) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const key = event.key.toUpperCase();
  if (!/^[A-Z0-9]$/.test(key)) return;
  event.preventDefault();
  handleChar(key);
});

window.addEventListener('pagehide', stopAlphabetsGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    stopAlphabetsGame();
    setMode('freeplay');
  }
});

document.getElementById('link-home').addEventListener('click', function() {
  stopAlphabetsGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});
