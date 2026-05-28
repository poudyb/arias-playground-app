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

function speakText(text, options = {}) {
  const { rate = 0.9 } = options;
  const synth = window.speechSynthesis;
  if (!synth) return null;
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
