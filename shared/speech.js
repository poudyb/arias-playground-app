function pickEnglishVoice() {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;
    for (const voice of voices) {
      if ((voice.lang || '').indexOf('en') === 0) return voice;
    }
    return voices[0];
  } catch (_) {
    return null;
  }
}

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
