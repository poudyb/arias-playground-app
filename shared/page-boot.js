// Shared per-page lifecycle wiring. Every game page did the same handful of
// things by hand: start the play session + timer, show the first screen, wire
// the two "back to home" links to clear session storage, stop the game on
// pagehide, and re-render on bfcache restore (pageshow.persisted). This
// centralizes that so a change to the lifecycle happens in one place.
//
//   initGamePage({
//     session,            // the createTimedSession(...) instance
//     stop,               // tear the running game down (timers, audio, ...)
//     start,              // render the first screen (set the initial mode)
//     onResume            // re-render after a bfcache restore
//   })
function initGamePage(options) {
  const session = options.session;
  const stop = options.stop || function () {};

  session.initPlaySession();
  session.startSessionTimerIfNeeded();
  if (options.start) options.start();

  const linkHome = document.getElementById('link-home');
  if (linkHome) {
    linkHome.addEventListener('click', function () {
      stop();
      session.clearPlaySessionStorage(false);
    });
  }

  const endHome = document.getElementById('session-end-home');
  if (endHome) {
    endHome.addEventListener('click', function () {
      session.clearPlaySessionStorage(true);
    });
  }

  window.addEventListener('pagehide', function () { stop(); });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && options.onResume) options.onResume();
  });
}
