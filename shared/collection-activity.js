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
    chasePool,
    speakChase,
    gridQuizClass,
    thumbsDown,
    confetti,
    dom,
    modeSessionKey,
    onFreeplayInteract,
    onQuizStart,
    onModeEnter
  } = options;

  const { audio, showCelebrationEmojis, spawnConfetti } = feedback;
  const { modeBtns, grid, modeHint, chaseArena, viewFreeplay, appMain, quizTop, quizReplayBtn } = dom;
  const modeNames = Array.prototype.map.call(modeBtns, function(btn) { return btn.dataset.mode; });

  const chaseHitMargin = 30;
  const chaseRepromptMs = 5000;
  const chaseDifficultyMax = 15;

  let mode = null;
  let quizTargetIndex = -1;
  let quizLocked = false;
  let chaseDifficulty = 0;
  let chaseItems = [];
  let chaseAnimId = null;
  let chaseTargetItem = null;
  let chasePaused = false;
  let chaseMissedThisRound = false;
  let chaseRepeatId = null;
  let lastChaseTargetKey = null;
  let lastFrameTime = 0;

  function quizTarget() {
    return quizTargetIndex >= 0 ? items[quizTargetIndex] : null;
  }

  function chaseTarget() {
    return chaseTargetItem;
  }

  let gridTiles = [];

  function flashHintTarget() {
    if (mode === 'quiz') {
      flashHintEl(gridTiles[quizTargetIndex]);
    } else if (mode === 'chase') {
      const target = chaseTarget();
      for (let i = 0; i < chaseItems.length; i++) {
        if (chaseItems[i].item === target) {
          flashHintEl(chaseItems[i].el);
          break;
        }
      }
    }
  }

  const hint = createHintNudge({
    onFlash: flashHintTarget,
    isActive: function() {
      return !session.isSessionEnded() && (mode === 'quiz' || mode === 'chase');
    }
  });

  function promptChaseTarget() {
    if (chaseTargetItem == null) return;
    if (speakChase) {
      speakChase(chaseTargetItem);
      return;
    }
    if (!promptItem) return;
    const idx = items.indexOf(chaseTargetItem);
    if (idx >= 0) promptItem(idx);
  }

  function setMode(newMode) {
    if (session.isSessionEnded()) return;
    if (modeNames.indexOf(newMode) === -1) newMode = 'freeplay';
    if (mode === newMode) return;
    if (mode === 'chase') stopChase();
    if (stopPrompt) stopPrompt();

    mode = newMode;
    if (modeSessionKey) rememberSessionMode(modeSessionKey, mode);
    modeBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    thumbsDown.hide();
    hint.stop();
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
      var savedChase = modeSessionKey ? loadRoundState(modeSessionKey + ':chase') : null;
      chaseDifficulty = (savedChase && typeof savedChase.difficulty === 'number')
        ? Math.max(0, Math.min(savedChase.difficulty, chaseDifficultyMax))
        : 0;
      startChaseRound(savedChase && savedChase.targetKey ? savedChase.targetKey : null);
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
      if (modeSessionKey) saveRoundState(modeSessionKey + ':quiz', null);
      hint.stop();
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
      hint.registerMiss();
    }
  }

  function startQuizRound() {
    if (session.isSessionEnded() || mode !== 'quiz') return;
    quizLocked = false;
    thumbsDown.hide();

    if (modeSessionKey) {
      var saved = loadRoundState(modeSessionKey + ':quiz');
      if (saved && typeof saved.targetIndex === 'number' && saved.targetIndex >= 0 && saved.targetIndex < items.length) {
        quizTargetIndex = saved.targetIndex;
        if (stopPrompt) stopPrompt();
        if (promptItem) promptItem(quizTargetIndex);
        if (onQuizStart) onQuizStart(items[quizTargetIndex], quizTargetIndex);
        hint.reset();
        return;
      }
    }

    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * items.length);
    } while (quizTargetIndex >= 0 && getTargetKey(items[nextIndex]) === getTargetKey(items[quizTargetIndex]));
    quizTargetIndex = nextIndex;
    if (modeSessionKey) saveRoundState(modeSessionKey + ':quiz', { targetIndex: quizTargetIndex });
    if (stopPrompt) stopPrompt();
    if (promptItem) promptItem(quizTargetIndex);
    if (onQuizStart) onQuizStart(items[quizTargetIndex], quizTargetIndex);
    hint.reset();
  }

  function startChaseRound(preferTargetKey) {
    if (session.isSessionEnded() || mode !== 'chase') return;
    stopChase();
    chasePaused = false;
    chaseMissedThisRound = false;
    thumbsDown.hide();
    chaseItems.forEach(function(entry) { entry.el.remove(); });
    chaseItems = [];

    const params = getChaseParams(chaseDifficulty);
    const pool = chasePool ? chasePool(chaseDifficulty) : items;
    const indices = pool.map(function(_, i) { return i; });
    const count = Math.min(params.count, indices.length);
    const shuffled = [];
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (indices.length - i));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
      shuffled.push(indices[i]);
    }
    let targetCandidates = shuffled;
    if (preferTargetKey) {
      const preferred = shuffled.filter(function(idx) {
        return getTargetKey(pool[idx]) === preferTargetKey;
      });
      if (preferred.length > 0) targetCandidates = preferred;
    } else if (lastChaseTargetKey != null && shuffled.length > 1) {
      const filtered = shuffled.filter(function(idx) {
        return getTargetKey(pool[idx]) !== lastChaseTargetKey;
      });
      if (filtered.length > 0) targetCandidates = filtered;
    }
    chaseTargetItem = pool[targetCandidates[Math.floor(Math.random() * targetCandidates.length)]];
    lastChaseTargetKey = getTargetKey(chaseTargetItem);
    if (modeSessionKey) saveRoundState(modeSessionKey + ':chase', { difficulty: chaseDifficulty, targetKey: lastChaseTargetKey });

    shuffled.forEach(function(idx, position) {
      const item = pool[idx];
      const el = createChaseElement(item, position);
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

    if (stopPrompt) stopPrompt();
    promptChaseTarget();
    hint.reset();
    chaseRepeatId = setInterval(function() {
      if (chasePaused || session.isSessionEnded()) return;
      promptChaseTarget();
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
      hint.stop();
      spawnConfetti({ colors: confetti.colors });
      showCelebrationEmojis();
      audio.playChime();
      chaseDifficulty = Math.min(chaseDifficulty + 1, chaseDifficultyMax);
      if (modeSessionKey) saveRoundState(modeSessionKey + ':chase', { difficulty: chaseDifficulty, targetKey: null });
      setTimeout(startChaseRound, 2000);
    } else {
      session.mutateStats(function(stats) {
        pushUniqueStruggle(stats.chaseStruggled, targetKey);
      });
      if (!chaseMissedThisRound) {
        chaseMissedThisRound = true;
        chaseDifficulty = Math.max(chaseDifficulty - 1, 0);
        if (modeSessionKey) saveRoundState(modeSessionKey + ':chase', { difficulty: chaseDifficulty, targetKey: lastChaseTargetKey });
      }
      thumbsDown.show();
      audio.playBuzzer();
      hint.registerMiss();
    }
  }

  function buildGrid() {
    grid.innerHTML = '';
    gridTiles = [];
    items.forEach(function(item, index) {
      const btn = renderTile(item, index);
      btn.addEventListener('click', function() { handleItemClick(item, index); });
      grid.appendChild(btn);
      gridTiles[index] = btn;
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
      hint.stop();
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
