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
    chaseItemWeight,
    chaseDifficultyMax = 15,
    speakChase,
    gridQuizClass,
    thumbsDown,
    confetti,
    dom,
    modeSessionKey,
    onFreeplayInteract,
    onQuizStart,
    onQuizRoundResolved,
    onModeEnter
  } = options;

  const { audio, showCelebrationEmojis, spawnConfetti } = feedback;
  const { modeBtns, grid, modeHint, chaseArena, viewFreeplay, appMain, quizTop, quizReplayBtn } = dom;
  const modeNames = Array.prototype.map.call(modeBtns, function(btn) { return btn.dataset.mode; });

  const chaseHitMargin = 30;
  const chaseRepromptMs = 5000;
  // After this long with no taps (correct or incorrect) on the same level, go
  // quiet so the prompt isn't nagging in the background when nobody's playing.
  const chaseSilenceMs = 60000;

  let mode = null;
  let quizTargetIndex = -1;
  let quizLocked = false;
  let quizRoundMissed = false;
  let quizRoundHinted = false;
  let chaseDifficulty = 0;
  let chaseItems = [];
  let chaseAnimId = null;
  let chaseTargetItem = null;
  let chasePaused = false;
  let chaseMissedThisRound = false;
  let chaseRepeatId = null;
  let lastChaseTargetKey = null;
  let lastFrameTime = 0;
  let lastChaseActivity = 0;

  function quizTarget() {
    return quizTargetIndex >= 0 ? items[quizTargetIndex] : null;
  }

  function chaseTarget() {
    return chaseTargetItem;
  }

  let gridTiles = [];

  function flashHintTarget() {
    if (mode === 'quiz') {
      // The round has been given away — onQuizRoundResolved reports it as
      // hinted so callers don't treat a waited-out answer as a clean solve.
      quizRoundHinted = true;
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
      if (modeSessionKey) saveRoundState(modeSessionKey + ':quiz', null);
      hint.stop();
      // Report the round before the celebration so anything the outcome
      // changes on screen lands with the confetti rather than after it.
      if (onQuizRoundResolved) {
        onQuizRoundResolved({ firstTry: !quizRoundMissed, hinted: quizRoundHinted, item });
      }
      spawnConfetti({ colors: confetti.colors });
      showCelebrationEmojis();
      audio.playChime();
      setTimeout(startQuizRound, 2000);
    } else {
      quizRoundMissed = true;
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
    quizRoundMissed = false;
    quizRoundHinted = false;
    thumbsDown.hide();

    if (modeSessionKey) {
      const saved = loadRoundState(modeSessionKey + ':quiz');
      if (saved && isValidIndex(saved.targetIndex, items.length)) {
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

  function startChaseRound() {
    if (session.isSessionEnded() || mode !== 'chase') return;
    stopChase();
    chasePaused = false;
    chaseMissedThisRound = false;
    thumbsDown.hide();
    chaseItems.forEach(function(entry) { entry.el.remove(); });
    chaseItems = [];

    // Resume from the saved round: same difficulty, and the same target if a
    // round was in progress (targetKey is null right after a correct answer).
    const saved = modeSessionKey ? loadRoundState(modeSessionKey + ':chase') : null;
    if (saved && typeof saved.difficulty === 'number') {
      chaseDifficulty = Math.max(0, Math.min(saved.difficulty, chaseDifficultyMax));
    }
    const preferTargetKey = saved && saved.targetKey ? saved.targetKey : null;

    const params = getChaseParams(chaseDifficulty);
    const pool = chasePool ? chasePool(chaseDifficulty) : items;
    const indices = pool.map(function(_, i) { return i; });
    const count = Math.min(params.count, indices.length);
    let targetCandidates = indices;
    if (preferTargetKey) {
      const preferred = indices.filter(function(idx) {
        return getTargetKey(pool[idx]) === preferTargetKey;
      });
      if (preferred.length > 0) targetCandidates = preferred;
    } else if (lastChaseTargetKey != null && indices.length > 1) {
      const filtered = indices.filter(function(idx) {
        return getTargetKey(pool[idx]) !== lastChaseTargetKey;
      });
      if (filtered.length > 0) targetCandidates = filtered;
    }
    const targetIndex = targetCandidates[Math.floor(Math.random() * targetCandidates.length)];
    chaseTargetItem = pool[targetIndex];
    lastChaseTargetKey = getTargetKey(chaseTargetItem);
    if (modeSessionKey) saveRoundState(modeSessionKey + ':chase', { difficulty: chaseDifficulty, targetKey: lastChaseTargetKey });

    // Pick the target first so every item in the learned pool remains equally
    // likely to be asked. A game may weight only the distractors; Numbers uses
    // that to favour familiar single digits without hiding the newer targets.
    const shuffled = [targetIndex];
    const remaining = indices.filter(function(idx) { return idx !== targetIndex; });
    while (shuffled.length < count) {
      let totalWeight = 0;
      const weights = remaining.map(function(idx) {
        const weight = chaseItemWeight ? Number(chaseItemWeight(pool[idx], chaseDifficulty)) : 1;
        const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 0;
        totalWeight += safeWeight;
        return safeWeight;
      });
      let pickedAt;
      if (totalWeight === 0) {
        pickedAt = Math.floor(Math.random() * remaining.length);
      } else {
        let roll = Math.random() * totalWeight;
        pickedAt = weights.length - 1;
        for (let i = 0; i < weights.length; i++) {
          roll -= weights[i];
          if (roll < 0) {
            pickedAt = i;
            break;
          }
        }
      }
      shuffled.push(remaining.splice(pickedAt, 1)[0]);
    }

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
    lastChaseActivity = performance.now();
    chaseRepeatId = setInterval(function() {
      if (chasePaused || session.isSessionEnded()) return;
      // Stay silent once the level's been idle for a while — the child isn't
      // playing, so don't keep talking. A tap resumes the prompts (see onArenaClick).
      if (performance.now() - lastChaseActivity >= chaseSilenceMs) return;
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

    // A tap (right or wrong) means someone's playing — keep the prompts going.
    lastChaseActivity = performance.now();

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
    // Re-run renderTile for every tile — for callers whose tiles change look
    // partway through play (e.g. the alphabet grid switching to "Aa" pairs).
    refreshTiles: buildGrid,
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
