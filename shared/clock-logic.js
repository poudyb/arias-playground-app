// Pure clock helpers — number/time wording and the digit -> lit-segment map.
// Kept free of any DOM access so they can be unit-tested under Node and reused
// by the page script (which is loaded after this one).

// Which of the seven segments (a-g) light up for each digit 0-9.
const SEGMENTS_FOR_DIGIT = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
};

const NUMBER_WORDS_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];
// Sixty is here only so Next can say its "3:60" decoy aloud; no real time
// reaches it.
const NUMBER_WORDS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'];

function numberToWords(n) {
  if (n < 20) return NUMBER_WORDS_ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return NUMBER_WORDS_TENS[tens];
  return NUMBER_WORDS_TENS[tens] + '-' + NUMBER_WORDS_ONES[ones];
}

function timeToWords(h, m) {
  const hourPart = NUMBER_WORDS_ONES[h];
  if (m === 0) return hourPart + " o'clock";
  if (m < 10) return hourPart + ' oh ' + NUMBER_WORDS_ONES[m];
  return hourPart + ' ' + numberToWords(m);
}

function formatTwo(n) {
  return n < 10 ? '0' + n : String(n);
}

function get12Hour(date) {
  let h = date.getHours() % 12;
  if (h === 0) h = 12;
  return h;
}

// Which segments each slot of the face is built with. On a 12-hour clock the
// leading digit is only ever blank or 1, so the only segments it can ever light
// are the two on the right. The other five would sit there permanently dark —
// real LED clocks don't fit them at all, so neither do we.
// (test/clock-logic.test.js pins the "only ever 1" assumption.)
const ALL_SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const LEADING_HOUR_SEGMENTS = ['b', 'c'];
const CLOCK_SLOTS = ['h1', 'h2', 'm1', 'm2'];

function segmentsForSlot(pos) {
  return pos === 'h1' ? LEADING_HOUR_SEGMENTS : ALL_SEGMENTS;
}

function segsForDigit(value) {
  return (SEGMENTS_FOR_DIGIT[value] || []).slice();
}

// The lit segments each slot needs to show h:mm — what Match grades against.
function targetSegmentsForTime(h, m) {
  const mm = formatTwo(m);
  return {
    h1: h < 10 ? [] : segsForDigit(Math.floor(h / 10)),
    h2: segsForDigit(h % 10),
    m1: segsForDigit(Number(mm[0])),
    m2: segsForDigit(Number(mm[1]))
  };
}

// The board Match hands her at the start of each go. Filled in, every line the
// face can show is already lit and the work is taking away the ones that don't
// belong — far less to hold in your head than building a digit out of nothing.
// Otherwise she starts from a dark face and draws the time herself.
//
// A filled board is never already right: that would read 18:88, which no time
// can be (there's a test for it), so she always has something to take away.
function startingBoardSegments(filled) {
  const board = {};
  CLOCK_SLOTS.forEach(function(pos) {
    board[pos] = filled ? segmentsForSlot(pos).slice() : [];
  });
  return board;
}

// A tap worth counting against her: lighting a line the clock above doesn't
// have, or putting out one it does. Clearing a stray line and adding a missing
// one are the work itself, so neither costs her the board.
function isMistakenTap(wasLit, inTarget) {
  return wasLit === inTarget;
}

// How loudly the Match board tells her a line is in the wrong place:
// 'steady' marks it the whole time, 'nudge' only flashes it when she's stuck,
// 'none' says nothing at all. Ordered most help to least.
const MATCH_MARK_MODES = ['steady', 'nudge', 'none'];

// The ladder Match climbs, one prop removed per rung. First the board that
// arrives already filled in — recognising a line that doesn't belong is much
// easier than drawing a digit out of nothing — and then, twice over, the red
// that calls out a wrong line, until the only thing left telling her she's
// right is the chime.
//
// The rung she's on is never named to her; it shows up only as a board that
// starts differently, and in the parent summary at the end of a session.
//
// Note that rung 2 hands the steady red back at the same moment it takes the
// filled-in board away. That isn't a slip in the ordering: drawing a digit
// from a dark face is the bigger step by far, and meeting it for the first
// time with the marks switched off as well would be two new difficulties at
// once. The board she starts from outranks how the marks behave, which is the
// order the test pins.
//
// The top rung deliberately leaves her with no feedback but the chime, which
// is the outcome 9b313d3 called the harshest the mode has. What makes that
// safe here is the way down: two scrappy boards and she's back on a rung that
// flashes, so the ladder catches her rather than stranding her.
// `note` is how the end-of-session summary puts the rung to a parent; it
// rides along here so a rung can never exist without one.
const MATCH_RUNGS = [
  {
    filled: true, marks: 'steady',
    note: "Each clock starts with every line lit, and a line that doesn't belong turns red straight away."
  },
  {
    filled: true, marks: 'nudge',
    note: 'Each clock still starts with every line lit, but the red only comes if she gets stuck.'
  },
  {
    filled: false, marks: 'steady',
    note: 'She builds each clock from a dark face now, with a wrong line turning red straight away.'
  },
  {
    filled: false, marks: 'nudge',
    note: 'She builds each clock from a dark face, and the red only comes if she gets stuck.'
  },
  {
    filled: false, marks: 'none',
    note: 'She builds each clock from a dark face with no red at all — just the chime when it comes right.'
  }
];

function matchRung(level) {
  const i = typeof level === 'number' && Number.isFinite(level)
    ? Math.max(0, Math.min(Math.floor(level), MATCH_RUNGS.length - 1))
    : 0;
  return MATCH_RUNGS[i];
}

// ---- Quiz and Next rounds ------------------------------------------------
//
// Both are pick-one-of-three rounds that answer every tap straight away: the
// big red X and the buzzer for a wrong clock, sound and confetti for the right
// one. Each climbs its own ladder the way Match does (three clean rounds up,
// two scrappy ones down, a hinted round passes through), and the rung is never
// named to her — it only changes what the next round looks like. `random` is
// injectable so the tests can drive every branch.

function nextMinuteOf(h, m) {
  if (m < 59) return { h: h, m: m + 1 };
  return { h: h === 12 ? 1 : h + 1, m: 0 };
}

function digitsOf(n) {
  return String(n).split('');
}

function shareDigit(a, b) {
  const da = digitsOf(a);
  return digitsOf(b).some(function(d) { return da.indexOf(d) !== -1; });
}

function minutesShareDigit(a, b) {
  return shareDigit(formatTwo(a), formatTwo(b));
}

function randomInt(random, lo, hi) {
  return lo + Math.floor(random() * (hi - lo + 1));
}

function shuffled(arr, random) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function sameTime(a, b) {
  return a.h === b.h && a.m === b.m;
}

// Pick `count` values from `make()` that `ok` accepts and that differ from each
// other, giving up after plenty of tries rather than spinning forever.
function pickDistinct(count, make, ok) {
  const out = [];
  for (let tries = 0; out.length < count && tries < 500; tries++) {
    const v = make();
    if (ok(v) && !out.some(function(o) { return sameTime(o, v); })) out.push(v);
  }
  return out;
}

function withAnswer(answer, decoys, random) {
  return shuffled([{ h: answer.h, m: answer.m, correct: true }].concat(decoys.map(function(d) {
    return { h: d.h, m: d.m, correct: false };
  })), random);
}

// Quiz says a time and she picks the clock that shows it. It used to start
// where it now ends up, at any time of day, which asks her to turn "ten
// forty-seven" into digits before she can answer at all; a child who can't yet
// do that can only guess. So the ladder starts with the time on show as well
// as said, at o'clock, where only the hour matters — finding the same clock
// while hearing its name is how the name gets attached — and takes one prop
// away per rung.
//
//   show  - the time she's listening for is also drawn above the choices
//   times - 'oclock': on the hour, the three hours sharing no digit
//           'hour':   any minute, the hours differ (listen for the hour)
//           'minute': the same hour on all three (listen for the minutes)
const QUIZ_RUNGS = [
  {
    show: true, times: 'oclock',
    note: "Each round says an o'clock time and shows it too, so she finds the clock that looks the same."
  },
  {
    show: false, times: 'oclock',
    note: "Each round says an o'clock time, like \"three o'clock\", and she finds it by ear."
  },
  {
    show: false, times: 'hour',
    note: 'Each round says a time like "three forty-seven"; the hour is enough to pick it out.'
  },
  {
    show: false, times: 'minute',
    note: 'Each round says a time, and all three clocks share the hour, so she has to listen for the minutes.'
  }
];

function quizRung(level) {
  return clampRungOf(QUIZ_RUNGS, level);
}

function quizRound(rung, random) {
  random = random || Math.random;
  const r = typeof rung === 'object' && rung ? rung : quizRung(rung);
  const hour = function() { return randomInt(random, 1, 12); };
  const minute = function() { return randomInt(random, 0, 59); };
  let target;
  let decoys;
  if (r.times === 'oclock') {
    target = { h: hour(), m: 0 };
    // 1 and 11 o'clock, or 2 and 12, look alike at a glance — keep the hours
    // apart digit for digit so the one she heard is the only one that fits.
    decoys = pickDistinct(2, function() { return { h: hour(), m: 0 }; }, function(d) {
      return !shareDigit(d.h, target.h);
    });
  } else if (r.times === 'minute') {
    target = { h: hour(), m: minute() };
    decoys = pickDistinct(2, function() { return { h: target.h, m: minute() }; }, function(d) {
      return !minutesShareDigit(d.m, target.m);
    });
  } else {
    target = { h: hour(), m: minute() };
    decoys = pickDistinct(2, function() { return { h: hour(), m: minute() }; }, function(d) {
      return d.h !== target.h && !minutesShareDigit(d.m, target.m);
    });
  }
  return { target: target, show: r.show, opts: withAnswer(target, decoys, random) };
}

// Next shows a clock and asks which time comes after it. It used to ask about
// the real clock and give its answer when the real minute turned — up to a
// whole minute of nothing after she'd tapped, which to her looked like no
// answer at all, so she tapped something else. Now the clock in the question
// is a made-up time and every tap is answered at once; the right one makes
// the clock tick over to it.
//
//   carry - 'none':   the last digit just counts up (3:14 -> 3:15)
//           'tens':   9 rolls over into the tens (3:19 -> 3:20)
//           'hour':   :59 rolls over into the hour (3:59 -> 4:00)
//   near  - for 'none': the wrong choices are the time on show and the minute
//           before it, the two that look most like an answer, instead of
//           other numbers further along
//
// The wrong choices on a carrying rung are the mistakes the carry invites:
// 3:10 and 3:29 for 3:19 (forgot the tens, or bumped them and kept the 9),
// 3:60 and 3:00 for 3:59.
const NEXT_RUNGS = [
  {
    carry: 'none', near: false,
    note: 'Each clock just counts up by one, like 3:14 to 3:15.'
  },
  {
    carry: 'none', near: true,
    note: 'Each clock counts up by one, and the wrong choices are the same time and the minute before.'
  },
  {
    carry: 'tens', near: false,
    note: 'Each clock ends in 9, so the next minute rolls into the tens, like 3:19 to 3:20.'
  },
  {
    carry: 'hour', near: false,
    note: 'Each clock reads :59, so the next minute rolls into the next hour, like 3:59 to 4:00.'
  }
];

function nextRung(level) {
  return clampRungOf(NEXT_RUNGS, level);
}

function nextRound(rung, random) {
  random = random || Math.random;
  const r = typeof rung === 'object' && rung ? rung : nextRung(rung);
  const h = randomInt(random, 1, 12);
  let shown;
  let decoys;
  if (r.carry === 'hour') {
    shown = { h: h, m: 59 };
    decoys = [{ h: h, m: 60 }, { h: h, m: 0 }];
  } else if (r.carry === 'tens') {
    const tens = randomInt(random, 0, 4);
    shown = { h: h, m: tens * 10 + 9 };
    decoys = [{ h: h, m: tens * 10 }, { h: h, m: (tens + 1) * 10 + 9 }];
  } else if (r.near) {
    // Ones digit 1-8: there's a minute before it and the next one carries nothing.
    shown = { h: h, m: randomInt(random, 0, 5) * 10 + randomInt(random, 1, 8) };
    decoys = [{ h: h, m: shown.m }, { h: h, m: shown.m - 1 }];
  } else {
    const tens = randomInt(random, 0, 5);
    const ones = randomInt(random, 0, 8);
    shown = { h: h, m: tens * 10 + ones };
    decoys = pickDistinct(2, function() { return { h: h, m: tens * 10 + randomInt(random, 0, 9) }; }, function(d) {
      // Not the minute before, the same one, or the answer: those are the
      // next rung's choices.
      return Math.abs(d.m % 10 - ones) > 1;
    });
  }
  return { shown: shown, opts: withAnswer(nextMinuteOf(shown.h, shown.m), decoys, random) };
}

function clampRungOf(rungs, level) {
  const i = typeof level === 'number' && Number.isFinite(level)
    ? Math.max(0, Math.min(Math.floor(level), rungs.length - 1))
    : 0;
  return rungs[i];
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SEGMENTS_FOR_DIGIT,
    NUMBER_WORDS_ONES,
    NUMBER_WORDS_TENS,
    numberToWords,
    timeToWords,
    formatTwo,
    get12Hour,
    ALL_SEGMENTS,
    LEADING_HOUR_SEGMENTS,
    CLOCK_SLOTS,
    segmentsForSlot,
    segsForDigit,
    targetSegmentsForTime,
    startingBoardSegments,
    isMistakenTap,
    MATCH_MARK_MODES,
    MATCH_RUNGS,
    matchRung,
    nextMinuteOf,
    minutesShareDigit,
    QUIZ_RUNGS,
    quizRung,
    quizRound,
    NEXT_RUNGS,
    nextRung,
    nextRound
  };
}
