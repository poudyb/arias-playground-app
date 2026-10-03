// Night mode. From 7pm to 7am every page wears the dim navy palette in
// styles/night.css instead of its daytime white and pastels, so the screen
// doesn't glare in a dark room. The Clock page is already dark and is the look
// the rest borrow.
//
// This is loaded in <head>, right after the stylesheets, so the attribute is on
// <html> before the first paint and a page never flashes white first. It is
// checked again whenever a page is shown, so going back to the home screen (or
// coming back to the tab) picks up the change. It deliberately does not flip
// the colours under her while she is in the middle of a game.
const NIGHT_STARTS_AT = 19;
const NIGHT_ENDS_AT = 7;

function isNightHour(hour) {
  return hour >= NIGHT_STARTS_AT || hour < NIGHT_ENDS_AT;
}

function applyNightTheme() {
  const root = document.documentElement;
  if (isNightHour(new Date().getHours())) root.setAttribute('data-theme', 'night');
  else root.removeAttribute('data-theme');
}

if (typeof document !== 'undefined') {
  applyNightTheme();
  window.addEventListener('pageshow', applyNightTheme);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') applyNightTheme();
  });
}

if (typeof module !== 'undefined') module.exports = { isNightHour };
