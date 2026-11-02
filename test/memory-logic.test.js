'use strict';
const test = require('node:test');
const assert = require('node:assert');
const mem = require('../shared/memory-logic.js');

const card = (key, seen) => ({ key, seen: !!seen });

test('a match is never a slip, however the turn got there', () => {
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('cat', true)), 'match');
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('cat', false)), 'match');
  assert.strictEqual(mem.classifyMemoryTurn(card('cat'), card('cat')), 'match');
});

test('two new cards that do not match are honest exploring', () => {
  assert.strictEqual(mem.classifyMemoryTurn(card('cat'), card('dog')), 'honest');
});

test('turning a card she has already seen, that is not the match, is a slip', () => {
  assert.strictEqual(mem.classifyMemoryTurn(card('cat'), card('dog', true)), 'slip');
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('dog', true)), 'slip');
});

test('going back to a seen card and gambling on a new one is a slip', () => {
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('dog')), 'slip');
});

// The example from the spec: six cards; 1&2, then 1&3, then 1&4.
test('1 & 2, then 1 & 3, then 1 & 4: the third turn fails the board', () => {
  const board = [card('a'), card('b'), card('c'), card('d'), card('a'), card('b')];
  let slips = 0;
  function turn(i, j) {
    const outcome = mem.classifyMemoryTurn(board[i], board[j]);
    board[i].seen = true;
    board[j].seen = true;
    if (outcome === 'slip') slips++;
    return outcome;
  }
  assert.strictEqual(turn(0, 1), 'honest');
  assert.strictEqual(turn(0, 2), 'slip');
  assert.strictEqual(mem.memoryBoardFailed(slips), false, 'one slip is let go');
  assert.strictEqual(turn(0, 3), 'slip');
  assert.strictEqual(mem.memoryBoardFailed(slips), true);
});

test('only a clean board moves her up a size', () => {
  assert.deepStrictEqual(mem.nextMemoryLevel(2, 'clean', 0, 7), { level: 3, failStreak: 0 });
  assert.deepStrictEqual(mem.nextMemoryLevel(2, 'slipped', 0, 7), { level: 2, failStreak: 0 });
  assert.deepStrictEqual(mem.nextMemoryLevel(6, 'clean', 0, 7), { level: 6, failStreak: 0 }, 'capped at the top');
});

test('one failed board repeats the size; two in a row drop one', () => {
  const once = mem.nextMemoryLevel(3, 'failed', 0, 7);
  assert.deepStrictEqual(once, { level: 3, failStreak: 1 });
  assert.deepStrictEqual(mem.nextMemoryLevel(3, 'failed', once.failStreak, 7), { level: 2, failStreak: 0 });
  assert.deepStrictEqual(mem.nextMemoryLevel(0, 'failed', 1, 7), { level: 0, failStreak: 0 }, 'never below the first');
});

test('any finished board clears the failed streak', () => {
  assert.deepStrictEqual(mem.nextMemoryLevel(3, 'slipped', 1, 7), { level: 3, failStreak: 0 });
  assert.deepStrictEqual(mem.nextMemoryLevel(3, 'failed', 'junk', 7), { level: 3, failStreak: 1 });
});
