const ACTIVITIES = [
  {
    id: 'alphabets',
    href: 'alphabet.html',
    title: 'Learn Alphabets and Numbers',
    hint: 'Letters and numbers!',
    tileClass: '',
    artClasses: 'game-tile__art game-tile__art--letters',
    artHtml:
      '<span class="game-tile__art__emoji">🔤</span>' +
      '<span class="game-tile__art__nums">' +
      '<span class="game-tile__art__n game-tile__art__n--1">1</span>' +
      '<span class="game-tile__art__n game-tile__art__n--2">2</span>' +
      '<span class="game-tile__art__n game-tile__art__n--3">3</span>' +
      '</span>' +
      '<span class="game-tile__art__emoji">✨</span>',
    sessionKey: 'ariaAlphabetSession',
    statsKey: 'ariaAlphabetStats',
    defaultStats: function() { return createModeStats('freeChars'); }
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
  }
];
