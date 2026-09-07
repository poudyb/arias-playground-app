'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { dealAvoiding } = require('../shared/deal.js');

const keyOf = (item) => item.key;
const pool = (n) => Array.from({ length: n }, (_, i) => ({ key: 'w' + i }));
const keys = (items) => items.map(keyOf).sort();

test('deals the requested number of distinct items', () => {
  const picks = dealAvoiding(pool(30), 8, [], keyOf);
  assert.strictEqual(picks.length, 8);
  assert.strictEqual(new Set(keys(picks)).size, 8);
});

test('never repeats an item from the previous board when the pool allows it', () => {
  const deck = pool(30);
  let last = [];
  for (let round = 0; round < 200; round++) {
    const picks = dealAvoiding(deck, 8, last, keyOf);
    assert.strictEqual(picks.length, 8);
    for (const p of picks) {
      assert.ok(!last.includes(p.key), p.key + ' was on the previous board too');
    }
    last = picks.map(keyOf);
  }
});

test('tops up from the previous board only when the pool is too small, repeating as few as possible', () => {
  const deck = pool(10);
  const last = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];
  const picks = dealAvoiding(deck, 8, last, keyOf);
  assert.strictEqual(picks.length, 8);
  assert.strictEqual(new Set(keys(picks)).size, 8);
  // Both fresh items must be in; exactly six carry over.
  const picked = keys(picks);
  assert.ok(picked.includes('w8') && picked.includes('w9'));
  assert.strictEqual(picked.filter((k) => last.includes(k)).length, 6);
});

test('a pinned random source makes the deal deterministic', () => {
  const rand = () => 0;
  const a = dealAvoiding(pool(12), 4, ['w0'], keyOf, rand);
  const b = dealAvoiding(pool(12), 4, ['w0'], keyOf, rand);
  assert.deepStrictEqual(keys(a), keys(b));
  assert.ok(!keys(a).includes('w0'));
});

test('tolerates a missing avoid list', () => {
  assert.strictEqual(dealAvoiding(pool(5), 3, undefined, keyOf).length, 3);
  assert.strictEqual(dealAvoiding(pool(5), 3, null, keyOf).length, 3);
});
