if (location.search.includes('debug=1')) (function () {
  const s = window.speechSynthesis, pre = document.createElement('pre');
  Object.assign(pre.style, {position:'fixed',left:'4px',bottom:'4px',zIndex:99999,
    maxWidth:'96vw',maxHeight:'45vh',overflow:'auto',font:'11px monospace',
    background:'rgba(0,0,0,.78)',color:'#0f0',padding:'6px',pointerEvents:'none'});
  document.body.appendChild(pre);
  const frames=[], longs=[], speaks=[]; let last=performance.now(), unlocked=false, vc=0, gv='n/a', longOK='off';
  const pct=(a,p)=>{ if(!a.length) return 0; const b=a.slice().sort((x,y)=>x-y); return b[Math.min(b.length-1, Math.floor((b.length-1)*p))]; };
  const draw=()=>{ const sp=speaks[speaks.length-1]||{};
    pre.textContent=[
      'raf60 p50='+pct(frames,.5).toFixed(1)+' p99='+pct(frames,.99).toFixed(1)+' ms',
      'last speak gap='+(sp.gap||0).toFixed(1)+' ms call='+(sp.call||'?')+' ms',
      'before speak: '+(sp.before||'none'),
      'voiceschanged after unlock='+vc+' unlocked='+unlocked+' getVoices='+gv,
      'now paused='+(s&&s.paused)+' speaking='+(s&&s.speaking),
      'longtask '+longOK+': '+(longs.map(x=>x.d.toFixed(1)+'ms '+x.a).join(' | ')||'none')
    ].join('\n'); };
  requestAnimationFrame(function tick(t){ frames.push(t-last); if(frames.length>60) frames.shift(); last=t; draw(); requestAnimationFrame(tick); });
  ['touchstart','pointerdown','click'].forEach(e=>document.addEventListener(e,()=>{unlocked=true; draw();},{capture:true,once:true,passive:true}));
  if (s) s.addEventListener('voiceschanged',()=>{ if(unlocked) vc++; draw(); });
  if ('PerformanceObserver' in window) try { longOK='on'; new PerformanceObserver(l=>{ l.getEntries().forEach(e=>longs.push({d:e.duration,a:(e.attribution||[]).map(a=>[a.containerType,a.containerName,a.containerId,a.containerSrc].filter(Boolean).join('#')).join('|')})); while(longs.length>6) longs.shift(); draw(); }).observe({entryTypes:['longtask']}); } catch (_) { longOK='unsupported'; }
  if (s && s.getVoices) { const ogv=s.getVoices.bind(s); s.getVoices=function(){ const t=performance.now(), r=ogv(); gv=(r?r.length:0)+' voices in '+(performance.now()-t).toFixed(1)+'ms'; return r; }; }
  if (s && s.speak) { const os=s.speak.bind(s); s.speak=function(u){ const t0=performance.now(), before='paused='+s.paused+' speaking='+s.speaking+' text='+u.text; let call='?'; requestAnimationFrame(t=>{speaks.push({gap:t-t0,call,before}); if(speaks.length>5) speaks.shift(); draw();}); const ret=os(u); call=(performance.now()-t0).toFixed(1); console.log('[speak]', before, 'callMs='+call); return ret; }; }
  draw();
})();

try {
  if (window.speechSynthesis && window.speechSynthesis.getVoices) {
    window.speechSynthesis.getVoices();
  }
} catch (_) {}

let activeUtterance = null;

// Voices can load asynchronously on first use; speaking before they're ready
// drops the utterance silently. Run `go` now if voices are present, otherwise
// once `voiceschanged` fires (one-shot).
function whenVoicesReady(synth, go) {
  if (synth.getVoices().length > 0) {
    go();
    return;
  }
  function onReady() {
    synth.removeEventListener('voiceschanged', onReady);
    go();
  }
  synth.addEventListener('voiceschanged', onReady);
}

// Every word this app speaks is English. Which English voice says it is
// decided by chooseEnglishVoice in shared/voice-logic.js — see the note there
// for why the device's own choice has to win. Call this only once voices are
// ready; a null result leaves `voice` unset, which is the browser's default.
function pickEnglishVoice(synth) {
  try {
    return chooseEnglishVoice(synth.getVoices(), preferredLangs());
  } catch (_) {
    return null;
  }
}

// The device's languages, most-wanted first.
function preferredLangs() {
  const nav = typeof navigator !== 'undefined' && navigator ? navigator : null;
  if (!nav) return [];
  if (nav.languages && nav.languages.length) return Array.prototype.slice.call(nav.languages);
  return nav.language ? [nav.language] : [];
}

function speakText(text, options = {}) {
  const { rate = 0.9 } = options;
  const synth = window.speechSynthesis;
  if (!synth) return null;
  // Don't talk to an empty room: timers (chase re-prompts, idle hint nudges)
  // keep firing while the tab/app is backgrounded, and speaking there is just
  // disruptive noise and wasted cycles.
  if (document.hidden) return null;
  if (activeUtterance && activeUtterance.text === text) return null;
  if (activeUtterance) synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;

  function release() {
    if (activeUtterance === utterance) activeUtterance = null;
  }
  utterance.addEventListener('end', release);
  utterance.addEventListener('error', release);

  function go() {
    if (synth.paused) synth.resume();
    // Picked here rather than above because voices are only guaranteed loaded
    // inside this callback.
    const voice = pickEnglishVoice(synth);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  }

  activeUtterance = utterance;
  whenVoicesReady(synth, function() {
    if (activeUtterance === utterance) go();
  });
  return utterance;
}

function cancelSpeech() {
  if (!activeUtterance) return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  activeUtterance = null;
}

// Speaks several parts back-to-back as one cancellable sequence (e.g. a word
// followed by its letters). rates[i] sets the rate per part.
function speakSequence(parts, options = {}) {
  const { rates = [] } = options;
  const synth = window.speechSynthesis;
  if (!synth || parts.length === 0) return;
  if (document.hidden) return;
  cancelSpeech();

  const utterances = parts.map(function(part, i) {
    const u = new SpeechSynthesisUtterance(part);
    u.rate = rates[i] != null ? rates[i] : 0.9;
    return u;
  });
  const first = utterances[0];

  function release() {
    if (activeUtterance === first) activeUtterance = null;
  }
  const last = utterances[utterances.length - 1];
  last.addEventListener('end', release);
  last.addEventListener('error', release);

  function go() {
    if (synth.paused) synth.resume();
    // One voice for every part, picked here for the same reason as speakText:
    // voices are only guaranteed loaded inside this callback. Without this the
    // spelled word and its letters were read by whatever voice the device fell
    // back to while the rest of the app spoke English.
    const voice = pickEnglishVoice(synth);
    utterances.forEach(function(u) {
      if (voice) u.voice = voice;
      synth.speak(u);
    });
  }

  activeUtterance = first;
  whenVoicesReady(synth, function() {
    if (activeUtterance === first) go();
  });
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) cancelSpeech();
});
window.addEventListener('pagehide', cancelSpeech);
