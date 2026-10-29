import test from 'node:test';
import assert from 'node:assert/strict';
import midiPackage from '@tonejs/midi';
import { compile, loadRuntime, loadWasm } from '../src/lilypond-runtime.js';
import { addPlaybackToScores } from '../src/source-map.js';
import { playbackSettings, readPlaybackEvents, mapPlaybackEvents, playbackEndTime } from '../src/playback-map.js';
import { sampleScore } from '../src/sample-score.js';

const { Midi } = midiPackage;
let engine;
async function render(source) {
  engine ??= Promise.all([loadRuntime(), loadWasm()]).then(([assets, wasmModule]) => ({ assets, wasmModule }));
  const sourceMap = addPlaybackToScores(source);
  const result = await compile(sourceMap.source, { ...await engine, format: ['svg', 'midi'],
    files: { 'live-settings.ly': playbackSettings }, includeSettings: 'live-settings.ly' });
  assert.equal(result.exitCode, 0, result.logs.join('\n'));
  assert.ok(Object.keys(result.files).some(name => name.endsWith('.svg')), 'engraving is retained with automatic MIDI');
  const scores = readPlaybackEvents(result.logs);
  let offset = 0;
  const points = [], midiFiles = [];
  for (const [index, [, bytes]] of Object.entries(result.files).filter(([name]) => /\.midi?$/.test(name))
    .sort(([a], [b]) => scores.findIndex(score => score.filename === a) - scores.findIndex(score => score.filename === b)).entries()) {
    const midi = new Midi(bytes), score = scores[index];
    assert.ok(score, 'each MIDI score has interpreted source events');
    points.push(...mapPlaybackEvents(score, midi, sourceMap, source, offset));
    midiFiles.push(midi);
    offset += Math.max(midi.duration, playbackEndTime(score, midi));
  }
  return { points, midiFiles, result };
}
const pointAt = (result, source, token) => result.points.find(point => point.start === source.indexOf(token));

test('real compiler maps simultaneous staves, attached dynamics, and variables to performed times', async () => {
  const source = String.raw`upper = { c'4\p d' e' f' }
lower = { g4 a b c' }
\score { << \new Staff \upper \new Staff \lower >> }`;
  const result = await render(source);
  assert.equal(pointAt(result, source, 'c\'4').time, 0);
  assert.equal(pointAt(result, source, 'g4').time, 0);
  assert.equal(pointAt(result, source, 'd\' e').time, 1);
  assert.equal(pointAt(result, source, 'a b').time, 1);
  assert.equal(pointAt(result, source, 'f\' }').time, 3);
});

test('real compiler uses tempo changes, rests, tuplets, chords and tie continuation moments', async () => {
  const source = String.raw`\score { { \tempo 4=60 r4 <c' e'>4 \tuplet 3/2 { d'8 e' f' } g'4~
    \tempo 4=120 g'4 a'4 } }`;
  const result = await render(source);
  assert.equal(pointAt(result, source, "c' e'").time, 1);
  assert.equal(pointAt(result, source, "e'>").time, 1);
  assert.ok(Math.abs(pointAt(result, source, "f' }").time - 8/3) < .002);
  assert.equal(pointAt(result, source, "g'4 a'").time, 4);
  assert.equal(pointAt(result, source, "a'4").time, 4.5);
});

test('real compiler preserves multiple scores and their final rests in concatenated playback', async () => {
  const source = String.raw`\score { { c'4 r2. } } \score { { d'4 e'4 } \midi {} }`;
  const result = await render(source);
  assert.equal(result.midiFiles.length, 2);
  assert.equal(result.midiFiles[0].tracks.flatMap(track => track.notes)[0].midi, 60);
  assert.equal(result.midiFiles[1].tracks.flatMap(track => track.notes)[0].midi, 62);
  assert.equal(pointAt(result, source, "d'4").time, 4);
  assert.equal(pointAt(result, source, "e'4").time, 5);
});

test('real compiler maps the entire showcase, including expressive notes and both first staff notes', async () => {
  const result = await render(sampleScore);
  assert.equal(pointAt(result, sampleScore, 'g4\\p').time, 0);
  assert.equal(pointAt(result, sampleScore, "g,4 d'").time, 0);
  assert.equal(pointAt(result, sampleScore, 'g1\\fermata').time, 37.5);
  assert.ok(result.points.length > 110);
});

test('real compiler maps grace notes to their actual MIDI onsets', async () => {
  const source = String.raw`\score { { \grace { c'16 d' } e'4 f'4 \grace { g'16 a' } b'4 c''4 } }`;
  const result = await render(source);
  const tokens = ["c'16", "d' }", "e'4", "f'4", "g'16", "a' }", "b'4", "c''4"];
  const notes = result.midiFiles[0].tracks.flatMap(track=>track.notes);
  for (const [index, token] of tokens.entries()) {
    const point = pointAt(result, source, token);
    assert.ok(point && Number.isFinite(point.time));
    assert.equal(point.time, notes[index].time, 'source selection starts at the actual MIDI onset of ' + token);
  }
});
