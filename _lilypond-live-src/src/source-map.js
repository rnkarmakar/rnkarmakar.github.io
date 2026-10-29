// LilyPond textedit links use FILE:LINE:CHAR:COLUMN. CHAR is zero based.
export function sourceOffset(source, line, character) {
  const lines = source.split('\n');
  if (line < 1 || line > lines.length) return null;
  let offset = 0;
  for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1;
  return offset + [...lines[line - 1]].slice(0, character).join('').length;
}

export function originalOffset(offset, insertions) {
  let shift = 0;
  for (const insertion of insertions) {
    const generatedStart = insertion.offset + shift;
    if (offset < generatedStart) break;
    if (offset < generatedStart + insertion.length) return null;
    shift += insertion.length;
  }
  return offset - shift;
}

export function tokenRange(source, offset) {
  let end = offset;
  while (end < source.length && !/[\s{}<>\[\]()|]/.test(source[end])) end++;
  return { start: offset, end: Math.max(offset + 1, end) };
}

export function maskSource(source) {
  let result = '', string = false, escaped = false, line = false, block = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (line) { result += c === '\n' ? '\n' : ' '; if (c === '\n') line = false; continue; }
    if (block) {
      if (c === '%' && next === '{') { block++; result += '  '; i++; }
      else if (c === '%' && next === '}') { block--; result += '  '; i++; }
      else result += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (string) {
      result += c === '\n' ? '\n' : ' ';
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') string = false;
      continue;
    }
    if (c === '%' && next === '{') { block++; result += '  '; i++; }
    else if (c === '%') { line = true; result += ' '; }
    else if (c === '"') { string = true; result += ' '; }
    else result += c;
  }
  return result;
}

export function addPlaybackToScores(source) {
  const mask = maskSource(source);
  const insertions = [];
  for (const match of mask.matchAll(/\\score\b\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    let depth = 1, close = open + 1;
    while (close < mask.length && depth) {
      if (mask[close] === '{') depth++;
      if (mask[close] === '}') depth--;
      if (depth) close++;
    }
    if (!depth && !/\\midi\b/.test(mask.slice(open, close)))
      insertions.push({ offset: close, length: 12 });
  }
  let generated = source;
  const text = ' \\midi { } ';
  for (const insertion of insertions.slice().reverse()) {
    insertion.length = text.length;
    generated = generated.slice(0, insertion.offset) + text + generated.slice(insertion.offset);
  }
  return { source: generated, insertions };
}
