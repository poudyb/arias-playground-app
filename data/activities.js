const ACTIVITIES = [
  {
    id: 'alphabets',
    href: 'alphabet.html',
    title: 'Learn Alphabets',
    hint: 'Letters A to Z!',
    tileClass: '',
    artClasses: 'game-tile__art game-tile__art--letters',
    artHtml:
      '<span class="game-tile__art__emoji">🔤</span>' +
      '<span class="game-tile__art__emoji">✨</span>',
    sessionKey: 'ariaAlphabetSession',
    statsKey: 'ariaAlphabetStats',
    defaultStats: function() { return createModeStats('freeLetters'); }
  },
  {
    id: 'numbers',
    href: 'numbers.html',
    title: 'Learn Numbers',
    hint: 'Numbers 0 to 9!',
    tileClass: 'game-tile--numbers',
    artClasses: 'game-tile__art game-tile__art--letters game-tile__art--numbers',
    artHtml:
      '<span class="game-tile__art__nums">' +
      '<span class="game-tile__art__n game-tile__art__n--0">0</span>' +
      '<span class="game-tile__art__n game-tile__art__n--1">1</span>' +
      '<span class="game-tile__art__n game-tile__art__n--2">2</span>' +
      '</span>',
    sessionKey: 'ariaNumbersSession',
    statsKey: 'ariaNumbersStats',
    defaultStats: function() { return createModeStats('freeNumbers'); }
  },
  {
    id: 'animals',
    href: 'animals.html',
    title: 'Learn Animals and Sounds',
    hint: 'Roars, chirps and more!',
    tileClass: 'game-tile--animals',
    artClasses: 'game-tile__art',
    artHtml: '🦁🔊🐘',
    sessionKey: 'ariaAnimalsSession',
    statsKey: 'ariaAnimalsStats',
    defaultStats: function() { return createModeStats('freeAnimals'); }
  },
  {
    id: 'shapes',
    href: 'shapes.html',
    title: 'Learn Shapes and Colors',
    hint: 'Circles, squares, and more!',
    tileClass: 'game-tile--shapes',
    artClasses: 'game-tile__art game-tile__art--shapes-icons',
    artHtml:
      '<span class="game-tile__art__shape">🔴</span>' +
      '<span class="game-tile__art__shape">🟦</span>' +
      '<span class="game-tile__art__shape">⭐</span>',
    sessionKey: 'ariaShapesSession',
    statsKey: 'ariaShapesStats',
    defaultStats: function() { return createModeStats('freeShapes'); }
  },
  {
    id: 'colors',
    href: 'colors.html',
    title: 'Learn Colors',
    hint: 'Big dots - names only!',
    tileClass: 'game-tile--colors',
    artClasses: 'game-tile__art game-tile__art--colors-dots',
    artHtml:
      '<span class="game-tile__art__dot game-tile__art__dot--red"></span>' +
      '<span class="game-tile__art__dot game-tile__art__dot--blue"></span>' +
      '<span class="game-tile__art__dot game-tile__art__dot--yellow"></span>' +
      '<span class="game-tile__art__dot game-tile__art__dot--green"></span>',
    sessionKey: 'ariaColorsSession',
    statsKey: 'ariaColorsStats',
    defaultStats: function() { return createModeStats('freeColors'); }
  },
  {
    id: 'same-as',
    href: 'same-as.html',
    title: 'Same As',
    hint: 'Pick the one that matches!',
    tileClass: 'game-tile--same',
    artClasses: 'game-tile__art game-tile__art--same-pair',
    artHtml:
      '<span class="game-tile__art__same-icon">🐸</span>' +
      '<span class="game-tile__art__same-icon">🟰</span>' +
      '<span class="game-tile__art__same-icon">🐸</span>',
    sessionKey: 'ariaSameAsSession',
    statsKey: 'ariaSameAsStats',
    defaultStats: function() { return createSameAsStats(); }
  },
  {
    id: 'clock',
    href: 'clock.html',
    title: 'Clock',
    hint: 'Watch the time tick!',
    tileClass: 'game-tile--clock',
    artClasses: 'game-tile__art game-tile__art--clock-digits',
    artHtml:
      '<span class="game-tile__art__digit">10</span>' +
      '<span class="game-tile__art__digit game-tile__art__digit--colon">:</span>' +
      '<span class="game-tile__art__digit">30</span>',
    sessionKey: 'ariaClockSession',
    statsKey: 'ariaClockStats',
    defaultStats: function() { return createClockStats(); }
  },
  {
    id: 'spelling',
    href: 'spelling.html',
    title: 'Spelling',
    hint: 'Spell three-letter words!',
    tileClass: 'game-tile--spelling',
    artClasses: 'game-tile__art game-tile__art--letters',
    artHtml:
      '<span class="game-tile__art__emoji">🔤</span>' +
      '<span class="game-tile__art__emoji">✏️</span>',
    sessionKey: 'ariaSpellingSession',
    statsKey: 'ariaSpellingStats',
    defaultStats: function() { return createSpellingStats(); }
  }
];
