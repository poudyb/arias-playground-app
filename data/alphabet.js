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
  // Once she's solving quiz rounds on the first try, the capital gets its
  // lowercase twin beside it ("Aa") everywhere she reads letters — the prompt,
  // the on-screen keyboard, and free play. A run of missed rounds puts it back
  // to plain capitals. See shared/progression.js for the streak rules.
  caseProgression: {
    storageKey: 'ariaAlphabetCasePairing',
    promoteAfter: 3,
    demoteAfter: 3,
    pairText: function(item) { return item + item.toLowerCase(); }
  }
};
