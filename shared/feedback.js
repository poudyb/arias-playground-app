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

function createAudioFeedback() {
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
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

  return { getAudioCtx, playChime, playBuzzer };
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

function showCelebrationEmojis(options = {}) {
  const {
    emojis = ['👍', '🎉'],
    positions = [
      { left: '15vw', top: '25vh' },
      { right: '15vw', top: '25vh' }
    ],
    durationMs = 1600
  } = options;

  emojis.forEach(function(emoji, index) {
    const el = document.createElement('div');
    el.className = 'celebration-emoji';
    el.textContent = emoji;
    Object.assign(el.style, positions[index] || positions[positions.length - 1] || {});
    document.body.appendChild(el);
    window.setTimeout(function() { el.remove(); }, durationMs);
  });
}

function createThumbsDownController(el, options = {}) {
  const {
    animationName,
    hideAfterMs = 800,
    useAriaHidden = true
  } = options;

  let hideTimer = null;

  function hide() {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    el.style.display = 'none';
    if (useAriaHidden) el.setAttribute('aria-hidden', 'true');
  }

  function show() {
    el.style.display = 'block';
    if (useAriaHidden) el.removeAttribute('aria-hidden');
    if (animationName) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = animationName + ' 0.4s ease-out';
    }
    if (hideTimer != null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function() {
      hideTimer = null;
      hide();
    }, hideAfterMs);
  }

  return { hide, show };
}
