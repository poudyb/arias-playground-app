'use strict';
const test = require('node:test');
const assert = require('node:assert');
const clock = require('../shared/clock-logic.js');

test('numberToWords handles ones, teens, tens, and compounds', () => {
  assert.strictEqual(clock.numberToWords(0), 'zero');
  assert.strictEqual(clock.numberToWords(7), 'seven');
  assert.strictEqual(clock.numberToWords(13), 'thirteen');
  assert.strictEqual(clock.numberToWords(20), 'twenty');
  assert.strictEqual(clock.numberToWords(30), 'thirty');
  assert.strictEqual(clock.numberToWords(42), 'forty-two');
  assert.strictEqual(clock.numberToWords(59), 'fifty-nine');
});

test('timeToWords reads the clock the way a person would', () => {
  assert.strictEqual(clock.timeToWords(3, 0), "three o'clock");
  assert.strictEqual(clock.timeToWords(3, 5), 'three oh five');
  assert.strictEqual(clock.timeToWords(3, 9), 'three oh nine');
  assert.strictEqual(clock.timeToWords(12, 30), 'twelve thirty');
  assert.strictEqual(clock.timeToWords(9, 45), 'nine forty-five');
});

test('formatTwo zero-pads single digits only', () => {
  assert.strictEqual(clock.formatTwo(0), '00');
  assert.strictEqual(clock.formatTwo(5), '05');
  assert.strictEqual(clock.formatTwo(10), '10');
  assert.strictEqual(clock.formatTwo(59), '59');
});

test('get12Hour converts 24h to a 1-12 face', () => {
  assert.strictEqual(clock.get12Hour(new Date(2020, 0, 1, 0, 0)), 12); // midnight
  assert.strictEqual(clock.get12Hour(new Date(2020, 0, 1, 12, 0)), 12); // noon
  assert.strictEqual(clock.get12Hour(new Date(2020, 0, 1, 13, 0)), 1);
  assert.strictEqual(clock.get12Hour(new Date(2020, 0, 1, 23, 0)), 11);
});

test('SEGMENTS_FOR_DIGIT covers 0-9 with valid, unique segments', () => {
  const valid = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  for (let d = 0; d <= 9; d++) {
    const segs = clock.SEGMENTS_FOR_DIGIT[d];
    assert.ok(Array.isArray(segs), 'digit ' + d + ' has a segment list');
    assert.strictEqual(new Set(segs).size, segs.length, 'digit ' + d + ' has no dup segments');
    segs.forEach((s) => assert.ok(valid.has(s), 'digit ' + d + ' segment ' + s + ' is a-g'));
  }
  // Spot-check the classic shapes.
  assert.deepStrictEqual([...clock.SEGMENTS_FOR_DIGIT[1]].sort(), ['b', 'c']);
  assert.strictEqual(clock.SEGMENTS_FOR_DIGIT[8].length, 7); // 8 lights every segment
});

// The clock face builds its leading digit with only the two right-hand segments,
// which is only safe while every hour it can show needs nothing else.
test('the leading hour digit never needs more than the two right segments', () => {
  const allowed = new Set(['b', 'c']);
  for (let h = 1; h <= 12; h++) {
    if (h < 10) continue; // blank — nothing lit at all
    const tens = Math.floor(h / 10);
    assert.strictEqual(tens, 1, h + " o'clock would put " + tens + ' in the leading slot');
    for (const seg of clock.SEGMENTS_FOR_DIGIT[tens]) {
      assert.ok(allowed.has(seg), 'hour ' + h + ' needs segment ' + seg + ' in the leading slot');
    }
  }
});

test('12-hour conversion never yields an hour outside 1-12', () => {
  for (let hour = 0; hour < 24; hour++) {
    const h = clock.get12Hour(new Date(2026, 0, 1, hour, 0, 0));
    assert.ok(h >= 1 && h <= 12, hour + ':00 became ' + h);
  }
});
