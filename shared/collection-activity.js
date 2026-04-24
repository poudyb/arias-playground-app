function createCollectionActivity(options) {
  const {
    items,
    session,
    feedback,
    promptItem,
    stopPrompt,
    freeplayHintText,
    freeplayStatField,
    getTargetKey,
    renderTile,
    createChaseElement,
    sizeChaseElement,
    getChaseParams,
    gridQuizClass,
    thumbsDown,
    hitMargin,
    confetti,
    dom
  } = options;

  const { audio, showCelebrationEmojis, spawnConfetti } = feedback;
  const { modeBtns, viewFreeplay, appMain, grid, modeHint, quizTop, quizReplayBtn, chaseArena } = dom;

  let mode = 'freeplay';
  let quizTarget = null;
  let quizLocked = false;
  let chaseDifficulty = 0;
  let chaseItems = [];
  let chaseAnimId = null;
  let chaseTarget = null;
  let chasePaused = false;
  let lastFrameTime = 0;

  function setMode(newMode) {
    if (session.isSessionEnded()) return;
    if (mode === 'chase') stopChase();
    if (stopPrompt) stopPrompt();

    mode = newMode;
    modeBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    thumbsDown.hide();
    quizLocked = false;

    const inChase = mode === 'chase';
    grid.style.display = inChase ? 'none' : '';
    chaseArena.style.display = inChase ? 'block' : 'none';
    if (modeHint) modeHint.style.display = inChase ? 'none' : 'block';

    if (gridQuizClass) {
      grid.classList.toggle(gridQuizClass, mode === 'quiz');
    }

    if (mode === 'quiz') {
      startQuizRound();
    } else if (mode === 'chase') {
      chaseDifficulty = 0;
      startChaseRound();
    } else if (mode === 'freeplay' && modeHint && freeplayHintText) {
      modeHint.textContent = freeplayHintText;
    }

    if (session.shouldTrackStats()) {
      session.mutateStats(function(stats) {
        if (mode === 'freeplay') stats.visitedFreeplay = true;
        else if (mode === 'quiz') stats.visitedQuiz = true;
        else stats.visitedChase = true;
      });
    }
  }

  function handleItemClick(item) {
    if (session.isSessionEnded() || mode === 'chase') return;

    if (mode === 'freeplay') {
      session.mutateStats(function(stats) {
        stats[freeplayStatField]++;
        stats.visitedFreeplay = true;
      });
      if (promptItem) {
        promptItem(items.indexOf(item));
      }
      return;
    }

    if (quizLocked) return;
    if (getTargetKey(item) === getTargetKey(quizTarget)) {
      session.mutateStats(function(stats) {
        stats.quizCorrect++;
      });
      quizLocked = true;
      spawnConfetti({ colors: confetti.colors });
      showCelebrationEmojis();
      audio.playChime();
      setTimeout(startQuizRound, 2000);
    } else {
      session.mutateStats(function(stats) {
        const struggledField = 'quizStruggled';
        if (!stats[struggledField].includes(getTargetKey(quizTarget))) {
          stats[struggledField].push(getTargetKey(quizTarget));
        }
      });
      thumbsDown.show();
      audio.playBuzzer();
    }
  }

  function startQuizRound() {
    if (session.isSessionEnded()) return;
    quizLocked = false;
    thumbsDown.hide();
    let next;
    do {
      next = items[Math.floor(Math.random() * items.length)];
    } while (quizTarget && getTargetKey(next) === getTargetKey(quizTarget));
    quizTarget = next;
    if (promptItem) {
      promptItem(items.indexOf(quizTarget));
    }
  }

  function startChaseRound() {
    if (session.isSessionEnded()) return;
    stopChase();
    chasePaused = false;
    thumbsDown.hide();
    chaseItems.forEach(function(entry) { entry.el.remove(); });
    chaseItems = [];

    const params = getChaseParams(chaseDifficulty);
    const shuffled = items.slice().sort(function() { return Math.random() - 0.5; }).slice(0, params.count);
    chaseTarget = shuffled[Math.floor(Math.random() * shuffled.length)];

    shuffled.forEach(function(item) {
      const el = createChaseElement(item);
      sizeChaseElement(el, params);
      chaseArena.appendChild(el);
      chaseItems.push({ el, item, x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0 });
    });

    chaseItems.forEach(function(entry) {
      entry.w = entry.el.offsetWidth;
      entry.h = entry.el.offsetHeight;
      entry.x = Math.random() * (window.innerWidth - entry.w);
      entry.y = Math.random() * (window.innerHeight - entry.h);
      const angle = Math.random() * Math.PI * 2;
      entry.vx = Math.cos(angle) * params.speed;
      entry.vy = Math.sin(angle) * params.speed;
    });

    if (promptItem) {
      promptItem(items.indexOf(chaseTarget));
    }
    lastFrameTime = performance.now();
    chaseAnimId = requestAnimationFrame(updateChase);
  }

  function updateChase(time) {
    const dt = (time - lastFrameTime) / 1000;
    lastFrameTime = time;

    if (!chasePaused) {
      chaseItems.forEach(function(entry) {
        entry.x += entry.vx * dt;
        entry.y += entry.vy * dt;

        if (entry.x <= 0 || entry.x >= window.innerWidth - entry.w) {
          entry.vx *= -1;
          entry.x = Math.max(0, Math.min(entry.x, window.innerWidth - entry.w));
        }
        if (entry.y <= 0 || entry.y >= window.innerHeight - entry.h) {
          entry.vy *= -1;
          entry.y = Math.max(0, Math.min(entry.y, window.innerHeight - entry.h));
        }
        entry.el.style.transform = 'translate(' + entry.x + 'px, ' + entry.y + 'px)';
      });
    }
    chaseAnimId = requestAnimationFrame(updateChase);
  }

  function stopChase() {
    if (chaseAnimId) {
      cancelAnimationFrame(chaseAnimId);
      chaseAnimId = null;
    }
  }

  function onArenaClick(e) {
    if (chasePaused || session.isSessionEnded()) return;
    const entry = chaseItems.find(function(en) { return en.el === e.target || en.el.contains(e.target); });
    if (!entry) return;

    if (getTargetKey(entry.item) === getTargetKey(chaseTarget)) {
      session.mutateStats(function(stats) {
        stats.chaseCorrect++;
      });
      chasePaused = true;
      spawnConfetti({ colors: confetti.colors });
      showCelebrationEmojis();
      audio.playChime();
      chaseDifficulty++;
      setTimeout(startChaseRound, 2000);
    } else {
      session.mutateStats(function(stats) {
        const struggledField = 'chaseStruggled';
        if (!stats[struggledField].includes(getTargetKey(chaseTarget))) {
          stats[struggledField].push(getTargetKey(chaseTarget));
        }
      });
      thumbsDown.show();
      audio.playBuzzer();
    }
  }

  function buildGrid() {
    grid.innerHTML = '';
    items.forEach(function(item) {
      const btn = renderTile(item);
      btn.addEventListener('click', function() { handleItemClick(item); });
      grid.appendChild(btn);
    });
  }

  chaseArena.addEventListener('click', onArenaClick);
  modeBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setMode(btn.dataset.mode);
      btn.blur();
    });
  });

  buildGrid();
  return {
    setMode,
    stop: function() {
      stopChase();
    },
    reset: function() {
      stopChase();
      setMode('freeplay');
    }
  };
}
