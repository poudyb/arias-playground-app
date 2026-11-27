'use strict';
const test = require('node:test');
const assert = require('node:assert');
const maze = require('../shared/maze-logic.js');

function sequence(values) {
  let i = 0;
  return function() { return values[i++ % values.length]; };
}

// Every board the game can deal: each rung's patterns in every flip, and on
// its side for a tall screen.
function everyBoard() {
  const boards = [];
  maze.MAZE_LEVELS.forEach((level, rung) => {
    level.patterns.forEach((pattern) => {
      maze.mazeVariants(pattern).forEach((rows) => {
        boards.push({ rung, rows, board: maze.boardFromRows(rows) });
      });
    });
  });
  return boards;
}

function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

// Walking straight at the friend: every tap goes the way that closes the
// bigger gap, and the other closing way only when that one is blocked.
function walkStraightAt(board) {
  let pos = board.start;
  for (let taps = 0; taps < 100; taps++) {
    if (pos.r === board.goal.r && pos.c === board.goal.c) return true;
    const dr = board.goal.r - pos.r;
    const dc = board.goal.c - pos.c;
    const vertical = dr < 0 ? 'up' : 'down';
    const horizontal = dc < 0 ? 'left' : 'right';
    const ways = Math.abs(dc) >= Math.abs(dr)
      ? [dc && horizontal, dr && vertical]
      : [dr && vertical, dc && horizontal];
    const moved = ways.filter(Boolean)
      .map((dir) => maze.mazeMove(board, pos, dir))
      .find((m) => m.result === 'step');
    if (!moved) return false;
    pos = moved.pos;
  }
  return false;
}

test('a pattern reads into grass, trees, ponds, a start and the friend', () => {
  const board = maze.boardFromRows(['.T.', 'K.F', '..P']);
  assert.strictEqual(board.cols, 3);
  assert.strictEqual(board.rows, 3);
  assert.deepStrictEqual(board.start, { r: 1, c: 0 });
  assert.deepStrictEqual(board.goal, { r: 1, c: 2 });
  assert.deepStrictEqual(board.cells, [['', 'tree', ''], ['', '', ''], ['', '', 'pond']]);
  assert.throws(() => maze.boardFromRows(['K.X.F']), 'unknown thing');
  assert.throws(() => maze.boardFromRows(['K..', '.F']), 'ragged rows');
});

test('a board can be flipped either way and turned on its side', () => {
  assert.deepStrictEqual(maze.mirrorMazeRows(['K.T', '..F']), ['T.K', 'F..']);
  assert.deepStrictEqual(maze.flipMazeRows(['K.T', '..F']), ['..F', 'K.T']);
  assert.deepStrictEqual(maze.transposeMazeRows(['K.T', '..F']), ['K.', '..', 'TF']);
});

test('walking straight at the friend never works on any board', () => {
  everyBoard().forEach(({ rung, rows, board }) => {
    assert.strictEqual(walkStraightAt(board), false, 'rung ' + rung + ' ' + rows.join('/') + ' can be walked straight');
    const plan = maze.mazePlan(board, board.start);
    assert.ok(plan.taps > manhattan(board.start, board.goal),
      'rung ' + rung + ' ' + rows.join('/') + ' has a straight way that is as short as any');
  });
});

test('every board can be finished, and takes a few taps', () => {
  everyBoard().forEach(({ rung, rows, board }) => {
    const plan = maze.mazePlan(board, board.start);
    assert.ok(Number.isFinite(plan.taps), 'rung ' + rung + ' ' + rows.join('/') + ' cannot be finished');
    assert.ok(plan.taps >= 3, 'rung ' + rung + ' ' + rows.join('/') + ' is over too fast');
    assert.ok(maze.MAZE_DIRECTIONS.includes(plan.firstDir));
  });
});

test('every board stays sparse: a tree or pond for no more than one tile in six', () => {
  everyBoard().forEach(({ rung, rows, board }) => {
    const things = board.cells.flat().filter(Boolean).length;
    assert.ok(things >= 1, 'rung ' + rung + ' ' + rows.join('/') + ' has nothing in the way');
    assert.ok(things * 6 <= board.cols * board.rows, 'rung ' + rung + ' ' + rows.join('/') + ' is crowded');
  });
});

test('the rungs grow a step at a time: never a smaller garden or a shorter walk', () => {
  const summary = maze.MAZE_LEVELS.map((level) => {
    const boards = level.patterns.map((p) => maze.boardFromRows(p));
    return {
      tiles: Math.min(...boards.map((b) => b.cols * b.rows)),
      taps: boards.reduce((sum, b) => sum + maze.mazePlan(b, b.start).taps, 0) / boards.length,
      things: Math.max(...boards.map((b) => b.cells.flat().filter(Boolean).length))
    };
  });
  for (let i = 1; i < summary.length; i++) {
    assert.ok(summary[i].tiles >= summary[i - 1].tiles, 'rung ' + i + ' garden shrinks');
    assert.ok(summary[i].taps > summary[i - 1].taps, 'rung ' + i + ' walk is no longer');
    assert.ok(summary[i].things - summary[i - 1].things <= 1, 'rung ' + i + ' adds more than one thing');
  }
});

test('a tap moves her one tile, and a tree, a pond or the edge is a bump in place', () => {
  const board = maze.boardFromRows(['.T.', 'K.F', 'P..']);
  assert.deepStrictEqual(maze.mazeMove(board, { r: 1, c: 0 }, 'right'), { pos: { r: 1, c: 1 }, result: 'step' });
  assert.deepStrictEqual(maze.mazeMove(board, { r: 1, c: 0 }, 'left'), { pos: { r: 1, c: 0 }, result: 'edge' });
  assert.deepStrictEqual(maze.mazeMove(board, { r: 1, c: 0 }, 'down'), { pos: { r: 1, c: 0 }, result: 'pond' });
  assert.deepStrictEqual(maze.mazeMove(board, { r: 1, c: 1 }, 'up'), { pos: { r: 1, c: 1 }, result: 'tree' });
  assert.deepStrictEqual(maze.mazeMove(board, { r: 0, c: 0 }, 'up'), { pos: { r: 0, c: 0 }, result: 'edge' });
});

test('only a tap inside the ring around her counts, toward the side tapped', () => {
  assert.strictEqual(maze.mazeTapDirection({ x: 0.7, y: 0.1 }), 'right');
  assert.strictEqual(maze.mazeTapDirection({ x: -0.6, y: -0.2 }), 'left');
  assert.strictEqual(maze.mazeTapDirection({ x: 0.2, y: -0.8 }), 'up');
  assert.strictEqual(maze.mazeTapDirection({ x: -0.3, y: 0.5 }), 'down');
  assert.strictEqual(maze.mazeTapDirection({ x: 0.05, y: 0.05 }), null, 'right on her middle says no side');
  assert.strictEqual(maze.mazeTapDirection({ x: 1.6, y: 0 }), null, 'outside the ring');
  assert.strictEqual(maze.mazeTapDirection({ x: 3, y: 2 }), null, 'far away');
});

test('a tap on the friend never moves her, even with the friend right beside her', () => {
  const offsets = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  offsets.forEach((friend) => {
    [0, 0.2, -0.2, 0.3].forEach((jitter) => {
      const tap = { x: friend.x + (friend.y ? jitter : 0), y: friend.y + (friend.x ? jitter : 0) };
      assert.strictEqual(maze.mazeTapDirection(tap, friend), null, JSON.stringify({ friend, tap }));
    });
    const between = { x: friend.x * 0.4, y: friend.y * 0.4 };
    assert.ok(maze.mazeTapDirection(between, friend), 'the ring between them still steps toward the friend');
  });
});

test('the hint points along the shortest way around', () => {
  const board = maze.boardFromRows(['...', 'KTF', '...']);
  const plan = maze.mazePlan(board, board.start);
  assert.strictEqual(plan.taps, 4);
  assert.ok(plan.firstDir === 'up' || plan.firstDir === 'down');
  assert.strictEqual(maze.mazePlan(board, { r: 0, c: 1 }).firstDir, 'right');
  assert.strictEqual(maze.mazePlan(board, board.goal).taps, 0);
});

test('a tap counts against her only when it brings her no closer', () => {
  const board = maze.boardFromRows(['...', 'KTF', '...']);
  const start = board.start;
  assert.strictEqual(maze.isMazeTapWasted(board, start, maze.mazeMove(board, start, 'up').pos), false, 'stepping round the tree');
  assert.strictEqual(maze.isMazeTapWasted(board, start, maze.mazeMove(board, start, 'right').pos), true, 'bumping the tree');
  assert.strictEqual(maze.isMazeTapWasted(board, start, maze.mazeMove(board, start, 'left').pos), true, 'bumping the edge');
  assert.strictEqual(maze.isMazeTapWasted(board, { r: 0, c: 1 }, { r: 0, c: 0 }), true, 'walking back');
});

test('two taps that go nowhere are let go; three make the board a missed one', () => {
  assert.strictEqual(maze.mazeBoardOutcome(0, false), 'clean');
  assert.strictEqual(maze.mazeBoardOutcome(maze.MAZE_WASTED_FORGIVEN, false), 'clean');
  assert.strictEqual(maze.mazeBoardOutcome(maze.MAZE_WASTED_FORGIVEN + 1, false), 'missed');
  assert.strictEqual(maze.mazeBoardOutcome(0, true), 'assisted');
  assert.strictEqual(maze.mazeBoardOutcome(maze.MAZE_WASTED_FORGIVEN + 1, true), 'missed');
});

test('the same board is never dealt twice in a row, and a tall screen gets a tall board', () => {
  const first = maze.buildMazeBoard(2, sequence([0]), null, false);
  const second = maze.buildMazeBoard(2, sequence([0]), first.key, false);
  assert.notStrictEqual(second.key, first.key);
  maze.MAZE_LEVELS.forEach((_, rung) => {
    const wide = maze.buildMazeBoard(rung, sequence([0.3]), null, false);
    const tall = maze.buildMazeBoard(rung, sequence([0.3]), null, true);
    assert.ok(wide.cols >= wide.rows, 'rung ' + rung + ' wide');
    assert.ok(tall.rows >= tall.cols, 'rung ' + rung + ' tall');
  });
});

test('a spoken hint waits until she has stopped, longest while she is on her way', () => {
  assert.ok(maze.mazeHintWaitMs('progress') > maze.mazeHintWaitMs('nowhere'));
  assert.strictEqual(maze.mazeHintWaitMs('none'), maze.mazeHintWaitMs('nowhere'));
  assert.throws(() => maze.mazeHintWaitMs('sideways'));
});
