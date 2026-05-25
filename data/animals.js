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

function animalEmojiForKey(key) {
  const animal = ANIMALS.find(function(item) { return item.key === key; });
  return animal ? animal.emoji : '?';
}
