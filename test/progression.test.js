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

function play(p, outcomes) {
  return outcomes.map((o) => p.recordRound(o));
}

test('starts off and promotes after three clean rounds in a row', () => {
  const p = make(fakeStorage());
  assert.strictEqual(p.isOn(), false);
  assert.deepStrictEqual(play(p, ['clean', 'clean']), [false, false]);
  assert.strictEqual(p.recordRound('clean'), true); // flipped on
  assert.strictEqual(p.isOn(), true);
});

test('a missed round restarts the promotion streak', () => {
  const p = make(fakeStorage());
  play(p, ['clean', 'clean', 'missed', 'clean', 'clean']);
  assert.strictEqual(p.isOn(), false); // one slip wiped the run
  assert.strictEqual(p.recordRound('clean'), true);
});

test('demotes only after three missed rounds in a row', () => {
  const p = make(fakeStorage());
  play(p, ['clean', 'clean', 'clean']);
  assert.deepStrictEqual(play(p, ['missed', 'missed']), [false, false]);
  assert.strictEqual(p.recordRound('missed'), true); // flipped off
  assert.strictEqual(p.isOn(), false);
});

test('a clean round rescues the mode from demotion', () => {
  const p = make(fakeStorage());
  play(p, ['clean', 'clean', 'clean']);
  play(p, ['missed', 'missed', 'clean', 'missed', 'missed']);
  assert.strictEqual(p.isOn(), true);
});

test('extra clean rounds while on do not toggle anything', () => {
  const p = make(fakeStorage());
  play(p, ['clean', 'clean', 'clean']);
  assert.deepStrictEqual(play(p, ['clean', 'clean']), [false, false]);
  assert.strictEqual(p.isOn(), true);
});

// A hinted round is the one the child solved by waiting for the game to point
// at the answer. It must not count toward promotion, and must not cost her the
// streak she has already built.
test('an assisted round never promotes on its own', () => {
  const p = make(fakeStorage());
  assert.deepStrictEqual(play(p, ['assisted', 'assisted', 'assisted', 'assisted']),
    [false, false, false, false]);
  assert.strictEqual(p.isOn(), false);
  assert.deepStrictEqual(p.getState(), { on: false, hits: 0, misses: 0 });
});

test('assisted rounds pass through without breaking a promotion streak', () => {
  const p = make(fakeStorage());
  // Three clean rounds spread out among hinted ones still level her up.
  play(p, ['clean', 'assisted', 'clean', 'assisted', 'assisted']);
  assert.strictEqual(p.isOn(), false);
  assert.strictEqual(p.recordRound('clean'), true);
  assert.strictEqual(p.isOn(), true);
});

test('assisted rounds neither trigger nor rescue a demotion', () => {
  const onDemote = make(fakeStorage());
  play(onDemote, ['clean', 'clean', 'clean']);
  play(onDemote, ['assisted', 'assisted', 'assisted']);
  assert.strictEqual(onDemote.isOn(), true); // hints alone never demote

  // ...and a hinted round mid-slump doesn't reset the miss count either.
  play(onDemote, ['missed', 'assisted', 'missed']);
  assert.strictEqual(onDemote.isOn(), true);
  assert.strictEqual(onDemote.recordRound('missed'), true);
  assert.strictEqual(onDemote.isOn(), false);
});

test('an unrecognized outcome is ignored like an assisted one', () => {
  const p = make(fakeStorage());
  for (const junk of [undefined, null, true, false, 'nonsense']) {
    assert.strictEqual(p.recordRound(junk), false);
  }
  assert.deepStrictEqual(p.getState(), { on: false, hits: 0, misses: 0 });
});

test('state survives a reload through storage', () => {
  const storage = fakeStorage();
  const first = make(storage);
  play(first, ['clean', 'clean']);

  // Mid-streak: a fresh page keeps the count, so one more round promotes.
  const second = make(storage);
  assert.strictEqual(second.isOn(), false);
  assert.strictEqual(second.recordRound('clean'), true);

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
  play(p, ['clean', 'clean']);
  assert.strictEqual(p.recordRound('clean'), true);
});

test('thresholds are configurable', () => {
  const p = make(fakeStorage(), { promoteAfter: 2, demoteAfter: 1 });
  p.recordRound('clean');
  assert.strictEqual(p.recordRound('clean'), true);
  assert.strictEqual(p.recordRound('assisted'), false);
  assert.strictEqual(p.recordRound('missed'), true);
  assert.strictEqual(p.isOn(), false);
});
