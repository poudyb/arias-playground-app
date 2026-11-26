// Memory's rules about strategy, kept apart from the page so they can be tested.
//
// Memory used to move her up a board size every time she finished one, however
// she finished it. A board always gets finished in the end — keep turning cards
// and the pairs fall out — so that was no evidence of anything, and she climbed
// while guessing.
//
// What counts against her is a pick she had the information to avoid, and
// there are two kinds, one worse than the other:
//
//   known  - the second card of a turn is one she has seen before, and it
//            isn't the match. She knew its face, and with the first card just
//            turned over she knew it wasn't the one. That is a wrong answer
//            given knowing better, so it always counts, and it gets the big
//            red X like any wrong answer.
//   gamble - the first card of a turn is one she has seen before, and the
//            second card (a new one) doesn't match it. She went back to a card
//            she knew and gambled on finding its partner, which spends a turn
//            learning one new card where starting on a new card would have
//            learned two. Turning 1 and 2, then 1 and 3, then 1 and 4 is that,
//            twice. Milder: the first one on a board is let go, later ones get
//            the buzzer and a shake.
//
// A first look at two new cards is honest exploring, never a slip. So is a turn
// that finds a match, however it got there. Forgetting where a seen card's
// partner was, when she starts a turn on a new card, isn't counted either:
// that is the memory part of the game, still being learned.
//
// None of it ever ends the board. She is two: a board that stopped and started
// over on her would only teach her that the game is frustrating. Slips decide
// only where the NEXT board goes (memoryBoardOutcome, nextMemoryLevel).
//
// Some cards are dealt face up and stay that way (`shown`), and those count as
// seen from the start: picking one that isn't the match is a wrong answer given
// knowing better, the same as a card she turned over earlier. Starting a turn
// on a face-up card is never a gamble, though. On a board where one card of a
// pair is up and its twin is down, that is the game: hold the one you can see
// and find its twin.

// The boards she climbs, from all face up to all face down. Early-years advice
// for this game is to begin with two to four pairs face up and add pairs only
// once she finds it easy; Super Simple's guided step between face up and face
// down turns one card over and has the child find its match. So it starts
// face up, then hides one card of each pair (she can see what she is looking
// for), then whole pairs. Each step changes one thing: either the board grows
// with the same share of it face down, or more of it goes face down at the
// same size.
const MEMORY_LADDER = [
  { pairs: 2, hidden: 0 },
  { pairs: 3, hidden: 0 },
  { pairs: 3, hidden: 3 },
  { pairs: 4, hidden: 4 },
  { pairs: 4, hidden: 6 },
  { pairs: 4, hidden: 8 },
  { pairs: 5, hidden: 10 },
  { pairs: 6, hidden: 12 },
  { pairs: 8, hidden: 16 }
];

// How many of pair `pairIndex`'s two cards are dealt face down, when `hidden`
// of the board's cards are. Whole pairs go down only once every pair has one
// card down already.
function memoryHiddenCopies(pairIndex, pairs, hidden) {
  const wholePairs = Math.max(0, hidden - pairs);
  const halfPairs = Math.min(pairs, hidden) - wholePairs;
  if (pairIndex < wholePairs) return 2;
  if (pairIndex < wholePairs + halfPairs) return 1;
  return 0;
}

// How many gambles a board forgives before they start to count.
const MEMORY_GAMBLES_FORGIVEN = 1;

// `first` and `second` as they were BEFORE this turn turned them over: each has
// `key` (its picture), `seen` (it was face up in an earlier turn, or dealt face
// up) and `shown` (dealt face up). A turn that is both (a seen card, then
// another seen card that isn't its partner) is the worse kind.
function classifyMemoryTurn(first, second) {
  if (first.key === second.key) return 'match';
  if (second.seen) return 'known';
  if (first.seen && !first.shown) return 'gamble';
  return 'honest';
}

// Whether this gamble is one that counts (the board's first is let go).
// `gambles` is the count on the board including this one.
function memoryGambleCounts(gambles) {
  return gambles > MEMORY_GAMBLES_FORGIVEN;
}

// How a finished board went, from its slips:
//
//   clean   - no known slip, no more than the one gamble it forgives, and
//             no hint needed
//   slipped - no known slip, and one gamble past the one forgiven; or a
//             board otherwise clean that she finished once the hint showed
//   failed  - any known slip, or two or more gambles past the one forgiven
//
// A known slip is weighed as two counted gambles: on its own it is enough to
// make the board a failed one. Finishing after the hint pointed the way is no
// evidence she could do it alone, so it can't move her up.
function memoryBoardOutcome(known, gambles, hinted) {
  const strikes = 2 * known + Math.max(0, gambles - MEMORY_GAMBLES_FORGIVEN);
  if (strikes === 0) return hinted ? 'slipped' : 'clean';
  if (strikes === 1) return 'slipped';
  return 'failed';
}

// Where the next board goes, and how many failed boards in a row she's had.
//
//   clean   - one size up. The only way up, so a size is earned by playing it
//             well, not by getting to the end of it.
//   slipped - the same size again.
//   failed  - the same size again, and after two failed boards in a row, one
//             size down. A single bad board is a bad board; two is the size
//             being too big for now.
function nextMemoryLevel(level, outcome, failStreak, levelCount) {
  const top = Math.max(0, levelCount - 1);
  const streak = typeof failStreak === 'number' && failStreak > 0 ? Math.floor(failStreak) : 0;
  if (outcome === 'clean') return { level: Math.min(level + 1, top), failStreak: 0 };
  if (outcome === 'failed') {
    if (streak + 1 >= 2) return { level: Math.max(level - 1, 0), failStreak: 0 };
    return { level: level, failStreak: streak + 1 };
  }
  return { level: level, failStreak: 0 };
}

// The cards the hint pulses, all of them face up for good, so it never gives
// away a face-down card: the lifted card's twin when that twin is face up, or
// when nothing is lifted, both cards of the first pair that is wholly face up.
// `cards` is the board as [{ key, matched, shown }].
function memoryHintIndices(cards, lifted) {
  if (lifted !== -1) {
    return cards.reduce(function(out, card, i) {
      if (i !== lifted && !card.matched && card.shown && card.key === cards[lifted].key) out.push(i);
      return out;
    }, []);
  }
  const shownKeys = {};
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.matched || !card.shown) continue;
    if (card.key in shownKeys) return [shownKeys[card.key], i];
    shownKeys[card.key] = i;
  }
  return [];
}

// Exported for Node's test runner; ignored in the browser (no `module`).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEMORY_GAMBLES_FORGIVEN,
    MEMORY_LADDER,
    memoryHiddenCopies,
    classifyMemoryTurn,
    memoryGambleCounts,
    memoryBoardOutcome,
    nextMemoryLevel,
    memoryHintIndices
  };
}
