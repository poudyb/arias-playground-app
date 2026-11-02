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

// ---- Read It: a ladder into reading -------------------------------------------
//
// Read It shows a picture, says its word, and asks her to find the written word
// among three. A child who can't read yet can only guess at that, and guessing
// three cards is quick, so she was taught to guess. The ladder gives her a way
// to actually find it that she can already manage, then takes it away a piece
// at a time:
//
//   letters - the word, then its letters one by one ("mom … m, o, m"), so she
//             can match letters she knows to the letters on the cards
//   first   - the word, then just its first letter ("mom … m")
//   word    - just the word: she listens for its first sound
//
// and on the bottom three rungs no two cards start with the same letter, so the
// first letter is always enough. The top rung puts the word among cards that
// start the same way ("mom" beside "mud"), so the rest of the word has to be
// read too. Never look-alikes (one letter different), on any rung.
//
// Same terms as every other ladder: three clean rounds up, two with a miss
// down, a hinted round passes through. Never named to her.
const READ_RUNGS = [
  {
    say: 'letters', sameStart: false,
    note: 'Each round says the word and spells it, and every card starts with a different letter, so matching the letters finds it.'
  },
  {
    say: 'first', sameStart: false,
    note: 'Each round says the word and its first letter; every card starts differently.'
  },
  {
    say: 'word', sameStart: false,
    note: 'Each round just says the word; every card starts differently, so its first sound is enough.'
  },
  {
    say: 'word', sameStart: true,
    note: 'Each round just says the word, among cards that start with the same letter, so she reads the whole word.'
  }
];

// The fullest help, for a hint: the word and all its letters.
const READ_HELP = { say: 'letters', sameStart: false };

function readRung(level) {
  const i = typeof level === 'number' && Number.isFinite(level)
    ? Math.max(0, Math.min(Math.floor(level), READ_RUNGS.length - 1))
    : 0;
  return READ_RUNGS[i];
}

// What the round says, as separate utterances (the pauses between them). The
// letters are marked so they can be spoken slower.
function readSpeech(word, rung) {
  const w = word.toLowerCase();
  const parts = [{ text: w, letter: false }];
  if (rung.say === 'letters') {
    for (let i = 0; i < w.length; i++) parts.push({ text: w[i], letter: true });
  } else if (rung.say === 'first') {
    parts.push({ text: w[0], letter: true });
  }
  return parts;
}

// Two wrong words to sit beside `target` on this rung. `random` is injectable
// for the tests. Falls back gracefully on a tiny word list: the rule it can't
// keep is dropped, never the "no look-alikes" one unless nothing else is left.
function readDistractors(target, words, rung, random) {
  random = random || Math.random;
  const others = words.filter(function(w) { return w !== target && !isLookAlike(target, w); });
  function pick(pool, count, taken) {
    const out = [];
    const left = pool.filter(function(w) { return taken.indexOf(w) === -1; });
    while (out.length < count && left.length > 0) {
      out.push(left.splice(Math.floor(random() * left.length), 1)[0]);
    }
    return out;
  }
  let chosen = [];
  if (rung.sameStart) {
    chosen = pick(others.filter(function(w) { return w[0] === target[0]; }), 2, []);
  } else {
    // Each card starts with a letter no other card does.
    const starts = [target[0]];
    const pool = others.slice();
    while (chosen.length < 2 && pool.length > 0) {
      const w = pool.splice(Math.floor(random() * pool.length), 1)[0];
      if (starts.indexOf(w[0]) === -1) {
        chosen.push(w);
        starts.push(w[0]);
      }
    }
  }
  if (chosen.length < 2) chosen = chosen.concat(pick(others, 2 - chosen.length, chosen));
  if (chosen.length < 2) {
    chosen = chosen.concat(pick(words.filter(function(w) { return w !== target; }), 2 - chosen.length, chosen));
  }
  return chosen;
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    allowedNext, isLookAlike, QUIZ_RUNGS, QUIZ_HELP, quizRung, quizSpeech,
    READ_RUNGS, READ_HELP, readRung, readSpeech, readDistractors
  };
}
