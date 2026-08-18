'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { clampChaseBounds, bounceChaseOffWalls } = require('../shared/collection-activity.js');

// A chase entry whose visible content is inset from its element box: a 100x100
// box whose ink occupies the middle 60x60 (20px of padding on every side).
function entry(overrides) {
  return Object.assign({
    x: 0, y: 0, vx: 10, vy: 10,
    w: 100, h: 100,
    hitLeft: 20, hitTop: 20, hitRight: 80, hitBottom: 80
  }, overrides);
}

test('content bounds pass through when they sit inside the element box', () => {
  assert.deepStrictEqual(
    clampChaseBounds({ left: 20, top: 25, right: 80, bottom: 75 }, 100, 100),
    { left: 20, top: 25, right: 80, bottom: 75 }
  );
});

test('bounds spilling outside the element box are clamped to it', () => {
  assert.deepStrictEqual(
    clampChaseBounds({ left: -15, top: -5, right: 130, bottom: 110 }, 100, 100),
    { left: 0, top: 0, right: 100, bottom: 100 }
  );
});

test('a degenerate measurement falls back to the whole box, never to nothing', () => {
  // Zero-area and inverted bounds both mean the measurement told us nothing.
  assert.deepStrictEqual(
    clampChaseBounds({ left: 50, top: 50, right: 50, bottom: 50 }, 100, 100),
    { left: 0, top: 0, right: 100, bottom: 100 }
  );
  assert.deepStrictEqual(
    clampChaseBounds({ left: 90, top: 90, right: 10, bottom: 10 }, 100, 100),
    { left: 0, top: 0, right: 100, bottom: 100 }
  );
});

test('an unlaid-out element (no size yet) yields a zero box rather than NaNs', () => {
  assert.deepStrictEqual(
    clampChaseBounds({ left: 0, top: 0, right: 0, bottom: 0 }, 0, 0),
    { left: 0, top: 0, right: 0, bottom: 0 }
  );
});

test('padding may cross the wall — only the visible content is kept on screen', () => {
  // Travelling left, content edge is exactly at x=0 while the box hangs off it.
  const e = entry({ x: -25, vx: -10 });
  bounceChaseOffWalls(e, 800, 600);
  assert.strictEqual(e.x, -20, 'box sits 20px off-screen so the ink starts at 0');
  assert.strictEqual(e.vx, 10, 'sent back inwards');
});

test('an item well inside the arena is left completely alone', () => {
  const e = entry({ x: 300, y: 200, vx: -10, vy: -10 });
  bounceChaseOffWalls(e, 800, 600);
  assert.deepStrictEqual(
    { x: e.x, y: e.y, vx: e.vx, vy: e.vy },
    { x: 300, y: 200, vx: -10, vy: -10 }
  );
});

test('the right and bottom walls stop the content, not the box', () => {
  const e = entry({ x: 780, y: 580, vx: 10, vy: 10 });
  bounceChaseOffWalls(e, 800, 600);
  assert.strictEqual(e.x, 720, 'content right edge lands on 800');
  assert.strictEqual(e.y, 520, 'content bottom edge lands on 600');
  assert.strictEqual(e.vx, -10);
  assert.strictEqual(e.vy, -10);
});

test('velocity is set by which wall was hit, so a bounce never re-flips', () => {
  // Already moving away from the left wall: direction must be preserved, not
  // negated back into the wall.
  const e = entry({ x: -30, vx: 10 });
  bounceChaseOffWalls(e, 800, 600);
  assert.strictEqual(e.vx, 10);
});

test('an item wider than the arena settles instead of buzzing on both walls', () => {
  // Content (60 wide) is wider than this 40px arena, so both edge tests match.
  // Direction is assigned, not toggled, so repeated frames converge.
  const e = entry({ x: 0, vx: 10 });
  bounceChaseOffWalls(e, 40, 600);
  const first = { x: e.x, vx: e.vx };
  bounceChaseOffWalls(e, 40, 600);
  assert.deepStrictEqual({ x: e.x, vx: e.vx }, first, 'stable across frames');
});
