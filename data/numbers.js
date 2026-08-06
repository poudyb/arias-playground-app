const NUMBER_WORDS = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  '11': 'eleven',
  '12': 'twelve',
  '13': 'thirteen',
  '14': 'fourteen',
  '15': 'fifteen',
  '16': 'sixteen',
  '17': 'seventeen',
  '18': 'eighteen',
  '19': 'nineteen',
  '20': 'twenty'
};

const NUMBERS_CHASE_MAX_VALUE = 20;
const NUMBERS_CHASE_ROUNDS_PER_NEW_VALUE = 2;
const NUMBERS_CHASE_MAX_DIFFICULTY =
  (NUMBERS_CHASE_MAX_VALUE - 9) * NUMBERS_CHASE_ROUNDS_PER_NEW_VALUE;

function numbersChaseHighest(difficulty) {
  const rangeStep = Math.floor(Math.max(0, difficulty) / NUMBERS_CHASE_ROUNDS_PER_NEW_VALUE);
  return Math.min(9 + rangeStep, NUMBERS_CHASE_MAX_VALUE);
}

function numbersChaseParams(difficulty) {
  // Preserve the fun of a busier arena as the range grows, but don't combine
  // new spoken names with faster motion and shrinking type.
  return {
    count: Math.min(3 + Math.floor(Math.max(0, difficulty) / 2), 8),
    speed: 100,
    fontSize: 15
  };
}

function numbersChaseItemWeight(item) {
  return Number(item) < 10 ? 2 : 1;
}

const LEARNING_SYMBOLS_CONFIG = {
  items: '0123456789'.split(''),
  sessionKey: 'ariaNumbersSession',
  statsKey: 'ariaNumbersStats',
  freeplayStatField: 'freeNumbers',
  defaultStats: function() { return createModeStats('freeNumbers'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeNumbers'); },
  touchHint: 'Tap any number!',
  keyboardHint: 'Press any number!',
  summary: {
    freeplayEmpty: 'You opened Free play - next time, tap lots of numbers to count along! 🔢',
    freeplayCount: function(count) {
      return 'You explored ' + count + ' ' + (count === 1 ? 'number' : 'numbers') + '! 🔢';
    },
    quizEmpty: 'You opened Quiz - try solving number puzzles next time! 🧩',
    quizStruggled: function(info) {
      return info.correct > 0
        ? 'These numbers took an extra try (you got them!):'
        : 'These numbers needed another try:';
    },
    chaseEmpty: 'You opened Chase - tap the right number next time! 🎯'
  },
  speakItem: function(item) {
    return NUMBER_WORDS[item] || item;
  },
  chasePool: function(difficulty) {
    const highest = numbersChaseHighest(difficulty);
    const pool = [];
    for (let n = 0; n <= highest; n++) pool.push(String(n));
    return pool;
  },
  chaseItemWeight: numbersChaseItemWeight,
  chaseDifficultyMax: NUMBERS_CHASE_MAX_DIFFICULTY,
  getChaseParams: numbersChaseParams
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NUMBERS_CHASE_MAX_VALUE,
    NUMBERS_CHASE_ROUNDS_PER_NEW_VALUE,
    NUMBERS_CHASE_MAX_DIFFICULTY,
    numbersChaseHighest,
    numbersChaseParams,
    numbersChaseItemWeight
  };
}
