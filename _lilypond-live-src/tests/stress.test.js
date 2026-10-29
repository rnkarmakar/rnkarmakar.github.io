import test from 'node:test';
import assert from 'node:assert/strict';
import { ScorePlayer } from '../src/player.js';
import { CompileQueue } from '../src/compile-queue.js';
import { addPlaybackToScores, sourceOffset, originalOffset, maskSource, isPitchToken } from '../src/source-map.js';
import { indentSelection, unindentSelection, toggleLineComments, insertBracePair, insertNewline } from '../src/editor-commands.js';

function audioHarness(resume = () => Promise.resolve()) {
  const intervals = new Map();
  let timerId = 0;
  const timers = {
    setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
    clearInterval: id => intervals.delete(id),
  };
  const created = [];
  const context = {
    currentTime: 0, destination: {}, resume,
    createOscillator() {
      const oscillator = { frequency: {}, immediateStops: 0, connected: false,
        connect() { this.connected = true; }, disconnect() { this.connected = false; },
        start(time) { this.startedAt = time; },
        stop(time) { if (time === undefined) this.immediateStops++; else this.endsAt = time; },
      };
      created.push(oscillator);
      return oscillator;
    },
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    },
  };
  const player = new ScorePlayer({ createContext: () => context, timers });
  return { player, context, created, intervals, tick: () => [...intervals.values()].forEach(callback => callback()) };
}
const notes = [{ midi: 60, time: 0, duration: 10, velocity: .8 }, { midi: 67, time: 9, duration: 1, velocity: .8 }];

test('500 restarts disconnect every old session and retain only one timer', async () => {
  const h = audioHarness();
  for (let i = 0; i < 500; i++) {
    await h.player.play(notes);
    assert.equal(h.intervals.size, 1);
    assert.equal(h.player.nodes.size, 1);
    for (const old of h.created.slice(0, -1)) {
      assert.ok(old.immediateStops > 0);
      assert.equal(old.connected, false);
    }
  }
  h.player.stop();
  assert.equal(h.player.nodes.size, 0);
  assert.equal(h.intervals.size, 0);
  h.context.currentTime = 20;
  h.tick();
  assert.equal(h.created.length, 500, 'cancelled future notes never get created');
});

test('Stop during async audio unlock prevents a late start', async () => {
  let resolve;
  const h = audioHarness(() => new Promise(r => { resolve = r; }));
  const pending = h.player.play(notes);
  h.player.stop();
  resolve();
  await pending;
  assert.equal(h.created.length, 0);
  assert.equal(h.player.playing, false);
  assert.equal(h.intervals.size, 0);
});

test('100 simultaneous Play calls allow only the last session to start', async () => {
  const h = audioHarness();
  await Promise.all(Array.from({ length: 100 }, () => h.player.play(notes)));
  assert.equal(h.created.length, 1);
  assert.equal(h.intervals.size, 1);
  h.player.stop();
});

test('an obsolete rejected audio unlock cannot reject or cancel a newer Play', async () => {
  const deferred = [];
  const h = audioHarness(() => new Promise((resolve, reject) => deferred.push({ resolve, reject })));
  const first = h.player.play(notes), second = h.player.play(notes);
  deferred[1].resolve();
  await second;
  deferred[0].reject(new Error('obsolete rejection'));
  await first;
  assert.equal(h.player.playing, true);
  h.player.stop();
});

test('10,000 notes use a short lookahead and skip expired notes after a stalled tab', async () => {
  const h = audioHarness();
  await h.player.play(Array.from({ length: 10000 }, (_, i) => ({ midi: 60, time: i * .5, duration: .1 })));
  assert.equal(h.created.length, 1);
  h.context.currentTime = 12;
  h.tick();
  assert.equal(h.created.length, 2, 'missed notes are not emitted in a burst');
  h.context.currentTime = 6000;
  h.tick();
  assert.equal(h.player.playing, false);
  assert.equal(h.intervals.size, 0);
});

test('play from a selected time begins there and sustains notes that cross the selection', async () => {
  const h = audioHarness();
  await h.player.play([
    { midi: 60, time: 0, duration: 1, velocity: .8 },
    { midi: 64, time: .5, duration: 3, velocity: .8 },
    { midi: 67, time: 2, duration: 1, velocity: .8 },
  ], 1.25);
  assert.equal(h.created.length, 1, 'only the note still sounding at the selection point starts immediately');
  assert.equal(h.created[0].startedAt, h.context.currentTime + .035);
  h.context.currentTime = .7;
  h.tick();
  assert.equal(h.created.length, 2, 'the next note retains its timing relative to the selection');
  assert.ok(Math.abs(h.created[1].startedAt - .785) < .001);
  h.player.stop();
});

test('10,000 edits coalesce to the newest revision with one compile active', () => {
  const sent = [], applied = [];
  const queue = new CompileQueue({ send: r => sent.push(r.id), result: d => applied.push(d.id) });
  for (let id = 1; id <= 10000; id++) { queue.invalidate(id); queue.submit({ id }); }
  assert.deepEqual(sent, [1]);
  queue.receive({ type: 'compiled', id: 1 });
  assert.deepEqual(sent, [1, 10000]);
  assert.deepEqual(applied, []);
  queue.receive({ type: 'compiled', id: 1 });
  assert.equal(queue.active.id, 10000);
  queue.receive({ type: 'compiled', id: 10000 });
  assert.deepEqual(applied, [10000]);
  assert.equal(queue.active, null);
});

test('editing before debounce invalidates both stale results and a previously pending request', () => {
  const sent = [], applied = [];
  const queue = new CompileQueue({ send: r => sent.push(r.id), result: d => applied.push(d.id) });
  queue.invalidate(1); queue.submit({ id: 1 });
  queue.invalidate(2); queue.submit({ id: 2 });
  queue.invalidate(3);
  queue.receive({ type: 'error', id: 1 });
  assert.deepEqual(sent, [1]);
  assert.deepEqual(applied, []);
  queue.submit({ id: 3 });
  queue.receive({ type: 'compiled', id: 3 });
  assert.deepEqual(sent, [1, 3]);
  assert.deepEqual(applied, [3]);
});

test('current compilation errors are surfaced and the queue accepts recovery', () => {
  const results = [];
  const queue = new CompileQueue({ send() {}, result: data => results.push(data.type) });
  queue.invalidate(1); queue.submit({ id: 1 }); queue.receive({ id: 1, type: 'error' });
  queue.invalidate(2); queue.submit({ id: 2 }); queue.receive({ id: 2, type: 'compiled' });
  assert.deepEqual(results, ['error', 'compiled']);
});

test('MIDI insertion ignores strings, nested block comments, and line comments', () => {
  const source = '\\header { title = "\\\\score { }" }\n%{ \\score { %{ nested %} } %}\n% \\score { }\n\\score { c4 }\n\\score { d4 \\midi { } }';
  const result = addPlaybackToScores(source);
  assert.equal(result.insertions.length, 1);
  assert.equal(result.source.slice(0, result.insertions[0].offset), source.slice(0, result.insertions[0].offset));
  assert.equal(maskSource(source).length, source.length);
});

test('source positions remain exact after injected MIDI, including two scores on the same line', () => {
  const source = '\\score { c4 } \\score { d4 }';
  const result = addPlaybackToScores(source);
  assert.equal(result.insertions.length, 2);
  for (const note of ['c4', 'd4']) {
    const generated = result.source.indexOf(note);
    assert.equal(originalOffset(generated, result.insertions), source.indexOf(note));
  }
  const inserted = result.insertions[0];
  assert.equal(originalOffset(inserted.offset + 1, result.insertions), null);
});

test('playback source mapping accepts LilyPond pitch tokens and ignores directives', () => {
  const source = '\\key c \\major \\tempo 4 = 100 cis\'4 bes,2 r4';
  assert.equal(isPitchToken(source, source.indexOf('\\key') + 1), false);
  assert.equal(isPitchToken(source, source.indexOf('\\tempo') + 1), false);
  assert.equal(isPitchToken(source, source.indexOf('cis')), true);
  assert.equal(isPitchToken(source, source.indexOf('bes')), true);
  assert.equal(isPitchToken(source, source.indexOf('r4')), false);
});

test('Tab inserts a literal tab and indents every line in a multiline selection', () => {
  assert.deepEqual(indentSelection('abc', 1, 1), { value: 'a\tbc', selectionStart: 2, selectionEnd: 2 });
  assert.deepEqual(indentSelection('a\nb\nc', 0, 3), { value: '\ta\n\tb\nc', selectionStart: 1, selectionEnd: 5 });
});

test('Shift+Tab removes one tab or up to two spaces on selected lines', () => {
  assert.deepEqual(unindentSelection('\ta\n  b\nc', 0, 6), { value: 'a\nb\nc', selectionStart: 0, selectionEnd: 3 });
  assert.deepEqual(unindentSelection('  c4', 3, 3), { value: 'c4', selectionStart: 1, selectionEnd: 1 });
});

test('Enter preserves indentation and adds a tab inside LilyPond braces', () => {
  assert.deepEqual(insertNewline('    c4', 4, 4), { value: '    \n    c4', selectionStart: 9, selectionEnd: 9 });
  assert.deepEqual(insertNewline('  {', 3, 3), { value: '  {\n  \t', selectionStart: 7, selectionEnd: 7 });
  assert.deepEqual(insertNewline('  { }', 4, 4), { value: '  { \n  \t\n  }', selectionStart: 8, selectionEnd: 8 });
});

test('typing an opening brace inserts its pair and wraps selected source', () => {
  assert.deepEqual(insertBracePair('c4 d4', 3, 3), {
    value: 'c4 {}d4', selectionStart: 4, selectionEnd: 4,
  });
  assert.deepEqual(insertBracePair('c4 d4', 0, 5), {
    value: '{c4 d4}', selectionStart: 1, selectionEnd: 6,
  });
});

test('Ctrl+/ toggles LilyPond percent comments and preserves mixed existing comments', () => {
  const source = '\tc4\n\td4\n';
  const commented = toggleLineComments(source, 0, source.length);
  assert.equal(commented.value, '\t% c4\n\t% d4\n');
  assert.deepEqual(toggleLineComments(commented.value, 0, commented.value.length), {
    value: source, selectionStart: 0, selectionEnd: source.length,
  });
  assert.equal(toggleLineComments('% c4\nd4', 0, 7).value, '% c4\n% d4');
});

test('source columns handle tabs, Unicode, and CRLF source', () => {
  const source = 'title="🎵"\r\n\tc4 d4';
  assert.equal(sourceOffset(source, 2, 1), source.indexOf('c4'));
  assert.equal(sourceOffset('🎵 c4', 1, 2), 3);
  assert.equal(sourceOffset(source, 99, 1), null);
});
