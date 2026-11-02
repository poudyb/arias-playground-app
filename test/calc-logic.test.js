'use strict';
const test = require('node:test');
const assert = require('node:assert');
const calc = require('../shared/calc-logic.js');

function pressAll(keys, rules) {
  let s = calc.emptyCalc();
  for (const k of keys) s = calc.calcPress(s, k, rules);
  return s;
}

function enabledKeys(s, rules) {
  return calc.CALC_KEYS.filter((k) => calc.isKeyEnabled(s, k, rules));
}

// A tiny seeded generator so the random walk is the same every run.
function seeded(seed) {
  let x = seed >>> 0;
  return function() {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

test('a clean screen only takes a digit: no minus first, no equals, nothing to clear', () => {
  assert.deepStrictEqual(enabledKeys(calc.emptyCalc()), calc.CALC_DIGIT_KEYS);
});

test('after one digit only plus, minus and C are on: no second digit, no equals', () => {
  const s = pressAll(['5']);
  assert.deepStrictEqual(enabledKeys(s), ['+', '-', 'C']);
  assert.strictEqual(calc.calcPress(s, '3'), s, 'a second digit does nothing');
});

test('minus only offers digits that keep the answer at zero or above', () => {
  const s = pressAll(['3', '-']);
  assert.deepStrictEqual(enabledKeys(s), ['0', '1', '2', '3', 'C']);
  const plus = pressAll(['3', '+']);
  assert.deepStrictEqual(enabledKeys(plus), calc.CALC_DIGIT_KEYS.concat(['C']));
});

test('a full sum only takes equals or C: no chaining another operator on', () => {
  const s = pressAll(['3', '+', '4']);
  assert.deepStrictEqual(enabledKeys(s), ['=', 'C']);
});

test('equals works once: it never repeats, and the answer never carries into a new sum', () => {
  const s = pressAll(['3', '+', '4', '=']);
  assert.deepStrictEqual(s, { a: 3, op: '+', b: 4, result: 7 });
  assert.strictEqual(calc.calcPress(s, '='), s);
  assert.strictEqual(calc.calcPress(s, '+'), s);
  assert.strictEqual(calc.calcPress(s, '-'), s);
  // A digit starts again from scratch, the way a calculator does.
  assert.deepStrictEqual(calc.calcPress(s, '6'), { a: 6, op: null, b: null, result: null });
});

test('C clears from anywhere once something is typed', () => {
  for (const keys of [['2'], ['2', '+'], ['2', '+', '2'], ['2', '+', '2', '=']]) {
    assert.deepStrictEqual(pressAll(keys.concat(['C'])), calc.emptyCalc());
  }
});

test('no run of key presses can make a negative, a two-digit entry or a chained sum', () => {
  const random = seeded(42);
  let s = calc.emptyCalc();
  for (let i = 0; i < 20000; i++) {
    const keys = enabledKeys(s);
    assert.ok(keys.length > 0, 'some key is always on');
    const k = keys[Math.floor(random() * keys.length)];
    const next = calc.calcPress(s, k);
    assert.notStrictEqual(next, s, k + ' was enabled, so it must do something');
    s = next;
    for (const v of [s.a, s.b]) {
      if (v != null) assert.ok(Number.isInteger(v) && v >= 0 && v <= 9, 'operand ' + v);
    }
    if (s.result != null) {
      assert.ok(s.result >= 0 && s.result <= 18, 'result ' + s.result);
      assert.strictEqual(s.result, calc.calcResult(s.a, s.op, s.b));
    }
  }
});

test('equationText and equationWords read the sum the way it is typed', () => {
  assert.strictEqual(calc.equationText(pressAll(['9', '-', '2', '='])), '9 − 2 = 7');
  assert.strictEqual(calc.equationWords(pressAll(['9', '-', '2', '='])), 'nine minus two equals seven');
  assert.strictEqual(calc.equationWords(pressAll(['9', '+'])), 'nine plus');
  assert.strictEqual(calc.equationWords(pressAll(['9', '+', '9', '='])), 'nine plus nine equals eighteen');
});

test('Make It keeps 0 off and only the rung\'s operators on', () => {
  const rules = calc.makeRules(calc.makeRung(0));
  assert.ok(!calc.isKeyEnabled(calc.emptyCalc(), '0', rules));
  assert.deepStrictEqual(enabledKeys(pressAll(['4'], rules), rules), ['+', 'C']);
  const minus = calc.makeRules(calc.makeRung(2));
  assert.deepStrictEqual(enabledKeys(pressAll(['4'], minus), minus), ['-', 'C']);
  assert.deepStrictEqual(enabledKeys(pressAll(['4', '-'], minus), minus), ['1', '2', '3', '4', 'C']);
});

test('every number on every Make It rung can be made with the keys that rung leaves on', () => {
  calc.MAKE_RUNGS.forEach((rung, i) => {
    const rules = calc.makeRules(rung);
    for (let t = rung.min; t <= rung.max; t++) {
      assert.ok(calc.solutionsFor(t, rules).length > 0, 'rung ' + i + ' cannot make ' + t);
    }
    assert.ok(typeof rung.note === 'string' && rung.note.length > 0, 'rung ' + i + ' has a parent note');
  });
});

test('following the hint from any point always ends in the number she is making', () => {
  calc.MAKE_RUNGS.forEach((rung) => {
    const rules = calc.makeRules(rung);
    for (let t = rung.min; t <= rung.max; t++) {
      // From a clean screen, and from every first digit she might have typed.
      const starts = [[]].concat(calc.CALC_DIGIT_KEYS.filter((k) => calc.isKeyEnabled(calc.emptyCalc(), k, rules)).map((k) => [k]));
      for (const prefix of starts) {
        let s = pressAll(prefix, rules);
        for (let step = 0; step < 8 && s.result == null; step++) {
          const key = calc.hintKeyFor(s, t, rules);
          assert.ok(key, 'a hint for ' + t + ' at ' + JSON.stringify(s));
          assert.ok(calc.isKeyEnabled(s, key, rules), 'the hint ' + key + ' is a key that is on');
          s = calc.calcPress(s, key, rules);
        }
        assert.strictEqual(s.result, t, 'hints from ' + prefix.join('') + ' make ' + t);
      }
    }
  });
});

test('the first hint for a number starts from the middle, not with 1', () => {
  const rules = calc.makeRules(calc.makeRung(1));
  assert.strictEqual(calc.hintKeyFor(calc.emptyCalc(), 7, rules), '3');
  assert.strictEqual(calc.hintKeyFor(pressAll(['3'], rules), 7, rules), '+');
  assert.strictEqual(calc.hintKeyFor(pressAll(['3', '+'], rules), 7, rules), '4');
  assert.strictEqual(calc.hintKeyFor(pressAll(['3', '+', '1'], rules), 7, rules), 'C');
});

test('makeTarget stays in the rung\'s range and never repeats the last number', () => {
  const random = seeded(7);
  calc.MAKE_RUNGS.forEach((rung) => {
    let prev = null;
    for (let i = 0; i < 200; i++) {
      const t = calc.makeTarget(rung, random, prev);
      assert.ok(t >= rung.min && t <= rung.max, 'target ' + t);
      assert.notStrictEqual(t, prev);
      prev = t;
    }
  });
});

test('makeRung clamps a stored rung that is out of range or junk', () => {
  assert.strictEqual(calc.makeRung(-3), calc.MAKE_RUNGS[0]);
  assert.strictEqual(calc.makeRung(99), calc.MAKE_RUNGS[calc.MAKE_RUNGS.length - 1]);
  assert.strictEqual(calc.makeRung('x'), calc.MAKE_RUNGS[0]);
});
