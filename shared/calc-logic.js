// The calculator's rules, kept apart from the page so they can be unit-tested.
//
// A real calculator does whatever it is told, and most of what a small child
// tells it turns into something she can't read: a minus pressed first makes a
// negative number, 3 - 5 makes another one, 5 then 3 makes fifty-three, a plus
// after the answer chains on, and pressing = again repeats the last sum. This
// one only ever does one thing — a number, plus or minus, a number — and the
// answer comes up by itself. Every key that would step outside that is switched
// off (and drawn greyed out) rather than left to do something surprising.
//
//   start  - nothing typed           numbers on
//   first  - "3"                     + and - on, and the numbers (a different
//                                    one replaces the 3: there's no C to undo)
//   op     - "3 +"                   numbers on (for minus, only those under 3)
//   done   - "3 + 4 = 7"             numbers on, starting a fresh sum
//
// There is no 0, no C and no = at all. Zero is a concept for later; C was the
// key she pressed most and it only ever took her backwards; and = was the step
// she didn't know she had to take — the sum answers itself as soon as it's
// whole. With no = there is nothing to repeat, and the answer can never be
// carried into another sum. Minus never goes to zero either: 5 - 5 is off.

const CALC_DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const CALC_OP_KEYS = ['+', '-'];
const CALC_KEYS = CALC_DIGIT_KEYS.concat(CALC_OP_KEYS);

// Free Play: everything a single-digit sum can use.
const FREE_RULES = { ops: ['+', '-'] };

const CALC_NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen'
];

function emptyCalc() {
  return { a: null, op: null, b: null, result: null };
}

function calcPhase(s) {
  if (s.result != null) return 'done';
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

function isKeyEnabled(s, key, rules) {
  rules = rules || FREE_RULES;
  const phase = calcPhase(s);
  if (key === '+') return phase === 'first' && opAllowed('+', rules);
  // Minus needs something to take away that still leaves at least one.
  if (key === '-') return phase === 'first' && opAllowed('-', rules) && s.a >= 2;
  const d = digitOfKey(key);
  if (d == null) return false;
  if (phase === 'op') return s.op === '+' || d < s.a;
  return true;
}

// The state after pressing `key`. A key that isn't enabled hands back the very
// same object, so the page can tell nothing happened. The second number
// finishes the sum: its answer is worked out there and then.
function calcPress(s, key, rules) {
  if (!isKeyEnabled(s, key, rules)) return s;
  if (key === '+' || key === '-') return { a: s.a, op: key, b: null, result: null };
  const d = digitOfKey(key);
  if (calcPhase(s) === 'op') return { a: s.a, op: s.op, b: d, result: calcResult(s.a, s.op, d) };
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

// ---- Make It ---------------------------------------------------------------
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

function makeRules(rung) {
  return { ops: rung.ops.slice() };
}

// Every sum the keys allow that comes out at `target`, smallest first number
// first, plus before minus.
function solutionsFor(target, rules) {
  const out = [];
  for (let a = 1; a <= 9; a++) {
    CALC_OP_KEYS.forEach(function(op) {
      if (!opAllowed(op, rules)) return;
      for (let b = 1; b <= 9; b++) {
        if (op === '-' && b >= a) continue;
        if (calcResult(a, op, b) === target) out.push({ a: a, op: op, b: b });
      }
    });
  }
  return out;
}

function middleOf(list) {
  return list[Math.floor((list.length - 1) / 2)];
}

// The one key to glow when she's stuck: the next press along a sum that makes
// the target, picking up from whatever she has typed. A first number that can't
// get there is swapped for one that can (pressing another number replaces it).
// Null when there's nothing that helps: a sum that's finished, or one whose
// operator has already taken it somewhere the target can't be reached from —
// she finishes it, sees it's wrong, and gets a clean start.
//
// From a clean screen it starts from the middle of the list rather than the
// end, so the hint for 7 is 3 + 4 and not 1 + 6.
function hintKeyFor(s, target, rules) {
  const phase = calcPhase(s);
  const sols = solutionsFor(target, rules);
  if (sols.length === 0) return null;
  if (phase === 'start') return String(middleOf(sols).a);
  if (phase === 'first') {
    const m = sols.filter(function(x) { return x.a === s.a; });
    return m.length ? middleOf(m).op : String(middleOf(sols).a);
  }
  if (phase === 'op') {
    const m = sols.filter(function(x) { return x.a === s.a && x.op === s.op; });
    return m.length ? String(m[0].b) : null;
  }
  return null;
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
    CALC_NUMBER_WORDS,
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
    makeTarget
  };
}
