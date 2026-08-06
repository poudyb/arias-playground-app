'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  NUMBERS_CHASE_MAX_DIFFICULTY,
  numbersChaseHighest,
  numbersChaseParams,
  numbersChaseItemWeight
} = require('../data/numbers.js');

test('numbers chase keeps 0 through 9 as its starting review pool', () => {
  assert.strictEqual(numbersChaseHighest(0), 9);
  assert.strictEqual(numbersChaseHighest(1), 9);
});

test('numbers chase adds one possible value every two successful rounds', () => {
  assert.deepStrictEqual([2, 3, 4, 5, 6, 7].map(numbersChaseHighest), [10, 10, 11, 11, 12, 12]);
});

test('numbers chase reaches twenty and keeps the full pool', () => {
  assert.strictEqual(NUMBERS_CHASE_MAX_DIFFICULTY, 22);
  assert.strictEqual(numbersChaseHighest(NUMBERS_CHASE_MAX_DIFFICULTY), 20);
});

test('number range adds more targets without making them faster or smaller', () => {
  assert.deepStrictEqual(numbersChaseParams(0), { count: 3, speed: 100, fontSize: 15 });
  assert.deepStrictEqual(numbersChaseParams(2), { count: 4, speed: 100, fontSize: 15 });
  assert.deepStrictEqual(numbersChaseParams(4), { count: 5, speed: 100, fontSize: 15 });
  assert.deepStrictEqual(numbersChaseParams(NUMBERS_CHASE_MAX_DIFFICULTY), {
    count: 8,
    speed: 100,
    fontSize: 15
  });
});

test('numbers chase gives single-digit distractors twice the weight', () => {
  assert.strictEqual(numbersChaseItemWeight('0'), 2);
  assert.strictEqual(numbersChaseItemWeight('9'), 2);
  assert.strictEqual(numbersChaseItemWeight('10'), 1);
  assert.strictEqual(numbersChaseItemWeight('20'), 1);
});
