const modeBtns = document.querySelectorAll('.mode-btn');
const rowEl = document.getElementById('walk-row');
const pickerEl = document.getElementById('who-picker');
const pickerCardsEl = document.getElementById('who-cards');
const whoBtn = document.getElementById('who-btn');
const whoBtnImg = document.getElementById('who-btn-img');
const actionBtns = {};
document.querySelectorAll('.walk-btn').forEach(function(btn) {
  actionBtns[btn.dataset.action] = btn;
});

const WALK_SESSION_KEY = 'ariaWalkSession';
const WALK_LADDER_KEY = 'ariaWalkLadder';
const PICTURES = GARDEN_PICTURES;
const CONFETTI_HEX = ['#558b2f', '#9ccc65', '#ffca28', '#e53935', '#1e88e5', '#8e24aa', '#ff9800', '#26c6da'];

const MOVE_MS = { step: 380, over: 620, onto: 620, hop: 500, blocked: 420, edge: 420 };
const PIECE_ANIMATIONS = ['is-stepping', 'is-jumping', 'is-hopping', 'is-bumping', 'is-cheering', 'shake'];

let mode = null;
let avatar = loadGardenAvatar();
let board = null;
let state = null;
let friend = null;
let youEl = null;
let friendEl = null;
let locked = false;
let wasted = 0;
let hinted = false;
let lastPress = 'none';
let nowhereStreak = 0;
let lastBoardKey = null;
let lastFriendKey = null;
let boardSerial = 0;
let moveTimer = null;
let introTimer = null;
let cheerTimer = null;
let nextTimer = null;
let pickerTimer = null;

const ladder = createLadderProgression({
  storageKey: WALK_LADDER_KEY,
  rungs: WALK_LEVELS.length,
  promoteAfter: 1,
  demoteAfter: 2
});

function plural(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 's');
}

function freePlaySummary(stats) {
  if (stats.freeSteps + stats.freeJumps === 0) return 'You opened Free Play - tap an arrow to walk next time!';
  return 'You took ' + plural(stats.freeSteps, 'step') + ' and jumped ' + plural(stats.freeJumps, 'time') + '!';
}

function walkSummary(stats) {
  const body = createIntroBody(stats.walkFriends === 0
    ? 'Tap the arrows to walk to a friend!'
    : 'You walked to ' + plural(stats.walkFriends, 'friend') + '!');
  // For the grown-up: how the boards change, which she is never told.
  appendBodyNote(body, 'Now on boards with ' + WALK_LEVELS[ladder.getRung()].about + '. ' +
    'A board where no more than one press went nowhere moves her up; two messy boards in a row move her back' +
    (stats.walkBoardsMissed ? ' (' + stats.walkBoardsMissed + ' messy today)' : '') + '. ' +
    'A tap on the friend counts as a press that went nowhere' +
    (stats.friendTaps ? ' (' + stats.friendTaps + ' today)' : '') + '. ' +
    'A board she finishes only after the hint shows leaves her where she is.');
  return body;
}

function renderSummary(boardEl, stats) {
  if (stats.usedFreeplay) {
    appendScoreSection(boardEl, { icon: '🌳', title: 'Free Play', body: freePlaySummary(stats) });
  }
  if (stats.usedWalk) {
    appendScoreSection(boardEl, { icon: '🐾', title: 'Walk It', body: walkSummary(stats) });
  }
  cancelSpeech();
}

const session = createTimedSession({
  sessionKey: WALK_SESSION_KEY,
  statsKey: 'ariaWalkStats',
  defaultStats: createWalkStats,
  normalizeStats: normalizeWalkStats,
  stopGame: stopWalkGame,
  renderSummary
});

const audio = createAudioFeedback();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

const hint = createHintNudge({
  onFlash: function(speak) {
    hinted = true;
    const action = walkPlan(board, state).firstAction;
    flashHintEl(actionBtns[action]);
    if (speak) speakText(hintLine(action), { rate: 0.9 });
  },
  isActive: function() {
    return mode === 'walk' && board != null && !locked && pickerEl.hidden && !session.isSessionEnded();
  }
});

function hintLine(action) {
  if (action !== 'jump') return 'Tap the arrow to walk!';
  const front = state.pos + (state.facing === 'left' ? -1 : 1);
  return board.things[front] === 'stump' ? 'Jump up!' : 'Jump over it!';
}

function clearWalkTimers() {
  [moveTimer, introTimer, cheerTimer, nextTimer, pickerTimer].forEach(function(timer) {
    if (timer != null) clearTimeout(timer);
  });
  moveTimer = null;
  introTimer = null;
  cheerTimer = null;
  nextTimer = null;
  pickerTimer = null;
}

function layoutRow() {
  const width = rowEl.clientWidth;
  const height = rowEl.clientHeight;
  const slot = width / board.things.length;
  const sprite = Math.min(slot * 1.2, height * 0.46, 240);
  rowEl.style.setProperty('--slot', slot + 'px');
  rowEl.style.setProperty('--sprite', sprite + 'px');
  rowEl.style.setProperty('--stump', (sprite * 0.42) + 'px');
}

function addThing(className, pos, tag) {
  const el = document.createElement(tag || 'div');
  el.className = className;
  el.style.setProperty('--at', String(pos));
  el.setAttribute('aria-hidden', 'true');
  rowEl.appendChild(el);
  return el;
}

function makePiece(picture, className, label) {
  const piece = document.createElement('div');
  piece.className = 'walk-piece ' + className;
  piece.style.setProperty('--feet', String(picture.feet));
  const body = document.createElement('div');
  body.className = 'walk-piece__body';
  const img = document.createElement('img');
  img.src = PICTURES + picture.img;
  img.alt = '';
  img.decoding = 'async';
  body.appendChild(img);
  piece.appendChild(body);
  piece.setAttribute('aria-label', label);
  rowEl.appendChild(piece);
  return piece;
}

function placePiece(el, pos, facing, facesFront) {
  el.style.setProperty('--at', String(pos));
  el.style.setProperty('--lift', board.things[pos] === 'stump' ? 'var(--stump)' : '0px');
  el.style.setProperty('--flip', facesFront || facing === 'right' ? '1' : '-1');
  el.style.setProperty('--dir', facing === 'left' ? '-1' : '1');
}

function playPieceAnimation(el, className) {
  PIECE_ANIMATIONS.forEach(function(name) { el.classList.remove(name); });
  void el.offsetWidth;
  el.classList.add(className);
}

function renderBoard() {
  rowEl.innerHTML = '';
  board.things.forEach(function(thing, pos) {
    switch (thing) {
      case '':
        addThing('walk-stone', pos);
        break;
      case 'rock':
        addThing('walk-rock', pos);
        break;
      case 'log': {
        const log = addThing('walk-log', pos, 'img');
        log.src = PICTURES + 'log.png';
        log.alt = '';
        break;
      }
      case 'stump':
        addThing('walk-stump', pos);
        break;
      default:
        throw new Error('Unknown walk thing: ' + thing);
    }
  });

  friendEl = null;
  if (friend) {
    friendEl = makePiece(friend, 'walk-piece--friend', friend.key);
    placePiece(friendEl, board.goal, board.goal > board.start ? 'left' : 'right', friend.facesFront);
    friendEl.addEventListener('click', onFriendTap);
  }

  youEl = makePiece(avatar, 'walk-piece--you', 'You, the ' + avatar.name);
  placePiece(youEl, state.pos, state.facing, false);

  Object.keys(actionBtns).forEach(function(action) {
    actionBtns[action].classList.toggle('is-absent', !board.buttons.includes(action));
  });

  layoutRow();
}

function pickFriend() {
  const pick = pickGardenFriend(avatar, lastFriendKey);
  lastFriendKey = pick.key;
  return pick;
}

function sayIntro(line, greet) {
  if (introTimer != null) clearTimeout(introTimer);
  introTimer = window.setTimeout(function() {
    introTimer = null;
    if (session.isSessionEnded()) return;
    if (greet) {
      playPieceAnimation(youEl, 'is-hopping');
      speakText("That's you!", { rate: 0.9 });
      speakText(line, { rate: 0.9, queue: true });
    } else {
      speakText(line, { rate: 0.9 });
    }
  }, 360);
}

function dropIntro() {
  if (introTimer != null) {
    clearTimeout(introTimer);
    introTimer = null;
  }
}

function dealWalkBoard(greet) {
  clearWalkTimers();
  boardSerial += 1;
  board = buildWalkBoard(ladder.getRung(), Math.random, lastBoardKey);
  lastBoardKey = board.key;
  friend = pickFriend();
  state = walkStartState(board);
  wasted = 0;
  hinted = false;
  lastPress = 'none';
  nowhereStreak = 0;
  locked = false;
  renderBoard();
  sayIntro('Walk to the ' + friend.key + '!', greet);
  hint.reset(walkHintWaitMs(lastPress));
}

function enterFreeGarden(greet) {
  clearWalkTimers();
  boardSerial += 1;
  board = buildFreeGarden();
  friend = null;
  state = walkStartState(board);
  locked = false;
  renderBoard();
  sayIntro('Walk and jump!', greet);
}

function spawnFriendConfetti() {
  const rect = friendEl.getBoundingClientRect();
  spawnConfetti({
    colors: CONFETTI_HEX,
    count: 80,
    originLeft: ((rect.left + rect.width / 2) / window.innerWidth) * 100 + 'vw',
    originTop: ((rect.top + rect.height / 2) / window.innerHeight) * 100 + 'vh',
    minDistance: 30,
    distanceJitter: 50,
    minDuration: 1.0,
    durationJitter: 0.8
  });
}

function finishWalkBoard() {
  locked = true;
  hint.stop();
  const outcome = walkBoardOutcome(wasted, hinted);
  ladder.recordRound(outcome);
  session.mutateStats(function(stats) {
    stats.walkFriends += 1;
    if (outcome === 'missed') stats.walkBoardsMissed += 1;
  });

  playPieceAnimation(youEl, 'is-cheering');
  playPieceAnimation(friendEl, 'is-cheering');
  spawnFriendConfetti();
  audio.playFanfare();
  cancelSpeech();
  cheerTimer = window.setTimeout(function() {
    cheerTimer = null;
    if (!session.isSessionEnded()) speakText('Hooray! You did it!', { rate: 0.95 });
  }, 240);
  const serial = boardSerial;
  nextTimer = window.setTimeout(function() {
    nextTimer = null;
    if (serial === boardSerial && !session.isSessionEnded()) dealWalkBoard(false);
  }, 2600);
}

// Arriving on the friend's stone, she stops just in front of it and the friend
// leans back a little, so the two stand together instead of on top of each other.
function standBeside(approach) {
  youEl.style.setProperty('--nudge', 'calc(var(--sprite) * ' + (-0.36 * approach) + ')');
  friendEl.style.setProperty('--nudge', 'calc(var(--sprite) * ' + (0.12 * approach) + ')');
}

function showMove(result) {
  const airborne = result === 'over' || result === 'onto';
  youEl.classList.toggle('is-airborne', airborne);
  placePiece(youEl, state.pos, state.facing, false);
  switch (result) {
    case 'step':
      playPieceAnimation(youEl, 'is-stepping');
      audio.playStep();
      break;
    case 'over':
    case 'onto':
      playPieceAnimation(youEl, 'is-jumping');
      audio.playHop();
      break;
    case 'hop':
      playPieceAnimation(youEl, 'is-hopping');
      audio.playHop();
      break;
    case 'blocked':
    case 'edge':
      playPieceAnimation(youEl, 'is-bumping');
      audio.playBump();
      break;
    default:
      throw new Error('Unknown walk result: ' + result);
  }
}

function flashHelpfulButton() {
  flashHintEl(actionBtns[walkPlan(board, state).firstAction]);
}

// She is trying something: the voice stops, and the spoken hint waits again.
function notePress(wentNowhere) {
  if (wentNowhere) {
    wasted += 1;
    nowhereStreak += 1;
    lastPress = 'nowhere';
    if (nowhereStreak >= WALK_STUCK_PRESSES) flashHelpfulButton();
  } else {
    nowhereStreak = 0;
    lastPress = 'progress';
  }
  hint.reset(walkHintWaitMs(lastPress));
}

function quietForHerTap() {
  dropIntro();
  cancelSpeech();
}

function onAction(action) {
  if (board == null || locked || !pickerEl.hidden || session.isSessionEnded()) return;
  if (!board.buttons.includes(action)) return;
  quietForHerTap();

  const before = state;
  const moved = walkMove(board, state, action);
  const wentNowhere = mode === 'walk' && isWalkPressWasted(board, before, moved);
  const reached = mode === 'walk' && moved.pos === board.goal;
  state = { pos: moved.pos, facing: moved.facing };
  if (reached) standBeside(before.pos < board.goal ? 1 : -1);
  showMove(moved.result);

  if (mode === 'freeplay') {
    session.mutateStats(function(stats) {
      if (action === 'jump') stats.freeJumps += 1;
      else if (moved.result === 'step') stats.freeSteps += 1;
    });
  } else if (!reached) {
    notePress(wentNowhere);
  }

  const serial = boardSerial;
  locked = true;
  moveTimer = window.setTimeout(function() {
    moveTimer = null;
    if (serial !== boardSerial) return;
    youEl.classList.remove('is-airborne');
    if (reached) finishWalkBoard();
    else locked = false;
  }, MOVE_MS[moved.result]);
}

function onFriendTap() {
  if (mode !== 'walk' || locked || session.isSessionEnded()) return;
  quietForHerTap();
  session.mutateStats(function(stats) { stats.friendTaps += 1; });
  playPieceAnimation(friendEl, 'shake');
  audio.playSoftTone();
  flashHelpfulButton();
  notePress(true);
}

function renderPickerCards() {
  pickerCardsEl.innerHTML = '';
  AVATARS.forEach(function(choice) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'who-card' + (avatar && avatar.key === choice.key ? ' is-picked' : '');
    card.setAttribute('aria-label', choice.name);
    const img = document.createElement('img');
    img.src = PICTURES + choice.img;
    img.alt = '';
    const name = document.createElement('span');
    name.className = 'picture-card__name';
    name.textContent = choice.name;
    card.appendChild(img);
    card.appendChild(name);
    card.addEventListener('click', function() { onPickAvatar(choice, card); });
    pickerCardsEl.appendChild(card);
  });
}

function openPicker() {
  hint.stop();
  dropIntro();
  renderPickerCards();
  pickerEl.hidden = false;
  cancelSpeech();
  introTimer = window.setTimeout(function() {
    introTimer = null;
    if (!session.isSessionEnded()) speakText('Who do you want to be?', { rate: 0.9 });
  }, 360);
}

function syncWhoButton() {
  whoBtn.hidden = avatar == null;
  if (avatar) whoBtnImg.src = PICTURES + avatar.img;
}

function onPickAvatar(choice, card) {
  if (pickerTimer != null || session.isSessionEnded()) return;
  pickerCardsEl.querySelectorAll('.who-card').forEach(function(el) { el.classList.remove('is-picked'); });
  card.classList.add('is-picked');
  dropIntro();
  speakText(choice.name, { rate: 0.9 });
  const firstPick = avatar == null;
  avatar = choice;
  saveGardenAvatar(choice);
  syncWhoButton();
  pickerTimer = window.setTimeout(function() {
    pickerTimer = null;
    pickerEl.hidden = true;
    if (firstPick || board == null) {
      MODES[mode].start(true);
      return;
    }
    renderBoard();
    if (mode === 'walk') hint.reset(walkHintWaitMs(lastPress));
    playPieceAnimation(youEl, 'is-hopping');
    speakText("That's you!", { rate: 0.9 });
  }, 700);
}

function stopWalkGame() {
  boardSerial += 1;
  clearWalkTimers();
  hint.stop();
  cancelSpeech();
  locked = false;
}

const MODES = {
  freeplay: { start: enterFreeGarden, usedField: 'usedFreeplay' },
  walk: { start: dealWalkBoard, usedField: 'usedWalk' }
};

function setMode(name) {
  if (session.isSessionEnded()) return;
  stopWalkGame();
  mode = MODES[name] ? name : 'freeplay';
  rememberSessionMode(WALK_SESSION_KEY, mode);
  modeBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  session.mutateStats(function(stats) { stats[MODES[mode].usedField] = true; });
  board = null;
  if (avatar == null) {
    rowEl.innerHTML = '';
    openPicker();
    return;
  }
  pickerEl.hidden = true;
  MODES[mode].start(false);
}

modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (btn.dataset.mode === mode) return;
    setMode(btn.dataset.mode);
    btn.blur();
  });
});

Object.keys(actionBtns).forEach(function(action) {
  actionBtns[action].addEventListener('click', function() { onAction(action); });
});

whoBtn.addEventListener('click', function() {
  if (session.isSessionEnded() || !pickerEl.hidden) return;
  openPicker();
  whoBtn.blur();
});

window.addEventListener('resize', function() {
  if (board) layoutRow();
});

syncWhoButton();

initGamePage({
  session: session,
  stop: stopWalkGame,
  start: function() { setMode(readSessionMode(WALK_SESSION_KEY, 'freeplay')); },
  onResume: function() { setMode(mode); }
});
