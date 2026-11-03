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

const DIGITS = calc.CALC_DIGIT_KEYS;

test('there is no 0 and no C; = is the only key besides numbers, plus and minus', () => {
  assert.deepStrictEqual(calc.CALC_KEYS, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '=']);
});

test('a clean screen only takes a number: no minus first, no equals', () => {
  assert.deepStrictEqual(enabledKeys(calc.emptyCalc()), DIGITS);
});

test('after one number only plus and minus are on: no second number, no swapping it', () => {
  const s = pressAll(['5']);
  assert.deepStrictEqual(enabledKeys(s), ['+', '-']);
  assert.strictEqual(calc.calcPress(s, '3'), s, '5 then 3 does nothing: never 3, never fifty-three');
});

test('minus needs something left over: off after 1, and only smaller numbers after it', () => {
  assert.deepStrictEqual(enabledKeys(pressAll(['1'])), ['+']);
  assert.deepStrictEqual(enabledKeys(pressAll(['4', '-'])), ['1', '2', '3']);
  assert.deepStrictEqual(enabledKeys(pressAll(['4', '+'])), DIGITS);
});

test('a whole sum lights only equals, and equals gives the answer', () => {
  const s = pressAll(['3', '+', '4']);
  assert.deepStrictEqual(s, { a: 3, op: '+', b: 4, result: null });
  assert.deepStrictEqual(enabledKeys(s), ['=']);
  assert.deepStrictEqual(calc.calcPress(s, '='), { a: 3, op: '+', b: 4, result: 7 });
  assert.deepStrictEqual(pressAll(['9', '-', '2', '=']), { a: 9, op: '-', b: 2, result: 7 });
});

test('equals works once: it never repeats, and nothing chains on; a number starts afresh', () => {
  const s = pressAll(['3', '+', '4', '=']);
  assert.deepStrictEqual(enabledKeys(s), DIGITS);
  for (const k of ['=', '+', '-']) assert.strictEqual(calc.calcPress(s, k), s, k + ' after the answer');
  assert.deepStrictEqual(calc.calcPress(s, '6'), { a: 6, op: null, b: null, result: null });
});

test('an operator can\'t be pressed twice or swapped once chosen', () => {
  const s = pressAll(['5', '+']);
  assert.strictEqual(calc.calcPress(s, '+'), s);
  assert.strictEqual(calc.calcPress(s, '-'), s);
});

test('no run of key presses can make zero, a negative, a two-digit entry or a chained sum', () => {
  const random = seeded(42);
  const ruleSets = [calc.FREE_RULES];
  calc.MAKE_RUNGS.forEach((rung) => {
    for (let t = rung.min; t <= rung.max; t++) ruleSets.push(calc.makeRules(rung, t));
  });
  for (const rules of ruleSets) {
    let s = calc.emptyCalc();
    for (let i = 0; i < 400; i++) {
      const keys = enabledKeys(s, rules);
      assert.ok(keys.length > 0, 'some key is always on: ' + JSON.stringify(s) + ' ' + JSON.stringify(rules));
      const k = keys[Math.floor(random() * keys.length)];
      const next = calc.calcPress(s, k, rules);
      assert.notStrictEqual(next, s, k + ' was enabled, so it must do something');
      s = next;
      for (const v of [s.a, s.b]) {
        if (v != null) assert.ok(Number.isInteger(v) && v >= 1 && v <= 9, 'operand ' + v);
      }
      if (s.result != null) {
        assert.ok(s.result >= 1 && s.result <= 18, 'result ' + s.result);
        assert.strictEqual(s.result, calc.calcResult(s.a, s.op, s.b));
      }
    }
  }
});

test('equationText and equationWords read the sum the way it is typed', () => {
  assert.strictEqual(calc.equationText(pressAll(['9', '-', '2', '='])), '9 − 2 = 7');
  assert.strictEqual(calc.equationWords(pressAll(['9', '-', '2', '='])), 'nine minus two equals seven');
  assert.strictEqual(calc.equationWords(pressAll(['9', '+'])), 'nine plus');
  assert.strictEqual(calc.equationWords(pressAll(['9', '+', '2'])), 'nine plus two');
  assert.strictEqual(calc.equationWords(pressAll(['9', '+', '9', '='])), 'nine plus nine equals eighteen');
});

test('Quiz only turns on the rung\'s operators, and no number is a dead end', () => {
  const rules = calc.makeRules(calc.makeRung(0));
  assert.deepStrictEqual(enabledKeys(pressAll(['4'], rules), rules), ['+']);
  const minus = calc.makeRules(calc.makeRung(2));
  assert.deepStrictEqual(enabledKeys(calc.emptyCalc(), minus), DIGITS.slice(1),
    'on a minus-only rung 1 has nothing it can take away, so it is off');
  assert.deepStrictEqual(enabledKeys(pressAll(['4'], minus), minus), ['-']);
  assert.deepStrictEqual(enabledKeys(pressAll(['4', '-'], minus), minus), ['1', '2', '3']);
});

test('every number on every Quiz rung can be made with the keys that rung leaves on', () => {
  calc.MAKE_RUNGS.forEach((rung, i) => {
    const rules = calc.makeRules(rung);
    for (let t = rung.min; t <= rung.max; t++) {
      assert.ok(calc.solutionsFor(t, rules).length > 0, 'rung ' + i + ' cannot make ' + t);
    }
    assert.ok(typeof rung.note === 'string' && rung.note.length > 0, 'rung ' + i + ' has a parent note');
  });
});

test('following the hint from any point that can still get there ends in the number', () => {
  calc.MAKE_RUNGS.forEach((rung) => {
    for (let t = rung.min; t <= rung.max; t++) {
      const rules = calc.makeRules(rung, t);
      // From a clean screen, and from every first number that can still make t.
      const starts = [[]].concat(DIGITS.map((k) => [k]).filter((p) => {
        const s = pressAll(p, rules);
        return s.a != null && calc.solutionsFor(t, rules).some((x) => x.a === s.a);
      }));
      for (const prefix of starts) {
        let s = pressAll(prefix, rules);
        for (let step = 0; step < 6 && s.result == null; step++) {
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
  const rules = calc.makeRules(calc.makeRung(1), 7);
  assert.strictEqual(calc.hintKeyFor(calc.emptyCalc(), 7, rules), '3');
  assert.strictEqual(calc.hintKeyFor(pressAll(['3'], rules), 7, rules), '+');
  assert.strictEqual(calc.hintKeyFor(pressAll(['3', '+'], rules), 7, rules), '4');
  assert.strictEqual(calc.hintKeyFor(pressAll(['3', '+', '4'], rules), 7, rules), '=');
  // Nothing can be undone, so once a sum can't get there there's nothing to point at.
  assert.strictEqual(calc.hintKeyFor(pressAll(['9'], rules), 7, rules), null);
  assert.strictEqual(calc.hintKeyFor(pressAll(['3', '+', '1'], rules), 7, rules), null);
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

test('in Quiz the number to make can\'t start a sum, but is on once a sum has started', () => {
  const plus = calc.makeRules(calc.makeRung(1), 5);
  assert.ok(!calc.isKeyEnabled(calc.emptyCalc(), '5', plus), 'not as the first number');
  assert.ok(calc.isKeyEnabled(pressAll(['2', '+'], plus), '5', plus), 'as the second number it is hers to choose');
  const both = calc.makeRules(calc.makeRung(3), 3);
  assert.ok(!calc.isKeyEnabled(calc.emptyCalc(), '3', both));
  assert.ok(calc.isKeyEnabled(pressAll(['6', '-'], both), '3', both));
  // and after a finished sum, starting the next one
  assert.ok(!calc.isKeyEnabled(pressAll(['2', '+', '3', '='], plus), '5', plus));
  // Free Play has no target, so nothing extra is off
  assert.ok(calc.isKeyEnabled(calc.emptyCalc(), '5'));
});

test('the target being off never removes a right answer', () => {
  calc.MAKE_RUNGS.forEach((rung) => {
    for (let t = rung.min; t <= rung.max; t++) {
      const rules = calc.makeRules(rung, t);
      for (const sol of calc.solutionsFor(t, rules)) {
        const keys = [String(sol.a), sol.op, String(sol.b), '='];
        let s = calc.emptyCalc();
        for (const k of keys) {
          assert.ok(calc.isKeyEnabled(s, k, rules), sol.a + sol.op + sol.b + ' needs ' + k + ' on');
          s = calc.calcPress(s, k, rules);
        }
        assert.strictEqual(s.result, t);
      }
    }
  });
});
