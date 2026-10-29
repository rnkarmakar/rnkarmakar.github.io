// Run LilyPond directly in this worker. This avoids a nested worker, which is important
// for the portable one-file build where browser workers are created from Blob URLs.
import { compile, loadRuntime, loadWasm } from './lilypond-runtime.js';
import { Midi } from '@tonejs/midi';

let enginePromise;

function addPlaybackToScores(source) {
  const openings = [];
  let inString = false;
  let escaped = false;
  let inComment = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inComment) {
      if (char === '\n') inComment = false;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '%') { inComment = true; continue; }
    if (char === '"') { inString = true; continue; }
    if (source.startsWith('\\score', i) && !/[A-Za-z]/.test(source[i + 6] ?? '')) {
      let brace = i + 6;
      while (brace < source.length && source[brace] !== '{') {
        if (source[brace] === '%') {
          const newline = source.indexOf('\n', brace);
          brace = newline < 0 ? source.length : newline + 1;
        } else brace++;
      }
      if (source[brace] === '{') openings.push(brace);
      i = brace;
      continue;
    }
  }

  const insertions = [];
  for (const open of openings) {
    let depth = 0;
    inString = false;
    escaped = false;
    inComment = false;
    let close = -1;
    for (let i = open; i < source.length; i++) {
      const char = source[i];
      if (inComment) {
        if (char === '\n') inComment = false;
        continue;
      }
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '%') { inComment = true; continue; }
      if (char === '"') { inString = true; continue; }
      if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { close = i; break; }
    }
    if (close < 0) continue;
    const body = source.slice(open + 1, close);
    const activeCode = body.replace(/"(?:\\.|[^"\\])*"/gs, '""').replace(/%[^\n]*/g, '');
    if (!/\\midi\b/.test(activeCode)) insertions.push(close);
  }
  for (const index of insertions.sort((a, b) => b - a)) {
    source = `${source.slice(0, index)}\\midi { } ${source.slice(index)}`;
  }
  return source;
}

async function getEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      loadRuntime(undefined, { onProgress: (loadedBytes, totalBytes) => self.postMessage({
        type: 'loading', loadedBytes, totalBytes,
        percent: totalBytes ? Math.floor((loadedBytes / totalBytes) * 100) : 0,
      }) }),
      loadWasm({ onProgress: (loadedBytes, totalBytes) => self.postMessage({
        type: 'loading', loadedBytes, totalBytes,
        percent: totalBytes ? Math.floor((loadedBytes / totalBytes) * 100) : 0,
      }) }),
    ]).then(([assets, wasmModule]) => ({ assets, wasmModule }));
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'compile') return;
  const { id, source } = data;
  try {
    self.postMessage({ type: 'compiling', id });
    const engine = await getEngine();
    const result = await compile(addPlaybackToScores(source), {
      ...engine,
      filename: 'score.ly',
      format: ['svg', 'midi'],
    });
    const files = result.files ?? {};
    const svgFiles = Object.entries(files)
      .filter(([name]) => name.toLowerCase().endsWith('.svg'))
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    const midiEntry = Object.entries(files).find(([name]) => /\.midi?$/i.test(name));
    let midiNotes = null;
    if (midiEntry) {
      const parsed = new Midi(midiEntry[1]);
      midiNotes = parsed.tracks.flatMap((track) => track.notes.map((note) => ({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
      })));
    }
    self.postMessage({
      type: 'compiled',
      id,
      svgs: svgFiles.map(([name, svg]) => ({ name, svg: typeof svg === 'string' ? svg : new TextDecoder().decode(svg) })),
      midiNotes,
      logs: result.logs ?? [],
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      message: error?.message ?? String(error),
      logs: error?.logs ?? [],
    });
  }
};
