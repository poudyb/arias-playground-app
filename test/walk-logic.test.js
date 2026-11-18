'use strict';
const test = require('node:test');
const assert = require('node:assert');
const walk = require('../shared/walk-logic.js');

function boardOf(pattern, buttons) {
  const parsed = walk.parseWalkPattern(pattern);
  return { things: parsed.things, start: parsed.start, goal: parsed.goal, buttons: buttons || walk.WALK_ACTIONS };
}

function sequence(values) {
  let i = 0;
  return function() { return values[i++ % values.length]; };
}

test('a pattern reads into stones, a start and the friend', () => {
  assert.deepStrictEqual(walk.parseWalkPattern('K.L.G.'), {
    things: ['', '', 'log', '', 'stump', ''],
    start: 0,
    goal: 4
  });
  assert.strictEqual(walk.parseWalkPattern(walk.WALK_FREE_GARDEN).goal, -1, 'Free Play has nobody to reach');
  assert.throws(() => walk.parseWalkPattern('K.M.D.'), 'mud is gone');
});

test('mirroring puts the friend on the other side', () => {
  assert.strictEqual(walk.mirrorWalkPattern('K.L.D.'), '.D.L.K');
});

test('she starts facing the friend', () => {
  assert.deepStrictEqual(walk.walkStartState(boardOf('K..D..')), { pos: 0, facing: 'right' });
  assert.deepStrictEqual(walk.walkStartState(boardOf('..D..K')), { pos: 5, facing: 'left' });
});

test('an arrow walks one stone, and stops at the end of the garden', () => {
  const board = boardOf('K..D..');
  assert.deepStrictEqual(walk.walkMove(board, { pos: 0, facing: 'right' }, 'right'), { pos: 1, facing: 'right', result: 'step' });
  assert.deepStrictEqual(walk.walkMove(board, { pos: 0, facing: 'right' }, 'left'), { pos: 0, facing: 'left', result: 'edge' });
});

test('logs, rocks and stumps stop a walk, and the arrow still turns her', () => {
  assert.deepStrictEqual(walk.walkMove(boardOf('K.L.D.'), { pos: 1, facing: 'left' }, 'right'), { pos: 1, facing: 'right', result: 'blocked' });
  assert.strictEqual(walk.walkMove(boardOf('KR..D.'), { pos: 0, facing: 'right' }, 'right').result, 'blocked');
  assert.strictEqual(walk.walkMove(boardOf('K.G...'), { pos: 1, facing: 'right' }, 'right').result, 'blocked');
});

test('jump clears a log or a rock, climbs a stump, and hops on the spot otherwise', () => {
  assert.deepStrictEqual(walk.walkMove(boardOf('K.L.D.'), { pos: 1, facing: 'right' }, 'jump'), { pos: 3, facing: 'right', result: 'over' });
  assert.deepStrictEqual(walk.walkMove(boardOf('D.R.K.'), { pos: 3, facing: 'left' }, 'jump'), { pos: 1, facing: 'left', result: 'over' });
  assert.deepStrictEqual(walk.walkMove(boardOf('K.G...'), { pos: 1, facing: 'right' }, 'jump'), { pos: 2, facing: 'right', result: 'onto' });
  assert.deepStrictEqual(walk.walkMove(boardOf('K..D..'), { pos: 0, facing: 'right' }, 'jump'), { pos: 0, facing: 'right', result: 'hop' });
  assert.strictEqual(walk.walkMove(boardOf('K..D.L'), { pos: 4, facing: 'right' }, 'jump').result, 'hop', 'no stone to land on past the log');
  assert.strictEqual(walk.walkMove(boardOf('K..D..'), { pos: 0, facing: 'left' }, 'jump').result, 'hop', 'at the end of the garden');
});

test('from a stump she walks off either side', () => {
  const board = boardOf('K.T.D.');
  assert.deepStrictEqual(walk.walkMove(board, { pos: 2, facing: 'right' }, 'right'), { pos: 3, facing: 'right', result: 'step' });
  assert.deepStrictEqual(walk.walkMove(board, { pos: 2, facing: 'right' }, 'left'), { pos: 1, facing: 'left', result: 'step' });
  assert.strictEqual(walk.walkMove(board, { pos: 2, facing: 'right' }, 'jump').result, 'hop');
});

test('every board on every rung can be finished with only the buttons that rung shows', () => {
  walk.WALK_LEVELS.forEach((level, idx) => {
    level.patterns.forEach((pattern) => {
      level.sides.forEach((side) => {
        const key = side === 'left' ? walk.mirrorWalkPattern(pattern) : pattern;
        const board = boardOf(key, level.buttons);
        const plan = walk.walkPlan(board, walk.walkStartState(board));
        assert.ok(Number.isFinite(plan.presses), 'rung ' + idx + ' ' + key + ' cannot be finished');
        assert.ok(plan.presses >= 3, 'rung ' + idx + ' ' + key + ' is over too fast');
        assert.ok(level.buttons.includes(plan.firstAction));
        assert.strictEqual(board.goal > board.start, side === 'right', 'rung ' + idx + ' ' + key + ' friend on the wrong side');
      });
    });
  });
});

test('the first two rungs keep the friend to the right, and later ones use both sides', () => {
  assert.deepStrictEqual(walk.WALK_LEVELS[0].sides, ['right']);
  assert.deepStrictEqual(walk.WALK_LEVELS[1].sides, ['right']);
  walk.WALK_LEVELS.slice(2).forEach((level) => {
    assert.deepStrictEqual(level.sides.slice().sort(), ['left', 'right']);
  });
});

test('the first board is the → button alone, with nothing in the way', () => {
  const level = walk.WALK_LEVELS[0];
  assert.deepStrictEqual(level.buttons, ['right']);
  level.patterns.forEach((pattern) => {
    assert.ok(!/[LRTG]/.test(pattern), pattern);
  });
});

test('a rung with something to jump always has the jump button', () => {
  walk.WALK_LEVELS.forEach((level) => {
    const needsJump = level.patterns.some((p) => /[LRTG]/.test(p));
    assert.ok(!needsJump || level.buttons.includes('jump'), level.about);
  });
});

test('the hint points at the shortest way, jump included', () => {
  const board = boardOf('K.L.D.', ['right', 'jump']);
  assert.strictEqual(walk.walkPlan(board, { pos: 0, facing: 'right' }).firstAction, 'right');
  assert.strictEqual(walk.walkPlan(board, { pos: 1, facing: 'right' }).firstAction, 'jump');
  assert.strictEqual(walk.walkPlan(board, { pos: 3, facing: 'right' }).presses, 1);
  assert.strictEqual(walk.walkPlan(board, { pos: 4, facing: 'right' }).presses, 0);
});

test('a press counts against her only when it brings her no closer', () => {
  const board = boardOf('K.L.D.');
  const start = { pos: 1, facing: 'left' };
  const turned = walk.walkMove(board, start, 'right');
  assert.strictEqual(turned.result, 'blocked');
  assert.strictEqual(walk.isWalkPressWasted(board, start, turned), false, 'turning to face the log is progress');
  const facing = { pos: 1, facing: 'right' };
  assert.strictEqual(walk.isWalkPressWasted(board, facing, walk.walkMove(board, facing, 'right')), true, 'bumping the log again');
  assert.strictEqual(walk.isWalkPressWasted(board, facing, walk.walkMove(board, facing, 'left')), true, 'walking away');
  assert.strictEqual(walk.isWalkPressWasted(board, facing, walk.walkMove(board, facing, 'jump')), false);
  const open = { pos: 0, facing: 'right' };
  assert.strictEqual(walk.isWalkPressWasted(board, open, walk.walkMove(board, open, 'jump')), true, 'a hop on the spot');
});

test('one press that goes nowhere is let go; two make the board a missed one', () => {
  assert.strictEqual(walk.walkBoardOutcome(0, false), 'clean');
  assert.strictEqual(walk.walkBoardOutcome(walk.WALK_WASTED_FORGIVEN, false), 'clean');
  assert.strictEqual(walk.walkBoardOutcome(walk.WALK_WASTED_FORGIVEN + 1, false), 'missed');
  assert.strictEqual(walk.walkBoardOutcome(0, true), 'assisted');
  assert.strictEqual(walk.walkBoardOutcome(walk.WALK_WASTED_FORGIVEN + 1, true), 'missed');
});

test('the same board is never dealt twice in a row', () => {
  const first = walk.buildWalkBoard(3, sequence([0]));
  const second = walk.buildWalkBoard(3, sequence([0]), first.key);
  assert.notStrictEqual(second.key, first.key);
});

test('a dealt board carries its rung\'s buttons', () => {
  const board = walk.buildWalkBoard(1, sequence([0.5]));
  assert.deepStrictEqual(board.buttons, ['right', 'jump']);
  assert.strictEqual(board.side, 'right');
});

test('Free Play\'s garden can be walked end to end, over and onto everything', () => {
  const garden = walk.buildFreeGarden();
  const reached = new Set();
  let frontier = [walk.walkStartState(garden)];
  const seen = new Set();
  while (frontier.length > 0) {
    const next = [];
    frontier.forEach((state) => {
      reached.add(state.pos);
      walk.WALK_ACTIONS.forEach((action) => {
        const moved = walk.walkMove(garden, state, action);
        const key = moved.pos + moved.facing;
        if (seen.has(key)) return;
        seen.add(key);
        next.push({ pos: moved.pos, facing: moved.facing });
      });
    });
    frontier = next;
  }
  garden.things.forEach((thing, pos) => {
    const standable = thing !== 'log' && thing !== 'rock';
    assert.strictEqual(reached.has(pos), standable, 'stone ' + pos + ' (' + (thing || 'open') + ')');
  });
});

test('a spoken hint waits until she has stopped, longest while she is on her way', () => {
  assert.ok(walk.walkHintWaitMs('progress') > walk.walkHintWaitMs('nowhere'));
  assert.strictEqual(walk.walkHintWaitMs('none'), walk.walkHintWaitMs('nowhere'));
  assert.ok(walk.walkHintWaitMs('none') >= 8000, 'longer than a toddler\'s pause between presses');
  assert.throws(() => walk.walkHintWaitMs('tap'));
});

test('the silent flash waits for more than one press that goes nowhere', () => {
  assert.ok(walk.WALK_STUCK_PRESSES > 1);
});
