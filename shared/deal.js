// Deal `count` items from `pool` for a new board, steering clear of the items
// that were on the board before it. The Memory game uses this so two boards in
// a row never share a picture: a child who has just learned where the cow was
// should meet a fresh set, not the same faces shuffled around.
//
// `avoidKeys` holds the keys of the previous board's items, `keyOf(item)` reads
// an item's key. Fresh items are dealt first; only if the pool is too small to
// fill the board without repeats does it top up from the avoided ones, and even
// then it repeats as few as possible. `random` defaults to Math.random and is
// injectable so tests can pin the shuffle.
function dealAvoiding(pool, count, avoidKeys, keyOf, random) {
  const rand = random || Math.random;
  const avoid = {};
  (avoidKeys || []).forEach(function(k) { avoid[k] = true; });

  const fresh = [];
  const stale = [];
  pool.forEach(function(item) {
    (avoid[keyOf(item)] ? stale : fresh).push(item);
  });

  const picks = shuffleWith(fresh, rand).slice(0, count);
  if (picks.length < count) {
    picks.push.apply(picks, shuffleWith(stale, rand).slice(0, count - picks.length));
  }
  return picks;
}

function shuffleWith(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dealAvoiding };
}
