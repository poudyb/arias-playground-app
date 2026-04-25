function createTimedSession(options) {
  const {
    sessionKey,
    statsKey,
    defaultStats,
    normalizeStats,
    stopGame,
    renderSummary,
    timerEl = document.getElementById('play-timer'),
    overlayEl = document.getElementById('session-end-overlay'),
    boardEl = document.getElementById('session-end-stats')
  } = options;

  let playLimitEndsAt = null;
  let sessionEnded = false;
  let sessionTickId = null;
  let stats = defaultStats();
  let lastTimerText = '';

  function shouldTrackStats() {
    return playLimitEndsAt != null && !sessionEnded;
  }

  function persistStats() {
    if (!shouldTrackStats()) return;
    try {
      sessionStorage.setItem(statsKey, JSON.stringify(stats));
    } catch (_) {}
  }

  function mutateStats(mutator) {
    if (!shouldTrackStats()) return;
    mutator(stats);
    persistStats();
  }

  function loadStatsFromStorage() {
    try {
      const raw = sessionStorage.getItem(statsKey);
      stats = raw ? normalizeStats(JSON.parse(raw)) : defaultStats();
    } catch (_) {
      stats = defaultStats();
    }
  }

  function clearPlaySessionStorage(alsoClearPortalTimer) {
    try {
      sessionStorage.removeItem(sessionKey);
      sessionStorage.removeItem(statsKey);
      if (alsoClearPortalTimer) {
        sessionStorage.removeItem(PORTAL_TIMER_KEY);
        sessionStorage.removeItem(PLAY_LIMIT_UI_KEY);
      }
    } catch (_) {}
  }

  function readSessionStartedAt(raw, fallback) {
    if (!raw) return fallback;
    try {
      const payload = JSON.parse(raw);
      const startedAt = Number(payload.startedAt);
      return Number.isFinite(startedAt) ? startedAt : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function initPlaySession() {
    try {
      const portalPayload = readPortalPlayPayload();
      const portalDeadline = portalPayload ? Number(portalPayload.endsAt) : null;
      const raw = sessionStorage.getItem(sessionKey);

      if (portalDeadline == null && !raw) {
        playLimitEndsAt = null;
        stats = defaultStats();
        sessionStorage.removeItem(statsKey);
        return;
      }

      let endsAt = portalDeadline;
      let startedAt = readSessionStartedAt(raw, Date.now());

      if (portalDeadline != null) {
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ endsAt, startedAt }));
        } catch (_) {}
      } else {
        const payload = JSON.parse(raw);
        endsAt = payload.endsAt != null ? Number(payload.endsAt) : null;
      }

      playLimitEndsAt = endsAt;
      loadStatsFromStorage();

      if (endsAt != null && (Number.isNaN(endsAt) || Date.now() >= endsAt)) {
        onSessionTimeUp();
      }
    } catch (_) {
      playLimitEndsAt = null;
      stats = defaultStats();
    }
  }

  function formatTimeLeft(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes + ':' + (remainder < 10 ? '0' : '') + remainder;
  }

  function onSessionTimeUp() {
    if (sessionEnded) return;
    sessionEnded = true;

    try {
      sessionStorage.removeItem(PORTAL_TIMER_KEY);
      sessionStorage.removeItem(PLAY_LIMIT_UI_KEY);
    } catch (_) {}

    if (sessionTickId != null) {
      clearInterval(sessionTickId);
      sessionTickId = null;
    }

    stopGame();
    document.body.classList.add('session-ended');

    if (timerEl) {
      timerEl.classList.remove('is-visible');
      timerEl.textContent = '';
      lastTimerText = '';
    }
    if (overlayEl) overlayEl.setAttribute('aria-hidden', 'false');
    if (boardEl) {
      boardEl.innerHTML = '';
      renderSummary(boardEl, stats);
    }
  }

  function updatePlayTimerUi() {
    if (!timerEl) return;
    if (!playLimitEndsAt || sessionEnded) {
      if (lastTimerText !== '') {
        timerEl.classList.remove('is-visible');
        timerEl.textContent = '';
        lastTimerText = '';
      }
      return;
    }

    const left = playLimitEndsAt - Date.now();
    if (left <= 0) {
      onSessionTimeUp();
      return;
    }

    const next = formatTimeLeft(left) + ' left';
    if (next === lastTimerText) return;
    if (lastTimerText === '') timerEl.classList.add('is-visible');
    timerEl.textContent = next;
    lastTimerText = next;
  }

  function startSessionTimerIfNeeded() {
    if (!playLimitEndsAt || sessionEnded) return;
    updatePlayTimerUi();
    sessionTickId = setInterval(updatePlayTimerUi, 1000);
  }

  return {
    clearPlaySessionStorage,
    initPlaySession,
    isSessionEnded() {
      return sessionEnded;
    },
    mutateStats,
    shouldTrackStats,
    startSessionTimerIfNeeded
  };
}
