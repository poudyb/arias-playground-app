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

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SEGMENTS_FOR_DIGIT,
    NUMBER_WORDS_ONES,
    NUMBER_WORDS_TENS,
    numberToWords,
    timeToWords,
    formatTwo,
    get12Hour
  };
}
