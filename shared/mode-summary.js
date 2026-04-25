function createTextElement(tagName, text) {
  const el = document.createElement(tagName);
  el.textContent = text;
  return el;
}

function createSubheading(text) {
  const sub = document.createElement('div');
  sub.style.marginTop = '0.45rem';
  sub.style.fontWeight = '600';
  sub.textContent = text;
  return sub;
}

const COMMON_NOT_VISITED = 'This mode was not accessed during this play session.';
const COMMON_PERFECT_QUIZ = 'Every answer was first try - you are a star! ⭐';

function buildModeSummaryConfig(options) {
  const { freeplay, quiz, chase } = options;
  return {
    freeplay: {
      modClass: 'score-section--free',
      icon: '🎨',
      title: 'Free play',
      notVisitedMessage: COMMON_NOT_VISITED,
      ...freeplay
    },
    quiz: {
      modClass: 'score-section--quiz',
      icon: '🧠',
      title: 'Quiz',
      notVisitedMessage: COMMON_NOT_VISITED,
      perfectMessage: COMMON_PERFECT_QUIZ,
      ...quiz
    },
    chase: {
      modClass: 'score-section--chase',
      icon: '🏃',
      title: 'Chase',
      notVisitedMessage: COMMON_NOT_VISITED,
      ...chase
    }
  };
}

function renderThreeModeSummary(board, stats, options) {
  const { freeplay, quiz, chase } = options;

  if (!stats.visitedFreeplay) {
    appendMutedSection(board, {
      modClass: freeplay.modClass,
      icon: freeplay.icon,
      title: freeplay.title,
      body: freeplay.notVisitedMessage
    });
  } else if (stats[freeplay.countField] === 0) {
    appendScoreSection(board, {
      modClass: freeplay.modClass,
      icon: freeplay.icon,
      title: freeplay.title,
      body: createTextElement('span', freeplay.emptyMessage)
    });
  } else {
    appendScoreSection(board, {
      modClass: freeplay.modClass,
      icon: freeplay.icon,
      title: freeplay.title,
      body: createTextElement('span', freeplay.countMessage(stats[freeplay.countField]))
    });
  }

  renderChallengeMode(board, stats, {
    visitedField: 'visitedQuiz',
    correctField: 'quizCorrect',
    struggledField: 'quizStruggled',
    ...quiz
  });
  renderChallengeMode(board, stats, {
    visitedField: 'visitedChase',
    correctField: 'chaseCorrect',
    struggledField: 'chaseStruggled',
    ...chase
  });
}

function renderChallengeMode(board, stats, options) {
  const { visitedField, correctField, struggledField } = options;

  if (!stats[visitedField]) {
    appendMutedSection(board, {
      modClass: options.modClass,
      icon: options.icon,
      title: options.title,
      body: options.notVisitedMessage
    });
    return;
  }

  const body = document.createElement('div');
  const intro = createTextElement('div', options.message({
    correct: stats[correctField],
    struggled: stats[struggledField]
  }));
  body.appendChild(intro);

  if (stats[struggledField].length === 0) {
    if (stats[correctField] > 0 && options.perfectMessage) {
      const cheer = createTextElement('div', options.perfectMessage);
      cheer.className = 'score-celebrate';
      body.appendChild(cheer);
    }
  } else {
    body.appendChild(createSubheading(options.struggledLabel({
      correct: stats[correctField],
      struggled: stats[struggledField]
    })));
    body.appendChild(createPillWrap(stats[struggledField], options.renderPill));
  }

  appendScoreSection(board, {
    modClass: options.modClass,
    icon: options.icon,
    title: options.title,
    body
  });
}
