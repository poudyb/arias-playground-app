'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { SPELLING_WORDS } = require('../data/spelling.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'spelling');

test('every word is three lowercase letters', () => {
  for (const w of SPELLING_WORDS) {
    assert.match(w.word, /^[a-z]{3}$/, w.word + ' is not a 3-letter lowercase word');
  }
});

test('no word appears twice', () => {
  const seen = new Set();
  for (const w of SPELLING_WORDS) {
    assert.ok(!seen.has(w.word), 'duplicate word: ' + w.word);
    seen.add(w.word);
  }
});

// Two words sharing one ARASAAC pictogram means the same drawing is being
// taught as two different words — the cup/mug bug. Distinct ids don't prove
// two pictures are conceptually distinct, but identical ones prove they aren't.
test('no two words share the same picture', () => {
  const byId = new Map();
  for (const w of SPELLING_WORDS) {
    const clash = byId.get(w.id);
    assert.ok(!clash, 'pictogram #' + w.id + ' used for both ' + clash + ' and ' + w.word);
    byId.set(w.id, w.word);
  }
});

test('no two words ship byte-identical art', () => {
  const bySize = new Map();
  for (const w of SPELLING_WORDS) {
    const buf = fs.readFileSync(path.join(ASSETS, w.img));
    const key = buf.length + ':' + buf.subarray(0, 512).toString('base64');
    const clash = bySize.get(key);
    assert.ok(!clash, w.word + ' and ' + clash + ' use the same image');
    bySize.set(key, w.word);
  }
});

test('every word has its image file, named after the word', () => {
  for (const w of SPELLING_WORDS) {
    assert.strictEqual(w.img, w.word + '.png', w.word + ' has mismatched img field');
    assert.ok(fs.existsSync(path.join(ASSETS, w.img)), 'missing asset: ' + w.img);
  }
});

test('no unused images are left in the assets folder', () => {
  const used = new Set(SPELLING_WORDS.map((w) => w.img));
  const stray = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.png') && !used.has(f));
  assert.deepStrictEqual(stray, [], 'unreferenced images: ' + stray.join(', '));
});

test('every picture is a real PNG of the expected size', () => {
  for (const w of SPELLING_WORDS) {
    const buf = fs.readFileSync(path.join(ASSETS, w.img));
    assert.strictEqual(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', w.img + ' is not a PNG');
    // ARASAAC's 300px export: a wildly different size would stick out on the board.
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.strictEqual(width, height, w.img + ' is not square');
    assert.ok(width >= 256 && width <= 320, w.img + ' is ' + width + 'px, expected ~300');
  }
});
