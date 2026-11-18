// Walk It's rules, kept apart from the page so they can be tested.
//
// The garden is a row of stones. Her character stands on one and moves only
// when she presses a button, one stone per press: the friend she is walking to
// never moves her, however often it is tapped. That is the whole lesson, so no
// rule here may ever turn a tap on the friend into progress.
//
// A board is written as a row of characters, read left to right:
//
//   K  where she starts        .  an open stone
//   D  the friend, on a stone  G  the friend, up on a stump
//   L  a log                   R  a rock
//   T  a stump with nobody on it
//
// Logs and rocks are jumped over. A stump is too tall to walk into, so she jumps
// up onto it and walks off the other side.

const WALK_ACTIONS = ['left', 'right', 'jump'];

const WALK_LEVELS = [
  { buttons: ['right'], sides: ['right'], patterns: ['K..D..', '.K..D.', '..K..D'],
    about: 'the → button only' },
  { buttons: ['right', 'jump'], sides: ['right'], patterns: ['K.L.D.', '.K.L.D', 'K..L.D'],
    about: '→ and jump, with a log in the way' },
  { buttons: ['left', 'right'], sides: ['right', 'left'], patterns: ['K..D..', '.K...D', 'K...D.'],
    about: '← and →, with the friend on either side' },
  { buttons: WALK_ACTIONS, sides: ['right', 'left'], patterns: ['K.L.D.', '.K.R.D', 'K..L.D', 'K.R..D'],
    about: 'all three buttons, with a log or a rock in the way' },
  { buttons: WALK_ACTIONS, sides: ['right', 'left'], patterns: ['K..G..', '.K..G.', 'K...G.'],
    about: 'all three buttons, with the friend up on a stump' },
  { buttons: WALK_ACTIONS, sides: ['right', 'left'], patterns: ['K.R.LD', 'K.L.G.', '.K.R.G', 'KL.R.D', 'K.T.D.'],
    about: 'all three buttons, with two things in the way' }
];

const WALK_FREE_GARDEN = 'K.L.T.R.';

// Presses that don't bring her closer are let go once a board, so the first
// bump into a new log, or one tap on the friend, doesn't hold her back.
const WALK_WASTED_FORGIVEN = 1;

const PATTERN_THINGS = { '.': '', K: '', D: '', G: 'stump', L: 'log', R: 'rock', T: 'stump' };

function parseWalkPattern(pattern) {
  const chars = pattern.split('');
  chars.forEach(function(ch) {
    if (!(ch in PATTERN_THINGS)) throw new Error('Unknown walk pattern character: ' + ch);
  });
  const start = chars.indexOf('K');
  const goal = chars.findIndex(function(ch) { return ch === 'D' || ch === 'G'; });
  if (start === -1) throw new Error('Walk pattern has no start: ' + pattern);
  return {
    things: chars.map(function(ch) { return PATTERN_THINGS[ch]; }),
    start: start,
    goal: goal
  };
}

function mirrorWalkPattern(pattern) {
  return pattern.split('').reverse().join('');
}

function walkFacingToward(from, to) {
  return to < from ? 'left' : 'right';
}

function stepOf(facing) {
  return facing === 'left' ? -1 : 1;
}

// One board for the given rung. `lastKey` is the board before it, which is
// never dealt twice in a row; `random` is injectable so tests can pin it.
function buildWalkBoard(levelIdx, random, lastKey) {
  const rand = random || Math.random;
  const level = WALK_LEVELS[levelIdx];
  const options = [];
  level.patterns.forEach(function(pattern) {
    level.sides.forEach(function(side) {
      options.push({ pattern: side === 'left' ? mirrorWalkPattern(pattern) : pattern, side: side });
    });
  });
  const fresh = options.filter(function(option) { return option.pattern !== lastKey; });
  const pool = fresh.length > 0 ? fresh : options;
  const pick = pool[Math.floor(rand() * pool.length)];
  const parsed = parseWalkPattern(pick.pattern);
  return {
    key: pick.pattern,
    things: parsed.things,
    start: parsed.start,
    goal: parsed.goal,
    side: pick.side,
    buttons: level.buttons.slice()
  };
}

function buildFreeGarden() {
  const parsed = parseWalkPattern(WALK_FREE_GARDEN);
  return {
    key: WALK_FREE_GARDEN,
    things: parsed.things,
    start: parsed.start,
    goal: -1,
    side: 'right',
    buttons: WALK_ACTIONS.slice()
  };
}

function walkStartState(board) {
  return {
    pos: board.start,
    facing: board.goal === -1 ? 'right' : walkFacingToward(board.start, board.goal)
  };
}

function isJumpedOver(thing) {
  return thing === 'log' || thing === 'rock';
}

// What one press does. `result` is what the page shows:
//
//   step    - walked one stone (down off a stump included)
//   edge    - walked into the end of the garden; she stays
//   blocked - walked into a log, a rock or a stump; she stays
//   over    - jumped over the log or rock in front, landing past it
//   onto    - jumped up onto the stump in front
//   hop     - jumped with nothing in front to jump: a hop on the spot
//
// An arrow always turns her to face its way, even when she can't go.
function walkMove(board, state, action) {
  switch (action) {
    case 'left':
    case 'right':
      return walkStep(board.things, state.pos, action);
    case 'jump':
      return walkJump(board.things, state.pos, state.facing);
    default:
      throw new Error('Unknown walk action: ' + action);
  }
}

function walkStep(things, pos, facing) {
  const target = pos + stepOf(facing);
  if (target < 0 || target >= things.length) return { pos: pos, facing: facing, result: 'edge' };
  const ahead = things[target];
  if (isJumpedOver(ahead) || (ahead === 'stump' && things[pos] !== 'stump')) {
    return { pos: pos, facing: facing, result: 'blocked' };
  }
  return { pos: target, facing: facing, result: 'step' };
}

function walkJump(things, pos, facing) {
  const dir = stepOf(facing);
  const front = pos + dir;
  const ahead = things[front];
  if (ahead === 'stump' && things[pos] !== 'stump') return { pos: front, facing: facing, result: 'onto' };
  if (isJumpedOver(ahead) && things[front + dir] === '') return { pos: front + dir, facing: facing, result: 'over' };
  return { pos: pos, facing: facing, result: 'hop' };
}

function stateKey(state) {
  return state.pos + state.facing;
}

// Shortest walk to the friend using only this board's buttons:
// { presses, firstAction }, with presses Infinity when there is no way there.
function walkPlan(board, state) {
  if (state.pos === board.goal) return { presses: 0, firstAction: null };
  const seen = {};
  seen[stateKey(state)] = true;
  let frontier = [{ state: state, firstAction: null }];
  for (let presses = 1; frontier.length > 0; presses++) {
    const next = [];
    for (const node of frontier) {
      const arrivedBy = pressOnceFrom(board, node, seen, next);
      if (arrivedBy) return { presses: presses, firstAction: arrivedBy };
    }
    frontier = next;
  }
  return { presses: Infinity, firstAction: null };
}

// Tries every button once from `node`, queueing new places into `next`.
// Returns the first action of the walk when one of them reaches the friend.
function pressOnceFrom(board, node, seen, next) {
  for (const action of board.buttons) {
    const moved = walkMove(board, node.state, action);
    const firstAction = node.firstAction || action;
    if (moved.pos === board.goal) return firstAction;
    if (!seen[stateKey(moved)]) {
      seen[stateKey(moved)] = true;
      next.push({ state: { pos: moved.pos, facing: moved.facing }, firstAction: firstAction });
    }
  }
  return null;
}

function isWalkPressWasted(board, before, after) {
  return walkPlan(board, after).presses >= walkPlan(board, before).presses;
}

// A voice while she is pressing reads to her as "that was wrong", and she
// switches arrows even when she was on her way. So a hint only speaks once
// she has stopped: the wait runs from her last press, and is longest when
// that press was getting her there. `lastPress` is 'none' on a fresh board.
function walkHintWaitMs(lastPress) {
  switch (lastPress) {
    case 'none':
    case 'nowhere':
      return 8000;
    case 'progress':
      return 15000;
    default:
      throw new Error('Unknown walk press: ' + lastPress);
  }
}

// Presses in a row that go nowhere before the button that would help flashes,
// silently: she is stuck but still trying, so she gets a look, not a voice.
const WALK_STUCK_PRESSES = 2;

// How a finished board went: missed when more presses went nowhere than the
// one forgiven, assisted when she only got there once the hint was showing.
function walkBoardOutcome(wasted, hinted) {
  if (wasted > WALK_WASTED_FORGIVEN) return 'missed';
  if (hinted) return 'assisted';
  return 'clean';
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WALK_ACTIONS,
    WALK_LEVELS,
    WALK_FREE_GARDEN,
    WALK_WASTED_FORGIVEN,
    WALK_STUCK_PRESSES,
    walkHintWaitMs,
    parseWalkPattern,
    mirrorWalkPattern,
    buildWalkBoard,
    buildFreeGarden,
    walkStartState,
    walkMove,
    walkPlan,
    isWalkPressWasted,
    walkBoardOutcome
  };
}
