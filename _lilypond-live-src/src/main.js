import * as Tone from 'tone';
import CompilerWorker from './compiler.worker.js?worker&inline';
import { sampleScore } from './sample-score.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="LilyPond Live home"><span class="brand-mark">♬</span><span>LilyPond <b>Live</b></span></a>
    <div class="top-actions">
      <span id="compile-status" class="status"><i></i><span>Starting compiler…</span></span>
      <button class="button quiet" id="new-score" title="Restore the example score">New example</button>
      <button class="button quiet" id="open-score">Open .ly</button>
      <button class="button quiet" id="save-score">Save .ly</button>
      <button class="button quiet" id="download-svg" disabled>Save SVG</button>
      <input id="file-picker" type="file" accept=".ly,.ily,.txt,text/plain" hidden />
    </div>
  </header>
  <main class="workspace">
    <section class="editor-panel" aria-label="LilyPond score editor">
      <div class="panel-heading">
        <div><h1>Score source</h1><p>Type LilyPond. The score compiles as you edit.</p></div>
        <span id="edit-state" class="edit-state">Example score</span>
      </div>
      <div class="editor-wrap">
        <div class="line-numbers" id="line-numbers" aria-hidden="true"></div>
        <textarea id="source" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="LilyPond source"></textarea>
      </div>
      <div class="editor-footer"><span>Auto-compiles after a short pause</span><span id="source-count">0 lines</span></div>
    </section>
    <section class="preview-panel" aria-label="Compiled score and playback">
      <div class="panel-heading preview-heading">
        <div><h1>Score preview</h1><p id="preview-message">Waiting for the first compile…</p></div>
        <div class="transport">
          <button class="play-button" id="play" disabled><span class="play-icon">▶</span><span>Play</span></button>
          <button class="stop-button" id="stop" disabled title="Stop playback">■</button>
        </div>
      </div>
      <div class="preview-scroll" id="preview-scroll"><div id="score-output" class="score-output"><div class="empty-state"><span class="empty-glyph">𝄞</span><b>Your score will appear here</b><span>Start with the example or open a .ly file.</span></div></div></div>
      <div class="playback-footer"><span id="audio-state">Audio is prepared with the score.</span><span id="duration"></span></div>
    </section>
  </main>
  <footer class="footnote"><span>Local editor · your score stays in this browser</span><span id="engine-state">Loading LilyPond engine…</span></footer>
  <div id="error-toast" class="error-toast" role="status" aria-live="polite"></div>
`;

const sourceEl = document.querySelector('#source');
const lineNumbers = document.querySelector('#line-numbers');
const statusEl = document.querySelector('#compile-status');
const statusText = statusEl.querySelector('span');
const editState = document.querySelector('#edit-state');
const previewMessage = document.querySelector('#preview-message');
const output = document.querySelector('#score-output');
const engineState = document.querySelector('#engine-state');
const playButton = document.querySelector('#play');
const stopButton = document.querySelector('#stop');
const audioState = document.querySelector('#audio-state');
const durationEl = document.querySelector('#duration');
const worker = new CompilerWorker();

let compileTimer;
let compileId = 0;
let latestRequestedId = 0;
let lastGoodSvgs = [];
let playableNotes = null;
let synth = null;
let isPlaying = false;
let stopTimer;
let saveName = 'my-score.ly';
let compileStart = 0;
let previewUrls = [];

function setStatus(kind, text) {
  statusEl.className = `status ${kind}`;
  statusText.textContent = text;
}

function setSource(text, label = 'Unsaved score') {
  sourceEl.value = text;
  editState.textContent = label;
  updateEditorChrome();
  queueCompile();
}

function updateEditorChrome() {
  const count = sourceEl.value.split('\n').length;
  lineNumbers.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  document.querySelector('#source-count').textContent = `${count} ${count === 1 ? 'line' : 'lines'}`;
}

function queueCompile() {
  clearTimeout(compileTimer);
  const id = ++compileId;
  latestRequestedId = id;
  setStatus('queued', 'Compiling shortly…');
  previewMessage.textContent = 'Updating preview…';
  editState.textContent = 'Unsaved changes';
  try { localStorage.setItem('lilypond-live-source', sourceEl.value); } catch { /* file:// storage may be disabled */ }
  compileTimer = setTimeout(() => {
    compileStart = performance.now();
    worker.postMessage({ type: 'compile', id, source: sourceEl.value });
  }, 650);
}

function renderSvgs(svgs) {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
  output.replaceChildren();
  for (const page of svgs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'score-page';
    const image = document.createElement('img');
    image.alt = `Engraved score page ${previewUrls.length + 1}`;
    image.src = URL.createObjectURL(new Blob([page.svg], { type: 'image/svg+xml' }));
    previewUrls.push(image.src);
    wrapper.append(image);
    output.append(wrapper);
  }
  document.querySelector('#download-svg').disabled = svgs.length === 0;
}

function midiDuration(notes) {
  if (!notes?.length) return 0;
  return Math.max(...notes.map((note) => note.time + note.duration));
}

function stopPlayback() {
  if (stopTimer) clearTimeout(stopTimer);
  if (synth) synth.releaseAll();
  isPlaying = false;
  playButton.querySelector('span:last-child').textContent = 'Play';
  playButton.classList.remove('playing');
  stopButton.disabled = true;
  if (playableNotes?.length) audioState.textContent = 'Audio is prepared with the score.';
}

worker.onmessage = ({ data }) => {
  if (data.type === 'loading') {
    const pct = data.percent ? ` ${data.percent}%` : '';
    setStatus('loading', `Loading compiler${pct}`);
    engineState.textContent = `Loading LilyPond engine…${pct}`;
    return;
  }
  if (data.type === 'compiling') {
    if (data.id !== latestRequestedId) return;
    setStatus('compiling', 'Compiling score…');
    return;
  }
  if (data.id !== latestRequestedId) return;
  if (data.type === 'compiled') {
    if (!data.svgs?.length) {
      setStatus('warning', 'Score compiled, but no page was produced');
      previewMessage.textContent = 'The source did not produce an engraved page.';
      return;
    }
    lastGoodSvgs = data.svgs;
    renderSvgs(lastGoodSvgs);
    stopPlayback();
    const elapsed = Math.max(1, Math.round(performance.now() - compileStart));
    previewMessage.textContent = `${data.svgs.length} page${data.svgs.length === 1 ? '' : 's'} · compiled in ${(elapsed / 1000).toFixed(1)} s`;
    if (data.midiNotes?.length) {
      playableNotes = data.midiNotes;
      playButton.disabled = false;
      durationEl.textContent = `${midiDuration(playableNotes).toFixed(1)} s`;
      audioState.textContent = `${playableNotes.length} notes ready to play.`;
      playButton.disabled = false;
    } else {
      playableNotes = null;
      playButton.disabled = true;
      durationEl.textContent = '';
      audioState.textContent = 'Wrap music in \\score { } to enable playback; MIDI is added automatically.';
    }
    setStatus('ready', 'Score and audio ready');
    engineState.textContent = 'LilyPond engine ready';
    editState.textContent = 'Compiled';
    return;
  }
  if (data.type === 'error') {
    const msg = String(data.message || 'Compilation failed');
    setStatus('error', 'Fix notation to update');
    previewMessage.textContent = 'The last valid score is shown. Correct the source to refresh it.';
    audioState.textContent = playableNotes?.length ? 'Playing the last valid compiled version.' : 'No playable version yet.';
    showError(msg);
  }
};

let toastTimer;
function showError(message) {
  const toast = document.querySelector('#error-toast');
  toast.textContent = message.split('\n').slice(0, 8).join('\n');
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 9000);
}

async function ensureSynth() {
  await Tone.start();
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 32,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.012, decay: 0.08, sustain: 0.62, release: 0.18 },
    }).toDestination();
    synth.volume.value = -8;
  }
}

async function playScore() {
  if (!playableNotes?.length) return;
  if (isPlaying) { stopPlayback(); return; }
  try {
    await ensureSynth();
    isPlaying = true;
    stopButton.disabled = false;
    playButton.classList.add('playing');
    playButton.querySelector('span:last-child').textContent = 'Playing';
    audioState.textContent = 'Playing compiled audio…';
    const startAt = Tone.now() + 0.08;
    for (const note of playableNotes) {
      const pitch = Tone.Frequency(note.midi, 'midi').toNote();
      synth.triggerAttackRelease(pitch, Math.max(0.035, note.duration), startAt + note.time, Math.max(0.05, note.velocity));
    }
    stopTimer = setTimeout(stopPlayback, (midiDuration(playableNotes) + 0.5) * 1000);
  } catch (error) {
    stopPlayback();
    showError(`Audio could not start: ${error?.message ?? error}`);
  }
}

sourceEl.addEventListener('input', () => {
  updateEditorChrome();
  queueCompile();
});
sourceEl.addEventListener('scroll', () => { lineNumbers.scrollTop = sourceEl.scrollTop; });
document.querySelector('#new-score').addEventListener('click', () => {
  saveName = 'my-score.ly';
  setSource(sampleScore, 'Example score');
});
document.querySelector('#open-score').addEventListener('click', () => document.querySelector('#file-picker').click());
document.querySelector('#file-picker').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  saveName = file.name.endsWith('.ly') ? file.name : `${file.name.replace(/\.[^.]+$/, '')}.ly`;
  setSource(await file.text(), file.name);
  event.target.value = '';
});
document.querySelector('#save-score').addEventListener('click', () => {
  const blob = new Blob([sourceEl.value], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = saveName;
  link.click();
  URL.revokeObjectURL(link.href);
  editState.textContent = 'Saved .ly file';
});
document.querySelector('#download-svg').addEventListener('click', () => {
  if (!lastGoodSvgs.length) return;
  const blob = new Blob([lastGoodSvgs[0].svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${saveName.replace(/\.ly$/i, '')}.svg`;
  link.click();
  URL.revokeObjectURL(link.href);
});
playButton.addEventListener('click', playScore);
stopButton.addEventListener('click', stopPlayback);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    document.querySelector('#save-score').click();
  }
  if (event.code === 'Space' && event.target !== sourceEl && !['INPUT', 'BUTTON'].includes(event.target.tagName)) {
    event.preventDefault();
    playScore();
  }
});

let savedSource = null;
try { savedSource = localStorage.getItem('lilypond-live-source'); } catch { /* file:// storage may be disabled */ }
sourceEl.value = savedSource || sampleScore;
if (savedSource) editState.textContent = 'Restored draft';
updateEditorChrome();
queueCompile();
