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

test('a seen second card that is not the match is the worse kind: known', () => {
  assert.strictEqual(mem.classifyMemoryTurn(card('cat'), card('dog', true)), 'known');
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('dog', true)), 'known',
    'seen then seen is the worse kind, not a gamble');
});

test('going back to a seen card and gambling on a new one is the milder kind: gamble', () => {
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('dog')), 'gamble');
});

test('the first gamble on a board is let go; later ones count', () => {
  assert.strictEqual(mem.memoryGambleCounts(1), false);
  assert.strictEqual(mem.memoryGambleCounts(2), true);
  assert.strictEqual(mem.memoryGambleCounts(3), true);
});

// The example from the spec: six cards; 1&2, then 1&3, then 1&4.
test('1 & 2, then 1 & 3, then 1 & 4: two gambles, the second one counts', () => {
  const board = [card('a'), card('b'), card('c'), card('d'), card('a'), card('b')];
  let gambles = 0;
  function turn(i, j) {
    const outcome = mem.classifyMemoryTurn(board[i], board[j]);
    board[i].seen = true;
    board[j].seen = true;
    if (outcome === 'gamble') gambles++;
    return outcome;
  }
  assert.strictEqual(turn(0, 1), 'honest');
  assert.strictEqual(turn(0, 2), 'gamble');
  assert.strictEqual(mem.memoryBoardOutcome(0, gambles), 'clean', 'one gamble is let go');
  assert.strictEqual(turn(0, 3), 'gamble');
  assert.strictEqual(mem.memoryBoardOutcome(0, gambles), 'slipped');
});

test('a single known slip is never let go: the board counts as failed', () => {
  assert.strictEqual(mem.memoryBoardOutcome(0, 0), 'clean');
  assert.strictEqual(mem.memoryBoardOutcome(0, 1), 'clean');
  assert.strictEqual(mem.memoryBoardOutcome(0, 2), 'slipped');
  assert.strictEqual(mem.memoryBoardOutcome(0, 3), 'failed');
  assert.strictEqual(mem.memoryBoardOutcome(1, 0), 'failed');
  assert.strictEqual(mem.memoryBoardOutcome(1, 1), 'failed');
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

const shownCard = (key) => ({ key, seen: true, shown: true });

test('a face-up card counts as seen: picking it when it is not the match is a known slip', () => {
  assert.strictEqual(mem.classifyMemoryTurn(shownCard('cat'), shownCard('dog')), 'known');
  assert.strictEqual(mem.classifyMemoryTurn(card('cat'), shownCard('dog')), 'known');
  assert.strictEqual(mem.classifyMemoryTurn(shownCard('cat'), shownCard('cat')), 'match');
});

test('holding a face-up card and turning over a new one is how the game is played, not a gamble', () => {
  assert.strictEqual(mem.classifyMemoryTurn(shownCard('cat'), card('dog')), 'honest');
  assert.strictEqual(mem.classifyMemoryTurn(card('cat', true), card('dog')), 'gamble', 'a turned card still is');
});

test('a board finished only once the hint showed cannot move her up', () => {
  assert.strictEqual(mem.memoryBoardOutcome(0, 0, true), 'slipped');
  assert.strictEqual(mem.memoryBoardOutcome(0, 0, false), 'clean');
  assert.strictEqual(mem.memoryBoardOutcome(1, 0, true), 'failed');
});

test('the ladder starts with two rungs all face up, then hides cards before it grows past four pairs', () => {
  const ladder = mem.MEMORY_LADDER;
  assert.strictEqual(ladder[0].hidden, 0);
  assert.strictEqual(ladder[1].hidden, 0);
  assert.ok(ladder[2].hidden > 0, 'then cards start going face down');
  const firstAllDown = ladder.findIndex((rung) => rung.hidden === 2 * rung.pairs);
  assert.ok(ladder[firstAllDown].pairs >= 4, 'all face down only once the board is a reasonable size');
  ladder.slice(firstAllDown).forEach((rung) => assert.strictEqual(rung.hidden, 2 * rung.pairs));
});

test('each step either grows the board with the same share face down, or hides more at the same size', () => {
  const ladder = mem.MEMORY_LADDER;
  for (let i = 1; i < ladder.length; i++) {
    const prev = ladder[i - 1];
    const rung = ladder[i];
    const grew = rung.pairs > prev.pairs && rung.hidden * prev.pairs === prev.hidden * rung.pairs;
    const hidMore = rung.pairs === prev.pairs && rung.hidden > prev.hidden;
    assert.ok(grew !== hidMore, 'rung ' + i + ' ' + JSON.stringify(rung) + ' after ' + JSON.stringify(prev));
  }
});

test('hiding goes one card of each pair first, then whole pairs', () => {
  const copies = (pairs, hidden) => Array.from({ length: pairs }, (_, i) => mem.memoryHiddenCopies(i, pairs, hidden));
  assert.deepStrictEqual(copies(3, 0), [0, 0, 0]);
  assert.deepStrictEqual(copies(3, 3), [1, 1, 1]);
  assert.deepStrictEqual(copies(4, 6), [2, 2, 1, 1]);
  assert.deepStrictEqual(copies(4, 8), [2, 2, 2, 2]);
  mem.MEMORY_LADDER.forEach((rung) => {
    const total = copies(rung.pairs, rung.hidden).reduce((a, b) => a + b, 0);
    assert.strictEqual(total, rung.hidden, JSON.stringify(rung));
  });
});

const board = (...specs) => specs.map(([key, shown]) => ({ key, shown, matched: false }));

test('the hint points at the lifted card\'s face-up twin, or the first pair wholly face up', () => {
  const cards = board(['cat', true], ['dog', true], ['cat', true], ['dog', true]);
  assert.deepStrictEqual(mem.memoryHintIndices(cards, 1), [3]);
  assert.deepStrictEqual(mem.memoryHintIndices(cards, -1), [0, 2]);
  cards[0].matched = true;
  cards[2].matched = true;
  assert.deepStrictEqual(mem.memoryHintIndices(cards, -1), [1, 3], 'a matched pair is skipped');
  cards[1].matched = true;
  cards[3].matched = true;
  assert.deepStrictEqual(mem.memoryHintIndices(cards, -1), [], 'nothing left to point at');
});

test('the hint never gives away a face-down card', () => {
  const cards = board(['cat', true], ['dog', true], ['cat', false], ['dog', false]);
  assert.deepStrictEqual(mem.memoryHintIndices(cards, 0), [], 'the cat\'s twin is face down');
  assert.deepStrictEqual(mem.memoryHintIndices(cards, -1), [], 'no pair is wholly face up');
  assert.deepStrictEqual(mem.memoryHintIndices(cards, 3), [1], 'a turned-over dog points at the face-up dog');
});
