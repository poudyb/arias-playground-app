const PORTAL_TIMER_KEY = 'ariaPortalPlayTimer';
const PLAY_LIMIT_UI_KEY = 'ariaPortalPlayLimitUi';

function readPortalPlayPayload() {
  try {
    const raw = sessionStorage.getItem(PORTAL_TIMER_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    const endsAt = payload.endsAt != null ? Number(payload.endsAt) : null;
    if (endsAt == null || Number.isNaN(endsAt) || Date.now() >= endsAt) return null;
    return payload;
  } catch (_) {
    return null;
  }
}
