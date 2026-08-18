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

  // A single bell-like "ding" for "your clock matches": C5 plus its exact
  // octave and twelfth (f, 2f, 3f) under one shared envelope.
  //
  // This used to be a C-major triad of three pure sines, and the triad itself
  // was why it kept sounding like a stuttering double chime no matter how
  // precisely the notes were aligned: equal-tempered C5/E5/G5 have difference
  // tones of 136.0 Hz and 124.7 Hz, which beat against each other at ~11 Hz.
  // Rendered offline, the chord's loudness fell and re-rose by up to ~22%
  // several times during its ring — that pulsing is the "double chime".
  // Integer harmonics of one fundamental cannot beat, so this envelope never
  // rises again after the attack (same render: 0%): one onset, one smooth
  // ring-out. The decay also replaces the old flat 300ms hold, which gave the
  // flutter a stage; a struck-bell shape has no steady state to wobble.
  //
  // Kept from the earlier rewrite, still deliberate:
  //  - ONE start time with a little lookahead, shared by every partial.
  //  - ONE envelope on a shared gain, ramped from near-silence — an instant
  //    jump to full volume is a step discontinuity, i.e. a click.
  //  - A guard against re-triggering while it's still ringing, so a match
  //    that flickers off and back on can't stack two copies.
  let matchToneRingingUntil = 0;

  function playMatchTone() {
    const ctx = getAudioCtx();
    const start = ctx.currentTime + 0.02;
    if (start < matchToneRingingUntil) return;

    const attack = 0.015;
    const ring = 0.55;
    const end = start + attack + ring;
    // The partials sum to ~1.6x this at the attack peak, landing the ding at
    // the same peak level as the old chord.
    const peak = 0.24;
    // exponentialRamp can't touch zero, so the envelope starts and ends just
    // above silence rather than at it.
    const silence = 0.0001;

    const master = ctx.createGain();
    master.gain.setValueAtTime(silence, start);
    master.gain.exponentialRampToValueAtTime(peak, start + attack);
    master.gain.exponentialRampToValueAtTime(silence, end);
    master.connect(ctx.destination);

    // Fundamental, octave, twelfth — quieter as they go up, like a struck bar.
    [
      { freq: 523.25, level: 1 },
      { freq: 1046.5, level: 0.4 },
      { freq: 1569.75, level: 0.18 }
    ].forEach(function(partial) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = partial.freq;
      const gain = ctx.createGain();
      gain.gain.value = partial.level;
      osc.connect(gain);
      gain.connect(master);
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
