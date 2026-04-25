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
    confetti,
    dom,
    onFreeplayInteract,
    onQuizStart,
    onModeEnter
  } = options;

  const { audio, showCelebrationEmojis, spawnConfetti } = feedback;
  const { modeBtns, grid, modeHint, chaseArena, viewFreeplay, appMain, quizTop, quizReplayBtn } = dom;

  const chaseHitMargin = 30;
  const chaseRepromptMs = 5000;
  const chaseDifficultyMax = 15;

  let mode = 'freeplay';
  let quizTargetIndex = -1;
  let quizLocked = false;
  let chaseDifficulty = 0;
  let chaseItems = [];
  let chaseAnimId = null;
  let chaseTargetIndex = -1;
  let chasePaused = false;
  let chaseRepeatId = null;
  let lastFrameTime = 0;

  function quizTarget() {
    return quizTargetIndex >= 0 ? items[quizTargetIndex] : null;
  }

  function chaseTarget() {
    return chaseTargetIndex >= 0 ? items[chaseTargetIndex] : null;
  }

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
    document.body.classList.toggle('chase-active', inChase);
    grid.style.display = inChase ? 'none' : '';
    chaseArena.style.display = inChase ? 'block' : 'none';
    chaseArena.setAttribute('aria-hidden', inChase ? 'false' : 'true');
    if (appMain) appMain.hidden = inChase;
    if (modeHint) modeHint.hidden = mode !== 'freeplay';

    if (gridQuizClass) {
      grid.classList.toggle(gridQuizClass, mode === 'quiz');
    }
    if (viewFreeplay) viewFreeplay.classList.toggle('view-freeplay--quiz', mode === 'quiz');
    if (appMain) appMain.classList.toggle('app-main--quiz', mode === 'quiz');
    if (quizTop) quizTop.hidden = mode !== 'quiz';

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

    if (onModeEnter) onModeEnter(mode);
  }

  function handleItemClick(item, index) {
    if (session.isSessionEnded() || mode === 'chase') return;

    if (mode === 'freeplay') {
      session.mutateStats(function(stats) {
        stats[freeplayStatField]++;
        stats.visitedFreeplay = true;
      });
      if (promptItem) promptItem(index);
      if (onFreeplayInteract) onFreeplayInteract(item, index);
      return;
    }

    if (quizLocked) return;
    if (getTargetKey(item) === getTargetKey(quizTarget())) {
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
        pushUniqueStruggle(stats.quizStruggled, getTargetKey(quizTarget()));
      });
      thumbsDown.show();
      audio.playBuzzer();
    }
  }

  function startQuizRound() {
    if (session.isSessionEnded()) return;
    quizLocked = false;
    thumbsDown.hide();
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * items.length);
    } while (quizTargetIndex >= 0 && getTargetKey(items[nextIndex]) === getTargetKey(items[quizTargetIndex]));
    quizTargetIndex = nextIndex;
    if (promptItem) promptItem(quizTargetIndex);
    if (onQuizStart) onQuizStart(items[quizTargetIndex], quizTargetIndex);
  }

  function startChaseRound() {
    if (session.isSessionEnded()) return;
    stopChase();
    chasePaused = false;
    thumbsDown.hide();
    chaseItems.forEach(function(entry) { entry.el.remove(); });
    chaseItems = [];

    const params = getChaseParams(chaseDifficulty);
    const indices = items.map(function(_, i) { return i; });
    const count = Math.min(params.count, indices.length);
    const shuffled = [];
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (indices.length - i));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
      shuffled.push(indices[i]);
    }
    chaseTargetIndex = shuffled[Math.floor(Math.random() * shuffled.length)];

    shuffled.forEach(function(idx, position) {
      const item = items[idx];
      const el = createChaseElement(item, position);
      sizeChaseElement(el, params);
      chaseArena.appendChild(el);
      chaseItems.push({ el, item, index: idx, x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0 });
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

    if (promptItem) promptItem(chaseTargetIndex);
    chaseRepeatId = setInterval(function() {
      if (chasePaused || session.isSessionEnded()) return;
      if (promptItem) promptItem(chaseTargetIndex);
    }, chaseRepromptMs);
    lastFrameTime = performance.now();
    chaseAnimId = requestAnimationFrame(updateChase);
  }

  function updateChase(time) {
    const dt = Math.min((time - lastFrameTime) / 1000, 0.05);
    lastFrameTime = time;

    if (!chasePaused) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      chaseItems.forEach(function(entry) {
        entry.x += entry.vx * dt;
        entry.y += entry.vy * dt;

        if (entry.x <= 0 || entry.x >= width - entry.w) {
          entry.vx *= -1;
          entry.x = Math.max(0, Math.min(entry.x, width - entry.w));
        }
        if (entry.y <= 0 || entry.y >= height - entry.h) {
          entry.vy *= -1;
          entry.y = Math.max(0, Math.min(entry.y, height - entry.h));
        }
      });

      for (let i = 0; i < chaseItems.length; i++) {
        for (let j = i + 1; j < chaseItems.length; j++) {
          const a = chaseItems[i];
          const b = chaseItems[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          if (overlapX < overlapY) {
            const half = overlapX / 2;
            if (a.x < b.x) { a.x -= half; b.x += half; }
            else { a.x += half; b.x -= half; }
            const tmp = a.vx; a.vx = b.vx; b.vx = tmp;
          } else {
            const half = overlapY / 2;
            if (a.y < b.y) { a.y -= half; b.y += half; }
            else { a.y += half; b.y -= half; }
            const tmp = a.vy; a.vy = b.vy; b.vy = tmp;
          }
        }
      }

      chaseItems.forEach(function(entry) {
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
    if (chaseRepeatId != null) {
      clearInterval(chaseRepeatId);
      chaseRepeatId = null;
    }
  }

  function onArenaClick(e) {
    if (chasePaused || session.isSessionEnded()) return;
    const x = e.clientX;
    const y = e.clientY;
    const hits = chaseItems.filter(function(en) {
      return x >= en.x - chaseHitMargin && x <= en.x + en.w + chaseHitMargin &&
        y >= en.y - chaseHitMargin && y <= en.y + en.h + chaseHitMargin;
    });
    if (hits.length === 0) return;

    const targetKey = getTargetKey(chaseTarget());
    if (hits.some(function(en) { return getTargetKey(en.item) === targetKey; })) {
      session.mutateStats(function(stats) {
        stats.chaseCorrect++;
      });
      chasePaused = true;
      spawnConfetti({ colors: confetti.colors });
      showCelebrationEmojis();
      audio.playChime();
      chaseDifficulty = Math.min(chaseDifficulty + 1, chaseDifficultyMax);
      setTimeout(startChaseRound, 2000);
    } else {
      session.mutateStats(function(stats) {
        pushUniqueStruggle(stats.chaseStruggled, targetKey);
      });
      chaseDifficulty = Math.max(chaseDifficulty - 1, 0);
      thumbsDown.show();
      audio.playBuzzer();
    }
  }

  function buildGrid() {
    grid.innerHTML = '';
    items.forEach(function(item, index) {
      const btn = renderTile(item, index);
      btn.addEventListener('click', function() { handleItemClick(item, index); });
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
  if (quizReplayBtn) {
    quizReplayBtn.addEventListener('click', function() {
      if (session.isSessionEnded() || mode !== 'quiz' || quizTargetIndex < 0) return;
      if (promptItem) promptItem(quizTargetIndex);
      quizReplayBtn.blur();
    });
  }

  buildGrid();
  return {
    setMode,
    stop: function() {
      stopChase();
    },
    reset: function() {
      stopChase();
      setMode('freeplay');
    },
    triggerItemByKey: function(key) {
      for (let i = 0; i < items.length; i++) {
        if (getTargetKey(items[i]) === key) {
          handleItemClick(items[i], i);
          return true;
        }
      }
      return false;
    },
    getMode: function() { return mode; }
  };
}
