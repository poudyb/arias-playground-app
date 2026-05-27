try {
  if (window.speechSynthesis && window.speechSynthesis.getVoices) {
    window.speechSynthesis.getVoices();
  }
} catch (_) {}

let activeUtterance = null;
let heartbeatId = null;

// iOS Safari's AVSpeechSynthesizer audio session falls asleep between
// utterances and the next synth.speak() blocks ~100-300ms on the main
// thread waking it back up (this is separate from the Web Audio session
// kept warm by feedback.js). A periodic inaudible utterance keeps the
// speech engine itself warm so chase reprompts don't stall rAF.
function startSpeechHeartbeat() {
  if (heartbeatId != null) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  heartbeatId = setInterval(function() {
    if (document.hidden) return;
    if (activeUtterance) return;
    if (synth.speaking || synth.pending) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    try { synth.speak(u); } catch (_) {}
  }, 3000);
}

function speakText(text, options = {}) {
  const { rate = 0.9 } = options;
  const synth = window.speechSynthesis;
  if (!synth) return null;
  if (activeUtterance && activeUtterance.text === text) return null;
  if (activeUtterance) synth.cancel();

  startSpeechHeartbeat();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;

  function release() {
    if (activeUtterance === utterance) activeUtterance = null;
  }
  utterance.addEventListener('end', release);
  utterance.addEventListener('error', release);

  function go() {
    if (synth.paused) synth.resume();
    synth.speak(utterance);
  }

  activeUtterance = utterance;

  if (synth.getVoices().length > 0) {
    go();
  } else {
    function onReady() {
      synth.removeEventListener('voiceschanged', onReady);
      if (activeUtterance === utterance) go();
    }
    synth.addEventListener('voiceschanged', onReady);
  }
  return utterance;
}

function cancelSpeech() {
  if (!activeUtterance) return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  activeUtterance = null;
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) cancelSpeech();
});
