function lineStartAt(source, offset) {
  return source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
}

function selectedLineStarts(source, start, end) {
  const first = lineStartAt(source, start);
  const lastOffset = end > start && source[end - 1] === '\n' ? end - 1 : end;
  const last = lineStartAt(source, lastOffset);
  const lines = [];
  for (let line = first; line <= last; ) {
    lines.push(line);
    const next = source.indexOf('\n', line);
    if (next < 0 || next >= last) break;
    line = next + 1;
  }
  return lines;
}

function applyPrefixEdits(source, start, end, edits) {
  let value = source;
  for (const edit of edits.slice().reverse())
    value = value.slice(0, edit.at) + edit.insert + value.slice(edit.at + edit.remove);
  const move = offset => Math.max(0, Math.min(value.length, offset + edits.reduce((shift, edit) =>
    edit.at <= offset ? shift + edit.insert.length - edit.remove : shift, 0)));
  return { value, selectionStart: move(start), selectionEnd: move(end) };
}

export function indentSelection(source, start, end) {
  if (start === end || !source.slice(start, end).includes('\n')) {
    return { value: source.slice(0, start) + '\t' + source.slice(end),
      selectionStart: start + 1, selectionEnd: start + 1 };
  }
  return applyPrefixEdits(source, start, end,
    selectedLineStarts(source, start, end).map(at => ({ at, remove: 0, insert: '\t' })));
}

export function unindentSelection(source, start, end) {
  const edits = [];
  for (const at of selectedLineStarts(source, start, end)) {
    const leading = source.slice(at).match(/^(\t| {1,2})/)?.[0];
    if (leading) edits.push({ at, remove: leading.length, insert: '' });
  }
  return applyPrefixEdits(source, start, end, edits);
}

export function toggleLineComments(source, start, end) {
  const starts = selectedLineStarts(source, start, end);
  const edits = starts.map(at => {
    const indent = source.slice(at).match(/^[\t ]*/)[0];
    const marker = at + indent.length;
    return { at: marker, remove: source[marker] === '%' ? (source[marker + 1] === ' ' ? 2 : 1) : 0,
      insert: source[marker] === '%' ? '' : '% ' };
  });
  const uncomment = edits.every(edit => edit.remove > 0);
  return applyPrefixEdits(source, start, end, edits.filter(edit => uncomment || !edit.remove).map(edit => ({
    ...edit, remove: uncomment ? edit.remove : 0, insert: uncomment ? '' : edit.insert,
  })));
}

export function insertNewline(source, start, end) {
  const lineStart = lineStartAt(source, start);
  const lineEnd = source.indexOf('\n', end) < 0 ? source.length : source.indexOf('\n', end);
  const before = source.slice(lineStart, start);
  const after = source.slice(end, lineEnd);
  const indent = source.slice(lineStart).match(/^[\t ]*/)[0];
  const opens = /(?:\{|<<)\s*$/.test(before);
  const closes = /^\s*(?:\}|>>)/.test(after);

  if (opens && closes) {
    const inner = indent + '\t';
    const text = '\n' + inner + '\n' + indent;
    return { value: source.slice(0, start) + text + source.slice(end),
      selectionStart: start + 1 + inner.length, selectionEnd: start + 1 + inner.length };
  }

  const nextIndent = indent + (opens ? '\t' : '');
  const text = '\n' + nextIndent;
  return { value: source.slice(0, start) + text + source.slice(end),
    selectionStart: start + text.length, selectionEnd: start + text.length };
}
