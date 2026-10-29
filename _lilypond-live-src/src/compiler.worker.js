import { compile, loadRuntime, loadWasm } from './lilypond-runtime.js';
import { Midi } from '@tonejs/midi';
import { addPlaybackToScores } from './source-map.js';
import { playbackSettings, readPlaybackEvents, mapPlaybackEvents, playbackEndTime } from './playback-map.js';

let enginePromise;
async function getEngine() {
  if (!enginePromise) {
    const totals = [15914502, 15266329], loaded = [0, 0];
    const onProgress = index => bytes => {
      loaded[index] = bytes;
      self.postMessage({ type: 'loading', percent: Math.floor(100 * (loaded[0] + loaded[1]) / (totals[0] + totals[1])) });
    };
    enginePromise = Promise.all([
      loadRuntime(undefined, { onProgress: onProgress(0) }),
      loadWasm({ onProgress: onProgress(1) }),
    ]).then(([assets, wasmModule]) => ({ assets, wasmModule }));
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'compile') return;
  const { id, source } = data;
  try {
    const engine = await getEngine();
    const sourceMap = addPlaybackToScores(source);
    const result = await compile(sourceMap.source, {
      ...engine, filename: 'score.ly', format: ['svg', 'midi'],
      files: { 'live-settings.ly': playbackSettings }, includeSettings: 'live-settings.ly',
    });
    if (result.exitCode !== 0) {
      const error = new Error((result.logs ?? []).join('\n') || 'LilyPond rejected this score.');
      error.logs = result.logs;
      throw error;
    }
    const entries = Object.entries(result.files ?? {});
    const svgs = entries.filter(([name]) => name.endsWith('.svg'))
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([name, svg]) => ({ name, svg: typeof svg === 'string' ? svg : new TextDecoder().decode(svg) }));
    // Multiple score blocks generate separate MIDI files; concatenate in output order.
    let timeOffset = 0;
    const midiNotes = [];
    const playbackMap = [], scores = readPlaybackEvents(result.logs ?? []);
    let scoreIndex = 0;
    for (const [name, bytes] of entries.filter(([name]) => /\.midi?$/i.test(name))
      .sort(([a], [b]) => scores.findIndex(score => score.filename === a) - scores.findIndex(score => score.filename === b))) {
      const midi = new Midi(bytes);
      const notes = midi.tracks.flatMap(track => track.notes);
      const score = scores.find(score => score.filename === name) ?? scores[scoreIndex];
      scoreIndex++;
      if (score) playbackMap.push(...mapPlaybackEvents(score, midi, sourceMap, source, timeOffset));
      for (const note of notes) midiNotes.push({
        midi: note.midi, time: note.time + timeOffset, duration: note.duration, velocity: note.velocity,
      });
      timeOffset += Math.max(notes.reduce((end, note) => Math.max(end, note.time + note.duration), 0),
        score ? playbackEndTime(score, midi) : 0);
    }
    self.postMessage({ type: 'compiled', id, svgs, midiNotes, sourceMap, playbackMap,
      logs: (result.logs ?? []).filter(line => !line.startsWith('LPLIVE:')) });
  } catch (error) {
    const logs = (error?.logs ?? []).filter(line => !line.startsWith('LPLIVE:'));
    const fontCrash = logs.some(line => /harfbuzz|assert_unicode/.test(line));
    const message = fontCrash
      ? 'The engraving engine could not render a text character in this score. Try removing unsupported symbols or emoji, then edit again to retry.'
      : error?.message ?? String(error);
    self.postMessage({ type: 'error', id, message, logs });
  }
};
