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
const NUMBER_WORDS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

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
    matchRung
  };
}
