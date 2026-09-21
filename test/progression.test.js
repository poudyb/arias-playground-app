'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createLadderProgression } = require('../shared/progression.js');

function fakeStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    map
  };
}

function play(p, outcomes) {
  return outcomes.map((o) => p.recordRound(o));
}

// --- the multi-rung ladder ------------------------------------------------

function ladder(storage, opts = {}) {
  return createLadderProgression({ storageKey: 'L', rungs: 5, storage, ...opts });
}

test('the ladder starts at the bottom and climbs one rung per clean streak', () => {
  const p = ladder(fakeStorage());
  assert.strictEqual(p.getRung(), 0);
  assert.deepStrictEqual(play(p, ['clean', 'clean']), [false, false]);
  assert.strictEqual(p.recordRound('clean'), true);
  assert.strictEqual(p.getRung(), 1);
  play(p, ['clean', 'clean', 'clean']);
  assert.strictEqual(p.getRung(), 2);
});

test('a missed round restarts the climb, three misses drop a rung', () => {
  const p = ladder(fakeStorage());
  play(p, ['clean', 'clean', 'clean']); // rung 1
  play(p, ['clean', 'clean', 'missed', 'clean', 'clean']);
  assert.strictEqual(p.getRung(), 1); // the slip wiped the run
  assert.deepStrictEqual(play(p, ['missed', 'missed']), [false, false]);
  assert.strictEqual(p.recordRound('missed'), true);
  assert.strictEqual(p.getRung(), 0);
});

// A board she only finished once the red started flashing is not evidence she
// can do without it — but it is not a mistake either.
test('assisted rounds neither climb nor drop the ladder', () => {
  const p = ladder(fakeStorage());
  assert.deepStrictEqual(play(p, ['assisted', 'assisted', 'assisted', 'assisted']),
    [false, false, false, false]);
  assert.strictEqual(p.getRung(), 0);
  play(p, ['clean', 'assisted', 'clean', 'assisted', 'clean']);
  assert.strictEqual(p.getRung(), 1); // hinted boards passed through
  assert.deepStrictEqual(p.getState(), { rung: 1, hits: 0, misses: 0 });
});

test('the ladder stops at both ends instead of running off', () => {
  const p = ladder(fakeStorage(), { rungs: 3 });
  for (let i = 0; i < 30; i++) p.recordRound('clean');
  assert.strictEqual(p.getRung(), 2);
  assert.strictEqual(p.recordRound('clean'), false); // already at the top

  // One slip at the ceiling is still just one slip — it takes demoteAfter.
  assert.strictEqual(p.recordRound('missed'), false);
  assert.strictEqual(p.getRung(), 2);

  for (let i = 0; i < 30; i++) p.recordRound('missed');
  assert.strictEqual(p.getRung(), 0);
  assert.strictEqual(p.recordRound('missed'), false); // already at the bottom
});

test('a one-rung ladder never moves', () => {
  const p = ladder(fakeStorage(), { rungs: 1 });
  for (const o of ['clean', 'clean', 'clean', 'missed', 'missed', 'missed']) {
    assert.strictEqual(p.recordRound(o), false);
  }
  assert.strictEqual(p.getRung(), 0);
});

test('ladder thresholds are configurable', () => {
  const p = ladder(fakeStorage(), { promoteAfter: 2, demoteAfter: 1 });
  p.recordRound('clean');
  assert.strictEqual(p.recordRound('clean'), true);
  assert.strictEqual(p.getRung(), 1);
  assert.strictEqual(p.recordRound('missed'), true);
  assert.strictEqual(p.getRung(), 0);
});

test('the ladder rung survives a reload, and junk is ignored', () => {
  const storage = fakeStorage();
  play(ladder(storage), ['clean', 'clean', 'clean', 'clean']);
  const back = ladder(storage);
  assert.strictEqual(back.getRung(), 1);
  assert.strictEqual(back.getState().hits, 1);

  for (const raw of ['not json', 'null', '"str"', '{"rung":"three","hits":-2}', '{"rung":99}']) {
    const p = ladder(fakeStorage({ L: raw }));
    const state = p.getState();
    assert.ok(state.rung >= 0 && state.rung <= 4, raw + ' gave rung ' + state.rung);
    assert.strictEqual(state.hits, 0);
  }
  // A rung saved from a longer ladder is clamped to this one's top.
  assert.strictEqual(ladder(fakeStorage({ L: '{"rung":99}' }), { rungs: 3 }).getRung(), 2);
});

test('the ladder works with no storage at all', () => {
  const p = createLadderProgression({ storageKey: 'L', rungs: 3, storage: null });
  play(p, ['clean', 'clean']);
  assert.strictEqual(p.recordRound('clean'), true);
  assert.strictEqual(p.getRung(), 1);
});
