function makeShapeSvg(kind, fill) {
  let radius;
  let point;
  let theta;
  let x;
  let y;
  let path;
  const open =
    '<svg class="shape-tile-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
  const close = '</svg>';

  if (kind === 'pentagon') {
    radius = 46;
    path = '';
    for (point = 0; point < 5; point++) {
      theta = -Math.PI / 2 + (2 * Math.PI * point) / 5;
      x = 50 + radius * Math.cos(theta);
      y = 50 + radius * Math.sin(theta);
      path += (point === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    return open + '<path d="' + path + 'Z" fill="' + fill + '" />' + close;
  }

  if (kind === 'hexagon') {
    radius = 45;
    path = '';
    for (point = 0; point < 6; point++) {
      theta = -Math.PI / 2 + (2 * Math.PI * point) / 6;
      x = 50 + radius * Math.cos(theta);
      y = 50 + radius * Math.sin(theta);
      path += (point === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    return open + '<path d="' + path + 'Z" fill="' + fill + '" />' + close;
  }

  if (kind === 'parallelogram') {
    path = 'M 6 78 L 36 22 L 94 22 L 64 78 Z';
    return open + '<path d="' + path + '" fill="' + fill + '" />' + close;
  }

  if (kind === 'trapezoid') {
    path = 'M 6 78 L 30 22 L 70 22 L 94 78 Z';
    return open + '<path d="' + path + '" fill="' + fill + '" />' + close;
  }

  if (kind === 'oval') {
    return open + '<ellipse cx="50" cy="50" rx="46" ry="30" fill="' + fill + '" />' + close;
  }

  return '';
}

const SHAPES = [
  { key: 'red_circle', name: 'Red circle', emoji: '🔴', say: 'Red circle' },
  { key: 'blue_circle', name: 'Blue circle', emoji: '🔵', say: 'Blue circle' },
  { key: 'red_square', name: 'Red square', emoji: '🟥', say: 'Red square' },
  { key: 'blue_square', name: 'Blue square', emoji: '🟦', say: 'Blue square' },
  { key: 'yellow_square', name: 'Yellow square', emoji: '🟨', say: 'Yellow square' },
  { key: 'red_triangle', name: 'Red triangle', emoji: '🔺', say: 'Red triangle' },
  { key: 'orange_diamond', name: 'Orange diamond', emoji: '🔶', say: 'Orange diamond' },
  { key: 'yellow_star', name: 'Yellow star', emoji: '⭐', say: 'Yellow star' },
  {
    key: 'green_pentagon',
    name: 'Green pentagon',
    emoji: '🟢',
    say: 'Green pentagon',
    svgMarkup: makeShapeSvg('pentagon', '#43a047')
  },
  {
    key: 'purple_hexagon',
    name: 'Purple hexagon',
    emoji: '🟣',
    say: 'Purple hexagon',
    svgMarkup: makeShapeSvg('hexagon', '#8e24aa')
  },
  {
    key: 'teal_parallelogram',
    name: 'Teal parallelogram',
    emoji: '🔷',
    say: 'Teal parallelogram',
    svgMarkup: makeShapeSvg('parallelogram', '#00897b')
  },
  {
    key: 'pink_trapezoid',
    name: 'Pink trapezoid',
    emoji: '💗',
    say: 'Pink trapezoid',
    svgMarkup: makeShapeSvg('trapezoid', '#d81b60')
  }
];

function shapeEmojiForKey(key) {
  const shape = SHAPES.find(function(item) { return item.key === key; });
  return shape ? shape.emoji : '?';
}
