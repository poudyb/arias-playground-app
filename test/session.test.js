'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isValidIndex, isValidIndexArray } = require('../shared/session.js');

test('isValidIndex accepts in-range integers only', () => {
  assert.strictEqual(isValidIndex(0, 3), true);
  assert.strictEqual(isValidIndex(2, 3), true);
  assert.strictEqual(isValidIndex(3, 3), false); // out of range (==poolSize)
  assert.strictEqual(isValidIndex(-1, 3), false);
  assert.strictEqual(isValidIndex('1', 3), false); // not a number
});

test('isValidIndexArray checks length and every element', () => {
  assert.strictEqual(isValidIndexArray([0, 1, 2], 3, 5), true);
  assert.strictEqual(isValidIndexArray([0, 1], 3, 5), false); // wrong length
  assert.strictEqual(isValidIndexArray([0, 9, 2], 3, 5), false); // 9 out of range
  assert.strictEqual(isValidIndexArray('nope', 3, 5), false); // not an array
});
