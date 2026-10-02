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

test('segmentsForSlot gives each slot the segments it is built with', () => {
  assert.deepStrictEqual(clock.segmentsForSlot('h1'), ['b', 'c']);
  ['h2', 'm1', 'm2'].forEach((pos) => {
    assert.deepStrictEqual(clock.segmentsForSlot(pos), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});

test('targetSegmentsForTime lights the slots that spell the time', () => {
  const nine30 = clock.targetSegmentsForTime(9, 30);
  assert.deepStrictEqual(nine30.h1, []); // single-digit hour leaves the tens dark
  assert.deepStrictEqual(nine30.h2, clock.SEGMENTS_FOR_DIGIT[9]);
  assert.deepStrictEqual(nine30.m1, clock.SEGMENTS_FOR_DIGIT[3]);
  assert.deepStrictEqual(nine30.m2, clock.SEGMENTS_FOR_DIGIT[0]);

  const twelve05 = clock.targetSegmentsForTime(12, 5);
  assert.deepStrictEqual(twelve05.h1, clock.SEGMENTS_FOR_DIGIT[1]);
  assert.deepStrictEqual(twelve05.h2, clock.SEGMENTS_FOR_DIGIT[2]);
  assert.deepStrictEqual(twelve05.m1, clock.SEGMENTS_FOR_DIGIT[0]); // 05, not 5
  assert.deepStrictEqual(twelve05.m2, clock.SEGMENTS_FOR_DIGIT[5]);
});

test('a target can be edited without corrupting the digit map', () => {
  clock.targetSegmentsForTime(9, 30).h2.push('nonsense');
  assert.deepStrictEqual(clock.targetSegmentsForTime(9, 30).h2, clock.SEGMENTS_FOR_DIGIT[9]);
  assert.strictEqual(clock.SEGMENTS_FOR_DIGIT[9].indexOf('nonsense'), -1);
});

test('the filled Match board lights every line each slot can show', () => {
  const filled = clock.startingBoardSegments(true);
  assert.deepStrictEqual(Object.keys(filled).sort(), ['h1', 'h2', 'm1', 'm2']);
  clock.CLOCK_SLOTS.forEach((pos) => {
    assert.deepStrictEqual(filled[pos], clock.segmentsForSlot(pos));
  });
  filled.m1.pop(); // editing a board must not shorten the shared slot list
  assert.strictEqual(clock.segmentsForSlot('m1').length, 7);
});

test('the blank Match board starts every slot dark', () => {
  const blank = clock.startingBoardSegments(false);
  clock.CLOCK_SLOTS.forEach((pos) => assert.deepStrictEqual(blank[pos], []));
});

// The filled board reads 18:88, so she always has lines to take away — no time
// can hand her a board that is already right and rob her of the puzzle.
test('no time is ever already showing on a filled Match board', () => {
  const filled = clock.startingBoardSegments(true);
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m++) {
      const target = clock.targetSegmentsForTime(h, m);
      const solved = clock.CLOCK_SLOTS.every((pos) =>
        target[pos].length === filled[pos].length &&
        target[pos].every((seg) => filled[pos].indexOf(seg) !== -1));
      assert.ok(!solved, h + ':' + clock.formatTwo(m) + ' starts out already matched');
    }
  }
});

test('isMistakenTap counts adding a stray line and clearing a needed one', () => {
  assert.strictEqual(clock.isMistakenTap(false, false), true);  // lit one that doesn't belong
  assert.strictEqual(clock.isMistakenTap(true, true), true);    // cleared one that does
  assert.strictEqual(clock.isMistakenTap(true, false), false);  // cleared a stray — the work
  assert.strictEqual(clock.isMistakenTap(false, true), false);  // lit a missing one — the work
});

// The whole point of the ladder is that it only ever gets harder as it climbs.
// A rung that quietly handed something back would let her bounce between two
// settings forever without the streaks ever meaning anything.
test('every Match rung takes support away and never gives it back', () => {
  const rungs = clock.MATCH_RUNGS;
  assert.ok(rungs.length >= 2, 'a ladder needs rungs to climb');

  assert.strictEqual(rungs[0].filled, true, 'the bottom rung fills the board in');
  assert.strictEqual(rungs[0].marks, 'steady', 'the bottom rung marks wrong lines outright');
  const top = rungs[rungs.length - 1];
  assert.strictEqual(top.filled, false, 'the top rung starts from a dark face');
  assert.strictEqual(top.marks, 'none', 'the top rung marks nothing at all');

  // How much the board is doing for her, ranked the way the ladder is built:
  // the starting board outranks the marks, so a rung may hand the red back at
  // the moment it takes the filled-in board away (rung 2 does exactly that),
  // but the total must still come down at every single step.
  const support = (r) => (r.filled ? 10 : 0) +
    (clock.MATCH_MARK_MODES.length - 1 - clock.MATCH_MARK_MODES.indexOf(r.marks));

  for (let i = 1; i < rungs.length; i++) {
    assert.ok(support(rungs[i]) < support(rungs[i - 1]),
      'rung ' + i + ' is no harder than rung ' + (i - 1) +
      ' (' + support(rungs[i - 1]) + ' -> ' + support(rungs[i]) + ')');
  }
});

test('matchRung clamps anything that is not a rung to the easiest one', () => {
  assert.deepStrictEqual(clock.matchRung(0), clock.MATCH_RUNGS[0]);
  assert.deepStrictEqual(clock.matchRung(2), clock.MATCH_RUNGS[2]);
  assert.deepStrictEqual(clock.matchRung(99), clock.MATCH_RUNGS[clock.MATCH_RUNGS.length - 1]);
  for (const junk of [-1, undefined, null, NaN, 'two', {}]) {
    assert.deepStrictEqual(clock.matchRung(junk), clock.MATCH_RUNGS[0]);
  }
});

test('every rung is drawable and has something to tell a parent', () => {
  const notes = new Set();
  clock.MATCH_RUNGS.forEach((rung, i) => {
    assert.ok(clock.MATCH_MARK_MODES.indexOf(rung.marks) !== -1, 'rung ' + i + ' mark mode');
    assert.strictEqual(typeof rung.filled, 'boolean', 'rung ' + i + ' board');
    assert.ok(typeof rung.note === 'string' && rung.note.length > 0, 'rung ' + i + ' note');
    notes.add(rung.note);
  });
  // Two rungs sharing a note would leave a parent unable to tell them apart.
  assert.strictEqual(notes.size, clock.MATCH_RUNGS.length, 'every rung reads differently');
});

// ---- Quiz and Next rounds ------------------------------------------------

// A seeded generator, so a failing round can be replayed.
function seeded(seed) {
  let x = seed >>> 0 || 1;
  return function() {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function eachRound(rungs, make, check) {
  rungs.forEach((rung, i) => {
    for (let seed = 1; seed <= 400; seed++) check(make(i, seeded(seed * 7919 + i)), rung, i);
  });
}

function assertThreeDistinctWithOneAnswer(opts, where) {
  assert.strictEqual(opts.length, 3, where + ': three choices');
  assert.strictEqual(opts.filter((o) => o.correct).length, 1, where + ': exactly one right answer');
  const keys = new Set(opts.map((o) => o.h + ':' + o.m));
  assert.strictEqual(keys.size, 3, where + ': no two choices the same');
}

test('nextMinuteOf rolls minutes into hours and 12 round to 1', () => {
  assert.deepStrictEqual(clock.nextMinuteOf(3, 14), { h: 3, m: 15 });
  assert.deepStrictEqual(clock.nextMinuteOf(3, 59), { h: 4, m: 0 });
  assert.deepStrictEqual(clock.nextMinuteOf(12, 59), { h: 1, m: 0 });
});

test('every Quiz round has one answer, the one it says, and decoys that fit the rung', () => {
  eachRound(clock.QUIZ_RUNGS, clock.quizRound, (round, rung, i) => {
    const where = 'quiz rung ' + i + ' ' + JSON.stringify(round);
    assertThreeDistinctWithOneAnswer(round.opts, where);
    const answer = round.opts.find((o) => o.correct);
    assert.deepStrictEqual({ h: answer.h, m: answer.m }, round.target, where);
    assert.strictEqual(round.show, rung.show, where);
    round.opts.forEach((o) => {
      assert.ok(o.h >= 1 && o.h <= 12 && o.m >= 0 && o.m <= 59, where + ': a real time');
    });
    const decoys = round.opts.filter((o) => !o.correct);
    decoys.forEach((d) => {
      if (rung.times === 'oclock') {
        assert.strictEqual(d.m, 0, where + ': on the hour');
        assert.ok(!String(d.h).split('').some((c) => String(round.target.h).includes(c)),
          where + ': o\'clock hours share no digit');
      } else if (rung.times === 'minute') {
        assert.strictEqual(d.h, round.target.h, where + ': same hour');
        assert.ok(!clock.minutesShareDigit(d.m, round.target.m), where + ': minutes share no digit');
      } else {
        assert.notStrictEqual(d.h, round.target.h, where + ': different hour');
      }
    });
  });
});

test('every Next round answers with the minute after the clock it shows', () => {
  eachRound(clock.NEXT_RUNGS, clock.nextRound, (round, rung, i) => {
    const where = 'next rung ' + i + ' ' + JSON.stringify(round);
    assertThreeDistinctWithOneAnswer(round.opts, where);
    const answer = round.opts.find((o) => o.correct);
    assert.deepStrictEqual({ h: answer.h, m: answer.m }, clock.nextMinuteOf(round.shown.h, round.shown.m), where);
    const { m } = round.shown;
    if (rung.carry === 'none') assert.notStrictEqual(m % 10, 9, where + ': nothing to carry');
    if (rung.carry === 'tens') assert.ok(m % 10 === 9 && m !== 59, where + ': rolls into the tens');
    if (rung.carry === 'hour') assert.strictEqual(m, 59, where + ': rolls into the hour');
    const decoys = round.opts.filter((o) => !o.correct);
    if (rung.carry === 'none' && rung.near) {
      assert.ok(decoys.some((d) => d.m === m), where + ': the same time is a choice');
      assert.ok(decoys.some((d) => d.m === m - 1), where + ': the minute before is a choice');
    }
    if (rung.carry === 'none' && !rung.near) {
      decoys.forEach((d) => assert.ok(Math.abs(d.m % 10 - m % 10) > 1, where + ': not next door'));
    }
  });
});

test('the Quiz and Next ladders start easiest and each have a note for every rung', () => {
  assert.strictEqual(clock.QUIZ_RUNGS[0].show, true, 'Quiz starts with the time on show');
  assert.strictEqual(clock.QUIZ_RUNGS[0].times, 'oclock', 'Quiz starts on the hour');
  assert.strictEqual(clock.NEXT_RUNGS[0].carry, 'none', 'Next starts with nothing to carry');
  [clock.QUIZ_RUNGS, clock.NEXT_RUNGS].forEach((rungs) => {
    const notes = new Set(rungs.map((r) => r.note));
    assert.strictEqual(notes.size, rungs.length, 'every rung reads differently to a parent');
  });
  assert.deepStrictEqual(clock.quizRung(99), clock.QUIZ_RUNGS[clock.QUIZ_RUNGS.length - 1]);
  assert.deepStrictEqual(clock.nextRung('two'), clock.NEXT_RUNGS[0]);
});

test('Next can say its 3:60 decoy aloud', () => {
  assert.strictEqual(clock.timeToWords(3, 60), 'three sixty');
});
