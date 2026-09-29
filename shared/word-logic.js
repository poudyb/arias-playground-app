// Pure word helpers for the Spelling game, kept DOM-free so they can be
// unit-tested under Node and reused by the page script (loaded after this one).

// The set of letters that can extend `prefix` toward some word in `words`.
// e.g. allowedNext('CA', ['CAT','CAN','DOG']) -> { T: true, N: true }.
// Used to constrain the Free Play keyboard to letters that still lead to a word.
function allowedNext(prefix, words) {
  const set = {};
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length > prefix.length && w.startsWith(prefix)) {
      set[w[prefix.length]] = true;
    }
  }
  return set;
}

// Two equal-length words that differ in exactly one position are "look-alikes"
// (cat/can, rat/cat). Read It avoids offering these as distractors so a child
// reads the whole word rather than a single letter.
function isLookAlike(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff === 1;
}

// How much Quiz says out loud at the start of a round, one piece less per rung.
// At the bottom she is asked the question and walked through the word; at the
// top all she hears is the letters and has to blend them into the word herself,
// which is the reading Quiz is there to build. Ordered most help to least.
//
//   sentence  "Which one is cow?"  c  o  w  "cow"
//   word      "cow"  c  o  w
//   spelling  c  o  w
//
// The rung she is on is never named to her; it shows up only as a round that
// sounds different, and in the parent summary (`note`). Whichever rung she is
// on, a wrong tap or a long pause still gets the fullest help (QUIZ_HELP), so
// climbing never leaves her without a way back in.
const QUIZ_RUNGS = [
  {
    opening: 'sentence', closing: true,
    note: 'Each round asks "Which one is ___?" out loud, then spells the word and says it again.'
  },
  {
    opening: 'word', closing: false,
    note: 'Each round says the word and spells it, without asking the question first.'
  },
  {
    opening: 'none', closing: false,
    note: 'Each round only spells the word out loud, so she has to put the letters together into the word herself.'
  }
];

// What a hint replay says: the word, its letters, then the word again.
const QUIZ_HELP = { opening: 'word', closing: true };

function quizRung(level) {
  const i = typeof level === 'number' && Number.isFinite(level)
    ? Math.max(0, Math.min(Math.floor(level), QUIZ_RUNGS.length - 1))
    : 0;
  return QUIZ_RUNGS[i];
}

// The utterances for one round at `rung`, in order. `lit` is the letter slots to
// light up while that part is spoken (the whole word for a phrase, one slot for a
// letter); `letter` marks the spelled-out letters, which are spoken slower.
function quizSpeech(word, rung) {
  const w = word.toLowerCase();
  const all = [];
  for (let i = 0; i < w.length; i++) all.push(i);
  const parts = [];
  if (rung.opening === 'sentence') parts.push({ text: 'Which one is ' + w + '?', lit: all, letter: false });
  else if (rung.opening === 'word') parts.push({ text: w, lit: all, letter: false });
  for (let i = 0; i < w.length; i++) parts.push({ text: w[i], lit: [i], letter: true });
  if (rung.closing) parts.push({ text: w, lit: all, letter: false });
  return parts;
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { allowedNext, isLookAlike, QUIZ_RUNGS, QUIZ_HELP, quizRung, quizSpeech };
}
