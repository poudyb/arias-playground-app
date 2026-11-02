'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { allowedNext, isLookAlike, QUIZ_RUNGS, QUIZ_HELP, quizRung, quizSpeech } = require('../shared/word-logic.js');

const WORDS = ['CAT', 'CAN', 'CAR', 'DOG', 'DAD'];

test('allowedNext returns letters that extend the prefix toward a word', () => {
  assert.deepStrictEqual(allowedNext('', WORDS), { C: true, D: true });
  assert.deepStrictEqual(allowedNext('CA', WORDS), { T: true, N: true, R: true });
  assert.deepStrictEqual(allowedNext('D', WORDS), { O: true, A: true });
});

test('allowedNext is empty once the prefix is a complete word (no longer word)', () => {
  assert.deepStrictEqual(allowedNext('CAT', WORDS), {});
});

test('allowedNext ignores words shorter than or equal to the prefix length', () => {
  assert.deepStrictEqual(allowedNext('CATS', WORDS), {});
});

test('isLookAlike is true only for a single-letter difference', () => {
  assert.strictEqual(isLookAlike('CAT', 'CAN'), true);
  assert.strictEqual(isLookAlike('CAT', 'RAT'), true);
  assert.strictEqual(isLookAlike('CAT', 'CAT'), false); // identical, zero diff
  assert.strictEqual(isLookAlike('CAT', 'DOG'), false); // all different
});

test('isLookAlike treats different-length words as not look-alike', () => {
  assert.strictEqual(isLookAlike('CAT', 'CATS'), false);
});

// --- Quiz's spoken-help ladder -------------------------------------------

const said = (word, rung) => quizSpeech(word, rung).map((p) => p.text);

test('the top of the Quiz ladder asks the question, the bottom only spells', () => {
  assert.deepStrictEqual(said('cow', QUIZ_RUNGS[0]), ['Which one is cow?', 'c', 'o', 'w', 'cow']);
  assert.deepStrictEqual(said('cow', QUIZ_RUNGS[1]), ['cow', 'c', 'o', 'w']);
  assert.deepStrictEqual(said('cow', QUIZ_RUNGS[2]), ['c', 'o', 'w']);
});

test('each Quiz rung says strictly less than the one before it', () => {
  const lengths = QUIZ_RUNGS.map((r) => said('cow', r).join(' ').length);
  for (let i = 1; i < lengths.length; i++) assert.ok(lengths[i] < lengths[i - 1], 'rung ' + i);
});

test('the hint replay is always the full word, letters, word', () => {
  assert.deepStrictEqual(said('cow', QUIZ_HELP), ['cow', 'c', 'o', 'w', 'cow']);
});

// The page lights a slot for each part as it is spoken.
test('a spoken phrase lights every letter, a spoken letter lights only its own', () => {
  const parts = quizSpeech('cow', QUIZ_RUNGS[0]);
  assert.deepStrictEqual(parts.map((p) => p.lit),
    [[0, 1, 2], [0], [1], [2], [0, 1, 2]]);
  assert.deepStrictEqual(parts.map((p) => p.letter), [false, true, true, true, false]);
});

test('every Quiz rung carries a note for the parent summary', () => {
  for (const r of QUIZ_RUNGS) assert.ok(typeof r.note === 'string' && r.note.length > 0);
});

test('quizRung clamps out-of-range and junk levels', () => {
  assert.strictEqual(quizRung(0), QUIZ_RUNGS[0]);
  assert.strictEqual(quizRung(99), QUIZ_RUNGS[QUIZ_RUNGS.length - 1]);
  assert.strictEqual(quizRung(-3), QUIZ_RUNGS[0]);
  assert.strictEqual(quizRung(1.9), QUIZ_RUNGS[1]);
  for (const junk of [undefined, null, NaN, 'two', {}]) assert.strictEqual(quizRung(junk), QUIZ_RUNGS[0]);
});

// ---- Read It ladder ------------------------------------------------------

const wl = require('../shared/word-logic.js');
const REAL_WORDS = require('../data/spelling.js').SPELLING_WORDS.map((w) => w.word.toUpperCase());

function seeded(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

test('Read It says less as she climbs: letters, then the first letter, then the word', () => {
  assert.deepStrictEqual(wl.readSpeech('MOM', wl.readRung(0)).map((p) => p.text), ['mom', 'm', 'o', 'm']);
  assert.deepStrictEqual(wl.readSpeech('MOM', wl.readRung(1)).map((p) => p.text), ['mom', 'm']);
  assert.deepStrictEqual(wl.readSpeech('MOM', wl.readRung(2)).map((p) => p.text), ['mom']);
  assert.deepStrictEqual(wl.readSpeech('MOM', wl.READ_HELP).map((p) => p.text), ['mom', 'm', 'o', 'm']);
  wl.READ_RUNGS.forEach((r, i) => assert.ok(r.note, 'rung ' + i + ' has a parent note'));
});

test('below the top rung, every card starts with a different letter', () => {
  const random = seeded(3);
  for (let level = 0; level < 3; level++) {
    for (const target of REAL_WORDS) {
      const d = wl.readDistractors(target, REAL_WORDS, wl.readRung(level), random);
      assert.strictEqual(d.length, 2);
      const starts = [target, ...d].map((w) => w[0]);
      assert.strictEqual(new Set(starts).size, 3, target + ' with ' + d.join(','));
      d.forEach((w) => assert.ok(!wl.isLookAlike(target, w) && w !== target));
    }
  }
});

test('on the top rung, cards share the first letter wherever the word list allows', () => {
  const random = seeded(9);
  const rung = wl.readRung(3);
  for (const target of REAL_WORDS) {
    const d = wl.readDistractors(target, REAL_WORDS, rung, random);
    assert.strictEqual(d.length, 2);
    const sameStartAvailable = REAL_WORDS.filter((w) => w !== target && w[0] === target[0] && !wl.isLookAlike(target, w)).length;
    const sameStart = d.filter((w) => w[0] === target[0]).length;
    assert.strictEqual(sameStart, Math.min(2, sameStartAvailable), target + ' with ' + d.join(','));
    d.forEach((w) => assert.ok(!wl.isLookAlike(target, w) && w !== target));
  }
});

test('readDistractors still finds two on a tiny list', () => {
  assert.strictEqual(wl.readDistractors('CAT', ['CAT', 'CAN', 'COT'], wl.readRung(0)).length, 2);
});
