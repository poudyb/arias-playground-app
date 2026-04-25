const ANIMALS = [
  { key: 'pig', name: 'Pig', emoji: '🐖' },
  { key: 'rooster', name: 'Rooster', emoji: '🐓' },
  { key: 'frog', name: 'Frog', emoji: '🐸' },
  { key: 'cat', name: 'Cat', emoji: '🐈' },
  { key: 'dog', name: 'Dog', emoji: '🐕' },
  { key: 'horse', name: 'Horse', emoji: '🐎' },
  { key: 'rabbit', name: 'Rabbit', emoji: '🐇' },
  { key: 'caterpillar', name: 'Caterpillar', emoji: '🐛' },
  { key: 'sheep', name: 'Sheep', emoji: '🐑' },
  { key: 'duck', name: 'Duck', emoji: '🦆' },
  { key: 'cow', name: 'Cow', emoji: '🐄' },
  { key: 'snake', name: 'Snake', emoji: '🐍' }
];

const ANIMAL_VIDEO_CUES = [
  [0, 4.653],
  [4.653, 9.306],
  [9.306, 13.958],
  [13.958, 17],
  [18, 20],
  [21, 27.917],
  [27.917, 31.5],
  [32.569, 36.8],
  [37.222, 41.875],
  [45.29, 48.38],
  [48.38, 52.5],
  [52.5, 55.85]
];

function animalEmojiForKey(key) {
  const animal = ANIMALS.find(function(item) { return item.key === key; });
  return animal ? animal.emoji : '?';
}
