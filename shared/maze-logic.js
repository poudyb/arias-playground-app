// Garden Maze's rules, kept apart from the page so they can be tested.
//
// The garden is seen from above: a grid of grass tiles with a few trees and
// ponds that never move. Her character stands on one tile and a friend on
// another. She moves only by tapping inside the soft ring around her, one tile
// per tap, toward the side of the ring she tapped. A tap anywhere else does
// nothing, and a tap on the friend never moves her, even when the friend is
// standing right beside her: getting there is the whole lesson.
//
// Every board puts a tree or a pond across the straight way, so walking
// straight at the friend never works and she has to go round. A test checks
// every board, flipped and turned, for that.
//
// A board is written as rows of characters, top to bottom:
//
//   K  where she starts     .  grass
//   F  the friend           T  a tree
//                           P  a pond

const MAZE_DIRECTIONS = ['up', 'down', 'left', 'right'];

const MAZE_LEVELS = [
  { about: 'one tree between her and the friend, a short walk round',
    patterns: [
      ['.....', '.KTF.', '.....'],
      ['.....', 'K.TF.', '.....'],
      ['.....', '.KT.F', '.....']
    ] },
  { about: 'a pond in the way and a longer walk',
    patterns: [
      ['......', 'K..P.F', '......'],
      ['......', '.K.P.F', '......'],
      ['......', 'K.P..F', '......']
    ] },
  { about: 'one tree or pond along the edge, so only one way round',
    patterns: [
      ['K..T..F', '.......', '.......'],
      ['.K..P.F', '.......', '.......'],
      ['K...T.F', '.......', '.......']
    ] },
  { about: 'two in a row across the way, a longer way round',
    patterns: [
      ['.......', 'K..T..F', '...T...', '.......'],
      ['K..T..F', '...P...', '.......', '.......'],
      ['.......', '.K.T..F', '...P...', '.......']
    ] },
  { about: 'the friend tucked behind a tree and a pond, reached from the far side',
    patterns: [
      ['....TF.', '.....P.', '.......', 'K......'],
      ['.......', 'K.....P', '.....TF', '.......'],
      ['.......', '..FT...', '..P....', '......K']
    ] },
  { about: 'a bigger garden, the friend tucked away and one more tree on the way',
    patterns: [
      ['........', '......TF', '...T...P', '........', 'K.......'],
      ['K.......', '...P....', '........', '......P.', '.....TF.'],
      ['.......K', '........', 'P....T..', 'FT......', '........']
    ] }
];

const MAZE_THINGS = { '.': '', K: '', F: '', T: 'tree', P: 'pond' };

const MAZE_STEPS = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 }
};

// The ring is measured in tiles from the middle of her tile. It reaches about
// halfway into the tiles beside her; a tap right on her middle names no side.
const MAZE_RING_RADIUS = 1.05;
const MAZE_RING_HOLE = 0.15;
// A tap this close to the friend is a tap on the friend, never a step.
const MAZE_FRIEND_RADIUS = 0.45;

// Taps that don't bring her closer are let go twice a board: bumping into a
// tree is how she finds it, so the first bump or two must not hold her back.
const MAZE_WASTED_FORGIVEN = 2;

// Taps in a row that go nowhere before the helpful side of the ring glows,
// silently: she is stuck but still trying, so she gets a look, not a voice.
const MAZE_STUCK_TAPS = 2;

function boardFromRows(rows) {
  const cols = rows[0].length;
  let start = null;
  let goal = null;
  const cells = rows.map(function(row, r) {
    if (row.length !== cols) throw new Error('Maze rows differ in length: ' + rows.join('/'));
    return row.split('').map(function(ch, c) {
      if (!(ch in MAZE_THINGS)) throw new Error('Unknown maze character: ' + ch);
      if (ch === 'K') start = { r: r, c: c };
      if (ch === 'F') goal = { r: r, c: c };
      return MAZE_THINGS[ch];
    });
  });
  if (!start || !goal) throw new Error('Maze needs a start and a friend: ' + rows.join('/'));
  return { key: rows.join('/'), cols: cols, rows: rows.length, cells: cells, start: start, goal: goal };
}

function mirrorMazeRows(rows) {
  return rows.map(function(row) { return row.split('').reverse().join(''); });
}

function flipMazeRows(rows) {
  return rows.slice().reverse();
}

function transposeMazeRows(rows) {
  const out = [];
  for (let c = 0; c < rows[0].length; c++) {
    out.push(rows.map(function(row) { return row[c]; }).join(''));
  }
  return out;
}

// The four ways a pattern can be dealt on a wide screen: as written, mirrored,
// flipped top to bottom, and both.
function mazeVariants(rows) {
  const mirrored = mirrorMazeRows(rows);
  return [rows, mirrored, flipMazeRows(rows), flipMazeRows(mirrored)];
}

// One board for the given rung. `lastKey` is the board before it, which is
// never dealt twice in a row; `tall` turns it on its side for a portrait
// screen; `random` is injectable so tests can pin it.
function buildMazeBoard(levelIdx, random, lastKey, tall) {
  const rand = random || Math.random;
  const options = [];
  MAZE_LEVELS[levelIdx].patterns.forEach(function(pattern) {
    mazeVariants(pattern).forEach(function(rows) {
      options.push(tall ? transposeMazeRows(rows) : rows);
    });
  });
  const fresh = options.filter(function(rows) { return rows.join('/') !== lastKey; });
  const pool = fresh.length > 0 ? fresh : options;
  return boardFromRows(pool[Math.floor(rand() * pool.length)]);
}

function samePlace(a, b) {
  return a.r === b.r && a.c === b.c;
}

// What one tap toward `dir` does. `result` is what the page shows:
//
//   step  - walked one tile
//   tree  - walked into a tree; she stays
//   pond  - walked into a pond; she stays
//   edge  - walked into the end of the garden; she stays
function mazeMove(board, pos, dir) {
  const step = MAZE_STEPS[dir];
  if (!step) throw new Error('Unknown maze direction: ' + dir);
  const r = pos.r + step.r;
  const c = pos.c + step.c;
  if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) return { pos: pos, result: 'edge' };
  const thing = board.cells[r][c];
  if (thing) return { pos: pos, result: thing };
  return { pos: { r: r, c: c }, result: 'step' };
}

// Shortest walk to the friend: { taps, firstDir }, with taps Infinity when
// there is no way there.
function mazePlan(board, pos) {
  if (samePlace(pos, board.goal)) return { taps: 0, firstDir: null };
  const seen = {};
  seen[pos.r + ',' + pos.c] = true;
  let frontier = [{ pos: pos, firstDir: null }];
  for (let taps = 1; frontier.length > 0; taps++) {
    const next = [];
    for (const node of frontier) {
      for (const dir of MAZE_DIRECTIONS) {
        const moved = mazeMove(board, node.pos, dir);
        if (moved.result !== 'step') continue;
        const firstDir = node.firstDir || dir;
        if (samePlace(moved.pos, board.goal)) return { taps: taps, firstDir: firstDir };
        const key = moved.pos.r + ',' + moved.pos.c;
        if (seen[key]) continue;
        seen[key] = true;
        next.push({ pos: moved.pos, firstDir: firstDir });
      }
    }
    frontier = next;
  }
  return { taps: Infinity, firstDir: null };
}

function isMazeTapWasted(board, before, after) {
  return mazePlan(board, after).taps >= mazePlan(board, before).taps;
}

// Which way a tap steers her. `tap` and `friend` are offsets from the middle
// of her tile, in tiles, with y growing downward. A tap on the friend, a tap
// on her middle, and a tap outside the ring all give null: nothing moves.
function mazeTapDirection(tap, friend) {
  if (friend && Math.hypot(tap.x - friend.x, tap.y - friend.y) <= MAZE_FRIEND_RADIUS) return null;
  const reach = Math.hypot(tap.x, tap.y);
  if (reach < MAZE_RING_HOLE || reach > MAZE_RING_RADIUS) return null;
  if (Math.abs(tap.x) >= Math.abs(tap.y)) return tap.x < 0 ? 'left' : 'right';
  return tap.y < 0 ? 'up' : 'down';
}

// A voice while she is tapping reads to her as "that was wrong", so a hint
// only speaks once she has stopped: the wait runs from her last tap, and is
// longest when that tap was getting her there. `lastTap` is 'none' on a
// fresh board.
function mazeHintWaitMs(lastTap) {
  switch (lastTap) {
    case 'none':
    case 'nowhere':
      return 8000;
    case 'progress':
      return 15000;
    default:
      throw new Error('Unknown maze tap: ' + lastTap);
  }
}

// How a finished board went: missed when more taps went nowhere than the two
// forgiven, assisted when she only got there once the hint was showing.
function mazeBoardOutcome(wasted, hinted) {
  if (wasted > MAZE_WASTED_FORGIVEN) return 'missed';
  if (hinted) return 'assisted';
  return 'clean';
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAZE_DIRECTIONS,
    MAZE_LEVELS,
    MAZE_RING_RADIUS,
    MAZE_RING_HOLE,
    MAZE_FRIEND_RADIUS,
    MAZE_WASTED_FORGIVEN,
    MAZE_STUCK_TAPS,
    boardFromRows,
    mirrorMazeRows,
    flipMazeRows,
    transposeMazeRows,
    mazeVariants,
    buildMazeBoard,
    mazeMove,
    mazePlan,
    isMazeTapWasted,
    mazeTapDirection,
    mazeHintWaitMs,
    mazeBoardOutcome
  };
}
