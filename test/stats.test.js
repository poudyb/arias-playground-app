'use strict';
const test = require('node:test');
const assert = require('node:assert');
const stats = require('../shared/stats.js');

test('createModeStats puts the count under the given free field', () => {
  const s = stats.createModeStats('freeShapes');
  assert.strictEqual(s.freeShapes, 0);
  assert.deepStrictEqual(s.quizStruggled, []);
  assert.strictEqual(s.visitedQuiz, false);
});

test('normalizeStatsBySchema keeps valid values and copies arrays', () => {
  const defaults = { count: 0, items: [], flag: false };
  const parsed = { count: 5, items: ['a'], flag: true };
  const out = stats.normalizeStatsBySchema(parsed, defaults);
  assert.deepStrictEqual(out, { count: 5, items: ['a'], flag: true });
  // arrays are copied, not aliased to the parsed object
  assert.notStrictEqual(out.items, parsed.items);
});

test('normalizeStatsBySchema repairs wrong types', () => {
  const defaults = { count: 0, items: [], flag: false };
  const out = stats.normalizeStatsBySchema(
    { count: 'nope', items: 'nope', flag: 1 },
    defaults
  );
  assert.strictEqual(out.count, 0);
  assert.deepStrictEqual(out.items, []);
  assert.strictEqual(out.flag, true); // boolean is coerced
});

test('normalizeStatsBySchema returns defaults for non-objects', () => {
  const defaults = stats.createSpellingStats();
  assert.strictEqual(stats.normalizeStatsBySchema(null, defaults), defaults);
  assert.strictEqual(stats.normalizeStatsBySchema('x', defaults), defaults);
});

test('normalizeStatsBySchema fills missing fields and preserves unknown ones', () => {
  const defaults = { count: 0, items: [] };
  const out = stats.normalizeStatsBySchema({ extra: 'kept' }, defaults);
  assert.strictEqual(out.count, 0);
  assert.deepStrictEqual(out.items, []);
  assert.strictEqual(out.extra, 'kept');
});

test('normalizeModeStats carries a legacy free-field forward', () => {
  const out = stats.normalizeModeStats({ freeAnimals: 7 }, 'freeShapes', ['freeAnimals']);
  assert.strictEqual(out.freeShapes, 7);
});

test('normalizeModeStats prefers the current field over the legacy one', () => {
  const out = stats.normalizeModeStats(
    { freeShapes: 3, freeAnimals: 7 },
    'freeShapes',
    ['freeAnimals']
  );
  assert.strictEqual(out.freeShapes, 3);
});

test('normalize* round-trips a full valid stats object unchanged', () => {
  for (const make of [stats.createSameAsStats, stats.createClockStats, stats.createSpellingStats]) {
    const fresh = make();
    fresh.quizCorrect = (fresh.quizCorrect || 0) + 2;
    const normalize = make === stats.createSameAsStats ? stats.normalizeSameAsStats
      : make === stats.createClockStats ? stats.normalizeClockStats
      : stats.normalizeSpellingStats;
    assert.deepStrictEqual(normalize(fresh), fresh);
  }
});

test('pushUniqueStruggle de-duplicates', () => {
  const arr = [];
  stats.pushUniqueStruggle(arr, 'cat');
  stats.pushUniqueStruggle(arr, 'cat');
  stats.pushUniqueStruggle(arr, 'dog');
  assert.deepStrictEqual(arr, ['cat', 'dog']);
});
