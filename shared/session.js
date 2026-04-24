const DEFAULT_PORTAL_TIMER_KEY = 'ariaPortalPlayTimer';
const DEFAULT_PLAY_LIMIT_UI_KEY = 'ariaPortalPlayLimitUi';

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
    boardEl = document.getElementById('session-end-stats'),
    portalTimerKey = DEFAULT_PORTAL_TIMER_KEY,
    playLimitUiKey = DEFAULT_PLAY_LIMIT_UI_KEY
  } = options;

  let playLimitEndsAt = null;
  let sessionEnded = false;
  let sessionTickId = null;
  let stats = defaultStats();

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

  function readPortalPlayDeadline() {
    try {
      const raw = sessionStorage.getItem(portalTimerKey);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      const endsAt = payload.endsAt != null ? Number(payload.endsAt) : null;
      if (endsAt == null || Number.isNaN(endsAt) || Date.now() >= endsAt) return null;
      return endsAt;
    } catch (_) {
      return null;
    }
  }

  function clearPlaySessionStorage(alsoClearPortalTimer) {
    try {
      sessionStorage.removeItem(sessionKey);
      sessionStorage.removeItem(statsKey);
      if (alsoClearPortalTimer) {
        sessionStorage.removeItem(portalTimerKey);
        sessionStorage.removeItem(playLimitUiKey);
      }
    } catch (_) {}
  }

  function initPlaySession() {
    try {
      const portalDeadline = readPortalPlayDeadline();
      const raw = sessionStorage.getItem(sessionKey);
      let endsAt = null;
      let startedAt = Date.now();

      if (portalDeadline != null) {
        endsAt = portalDeadline;
        if (raw) {
          try {
            const payload = JSON.parse(raw);
            if (payload.startedAt != null && !Number.isNaN(Number(payload.startedAt))) {
              startedAt = Number(payload.startedAt);
            }
          } catch (_) {}
        }
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ endsAt, startedAt }));
        } catch (_) {}
      } else if (raw) {
        const payload = JSON.parse(raw);
        endsAt = payload.endsAt != null ? Number(payload.endsAt) : null;
        if (payload.startedAt != null && !Number.isNaN(Number(payload.startedAt))) {
          startedAt = Number(payload.startedAt);
        }
      } else {
        playLimitEndsAt = null;
        stats = defaultStats();
        sessionStorage.removeItem(statsKey);
        return;
      }

      if (endsAt != null && (Number.isNaN(endsAt) || Date.now() >= endsAt)) {
        playLimitEndsAt = endsAt;
        loadStatsFromStorage();
        onSessionTimeUp();
        return;
      }

      playLimitEndsAt = endsAt;
      loadStatsFromStorage();
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
      sessionStorage.removeItem(portalTimerKey);
      sessionStorage.removeItem(playLimitUiKey);
    } catch (_) {}

    if (sessionTickId != null) {
      clearInterval(sessionTickId);
      sessionTickId = null;
    }

    loadStatsFromStorage();
    stopGame();
    document.body.classList.add('session-ended');

    if (timerEl) {
      timerEl.classList.remove('is-visible');
      timerEl.textContent = '';
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
      timerEl.classList.remove('is-visible');
      timerEl.textContent = '';
      return;
    }

    const left = playLimitEndsAt - Date.now();
    if (left <= 0) {
      onSessionTimeUp();
      return;
    }

    timerEl.classList.add('is-visible');
    timerEl.textContent = formatTimeLeft(left) + ' left';
  }

  function startSessionTimerIfNeeded() {
    if (!playLimitEndsAt || sessionEnded) return;
    updatePlayTimerUi();
    sessionTickId = setInterval(updatePlayTimerUi, 500);
  }

  return {
    clearPlaySessionStorage,
    initPlaySession,
    isSessionEnded() {
      return sessionEnded;
    },
    mutateStats,
    persistStats,
    shouldTrackStats,
    startSessionTimerIfNeeded,
    updatePlayTimerUi,
    get stats() {
      return stats;
    },
    set stats(value) {
      stats = value;
    }
  };
}
