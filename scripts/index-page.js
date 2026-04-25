const playLimit = document.getElementById('play-limit');
const customWrap = document.getElementById('custom-minutes-wrap');
const customMinutes = document.getElementById('custom-minutes');
const gameGrid = document.querySelector('.game-grid');

function renderTiles() {
  gameGrid.innerHTML = '';
  ACTIVITIES.forEach(function(activity) {
    const link = document.createElement('a');
    link.className = ['game-tile', activity.tileClass].filter(Boolean).join(' ');
    link.href = activity.href;
    link.id = 'tile-' + activity.id;

    const art = document.createElement('span');
    art.className = activity.artClasses;
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = activity.artHtml;

    const label = document.createElement('span');
    label.className = 'game-tile__label';
    label.textContent = activity.title;

    const hint = document.createElement('span');
    hint.className = 'game-tile__hint';
    hint.textContent = activity.hint;

    link.appendChild(art);
    link.appendChild(label);
    link.appendChild(hint);
    link.addEventListener('click', function(event) {
      event.preventDefault();
      navigateToActivity(activity);
    });
    gameGrid.appendChild(link);
  });
}

function syncCustomVisibility() {
  customWrap.hidden = playLimit.value !== 'custom';
}

function persistPlayLimitUi() {
  try {
    sessionStorage.setItem(PLAY_LIMIT_UI_KEY, JSON.stringify({
      selectValue: playLimit.value,
      customMinutes: customMinutes.value
    }));
  } catch (_) {}
}

function restorePlayLimitUiFromStorage() {
  try {
    const portal = readPortalPlayPayload();
    if (portal && portal.limitMinutes != null) {
      const minutes = Number(portal.limitMinutes);
      if (minutes === 5 || minutes === 10 || minutes === 15) {
        playLimit.value = String(minutes);
      } else {
        playLimit.value = 'custom';
        customMinutes.value = String(minutes);
      }
      syncCustomVisibility();
      persistPlayLimitUi();
      return;
    }

    const raw = sessionStorage.getItem(PLAY_LIMIT_UI_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.selectValue) playLimit.value = payload.selectValue;
    if (payload.customMinutes != null) customMinutes.value = payload.customMinutes;
    syncCustomVisibility();
  } catch (_) {}
}

function resolveMinutes() {
  if (playLimit.value === 'unlimited') return null;
  if (playLimit.value === 'custom') {
    let minutes = parseInt(customMinutes.value, 10);
    if (Number.isNaN(minutes) || minutes < 1) minutes = 1;
    if (minutes > 180) minutes = 180;
    return minutes;
  }
  const preset = parseInt(playLimit.value, 10);
  return !Number.isNaN(preset) && preset > 0 ? preset : null;
}

function resolveEndsAtForPortalNavigation(minutes) {
  if (minutes == null) {
    try {
      sessionStorage.removeItem(PORTAL_TIMER_KEY);
      sessionStorage.removeItem(PLAY_LIMIT_UI_KEY);
    } catch (_) {}
    return { endsAt: null, startedAt: Date.now() };
  }

  try {
    const raw = sessionStorage.getItem(PORTAL_TIMER_KEY);
    if (raw) {
      const payload = JSON.parse(raw);
      const prevMinutes = payload.limitMinutes != null ? Number(payload.limitMinutes) : Number.NaN;
      const endsAt = payload.endsAt != null ? Number(payload.endsAt) : null;
      if (prevMinutes === minutes && endsAt != null && !Number.isNaN(endsAt) && Date.now() < endsAt) {
        return {
          endsAt,
          startedAt: payload.startedAt != null ? Number(payload.startedAt) : Date.now()
        };
      }
    }
  } catch (_) {}

  const startedAt = Date.now();
  const endsAt = startedAt + minutes * 60 * 1000;

  try {
    sessionStorage.setItem(PORTAL_TIMER_KEY, JSON.stringify({
      endsAt,
      startedAt,
      limitMinutes: minutes
    }));
  } catch (_) {}

  return { endsAt, startedAt };
}

function navigateToActivity(activity) {
  persistPlayLimitUi();
  const timing = resolveEndsAtForPortalNavigation(resolveMinutes());

  try {
    sessionStorage.setItem(activity.sessionKey, JSON.stringify({
      endsAt: timing.endsAt,
      startedAt: timing.startedAt
    }));
    sessionStorage.setItem(activity.statsKey, JSON.stringify(activity.defaultStats()));
  } catch (_) {}

  window.location.href = activity.href;
}

playLimit.addEventListener('change', function() {
  syncCustomVisibility();
  persistPlayLimitUi();
});
customMinutes.addEventListener('input', persistPlayLimitUi);
customMinutes.addEventListener('change', persistPlayLimitUi);

renderTiles();
restorePlayLimitUiFromStorage();
