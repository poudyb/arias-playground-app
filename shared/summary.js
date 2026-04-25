function createScoreTitle(icon, text) {
  const row = document.createElement('div');
  row.className = 'score-section__header';
  const i = document.createElement('span');
  i.className = 'score-section__icon';
  i.textContent = icon;
  const t = document.createElement('span');
  t.className = 'score-section__title';
  t.textContent = text;
  row.appendChild(i);
  row.appendChild(t);
  return row;
}

function appendScoreSection(board, options) {
  const { modClass, icon, title, body } = options;
  const sec = document.createElement('div');
  sec.className = 'score-section ' + (modClass || '');
  sec.appendChild(createScoreTitle(icon, title));
  const b = document.createElement('div');
  b.className = 'score-section__body';
  if (typeof body === 'string') {
    b.textContent = body;
  } else {
    b.appendChild(body);
  }
  sec.appendChild(b);
  board.appendChild(sec);
}

function appendMutedSection(board, options) {
  const { modClass, icon, title, body } = options;
  const sec = document.createElement('div');
  sec.className = 'score-section score-section--muted ' + (modClass || '');
  sec.appendChild(createScoreTitle(icon, title));
  const b = document.createElement('div');
  b.className = 'score-section__body';
  b.textContent = body;
  sec.appendChild(b);
  board.appendChild(sec);
}

function createPillWrap(items, renderPill) {
  const wrap = document.createElement('div');
  wrap.className = 'score-pill-wrap';
  items.forEach(function(item) {
    const p = document.createElement('span');
    p.className = 'score-pill';
    renderPill(p, item);
    wrap.appendChild(p);
  });
  return wrap;
}
