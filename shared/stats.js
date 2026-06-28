// Build a normalized stats object from whatever was parsed out of
// sessionStorage, validating each field against a fresh `defaults` object:
//   - number default  -> keep parsed value only if it's a number
//   - array default   -> keep a copy of the parsed array, else an empty one
//   - boolean default -> coerce to boolean
//   - anything else    -> keep parsed value if present, else the default
// Unknown keys in `parsed` are preserved. This is the single place that decides
// how a stat field is validated, so adding a field to a create* function below
// is all it takes — there's no parallel per-field list to keep in sync.
function normalizeStatsBySchema(parsed, defaults) {
  if (!parsed || typeof parsed !== 'object') return defaults;
  const out = { ...parsed };
  for (const key in defaults) {
    const def = defaults[key];
    const val = parsed[key];
    if (Array.isArray(def)) {
      out[key] = Array.isArray(val) ? val.slice() : def.slice();
    } else if (typeof def === 'number') {
      out[key] = typeof val === 'number' ? val : def;
    } else if (typeof def === 'boolean') {
      out[key] = !!val;
    } else if (!(key in parsed)) {
      out[key] = def;
    }
  }
  return out;
}

function pushUniqueStruggle(arr, key) {
  if (!arr.includes(key)) arr.push(key);
}

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
  const out = normalizeStatsBySchema(parsed, defaults);
  // Pre-rename builds stored the free-play count under a different field name
  // (e.g. animals -> shapes). Carry it forward if the current field is missing.
  if (out !== defaults && typeof parsed[freeField] !== 'number') {
    for (const field of legacyFreeFields) {
      if (typeof parsed[field] === 'number') {
        out[freeField] = parsed[field];
        break;
      }
    }
  }
  return out;
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
    memoryUnforced: 0
  };
}

function normalizeSameAsStats(parsed) {
  return normalizeStatsBySchema(parsed, createSameAsStats());
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
  return normalizeStatsBySchema(parsed, createClockStats());
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
  return normalizeStatsBySchema(parsed, createSpellingStats());
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeStatsBySchema,
    pushUniqueStruggle,
    createModeStats,
    normalizeModeStats,
    createSameAsStats,
    normalizeSameAsStats,
    createClockStats,
    normalizeClockStats,
    createSpellingStats,
    normalizeSpellingStats
  };
}
