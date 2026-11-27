// The characters Walk and Jump and Garden Maze share. She picks who she is
// once, in either game, and the other game remembers it.
//
// `feet` is the empty band under each drawing, as a share of the picture's
// height, measured from the files, so every character stands on the ground.

const GARDEN_PICTURES = 'assets/spelling/';
const GARDEN_AVATAR_KEY = 'ariaWalkAvatar';

const AVATARS = [
  { key: 'cat', name: 'cat', img: 'cat.png', feet: 0.14 },
  { key: 'girl', name: 'girl', img: 'run.png', feet: 0.03 },
  { key: 'pig', name: 'pig', img: 'pig.png', feet: 0.25 },
  { key: 'hen', name: 'hen', img: 'hen.png', feet: 0.09 }
];

const FRIENDS = [
  { key: 'dog', img: 'dog.png', feet: 0.18, facesFront: false },
  { key: 'cat', img: 'cat.png', feet: 0.14, facesFront: false },
  { key: 'pig', img: 'pig.png', feet: 0.25, facesFront: false },
  { key: 'hen', img: 'hen.png', feet: 0.09, facesFront: false },
  { key: 'cow', img: 'cow.png', feet: 0.18, facesFront: false },
  { key: 'owl', img: 'owl.png', feet: 0.02, facesFront: true },
  { key: 'fox', img: 'fox.png', feet: 0.28, facesFront: false }
];

function loadGardenAvatar() {
  try {
    const key = localStorage.getItem(GARDEN_AVATAR_KEY);
    return AVATARS.find(function(a) { return a.key === key; }) || null;
  } catch (_) {
    return null;
  }
}

function saveGardenAvatar(picked) {
  try {
    localStorage.setItem(GARDEN_AVATAR_KEY, picked.key);
  } catch (_) {}
}

// A friend who isn't her and wasn't the last one.
function pickGardenFriend(avatar, lastKey, random) {
  const rand = random || Math.random;
  const pool = FRIENDS.filter(function(f) { return f.key !== avatar.key && f.key !== lastKey; });
  return pool[Math.floor(rand() * pool.length)];
}
