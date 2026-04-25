let cachedVoice = null;
let cachedVoiceSignature = '';

function pickEnglishVoice() {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || !voices.length) return null;
    const signature = voices.length + ':' + voices[0].voiceURI;
    if (cachedVoice && signature === cachedVoiceSignature) return cachedVoice;
    let picked = null;
    for (const voice of voices) {
      if ((voice.lang || '').indexOf('en') === 0) { picked = voice; break; }
    }
    cachedVoice = picked || voices[0];
    cachedVoiceSignature = signature;
    return cachedVoice;
  } catch (_) {
    return null;
  }
}

try {
  if (window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', function() {
      cachedVoice = null;
      cachedVoiceSignature = '';
    });
  }
} catch (_) {}

function speakText(text, options = {}) {
  const { rate = 0.9 } = options;
  const synth = window.speechSynthesis;
  if (!synth) return null;
  synth.cancel();
  if (synth.paused) synth.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
  return utterance;
}

function cancelSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
