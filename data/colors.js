const COLORS_DATA = [
  { key: 'red', name: 'Red', say: 'Red', fill: '#e53935' },
  { key: 'blue', name: 'Blue', say: 'Blue', fill: '#1e88e5' },
  { key: 'yellow', name: 'Yellow', say: 'Yellow', fill: '#ffeb3b' },
  { key: 'green', name: 'Green', say: 'Green', fill: '#43a047' },
  { key: 'orange', name: 'Orange', say: 'Orange', fill: '#ff9800' },
  { key: 'purple', name: 'Purple', say: 'Purple', fill: '#8e24aa' },
  { key: 'pink', name: 'Pink', say: 'Pink', fill: '#f06292' },
  { key: 'brown', name: 'Brown', say: 'Brown', fill: '#6d4c41' }
];

const COLOR_CONFETTI_HEX = [
  '#e53935',
  '#1e88e5',
  '#ffeb3b',
  '#43a047',
  '#ff9800',
  '#8e24aa',
  '#f06292',
  '#6d4c41'
];

function colorFillForKey(key) {
  const item = COLORS_DATA.find(function(entry) { return entry.key === key; });
  return item ? item.fill : '#cccccc';
}
