'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { allowedNext, isLookAlike } = require('../shared/word-logic.js');

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
