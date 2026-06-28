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

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { allowedNext, isLookAlike };
}
