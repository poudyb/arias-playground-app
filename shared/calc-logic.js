// The calculator's rules, kept apart from the page so they can be unit-tested.
//
// A real calculator does whatever it is told, and most of what a small child
// tells it turns into something she can't read: a minus pressed first makes a
// negative number, 3 - 5 makes another one, 5 then 3 makes fifty-three, a plus
// after the answer chains on, and pressing = again repeats the last sum. This
// one only ever does one thing — a single digit, plus or minus, a single digit,
// equals — and every key that would step outside that is switched off (and
// drawn greyed out) rather than left to do something surprising.
//
//   start  - nothing typed           digits on
//   first  - "3"                     + and - on
//   op     - "3 +"                   digits on (for minus, only those <= 3)
//   second - "3 + 4"                 = on
//   done   - "3 + 4 = 7"             digits on, starting a fresh sum
//
// C clears from anywhere once something is typed. = is on in exactly one
// place, so there is no "press it again" for it to repeat, and the answer can
// never be carried into another sum.

const CALC_DIGIT_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const CALC_OP_KEYS = ['+', '-'];
const CALC_KEYS = CALC_DIGIT_KEYS.concat(CALC_OP_KEYS, ['=', 'C']);

// Free Play: everything a single-digit sum can use.
const FREE_RULES = { ops: ['+', '-'], zero: true };

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
  if (s.b != null) return 'second';
  if (s.op != null) return 'op';
  if (s.a != null) return 'first';
  return 'start';
}

function digitOfKey(key) {
  const i = CALC_DIGIT_KEYS.indexOf(key);
  return i === -1 ? null : i;
}

function calcResult(a, op, b) {
  return op === '-' ? a - b : a + b;
}

function opAllowed(op, rules) {
  return !rules.ops || rules.ops.indexOf(op) !== -1;
}

function digitAllowed(d, rules) {
  return d !== 0 || rules.zero !== false;
}

function isKeyEnabled(s, key, rules) {
  rules = rules || FREE_RULES;
  const phase = calcPhase(s);
  if (key === 'C') return phase !== 'start';
  if (key === '=') return phase === 'second';
  if (key === '+' || key === '-') return phase === 'first' && opAllowed(key, rules);
  const d = digitOfKey(key);
  if (d == null || !digitAllowed(d, rules)) return false;
  if (phase === 'start' || phase === 'done') return true;
  // Taking away more than she has is the one sum that would go below zero.
  if (phase === 'op') return s.op === '+' || d <= s.a;
  return false;
}

// The state after pressing `key`. A key that isn't enabled hands back the very
// same object, so the page can tell nothing happened.
function calcPress(s, key, rules) {
  if (!isKeyEnabled(s, key, rules)) return s;
  if (key === 'C') return emptyCalc();
  if (key === '=') return { a: s.a, op: s.op, b: s.b, result: calcResult(s.a, s.op, s.b) };
  if (key === '+' || key === '-') return { a: s.a, op: key, b: null, result: null };
  const d = digitOfKey(key);
  const phase = calcPhase(s);
  if (phase === 'op') return { a: s.a, op: s.op, b: d, result: null };
  return { a: d, op: null, b: null, result: null };
}

// "3 + 4 = 7", with a real minus sign, for the parent's summary.
function equationText(s) {
  const parts = [];
  if (s.a != null) parts.push(String(s.a));
  if (s.op) parts.push(s.op === '-' ? '−' : '+');
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
// 9 - 2, or any other way she finds. Pressing = is her answer, so a wrong one
// gets the big red X like any other quiz.
//
// The 0 key is off in Make It. With it, 7 + 0 makes every target in two
// presses of the same digit, and a child who finds that has found a way to
// win without adding anything.
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
  return { ops: rung.ops.slice(), zero: false };
}

// Every sum the keys allow that comes out at `target`, smallest first number
// first, plus before minus.
function solutionsFor(target, rules) {
  const out = [];
  for (let a = 0; a <= 9; a++) {
    CALC_OP_KEYS.forEach(function(op) {
      for (let b = 0; b <= 9; b++) {
        const s = { a: a, op: op, b: b, result: null };
        if (!digitAllowed(a, rules) || !digitAllowed(b, rules) || !opAllowed(op, rules)) continue;
        if (op === '-' && b > a) continue;
        if (calcResult(a, op, b) === target) out.push(s);
      }
    });
  }
  return out;
}

function middleOf(list) {
  return list[Math.floor((list.length - 1) / 2)];
}

// The one key to glow when she's stuck: the next press along a sum that makes
// the target, picking up from whatever she has typed. If what she has typed
// can't get there any more, it's C. Null when there's nothing to point at.
//
// From a clean screen it starts from the middle of the list rather than the
// end, so the hint for 7 is 3 + 4 and not 1 + 6.
function hintKeyFor(s, target, rules) {
  const phase = calcPhase(s);
  const sols = solutionsFor(target, rules);
  if (phase === 'start') return sols.length ? String(middleOf(sols).a) : null;
  if (phase === 'first') {
    const m = sols.filter(function(x) { return x.a === s.a; });
    return m.length ? middleOf(m).op : 'C';
  }
  if (phase === 'op') {
    const m = sols.filter(function(x) { return x.a === s.a && x.op === s.op; });
    return m.length ? String(m[0].b) : 'C';
  }
  if (phase === 'second') return calcResult(s.a, s.op, s.b) === target ? '=' : 'C';
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
