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
    usedShapes: false
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
    usedShapes: !!parsed.usedShapes
  };
}
