import { compile, loadRuntime, loadWasm } from './lilypond-runtime.js';
import { Midi } from '@tonejs/midi';
import { addPlaybackToScores } from './source-map.js';

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
    for (const [, bytes] of entries.filter(([name]) => /\.midi?$/i.test(name))
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
      const midi = new Midi(bytes);
      const notes = midi.tracks.flatMap(track => track.notes);
      for (const note of notes) midiNotes.push({
        midi: note.midi, time: note.time + timeOffset, duration: note.duration, velocity: note.velocity,
      });
      timeOffset += notes.reduce((end, note) => Math.max(end, note.time + note.duration), 0);
    }
    self.postMessage({ type: 'compiled', id, svgs, midiNotes, sourceMap, logs: result.logs ?? [] });
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error?.message ?? String(error), logs: error?.logs ?? [] });
  }
};
