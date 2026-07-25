'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createStreakProgression } = require('../shared/progression.js');

function fakeStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    map
  };
}

function make(storage, opts = {}) {
  return createStreakProgression({ storageKey: 'k', storage, ...opts });
}

test('starts off and promotes after three first-try rounds in a row', () => {
  const p = make(fakeStorage());
  assert.strictEqual(p.isOn(), false);
  assert.strictEqual(p.recordRound(true), false);
  assert.strictEqual(p.recordRound(true), false);
  assert.strictEqual(p.recordRound(true), true); // flipped on
  assert.strictEqual(p.isOn(), true);
});

test('a missed round restarts the promotion streak', () => {
  const p = make(fakeStorage());
  p.recordRound(true);
  p.recordRound(true);
  p.recordRound(false); // one slip wipes the run...
  p.recordRound(true);
  p.recordRound(true);
  assert.strictEqual(p.isOn(), false); // ...so two more isn't enough yet
  assert.strictEqual(p.recordRound(true), true);
  assert.strictEqual(p.isOn(), true);
});

test('demotes only after three missed rounds in a row', () => {
  const p = make(fakeStorage());
  p.recordRound(true); p.recordRound(true); p.recordRound(true);
  assert.strictEqual(p.recordRound(false), false);
  assert.strictEqual(p.recordRound(false), false);
  assert.strictEqual(p.recordRound(false), true); // flipped off
  assert.strictEqual(p.isOn(), false);
});

test('a first-try round rescues the mode from demotion', () => {
  const p = make(fakeStorage());
  p.recordRound(true); p.recordRound(true); p.recordRound(true);
  p.recordRound(false);
  p.recordRound(false);
  p.recordRound(true); // clears the miss streak
  p.recordRound(false);
  p.recordRound(false);
  assert.strictEqual(p.isOn(), true);
});

test('extra first-try rounds while on do not toggle anything', () => {
  const p = make(fakeStorage());
  p.recordRound(true); p.recordRound(true); p.recordRound(true);
  assert.strictEqual(p.recordRound(true), false);
  assert.strictEqual(p.recordRound(true), false);
  assert.strictEqual(p.isOn(), true);
});

test('state survives a reload through storage', () => {
  const storage = fakeStorage();
  const first = make(storage);
  first.recordRound(true);
  first.recordRound(true);

  // Mid-streak: a fresh page keeps the count, so one more round promotes.
  const second = make(storage);
  assert.strictEqual(second.isOn(), false);
  assert.strictEqual(second.recordRound(true), true);

  const third = make(storage);
  assert.strictEqual(third.isOn(), true);
  assert.deepStrictEqual(third.getState(), { on: true, hits: 0, misses: 0 });
});

test('ignores junk or partial stored state', () => {
  for (const raw of ['not json', 'null', '"str"', '{"on":"yes","hits":-4,"misses":"x"}']) {
    const p = make(fakeStorage({ k: raw }));
    const state = p.getState();
    assert.strictEqual(state.hits, 0);
    assert.strictEqual(state.misses, 0);
    if (raw.indexOf('yes') === -1) assert.strictEqual(state.on, false);
  }
});

test('works with no storage at all', () => {
  const p = createStreakProgression({ storageKey: 'k', storage: null });
  p.recordRound(true); p.recordRound(true);
  assert.strictEqual(p.recordRound(true), true);
});

test('thresholds are configurable', () => {
  const p = make(fakeStorage(), { promoteAfter: 2, demoteAfter: 1 });
  p.recordRound(true);
  assert.strictEqual(p.recordRound(true), true);
  assert.strictEqual(p.recordRound(false), true);
  assert.strictEqual(p.isOn(), false);
});
