const stageEl = document.getElementById('maze-stage');
const fieldEl = document.getElementById('maze-field');
const pickerEl = document.getElementById('who-picker');
const pickerCardsEl = document.getElementById('who-cards');
const whoBtn = document.getElementById('who-btn');
const whoBtnImg = document.getElementById('who-btn-img');

const MAZE_SESSION_KEY = 'ariaMazeSession';
const MAZE_LADDER_KEY = 'ariaMazeLadder';
const PICTURES = GARDEN_PICTURES;
const CONFETTI_HEX = ['#558b2f', '#9ccc65', '#ffca28', '#e53935', '#1e88e5', '#8e24aa', '#ff9800', '#26c6da'];
const MOVE_MS = { step: 380, tree: 420, pond: 420, edge: 420 };
const PIECE_ANIMATIONS = ['is-stepping', 'is-hopping', 'is-bumping', 'is-cheering', 'shake'];

let avatar = loadGardenAvatar();
let board = null;
let pos = null;
let facing = 'right';
let friend = null;
let youEl = null;
let friendEl = null;
let ringEl = null;
let spotEl = null;
let thingEls = {};
let tile = 0;
let locked = false;
let wasted = 0;
let hinted = false;
let lastTap = 'none';
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
  storageKey: MAZE_LADDER_KEY,
  rungs: MAZE_LEVELS.length,
  promoteAfter: 2,
  demoteAfter: 2
});

function plural(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 's');
}

function renderSummary(boardEl, stats) {
  const body = createIntroBody(stats.mazeFriends === 0
    ? 'Tap next to you to walk to a friend!'
    : 'You walked to ' + plural(stats.mazeFriends, 'friend') + '!');
  // For the grown-up: how the boards change, which she is never told.
  appendBodyNote(body, 'Now on boards with ' + MAZE_LEVELS[ladder.getRung()].about + '. ' +
    'Two tidy boards in a row move her up, where no more than two taps went nowhere; two messy boards in a row move her back' +
    (stats.mazeBoardsMissed ? ' (' + stats.mazeBoardsMissed + ' messy today)' : '') + '. ' +
    'A bump into a tree, a pond or the edge, a step back, and a tap on the friend each count as a tap that went nowhere' +
    (stats.friendTaps ? ' (' + plural(stats.friendTaps, 'friend tap') + ' today)' : '') + '. ' +
    'A tap away from her moves nothing and counts for nothing' +
    (stats.offTaps ? ' (' + stats.offTaps + ' today)' : '') + '. ' +
    'A board she finishes only after the hint shows leaves her where she is.');
  appendScoreSection(boardEl, { icon: '🌳', title: 'Garden Maze', body: body });
  cancelSpeech();
}

const session = createTimedSession({
  sessionKey: MAZE_SESSION_KEY,
  statsKey: 'ariaMazeStats',
  defaultStats: createMazeStats,
  normalizeStats: normalizeMazeStats,
  stopGame: stopMazeGame,
  renderSummary
});

const audio = createAudioFeedback();

setupInteractionUnlock([function() { audio.getAudioCtx(); }]);

const hint = createHintNudge({
  onFlash: function(speak) {
    hinted = true;
    showSpot();
    if (speak) speakText('Tap next to you!', { rate: 0.9 });
  },
  isActive: function() {
    return board != null && !locked && pickerEl.hidden && !session.isSessionEnded();
  }
});

function clearMazeTimers() {
  [moveTimer, introTimer, cheerTimer, nextTimer, pickerTimer].forEach(function(timer) {
    if (timer != null) clearTimeout(timer);
  });
  moveTimer = null;
  introTimer = null;
  cheerTimer = null;
  nextTimer = null;
  pickerTimer = null;
}

function layoutField() {
  const width = stageEl.clientWidth * 0.94;
  const height = stageEl.clientHeight * 0.92;
  tile = Math.floor(Math.min(width / board.cols, height / board.rows, 220));
  fieldEl.style.setProperty('--tile', tile + 'px');
  fieldEl.style.width = (tile * board.cols) + 'px';
  fieldEl.style.height = (tile * board.rows) + 'px';
}

function placeAt(el, at) {
  el.style.setProperty('--r', String(at.r));
  el.style.setProperty('--c', String(at.c));
}

function addThing(thing, at) {
  const el = document.createElement('div');
  el.className = 'maze-thing maze-' + thing;
  el.setAttribute('aria-hidden', 'true');
  placeAt(el, at);
  if (thing === 'tree') {
    const crown = document.createElement('span');
    crown.className = 'maze-tree__crown';
    el.appendChild(crown);
  }
  fieldEl.appendChild(el);
  thingEls[at.r + ',' + at.c] = el;
}

function makePiece(picture, className, label) {
  const piece = document.createElement('div');
  piece.className = 'maze-piece ' + className;
  piece.style.setProperty('--feet', String(picture.feet));
  const body = document.createElement('div');
  body.className = 'maze-piece__body';
  const img = document.createElement('img');
  img.src = PICTURES + picture.img;
  img.alt = '';
  img.decoding = 'async';
  body.appendChild(img);
  piece.appendChild(body);
  piece.setAttribute('aria-label', label);
  fieldEl.appendChild(piece);
  return piece;
}

function placeYou() {
  placeAt(youEl, pos);
  placeAt(ringEl, pos);
  youEl.style.setProperty('--flip', facing === 'left' ? '-1' : '1');
}

function renderBoard() {
  fieldEl.innerHTML = '';
  thingEls = {};
  board.cells.forEach(function(row, r) {
    row.forEach(function(thing, c) {
      if (thing) addThing(thing, { r: r, c: c });
    });
  });

  ringEl = document.createElement('div');
  ringEl.className = 'maze-ring';
  ringEl.setAttribute('aria-hidden', 'true');
  spotEl = document.createElement('span');
  spotEl.className = 'maze-ring__spot';
  ringEl.appendChild(spotEl);
  fieldEl.appendChild(ringEl);

  friendEl = makePiece(friend, 'maze-piece--friend', friend.key);
  placeAt(friendEl, board.goal);
  friendEl.style.setProperty('--flip', friend.facesFront || board.goal.c >= board.start.c ? '-1' : '1');

  youEl = makePiece(avatar, 'maze-piece--you', 'You, the ' + avatar.name);
  placeYou();

  layoutField();
}

function playPieceAnimation(el, className) {
  PIECE_ANIMATIONS.forEach(function(name) { el.classList.remove(name); });
  void el.offsetWidth;
  el.classList.add(className);
}

function replayClass(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

// The ring breathes once to say "tap here, by me".
function pulseRing() {
  if (ringEl) replayClass(ringEl, 'is-pulsing');
}

// The hint: a glow on the side of the ring that leads the shortest way round.
function showSpot() {
  const dir = mazePlan(board, pos).firstDir;
  if (!dir) return;
  spotEl.dataset.dir = dir;
  replayClass(spotEl, 'is-glowing');
}

function sayIntro(line, greet) {
  if (introTimer != null) clearTimeout(introTimer);
  introTimer = window.setTimeout(function() {
    introTimer = null;
    if (session.isSessionEnded()) return;
    pulseRing();
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

function dealMazeBoard(greet) {
  clearMazeTimers();
  boardSerial += 1;
  const tall = stageEl.clientHeight > stageEl.clientWidth;
  board = buildMazeBoard(ladder.getRung(), Math.random, lastBoardKey, tall);
  lastBoardKey = board.key;
  friend = pickGardenFriend(avatar, lastFriendKey);
  lastFriendKey = friend.key;
  pos = board.start;
  facing = board.goal.c < board.start.c ? 'left' : 'right';
  wasted = 0;
  hinted = false;
  lastTap = 'none';
  nowhereStreak = 0;
  locked = false;
  renderBoard();
  sayIntro('Walk to the ' + friend.key + '!', greet);
  hint.reset(mazeHintWaitMs(lastTap));
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

function finishMazeBoard() {
  locked = true;
  hint.stop();
  ringEl.classList.add('is-gone');
  const outcome = mazeBoardOutcome(wasted, hinted);
  ladder.recordRound(outcome);
  session.mutateStats(function(stats) {
    stats.mazeFriends += 1;
    if (outcome === 'missed') stats.mazeBoardsMissed += 1;
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
    if (serial === boardSerial && !session.isSessionEnded()) dealMazeBoard(false);
  }, 2600);
}

// Arriving on the friend's tile, the two stand side by side instead of on
// top of each other, each leaning away along the way she came in.
function standBeside(dir) {
  const away = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[dir];
  youEl.style.setProperty('--nudge-x', (away[0] * 0.24) + '');
  youEl.style.setProperty('--nudge-y', (away[1] * 0.18) + '');
  friendEl.style.setProperty('--nudge-x', (-away[0] * 0.2) + '');
  friendEl.style.setProperty('--nudge-y', (-away[1] * 0.14) + '');
}

function bumpInto(result, dir) {
  youEl.dataset.dir = dir;
  playPieceAnimation(youEl, 'is-bumping');
  audio.playBump();
  if (result === 'edge') return;
  const step = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
  const thingEl = thingEls[(pos.r + step[0]) + ',' + (pos.c + step[1])];
  if (thingEl) replayClass(thingEl, 'is-bumped');
}

// She is trying something: the voice stops, and the spoken hint waits again.
function noteTap(wentNowhere) {
  if (wentNowhere) {
    wasted += 1;
    nowhereStreak += 1;
    lastTap = 'nowhere';
    if (nowhereStreak >= MAZE_STUCK_TAPS) showSpot();
  } else {
    nowhereStreak = 0;
    lastTap = 'progress';
  }
  hint.reset(mazeHintWaitMs(lastTap));
}

function quietForHerTap() {
  dropIntro();
  cancelSpeech();
}

function canTap() {
  return board != null && !locked && pickerEl.hidden && !session.isSessionEnded();
}

function showTapMark(x, y) {
  const mark = document.createElement('span');
  mark.className = 'maze-tap-mark';
  mark.style.left = x + 'px';
  mark.style.top = y + 'px';
  mark.setAttribute('aria-hidden', 'true');
  fieldEl.appendChild(mark);
  window.setTimeout(function() { mark.remove(); }, 500);
}

function step(dir) {
  quietForHerTap();
  const before = pos;
  const moved = mazeMove(board, pos, dir);
  const wentNowhere = isMazeTapWasted(board, before, moved.pos);
  if (dir === 'left' || dir === 'right') facing = dir;

  if (moved.result === 'step') {
    pos = moved.pos;
    placeYou();
    playPieceAnimation(youEl, 'is-stepping');
    audio.playStep();
  } else {
    placeYou();
    bumpInto(moved.result, dir);
    session.mutateStats(function(stats) { stats.bumps += 1; });
  }

  const reached = moved.pos.r === board.goal.r && moved.pos.c === board.goal.c;
  if (reached) standBeside(dir);
  else noteTap(wentNowhere);

  const serial = boardSerial;
  locked = true;
  moveTimer = window.setTimeout(function() {
    moveTimer = null;
    if (serial !== boardSerial) return;
    if (reached) finishMazeBoard();
    else locked = false;
  }, MOVE_MS[moved.result]);
}

function onFriendTap() {
  quietForHerTap();
  session.mutateStats(function(stats) { stats.friendTaps += 1; });
  playPieceAnimation(friendEl, 'shake');
  audio.playSoftTone();
  pulseRing();
  noteTap(true);
}

function onStageTap(event) {
  if (!canTap()) return;
  const fieldRect = fieldEl.getBoundingClientRect();
  const x = event.clientX - fieldRect.left;
  const y = event.clientY - fieldRect.top;
  const offset = { x: x / tile - (pos.c + 0.5), y: y / tile - (pos.r + 0.5) };
  const friendOffset = { x: board.goal.c - pos.c, y: board.goal.r - pos.r };
  if (event.target.closest('.maze-piece--friend')) {
    onFriendTap();
    return;
  }
  const dir = mazeTapDirection(offset, friendOffset);
  if (dir) {
    showTapMark(x, y);
    step(dir);
    return;
  }
  if (Math.hypot(offset.x - friendOffset.x, offset.y - friendOffset.y) <= MAZE_FRIEND_RADIUS) {
    onFriendTap();
    return;
  }
  // Away from her: nothing moves, and the ring breathes to show where to tap.
  session.mutateStats(function(stats) { stats.offTaps += 1; });
  pulseRing();
  hint.poke();
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
      dealMazeBoard(true);
      return;
    }
    if (friend.key === avatar.key) {
      dealMazeBoard(true);
      return;
    }
    renderBoard();
    hint.reset(mazeHintWaitMs(lastTap));
    playPieceAnimation(youEl, 'is-hopping');
    speakText("That's you!", { rate: 0.9 });
  }, 700);
}

function stopMazeGame() {
  boardSerial += 1;
  clearMazeTimers();
  hint.stop();
  cancelSpeech();
  locked = false;
}

function startMaze() {
  if (session.isSessionEnded()) return;
  stopMazeGame();
  board = null;
  if (avatar == null) {
    fieldEl.innerHTML = '';
    openPicker();
    return;
  }
  pickerEl.hidden = true;
  dealMazeBoard(false);
}

stageEl.addEventListener('click', onStageTap);

whoBtn.addEventListener('click', function() {
  if (session.isSessionEnded() || !pickerEl.hidden) return;
  openPicker();
  whoBtn.blur();
});

window.addEventListener('resize', function() {
  if (board) layoutField();
});

syncWhoButton();

initGamePage({
  session: session,
  stop: stopMazeGame,
  start: startMaze,
  onResume: startMaze
});
