if (location.search.includes('debug=1')) (function () {
  const s = window.speechSynthesis, pre = document.createElement('pre');
  Object.assign(pre.style, {position:'fixed',left:'4px',bottom:'4px',zIndex:99999,
    maxWidth:'96vw',maxHeight:'45vh',overflow:'auto',font:'11px monospace',
    background:'rgba(0,0,0,.78)',color:'#0f0',padding:'6px',pointerEvents:'none'});
  document.body.appendChild(pre);
  const frames=[], longs=[], speaks=[]; let last=performance.now(), unlocked=false, vc=0, gv='n/a', longOK='off';
  const pct=(a,p)=>{ if(!a.length) return 0; const b=a.slice().sort((x,y)=>x-y); return b[Math.min(b.length-1, Math.floor((b.length-1)*p))]; };
  // Whether the last utterance carried a voice, so an iPad can be checked from
  // the sofa: this code never sets one, so anything but VOICE SET=no is the old
  // code still cached. The list is shown only to confirm nothing is taken from
  // it - on iOS it holds the compact voices, not the one the device really uses.
  const voiceInfo=()=>{ try {
    const list=(s&&s.getVoices&&s.getVoices())||[];
    const en=list.filter(v=>/^en/i.test(v.lang||''));
    const sp=speaks[speaks.length-1];
    return ['VOICE SET='+(sp?(sp.voice?sp.voice+' - OLD code, still picking':'no (device default)'):'nothing spoken yet'),
      'nav.languages='+((navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language])||[]).join(','),
      'en voices listed (unused): '+(en.map(v=>v.name+'['+v.lang+(v.default?',DEFAULT':'')+']').join(' ')||'none')].join('\n');
  } catch(e){ return 'voiceInfo error: '+e; } };
  const draw=()=>{ const sp=speaks[speaks.length-1]||{};
    pre.textContent=[
      voiceInfo(),
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
  if (s && s.speak) { const os=s.speak.bind(s); s.speak=function(u){ const t0=performance.now(), before='paused='+s.paused+' speaking='+s.speaking+' text='+u.text, voice=u.voice&&u.voice.name; let call='?'; requestAnimationFrame(t=>{speaks.push({gap:t-t0,call,before,voice}); if(speaks.length>5) speaks.shift(); draw();}); const ret=os(u); call=(performance.now()-t0).toFixed(1); console.log('[speak]', before, 'callMs='+call); return ret; }; }
  draw();
})();

try {
  if (window.speechSynthesis && window.speechSynthesis.getVoices) {
    window.speechSynthesis.getVoices();
  }
} catch (_) {}

let activeUtterance = null;

// Never set `utterance.voice`. This has been "fixed" three times and every fix
// made the app sound worse, so it is worth being blunt about why.
//
// Every page is `<html lang="en">`, so an utterance with no voice set already
// asks for English, and the device answers with the voice it is set up to use —
// the good one, including a voice a parent chose in Settings. Naming a voice
// instead means naming one out of getVoices(), and on iOS that list is not the
// device's voices: it is the *compact* ones, the cheap robotic speech that ships
// for offline use. The device's real voice is not in it at all. So every pick
// from that list sounds archaic no matter which entry it is, and the three
// regressions were only ever arguments about which archaic voice to use:
//
//   * the first `en*` entry — iOS sorts by language tag, so every iPad went
//     Australian (Karen);
//   * then the first entry matching navigator.language, with the `default` flag
//     as a tie-break that WebKit doesn't reliably set — so list order decided
//     again and every iPad went to some other wrong voice;
//   * then, briefly, no pick at all for an English device but a forced en-US
//     one for a device set to another language. Nobody here has such a device,
//     and that path would have handed a child the same robot voice, so it went
//     too rather than sit here waiting to be "improved" back into the common
//     case.
//
// If English words ever do come out with another language's phonetics, that is
// the utterance language to fix (`utterance.lang`), not the voice.

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

// iOS drops any utterance spoken before the page has had a user gesture, and a
// dropped utterance never reports back — no `start`, no `end`, no `error` — so
// it also leaves `activeUtterance` set, and every later prompt with the same
// words is swallowed by the duplicate guard below for the rest of the page's
// life. A page refreshed straight into Chase restores that mode and prompts
// immediately with no gesture behind it, which is exactly this case: the Chase
// prompt is voice-only, so the child is left with nothing to go on and it never
// recovers. Hold the words until the first touch rather than spending them on a
// synth that isn't listening yet.
const SPEECH_GESTURES = ['touchstart', 'pointerdown', 'click'];
let speechUnlocked = false;
let pendingSpeech = [];

function onFirstSpeechGesture() {
  if (speechUnlocked) return;
  speechUnlocked = true;
  SPEECH_GESTURES.forEach(function(name) {
    document.removeEventListener(name, onFirstSpeechGesture, true);
  });
  const run = pendingSpeech;
  pendingSpeech = [];
  run.forEach(function(go) { go(); });
}

SPEECH_GESTURES.forEach(function(name) {
  document.addEventListener(name, onFirstSpeechGesture, { capture: true, passive: true });
});

// Only the newest request is worth holding: by the time the child touches the
// screen, an older prompt has been superseded by whatever is on screen now. A
// queued request is the exception — it was asked to follow the one before it.
function whenSpeechUnlocked(go, queue) {
  if (speechUnlocked) {
    go();
    return;
  }
  if (!queue) pendingSpeech = [];
  pendingSpeech.push(go);
}

// How long to give an utterance to actually start before assuming the synth
// swallowed it. Releasing early only risks a prompt repeating; not releasing
// costs every prompt that follows.
const SPEECH_START_TIMEOUT_MS = 2000;

// Who wins when two things want to be said at once.
//
// By default the newest request replaces whatever is being said: a new tap,
// a new round, a new prompt — the screen has moved on and so should the voice.
// The one exception is a request for the very words already being said, which
// is dropped rather than restarted, so a re-prompt or a hint replay that lands
// mid-sentence doesn't stutter it back to the beginning.
//
// That exception is wrong for a step in something she is building, where the
// same words a second time are a second, separate thing: the second card of a
// Memory pair (both say "cat" — that IS the match), the second "g" of "egg",
// the second number of a sum. Those pass `queue: true`: they wait for what is
// being said to finish and then are said too, never dropped and never cutting
// the step before them off. The first step of anything still replaces, so her
// tap always beats a prompt the game was in the middle of.
//
// A replacing request also cancels queued words that haven't started yet.
let speechGeneration = 0;

function speakText(text, options = {}) {
  const { rate = 0.9, queue = false } = options;
  const synth = window.speechSynthesis;
  if (!synth) return null;
  // Don't talk to an empty room: timers (chase re-prompts, idle hint nudges)
  // keep firing while the tab/app is backgrounded, and speaking there is just
  // disruptive noise and wasted cycles.
  if (document.hidden) return null;
  const ahead = queue && activeUtterance && !activeUtterance.__settled ? activeUtterance : null;
  if (!queue) {
    if (activeUtterance && activeUtterance.text === text) return null;
    if (activeUtterance) synth.cancel();
    speechGeneration += 1;
  }
  const generation = speechGeneration;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.__onSettle = [];

  let dropWatch = null;
  let started = false;
  function release() {
    if (utterance.__settled) return;
    utterance.__settled = true;
    if (dropWatch) { clearTimeout(dropWatch); dropWatch = null; }
    if (activeUtterance === utterance) activeUtterance = null;
    utterance.__onSettle.forEach(function(fn) { fn(); });
  }
  utterance.addEventListener('end', release);
  utterance.addEventListener('error', release);
  utterance.addEventListener('start', function() {
    started = true;
    if (dropWatch) { clearTimeout(dropWatch); dropWatch = null; }
  });

  // A queued utterance can't be expected to start until the one ahead of it
  // has finished, so its watch only starts counting from then.
  function armDropWatch() {
    if (started || utterance.__settled) return;
    dropWatch = setTimeout(release, SPEECH_START_TIMEOUT_MS);
  }

  function go() {
    if (generation !== speechGeneration) return;
    if (synth.paused) synth.resume();
    synth.speak(utterance);
    if (ahead && !ahead.__settled && ahead.__onSettle) ahead.__onSettle.push(armDropWatch);
    else armDropWatch();
  }

  activeUtterance = utterance;
  whenSpeechUnlocked(function() {
    if (generation !== speechGeneration) return;
    whenVoicesReady(synth, function() { go(); });
  }, queue);
  return utterance;
}

function cancelSpeech() {
  speechGeneration += 1;
  if (!activeUtterance) return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  activeUtterance = null;
}

// Speaks several parts back-to-back as one cancellable sequence (e.g. a word
// followed by its letters). rates[i] sets the rate per part.
//
// onPart(i) fires as part i starts being spoken, so the screen can follow along
// (light up the letter being said). onEnd() fires once when the whole sequence is
// over. Neither fires for a sequence that was cancelled or replaced — whoever
// cancelled it owns the screen from then on.
function speakSequence(parts, options = {}) {
  const { rates = [], onPart, onEnd } = options;
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

  if (onPart) {
    utterances.forEach(function(u, i) {
      u.addEventListener('start', function() {
        if (activeUtterance === first) onPart(i);
      });
    });
  }

  let dropWatch = null;
  function release() {
    if (dropWatch) { clearTimeout(dropWatch); dropWatch = null; }
    if (activeUtterance === first) {
      activeUtterance = null;
      if (onEnd) onEnd();
    }
  }
  const last = utterances[utterances.length - 1];
  last.addEventListener('end', release);
  last.addEventListener('error', release);
  first.addEventListener('start', function() {
    if (dropWatch) { clearTimeout(dropWatch); dropWatch = null; }
  });

  function go() {
    if (synth.paused) synth.resume();
    utterances.forEach(function(u) { synth.speak(u); });
    dropWatch = setTimeout(release, SPEECH_START_TIMEOUT_MS);
  }

  activeUtterance = first;
  whenSpeechUnlocked(function() {
    if (activeUtterance !== first) return;
    whenVoicesReady(synth, function() {
      if (activeUtterance === first) go();
    });
  });
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) cancelSpeech();
});
window.addEventListener('pagehide', cancelSpeech);
