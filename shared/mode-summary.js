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

  renderChallengeMode(board, stats, 'quiz', quiz);
  renderChallengeMode(board, stats, 'chase', chase);
}

function renderChallengeMode(board, stats, key, options) {
  const visitedField = key === 'quiz' ? 'visitedQuiz' : 'visitedChase';
  const correctField = key === 'quiz' ? 'quizCorrect' : 'chaseCorrect';
  const struggledField = key === 'quiz' ? 'quizStruggled' : 'chaseStruggled';

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
