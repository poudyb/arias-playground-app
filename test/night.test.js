'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isNightHour } = require('../shared/night.js');

test('night runs from 7pm until 7am', () => {
  const night = [];
  for (let hour = 0; hour < 24; hour++) if (isNightHour(hour)) night.push(hour);
  assert.deepStrictEqual(night, [0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 23]);
});
