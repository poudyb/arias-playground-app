const RAINBOW_PALETTE = [
  '#e53935',
  '#ff6d00',
  '#ffab00',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#d81b60',
  '#00897b',
  '#3949ab',
  '#f4511e'
];

// Every AudioContext created on the page, so we can suspend them all when the
// tab/app goes to the background (saves cycles and silences anything scheduled).
const audioContexts = [];

function suspendAllAudio() {
  audioContexts.forEach(function(ctx) {
    if (ctx && ctx.state === 'running' && ctx.suspend) {
      const p = ctx.suspend();
      if (p && typeof p.catch === 'function') p.catch(function() {});
    }
  });
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) suspendAllAudio();
});
window.addEventListener('pagehide', suspendAllAudio);

function createAudioFeedback() {
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContexts.push(audioCtx);
    }
    // Stay suspended while backgrounded so nothing plays out of view; a real
    // interaction after returning will resume it on the next call.
    if (!document.hidden && audioCtx.state === 'suspended') {
      const resumed = audioCtx.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(function() {});
    }
    return audioCtx;
  }

  function playChime() {
    const ctx = getAudioCtx();
    [523.25, 659.25, 783.99].forEach(function(freq, index) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      gain.gain.setTargetAtTime(0, ctx.currentTime + index * 0.1 + 0.08, 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + index * 0.1);
      osc.stop(ctx.currentTime + index * 0.1 + 0.2);
    });
  }

  function playBuzzer() {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    gain.gain.value = 0.08;
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.25, 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  // A C-major chord for "your clock matches" — C5, E5 and G5 together.
  //
  // It has to be a CHORD. An earlier pass replaced it with C5 plus its exact
  // octave and twelfth, on the theory that integer harmonics can't beat against
  // each other. They can't — but f, 2f and 3f are all the same note, so what
  // that bought was a measurement with no wobble in it and a single bell ding
  // where a celebration should be. Any future change here has to keep three
  // different pitches sounding at once.
  //
  // Two things about HOW it's scheduled are worth keeping, since the obvious
  // way to write it sounds bad on real hardware:
  //  - ONE start time, captured once with a little lookahead and shared by all
  //    three notes. Reading ctx.currentTime separately per note let them begin
  //    a fraction apart and smear the chord.
  //  - ONE envelope on a shared gain, ramped up over ~20ms rather than jumping
  //    to full volume. An instant jump is a step discontinuity — a click — and
  //    it lands exactly when all three notes start in phase.
  // Plus a guard so a match that flickers off and back can't stack two copies.
  let matchToneRingingUntil = 0;

  function playMatchTone() {
    const ctx = getAudioCtx();
    const start = ctx.currentTime + 0.02;
    if (start < matchToneRingingUntil) return;

    const attack = 0.02;
    const hold = 0.3;
    const decay = 0.23;
    const end = start + attack + hold + decay;
    // Three sines sum to ~3x this, matching the level the chord has always had.
    const peak = 0.08;
    // exponentialRamp can't touch zero, so the envelope starts and ends just
    // above silence rather than at it.
    const silence = 0.0001;

    const master = ctx.createGain();
    master.gain.setValueAtTime(silence, start);
    master.gain.exponentialRampToValueAtTime(peak, start + attack);
    master.gain.setValueAtTime(peak, start + attack + hold);
    master.gain.exponentialRampToValueAtTime(silence, end);
    master.connect(ctx.destination);

    [523.25, 659.25, 783.99].forEach(function(freq) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
    });

    matchToneRingingUntil = end;
  }

  // A soft, neutral two-note blip for "no match - your turn again". Quiet and
  // gentle so a missed memory flip never feels like a mistake (that is what the
  // buzzer is for, reserved for unforced errors).
  function playSoftTone() {
    const ctx = getAudioCtx();
    [494.0, 440.0].forEach(function(freq, index) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      gain.gain.setTargetAtTime(0, ctx.currentTime + index * 0.12 + 0.05, 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + index * 0.12);
      osc.stop(ctx.currentTime + index * 0.12 + 0.2);
    });
  }

  // A big, bright fanfare for clearing a whole memory board - a rising run that
  // lands on a held major chord. Reserved for level-ups so it feels like a real
  // reward, distinct from the smaller per-match chime.
  function playFanfare() {
    const ctx = getAudioCtx();
    const run = [523.25, 659.25, 783.99, 1046.5];
    run.forEach(function(freq, index) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.value = 0.14;
      gain.gain.setTargetAtTime(0, ctx.currentTime + index * 0.11 + 0.07, 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + index * 0.11);
      osc.stop(ctx.currentTime + index * 0.11 + 0.22);
    });
    const chordStart = ctx.currentTime + run.length * 0.11 + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach(function(freq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.1;
      gain.gain.setTargetAtTime(0, chordStart + 0.5, 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(chordStart);
      osc.stop(chordStart + 0.95);
    });
  }

  return { getAudioCtx, playChime, playBuzzer, playMatchTone, playSoftTone, playFanfare };
}

function setupInteractionUnlock(callbacks = []) {
  let unlocked = false;

  function once() {
    if (unlocked) return;
    unlocked = true;
    document.removeEventListener('touchstart', once, true);
    document.removeEventListener('pointerdown', once, true);
    document.removeEventListener('click', once, true);

    callbacks.forEach(function(callback) {
      try {
        callback();
      } catch (_) {}
    });

    try {
      if (window.speechSynthesis && window.speechSynthesis.getVoices) {
        window.speechSynthesis.getVoices();
      }
    } catch (_) {}
  }

  document.addEventListener('touchstart', once, { passive: true, capture: true });
  document.addEventListener('pointerdown', once, { passive: true, capture: true });
  document.addEventListener('click', once, { capture: true });
}

function spawnConfetti(options = {}) {
  const {
    colors = ['#e53935', '#1e88e5', '#ffeb3b', '#43a047'],
    count = 60,
    originLeft = '50vw',
    originTop = '50vh',
    minSize = 8,
    sizeJitter = 14,
    minDistance = 40,
    distanceJitter = 55,
    minDuration = 1,
    durationJitter = 0.8,
    allowCircles = true
  } = options;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    const size = minSize + Math.random() * sizeJitter;
    const duration = minDuration + Math.random() * durationJitter;
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * distanceJitter;

    el.style.width = size + 'px';
    el.style.height = size + 'px';
    if (allowCircles && Math.random() > 0.5) el.style.borderRadius = '50%';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = originLeft;
    el.style.top = originTop;
    el.style.setProperty('--tx', Math.cos(angle) * distance + 'vw');
    el.style.setProperty('--ty', Math.sin(angle) * distance + 'vh');
    el.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
    el.style.setProperty('--duration', duration + 's');
    document.body.appendChild(el);
    window.setTimeout(function() { el.remove(); }, duration * 1000 + 80);
  }
}

// Center with a full-viewport flexbox rather than a translate: the
// `emoji-pop` animation keyframes set `transform`, which would override an
// inline translate and leave the emoji anchored to the left edge (showing it
// off-center, to the right). Flex centering survives the animated transform.
const CENTER_EMOJI_STYLE = {
  left: '0',
  right: '0',
  top: '0',
  bottom: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '28vw'
};

function showCelebrationEmojis(options = {}) {
  const { emoji = '🎉', durationMs = 1600 } = options;
  const el = document.createElement('div');
  el.className = 'celebration-emoji';
  el.textContent = emoji;
  Object.assign(el.style, CENTER_EMOJI_STYLE);
  document.body.appendChild(el);
  window.setTimeout(function() { el.remove(); }, durationMs);
}

function createThumbsDownController(options = {}) {
  const { emoji = '❌', durationMs = 1600 } = options;
  let current = null;

  function hide() {
    if (current) { current.remove(); current = null; }
  }

  function show() {
    hide();
    const node = document.createElement('div');
    node.className = 'celebration-emoji';
    node.textContent = emoji;
    Object.assign(node.style, CENTER_EMOJI_STYLE);
    document.body.appendChild(node);
    window.setTimeout(function() { if (current === node) current = null; node.remove(); }, durationMs);
    current = node;
  }

  return { hide, show };
}
