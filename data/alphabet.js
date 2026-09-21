const LEARNING_SYMBOLS_CONFIG = {
  items: 'QWERTYUIOPASDFGHJKLZXCVBNM'.split(''),
  sessionKey: 'ariaAlphabetSession',
  statsKey: 'ariaAlphabetStats',
  freeplayStatField: 'freeLetters',
  defaultStats: function() { return createModeStats('freeLetters'); },
  normalizeStats: function(parsed) { return normalizeModeStats(parsed, 'freeLetters', ['freeChars']); },
  touchHint: 'Tap any letter!',
  keyboardHint: 'Press any letter!',
  summary: {
    freeplayEmpty: 'You opened Free play - next time, tap lots of letters to fill the rainbow! 🌈',
    freeplayCount: function(count) {
      return 'You explored ' + count + ' ' + (count === 1 ? 'letter' : 'letters') + '! 🌈';
    },
    quizEmpty: 'You opened Quiz - try solving letter puzzles next time! 🧩',
    quizStruggled: function(info) {
      return info.correct > 0
        ? 'These letters took an extra try (you got them!):'
        : 'These letters needed another try:';
    },
    chaseEmpty: 'You opened Chase - tap the right letter next time! 🎯'
  },
  speakItem: function(item) {
    return item.toLowerCase();
  },
  // Lowercase arrives a few letters at a time. Each clean streak of quiz
  // rounds unlocks the next group, whose capitals then show their small twin
  // beside them ("Cc") everywhere she reads letters — the prompt, the on-screen
  // keyboard, and free play — and get asked more often in the quiz until the
  // group after it opens. A run of missed rounds closes the newest group
  // again. See shared/progression.js for the streak rules.
  //
  // The groups run from "already knows it" to "genuinely new": first the
  // lowercase that is just a shrunken capital, then near-twins, then the tall
  // stick letters, then the ones with a new shape, and last the mirror pairs
  // (b/d, p/q) that trip up every early reader.
  caseProgression: {
    storageKey: 'ariaAlphabetCasePairing',
    promoteAfter: 3,
    demoteAfter: 3,
    stages: [
      'COSVWXZ'.split(''),
      'JKPUYM'.split(''),
      'ILTFHN'.split(''),
      'AERG'.split(''),
      'BDQ'.split('')
    ],
    pairText: function(item) { return item + item.toLowerCase(); }
  }
};

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEARNING_SYMBOLS_CONFIG };
}
