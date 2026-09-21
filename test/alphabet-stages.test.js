'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { LEARNING_SYMBOLS_CONFIG } = require('../data/alphabet.js');

const { items, caseProgression } = LEARNING_SYMBOLS_CONFIG;

test('the lowercase stages cover every letter exactly once', () => {
  const staged = [].concat(...caseProgression.stages);
  assert.deepStrictEqual([...staged].sort(), [...items].sort());
  assert.strictEqual(new Set(staged).size, items.length);
});

test('stages open a few letters at a time, easiest look-alikes first', () => {
  const sizes = caseProgression.stages.map((stage) => stage.length);
  assert.ok(sizes.every((n) => n >= 2 && n <= 8), 'each group is small: ' + sizes);
  const shrunkenCapitals = 'COSVWXZ'.split('');
  assert.deepStrictEqual(caseProgression.stages[0], shrunkenCapitals);
  const mirrorPairs = caseProgression.stages[caseProgression.stages.length - 1];
  assert.ok(['B', 'D'].every((ch) => mirrorPairs.includes(ch)), 'b/d come last');
});

test('pairText puts the small twin beside the capital', () => {
  assert.strictEqual(caseProgression.pairText('A'), 'Aa');
  assert.strictEqual(caseProgression.pairText('Q'), 'Qq');
});
