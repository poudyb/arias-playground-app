// The calculator's rules, kept apart from the page so they can be unit-tested.
//
// A real calculator does whatever it is told, and most of what a small child
// tells it turns into something she can't read: a minus pressed first makes a
// negative number, 3 - 5 makes another one, 5 then 3 makes fifty-three, and
// pressing = again repeats the last sum. This one only ever does one thing — a
// number, plus or minus, a number, equals — and at every step only the keys
// for that step are lit. Everything else is switched off (and drawn greyed
// out) rather than left to do something surprising.
//
//   start  - nothing typed           numbers on
//   first  - "3"                     + and - on, nothing else: no second
//                                    number, and no swapping the first one
//   op     - "3 +"                   numbers on (for minus, only those under 3)
//                                    — no swapping the operator either
//   second - "3 + 4"                 only = on
//   done   - "3 + 4 = 7"             numbers on, starting a fresh sum; + and -,
//                                    carrying on from 7; and in Free Play C,
//                                    which just wipes the screen (Quiz has no
//                                    C: it moves on by itself)
//
// Every press counts and nothing can be undone. Pressing number after number,
// each replacing the last, was a game of its own that never got to a sum. =
// is the one key lit once a sum is whole, so it's a step she goes through
// rather than one she has to know about; and it's lit only there, so there's
// no pressing it again to repeat the sum.
//
// Carrying on is what a real calculator does with a plus after the answer, and
// she reached for it: in front of "3 + 4 = 7" she pressed minus, then plus.
// The answer becomes the first number of the next sum, so a first number can
// be anything up to 18, though every key she presses is still 1 to 9.
//
// Every answer is 1 to 18: that is what the dots can show and as far as her
// number words go. There is no 0. Zero is a concept for later, and minus never
// goes to zero either: 5 - 5 is off.
//
// C is only ever on once a sum is finished. The old C was on all the time: it
// was the key she pressed most, and it only ever took her backwards. Without
// one, a number pressed after the answer started the next sum, but sitting in
// front of "3 + 4 = 7" with plus and minus grey she didn't always see that,
// and tried minus, then plus. So the finished sum has a C, glowing as the next
// step the way = does, but a number still works too: she was used to that,
// and it's no less a way on. C means "next sum", never "undo".

const CALC_DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const CALC_OP_KEYS = ['+', '-'];
const CALC_CLEAR_KEY = 'C';
const CALC_KEYS = CALC_DIGIT_KEYS.concat(CALC_OP_KEYS, ['=', CALC_CLEAR_KEY]);

// Free Play: everything a single-digit sum can use, and C to move on from the
// answer. Quiz's rules (makeRules) have no `clear`: it wipes the screen itself.
const FREE_RULES = { ops: ['+', '-'], clear: true };

const CALC_NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen'
];
const CALC_MAX_RESULT = CALC_NUMBER_WORDS.length - 1;

function emptyCalc() {
  return { a: null, op: null, b: null, result: null };
}

function calcPhase(s) {
  if (s.result != null) return 'done';
  if (s.b != null) return 'second';
  if (s.op != null) return 'op';
  if (s.a != null) return 'first';
  return 'start';
}

function digitOfKey(key) {
  const i = CALC_DIGIT_KEYS.indexOf(key);
  return i === -1 ? null : i + 1;
}

function calcResult(a, op, b) {
  return op === '-' ? a - b : a + b;
}

function opAllowed(op, rules) {
  return !rules.ops || rules.ops.indexOf(op) !== -1;
}

// Whether a sum may come out at `result`: 1 to 18, and in a Quiz round that
// can only go one way, never past the number she's making in the direction
// she couldn't come back from. With no minus, a key that would take her past
// it is off, the same way the number itself is off as a first number.
function resultAllowed(result, rules) {
  if (result < 1 || result > CALC_MAX_RESULT) return false;
  if (rules.target == null) return true;
  if (!opAllowed('-', rules) && result > rules.target) return false;
  if (!opAllowed('+', rules) && result < rules.target) return false;
  return true;
}

function secondNumberAllowed(a, op, b, rules) {
  return resultAllowed(calcResult(a, op, b), rules);
}

// Whether `op` can follow `a`, the first number or the answer carried on from:
// some second number has to leave the sum somewhere it's allowed to be.
function opCanFollow(op, a, rules) {
  if (!opAllowed(op, rules)) return false;
  return CALC_DIGIT_KEYS.some(function(key) { return secondNumberAllowed(a, op, digitOfKey(key), rules); });
}

function isKeyEnabled(s, key, rules) {
  rules = rules || FREE_RULES;
  const phase = calcPhase(s);
  if (key === CALC_CLEAR_KEY) return phase === 'done' && !!rules.clear;
  if (key === '=') return phase === 'second';
  if (key === '+' || key === '-') return isOpEnabled(s, phase, key, rules);
  const d = digitOfKey(key);
  return d != null && isDigitEnabled(s, phase, d, rules);
}

// An operator follows a first number, or carries on from an answer.
function isOpEnabled(s, phase, op, rules) {
  if (phase === 'first') return opCanFollow(op, s.a, rules);
  if (phase === 'done') return opCanFollow(op, s.result, rules);
  return false;
}

function isDigitEnabled(s, phase, d, rules) {
  if (phase === 'op') return secondNumberAllowed(s.a, s.op, d, rules);
  if (phase !== 'start' && phase !== 'done') return false;
  // In Quiz, the number she's asked to make (`rules.target`) can't start a sum:
  // with no 0 to add or take away, a sum that starts with it can never come
  // out right, and pressing the number she'd just been told was the one thing
  // she did. Only as the first number — once a sum is started, the second
  // number is hers to choose like any other.
  if (rules.target != null && d === rules.target) return false;
  // A first number is on only if some operator can follow it, so a number is
  // never a dead end (on a minus-only rung, 1 has nothing it can take away).
  return CALC_OP_KEYS.some(function(op) { return opCanFollow(op, d, rules); });
}

// The state after pressing `key`. A key that isn't enabled hands back the very
// same object, so the page can tell nothing happened.
function calcPress(s, key, rules) {
  if (!isKeyEnabled(s, key, rules)) return s;
  if (key === CALC_CLEAR_KEY) return emptyCalc();
  if (key === '=') return { a: s.a, op: s.op, b: s.b, result: calcResult(s.a, s.op, s.b) };
  if (key === '+' || key === '-') {
    const from = calcPhase(s) === 'done' ? s.result : s.a;
    return { a: from, op: key, b: null, result: null };
  }
  const d = digitOfKey(key);
  if (calcPhase(s) === 'op') return { a: s.a, op: s.op, b: d, result: null };
  return { a: d, op: null, b: null, result: null };
}

// "3 + 4 = 7", with a real minus sign, for the parent's summary.
function equationText(s) {
  const parts = [];
  if (s.a != null) parts.push(String(s.a));
  if (s.op) parts.push(s.op === '-' ? '\u2212' : '+');
  if (s.b != null) parts.push(String(s.b));
  if (s.result != null) parts.push('=', String(s.result));
  return parts.join(' ');
}

// What she hears: "three plus four equals seven", or as much of it as is typed.
function equationWords(s) {
  const parts = [];
  if (s.a != null) parts.push(CALC_NUMBER_WORDS[s.a]);
  if (s.op) parts.push(s.op === '-' ? 'minus' : 'plus');
  if (s.b != null) parts.push(CALC_NUMBER_WORDS[s.b]);
  if (s.result != null) parts.push('equals', CALC_NUMBER_WORDS[s.result]);
  return parts.join(' ');
}

// ---- Quiz ---------------------------------------------------------------
//
// A number to make, and the calculator to make it with: "Make 7!" — 3 + 4, or
// 9 - 2, or any other way she finds. The finished sum is her answer, so a wrong
// one gets the big red X like any other quiz.
//
// It climbs a ladder the way the clock's Quiz does — three clean rounds up,
// two with a miss down, a hinted round passes through — and the rung is never
// named to her; the next number just asks a bit more.
//
//   ops   - which of + and - are switched on
//   min/max - the range the number to make comes from
//   rings - the number is also drawn as that many empty circles, which her
//           dots drop into when she presses =, so she can see it fit (or a
//           gap, or one left over) before anyone says so
const MAKE_RUNGS = [
  {
    ops: ['+'], min: 2, max: 5, rings: true,
    note: 'She makes numbers up to 5 with plus, and the number is drawn as circles for her dots to fill.'
  },
  {
    ops: ['+'], min: 2, max: 9, rings: true,
    note: 'She makes numbers up to 9 with plus, with circles to fill.'
  },
  {
    ops: ['-'], min: 1, max: 5, rings: true,
    note: 'She makes small numbers with minus: start with more, take some away. Circles to fill.'
  },
  {
    ops: ['+', '-'], min: 1, max: 9, rings: true,
    note: 'Plus and minus are both on, so she picks which to use. Circles to fill.'
  },
  {
    ops: ['+', '-'], min: 1, max: 9, rings: false,
    note: 'Plus or minus, making numbers up to 9 from the number alone, with no circles to fill.'
  },
  {
    ops: ['+'], min: 10, max: 18, rings: false,
    note: 'She makes the big numbers, 10 to 18, with two digits that add up past ten.'
  }
];

function makeRung(level) {
  const i = typeof level === 'number' && Number.isFinite(level)
    ? Math.max(0, Math.min(Math.floor(level), MAKE_RUNGS.length - 1))
    : 0;
  return MAKE_RUNGS[i];
}

// The keys a Quiz round leaves on: the rung's operators, and `target`, the
// number to make (see isKeyEnabled).
function makeRules(rung, target) {
  return { ops: rung.ops.slice(), target: typeof target === 'number' ? target : null };
}

// Every sum the keys allow that comes out at `target`, smallest first number
// first, plus before minus.
function solutionsFor(target, rules) {
  const out = [];
  for (let a = 1; a <= 9; a++) {
    CALC_OP_KEYS.forEach(function(op) {
      if (!opAllowed(op, rules)) return;
      for (let b = 1; b <= 9; b++) {
        if (secondNumberAllowed(a, op, b, rules) && calcResult(a, op, b) === target) out.push({ a: a, op: op, b: b });
      }
    });
  }
  return out;
}

function middleOf(list) {
  return list[Math.floor((list.length - 1) / 2)];
}

// The one key to glow when she's stuck: the next press along the shortest way
// to a finished sum that makes the target, picking up from whatever she has
// typed. A sum short of the number carries on toward it; one that went past,
// on a rung with both operators, comes back. Null only when nothing gets
// there.
//
// From a clean screen it starts from the middle of the list rather than the
// end, so the hint for 7 is 3 + 4 and not 1 + 6.
function hintKeyFor(s, target, rules) {
  if (calcPhase(s) === 'start') {
    const sols = solutionsFor(target, rules);
    return sols.length > 0 ? String(middleOf(sols).a) : null;
  }
  return firstKeyToward(s, target, rules);
}

const CALC_HINT_DEPTH = 12;

function calcStateId(s) {
  return [s.a, s.op, s.b, s.result].join(',');
}

function firstKeyToward(s, target, rules) {
  if (s.result === target) return null;
  const seen = {};
  seen[calcStateId(s)] = true;
  let frontier = [{ state: s, first: null }];
  for (let depth = 0; depth < CALC_HINT_DEPTH && frontier.length > 0; depth++) {
    const next = [];
    for (const node of frontier) {
      const arrivedBy = pressEachKeyFrom(node, target, rules, seen, next);
      if (arrivedBy) return arrivedBy;
    }
    frontier = next;
  }
  return null;
}

// Presses every key that's on from `node`, queueing new states into `next`.
// Returns the first key of the way there when one of them makes the target.
function pressEachKeyFrom(node, target, rules, seen, next) {
  for (const key of CALC_KEYS) {
    if (!isKeyEnabled(node.state, key, rules)) continue;
    const moved = calcPress(node.state, key, rules);
    const first = node.first || key;
    if (moved.result === target) return first;
    if (!seen[calcStateId(moved)]) {
      seen[calcStateId(moved)] = true;
      next.push({ state: moved, first: first });
    }
  }
  return null;
}

// After an answer that isn't the number, the operator that carries on toward
// it, or null when it is the number or nothing carries on that way.
function carryKeyToward(result, target, rules) {
  if (result === target) return null;
  const op = result < target ? '+' : '-';
  return opCanFollow(op, result, rules) ? op : null;
}

// Whether a sum carried on from `from` ended further from the target.
function isStepAway(from, result, target) {
  return Math.abs(result - target) > Math.abs(from - target);
}

// How a Quiz round went, for the ladder. `sums` is how many times she pressed
// = on the way to the number. One sum is clean; carrying on once is fine but
// not evidence she could have made it straight off, so it counts like a hinted
// round; three sums, or carrying on the wrong way, is a miss.
function makeRoundOutcome(sums, steppedAway, hinted) {
  if (steppedAway || sums >= 3) return 'missed';
  if (sums === 2 || hinted) return 'assisted';
  return 'clean';
}

// A number to make on this rung, never the same one twice running.
function makeTarget(rung, random, previous) {
  random = random || Math.random;
  const r = typeof rung === 'object' && rung ? rung : makeRung(rung);
  const span = r.max - r.min + 1;
  for (let tries = 0; tries < 50; tries++) {
    const t = r.min + Math.floor(random() * span);
    if (t !== previous || span === 1) return t;
  }
  return previous === r.min ? r.min + 1 : r.min;
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CALC_DIGIT_KEYS,
    CALC_OP_KEYS,
    CALC_KEYS,
    CALC_CLEAR_KEY,
    CALC_NUMBER_WORDS,
    CALC_MAX_RESULT,
    FREE_RULES,
    emptyCalc,
    calcPhase,
    calcResult,
    digitOfKey,
    isKeyEnabled,
    calcPress,
    equationText,
    equationWords,
    MAKE_RUNGS,
    makeRung,
    makeRules,
    solutionsFor,
    hintKeyFor,
    carryKeyToward,
    isStepAway,
    makeRoundOutcome,
    makeTarget
  };
}
