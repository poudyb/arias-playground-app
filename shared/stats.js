function createModeStats(freeField) {
  return {
    [freeField]: 0,
    quizCorrect: 0,
    chaseCorrect: 0,
    quizStruggled: [],
    chaseStruggled: [],
    visitedFreeplay: false,
    visitedQuiz: false,
    visitedChase: false
  };
}

function normalizeModeStats(parsed, freeField, legacyFreeFields = []) {
  const defaults = createModeStats(freeField);
  if (!parsed || typeof parsed !== 'object') return defaults;

  let freeValue = typeof parsed[freeField] === 'number' ? parsed[freeField] : null;
  if (freeValue == null) {
    for (const field of legacyFreeFields) {
      if (typeof parsed[field] === 'number') {
        freeValue = parsed[field];
        break;
      }
    }
  }

  return {
    ...defaults,
    ...parsed,
    [freeField]: typeof freeValue === 'number' ? freeValue : defaults[freeField],
    quizStruggled: Array.isArray(parsed.quizStruggled) ? parsed.quizStruggled : [],
    chaseStruggled: Array.isArray(parsed.chaseStruggled) ? parsed.chaseStruggled : [],
    visitedFreeplay: !!parsed.visitedFreeplay,
    visitedQuiz: !!parsed.visitedQuiz,
    visitedChase: !!parsed.visitedChase
  };
}

function pushUniqueStruggle(arr, key) {
  if (!arr.includes(key)) arr.push(key);
}

function createSameAsStats() {
  return {
    matchCorrect: 0,
    matchWrong: 0,
    struggled: [],
    usedAnimals: false,
    usedShapes: false,
    usedMemory: false,
    memoryMatches: 0,
    memoryLevelsCleared: 0,
    memoryBestLevel: 1,
    memoryUnforced: 0
  };
}

function normalizeSameAsStats(parsed) {
  const defaults = createSameAsStats();
  if (!parsed || typeof parsed !== 'object') return defaults;
  return {
    ...defaults,
    ...parsed,
    matchCorrect: typeof parsed.matchCorrect === 'number' ? parsed.matchCorrect : defaults.matchCorrect,
    matchWrong: typeof parsed.matchWrong === 'number' ? parsed.matchWrong : defaults.matchWrong,
    struggled: Array.isArray(parsed.struggled) ? parsed.struggled : [],
    usedAnimals: !!parsed.usedAnimals,
    usedShapes: !!parsed.usedShapes,
    usedMemory: !!parsed.usedMemory,
    memoryMatches: typeof parsed.memoryMatches === 'number' ? parsed.memoryMatches : defaults.memoryMatches,
    memoryLevelsCleared: typeof parsed.memoryLevelsCleared === 'number' ? parsed.memoryLevelsCleared : defaults.memoryLevelsCleared,
    memoryBestLevel: typeof parsed.memoryBestLevel === 'number' ? parsed.memoryBestLevel : defaults.memoryBestLevel,
    memoryUnforced: typeof parsed.memoryUnforced === 'number' ? parsed.memoryUnforced : defaults.memoryUnforced
  };
}

function createClockStats() {
  return {
    matchSuccesses: 0,
    quizCorrect: 0,
    quizWrong: 0,
    quizStruggled: [],
    nextCorrect: 0,
    nextWrong: 0,
    nextStruggled: [],
    usedWatch: false,
    usedMatch: false,
    usedQuiz: false,
    usedNext: false
  };
}

function normalizeClockStats(parsed) {
  const defaults = createClockStats();
  if (!parsed || typeof parsed !== 'object') return defaults;
  return {
    ...defaults,
    ...parsed,
    matchSuccesses: typeof parsed.matchSuccesses === 'number' ? parsed.matchSuccesses : defaults.matchSuccesses,
    quizCorrect: typeof parsed.quizCorrect === 'number' ? parsed.quizCorrect : defaults.quizCorrect,
    quizWrong: typeof parsed.quizWrong === 'number' ? parsed.quizWrong : defaults.quizWrong,
    quizStruggled: Array.isArray(parsed.quizStruggled) ? parsed.quizStruggled : [],
    nextCorrect: typeof parsed.nextCorrect === 'number' ? parsed.nextCorrect : defaults.nextCorrect,
    nextWrong: typeof parsed.nextWrong === 'number' ? parsed.nextWrong : defaults.nextWrong,
    nextStruggled: Array.isArray(parsed.nextStruggled) ? parsed.nextStruggled : [],
    usedWatch: !!parsed.usedWatch,
    usedMatch: !!parsed.usedMatch,
    usedQuiz: !!parsed.usedQuiz,
    usedNext: !!parsed.usedNext
  };
}

function createSpellingStats() {
  return {
    freeWords: 0,
    quizCorrect: 0,
    quizWrong: 0,
    quizStruggled: [],
    spellCorrect: 0,
    spellStruggled: [],
    readCorrect: 0,
    readWrong: 0,
    readStruggled: [],
    usedFreeplay: false,
    usedQuiz: false,
    usedSpell: false,
    usedRead: false
  };
}

function normalizeSpellingStats(parsed) {
  const defaults = createSpellingStats();
  if (!parsed || typeof parsed !== 'object') return defaults;
  return {
    ...defaults,
    ...parsed,
    freeWords: typeof parsed.freeWords === 'number' ? parsed.freeWords : defaults.freeWords,
    quizCorrect: typeof parsed.quizCorrect === 'number' ? parsed.quizCorrect : defaults.quizCorrect,
    quizWrong: typeof parsed.quizWrong === 'number' ? parsed.quizWrong : defaults.quizWrong,
    quizStruggled: Array.isArray(parsed.quizStruggled) ? parsed.quizStruggled : [],
    spellCorrect: typeof parsed.spellCorrect === 'number' ? parsed.spellCorrect : defaults.spellCorrect,
    spellStruggled: Array.isArray(parsed.spellStruggled) ? parsed.spellStruggled : [],
    readCorrect: typeof parsed.readCorrect === 'number' ? parsed.readCorrect : defaults.readCorrect,
    readWrong: typeof parsed.readWrong === 'number' ? parsed.readWrong : defaults.readWrong,
    readStruggled: Array.isArray(parsed.readStruggled) ? parsed.readStruggled : [],
    usedFreeplay: !!parsed.usedFreeplay,
    usedQuiz: !!parsed.usedQuiz,
    usedSpell: !!parsed.usedSpell,
    usedRead: !!parsed.usedRead
  };
}
