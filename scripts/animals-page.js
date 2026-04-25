const modeBtns = document.querySelectorAll('.mode-btn');
const viewFreeplay = document.getElementById('view-freeplay');
const appMain = document.getElementById('app-main');
const animalGrid = document.getElementById('animal-grid');
const modeHint = document.getElementById('mode-hint');
const quizTop = document.getElementById('quiz-top');
const quizReplayBtn = document.getElementById('quiz-replay-btn');
const animalSoundsVideo = document.getElementById('animal-sounds-video');
const chaseArena = document.getElementById('chase-arena');
const thumbsDownEl = document.getElementById('thumbs-down');

let videoSegmentTimeUpdate = null;
let videoSegmentSeekedHandler = null;
let videoSegmentSeekTimer = null;
let videoPlaybackGen = 0;
let activity = null;

function renderAnimalPill(pill, key) {
  pill.textContent = animalEmojiForKey(key);
  pill.setAttribute('title', key);
}

function renderSummary(board, stats) {
  renderThreeModeSummary(board, stats, buildModeSummaryConfig({
    freeplay: {
      countField: 'freeAnimals',
      emptyMessage: 'You opened Free play - next time, tap lots of animals to hear every sound! 🌿',
      countMessage: function(count) {
        return 'You tapped animals ' + count + ' ' + (count === 1 ? 'time' : 'times') + '! 🌿';
      }
    },
    quiz: {
      message: function(info) {
        if (info.correct > 0) {
          return 'Nice work - ' + info.correct + ' quiz ' + (info.correct === 1 ? 'round' : 'rounds') + ' solved!';
        }
        if (info.struggled.length > 0) return 'You were practicing - keep going next time!';
        return 'You opened Quiz - match sounds to animals next time! 🧩';
      },
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These took an extra try (you got them!):'
          : 'These animals needed another try:';
      },
      renderPill: renderAnimalPill
    },
    chase: {
      message: function(info) {
        if (info.correct > 0) {
          return 'You caught the target ' + info.correct + ' ' + (info.correct === 1 ? 'time' : 'times') + '!';
        }
        if (info.struggled.length > 0) return 'You were chasing - nice effort!';
        return 'You opened Chase - tap the moving animal next time! 🎯';
      },
      perfectMessage: 'No mix-ups - sharp tapping! 🎯',
      struggledLabel: function(info) {
        return info.correct > 0
          ? 'These targets needed another tap or two:'
          : 'These targets were tricky to catch:';
      },
      renderPill: renderAnimalPill
    }
  }));
  cancelSpeech();
}

function stopAnimalsGame() {
  if (activity) activity.stop();
}

const session = createTimedSession({
  sessionKey: 'ariaAnimalsSession',
  statsKey: 'ariaAnimalsStats',
  defaultStats: function() { return createModeStats('freeAnimals'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeAnimals'); },
  stopGame: stopAnimalsGame,
  renderSummary
});

function stopVideoSegmentPlayback() {
  if (!animalSoundsVideo) return;
  videoPlaybackGen++;
  if (videoSegmentSeekTimer != null) {
    window.clearTimeout(videoSegmentSeekTimer);
    videoSegmentSeekTimer = null;
  }
  if (videoSegmentSeekedHandler) {
    animalSoundsVideo.removeEventListener('seeked', videoSegmentSeekedHandler);
    videoSegmentSeekedHandler = null;
  }
  if (videoSegmentTimeUpdate) {
    animalSoundsVideo.removeEventListener('timeupdate', videoSegmentTimeUpdate);
    videoSegmentTimeUpdate = null;
  }
  animalSoundsVideo.pause();
}

function getVideoSegmentBounds(animalIndex) {
  const duration = animalSoundsVideo.duration;
  if (!duration || !Number.isFinite(duration)) return null;
  const pair = ANIMAL_VIDEO_CUES[animalIndex];
  if (!pair) return null;
  return { start: pair[0], end: pair[1] };
}

function seekVideoTo(video, time) {
  if (typeof video.fastSeek === 'function') {
    try {
      video.fastSeek(time);
      return;
    } catch (_) {}
  }
  video.currentTime = time;
}

function playAnimalSoundFromVideo(animalIndex) {
  if (!animalSoundsVideo || session.isSessionEnded()) return;
  cancelSpeech();
  stopVideoSegmentPlayback();
  const playbackSession = videoPlaybackGen;

  function runPlayback() {
    if (playbackSession !== videoPlaybackGen) return;
    const bounds = getVideoSegmentBounds(animalIndex);
    if (!bounds) return;

    const start = bounds.start;
    const end = bounds.end;
    const trim = 0.05;
    const video = animalSoundsVideo;
    let started = false;

    function beginAfterSeek() {
      if (playbackSession !== videoPlaybackGen || started) return;
      started = true;
      if (videoSegmentSeekTimer != null) {
        window.clearTimeout(videoSegmentSeekTimer);
        videoSegmentSeekTimer = null;
      }
      if (videoSegmentSeekedHandler) {
        video.removeEventListener('seeked', videoSegmentSeekedHandler);
        videoSegmentSeekedHandler = null;
      }

      videoSegmentTimeUpdate = function() {
        if (playbackSession !== videoPlaybackGen) return;
        if (video.currentTime >= end - trim) {
          video.pause();
          stopVideoSegmentPlayback();
        }
      };
      video.addEventListener('timeupdate', videoSegmentTimeUpdate);
      video.muted = false;
      video.volume = 1;
      const startedPlayback = video.play();
      if (startedPlayback && typeof startedPlayback.catch === 'function') {
        startedPlayback.catch(function() {});
      }
    }

    videoSegmentSeekedHandler = beginAfterSeek;
    video.addEventListener('seeked', beginAfterSeek);
    video.muted = true;
    video.volume = 1;
    try {
      const primed = video.play();
      if (primed && typeof primed.catch === 'function') primed.catch(function() {});
    } catch (_) {}

    seekVideoTo(video, start);

    videoSegmentSeekTimer = window.setTimeout(function() {
      videoSegmentSeekTimer = null;
      if (playbackSession !== videoPlaybackGen) return;
      if (!started && !video.seeking) beginAfterSeek();
    }, 40);
  }

  if (!animalSoundsVideo.duration || !Number.isFinite(animalSoundsVideo.duration)) {
    animalSoundsVideo.addEventListener('loadedmetadata', function onMeta() {
      animalSoundsVideo.removeEventListener('loadedmetadata', onMeta);
      if (playbackSession !== videoPlaybackGen) return;
      runPlayback();
    }, { once: true });
    if (animalSoundsVideo.readyState === 0) animalSoundsVideo.load();
    return;
  }

  runPlayback();
}

const audio = createAudioFeedback();
const thumbsDown = createThumbsDownController(thumbsDownEl, {
  animationName: 'animal-shake'
});

function warmAnimalVideo() {
  const video = animalSoundsVideo;
  if (!video) return;
  const wasMuted = video.muted;
  video.muted = true;
  const primed = video.play();
  function settle() {
    try {
      video.pause();
      video.muted = wasMuted;
    } catch (_) {}
  }
  if (primed && typeof primed.then === 'function') primed.then(settle).catch(settle);
  else window.setTimeout(settle, 0);
}

setupInteractionUnlock([
  function() { audio.getAudioCtx(); },
  warmAnimalVideo
]);

activity = createCollectionActivity({
  items: ANIMALS,
  session,
  feedback: {
    audio,
    showCelebrationEmojis,
    spawnConfetti
  },
  promptItem: playAnimalSoundFromVideo,
  stopPrompt: function() {
    cancelSpeech();
    stopVideoSegmentPlayback();
  },
  freeplayHintText: 'Tap an animal!',
  freeplayStatField: 'freeAnimals',
  getTargetKey: function(item) { return item.key; },
  renderTile: function(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'animal-tile';
    btn.setAttribute('aria-label', item.name);

    const emoji = document.createElement('span');
    emoji.className = 'animal-tile__emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = item.emoji;

    const name = document.createElement('span');
    name.className = 'animal-tile__name';
    name.textContent = item.name;

    btn.appendChild(emoji);
    btn.appendChild(name);
    return btn;
  },
  createChaseElement: function(item) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chase-animal';
    el.textContent = item.emoji;
    el.setAttribute('aria-label', item.name);
    return el;
  },
  sizeChaseElement: function(el, params) {
    el.style.fontSize = params.fontSize + 'vmin';
  },
  getChaseParams: function(difficulty) {
    const count = Math.min(3 + Math.floor(difficulty / 2), 8);
    return {
      count: Math.min(count, ANIMALS.length),
      speed: 100 + difficulty * 10,
      fontSize: Math.max(12, 22 - count * 1.2)
    };
  },
  gridQuizClass: 'animal-grid--quiz',
  thumbsDown,
  confetti: { colors: RAINBOW_PALETTE },
  dom: {
    modeBtns,
    viewFreeplay,
    appMain,
    grid: animalGrid,
    modeHint,
    quizTop,
    quizReplayBtn,
    chaseArena
  }
});

session.initPlaySession();
session.startSessionTimerIfNeeded();
activity.setMode('freeplay');

document.getElementById('link-home').addEventListener('click', function() {
  stopAnimalsGame();
  session.clearPlaySessionStorage(false);
});

document.getElementById('session-end-home').addEventListener('click', function() {
  session.clearPlaySessionStorage(true);
});

window.addEventListener('pagehide', stopAnimalsGame);
window.addEventListener('pageshow', function(event) {
  if (event.persisted) activity.reset();
});
