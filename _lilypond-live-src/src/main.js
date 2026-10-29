import CompilerWorker from './compiler.worker.js?worker&inline';
import { sampleScore } from './sample-score.js';
import { ScorePlayer } from './player.js';
import { CompileQueue } from './compile-queue.js';
import { sourceOffset, originalOffset, tokenRange } from './source-map.js';
import './style.css';

document.querySelector('#app').innerHTML = [
  '<header class="topbar"><a class="brand" href="#" aria-label="LilyPond Live home"><span class="brand-mark">♬</span><span>LilyPond <b>Live</b></span></a>',
  '<div class="top-actions"><span id="compile-status" class="status"><i></i><span>Starting compiler…</span></span>',
  '<button class="button quiet" id="new-score">New example</button><button class="button quiet" id="open-score">Open .ly</button>',
  '<button class="button quiet" id="save-score" title="Save source (Ctrl/Cmd+S)">Save .ly</button><button class="button quiet" id="download-svg" disabled>Save SVG</button>',
  '<input id="file-picker" type="file" accept=".ly,.ily,.txt,text/plain" hidden /></div></header>',
  '<main class="workspace"><section class="editor-panel" aria-label="LilyPond score editor">',
  '<div class="panel-heading"><div><h1>Score source</h1><p>Type LilyPond. The score and audio update together.</p></div><span id="edit-state" class="edit-state"></span></div>',
  '<div class="editor-wrap"><div class="line-numbers" id="line-numbers" aria-hidden="true"></div>',
  '<textarea id="source" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="LilyPond source"></textarea>',
  '<div id="source-highlight" aria-hidden="true" hidden></div></div>',
  '<div class="editor-footer"><span id="mapping-hint">Hover notes or source to link them</span><span id="source-count"></span></div></section>',
  '<section class="preview-panel" aria-label="Compiled score and playback"><div class="panel-heading preview-heading">',
  '<div><h1>Score preview</h1><p id="preview-message">Waiting for the first compile…</p></div>',
  '<div class="transport"><button class="play-button" id="play" title="Play from start (Ctrl/Cmd+Enter)" aria-keyshortcuts="Control+Enter Meta+Enter" disabled><span class="play-icon">▶</span><span>Start</span></button>',
  '<button class="button quiet play-here" id="play-here" title="Play from the selected note (Ctrl/Cmd+Shift+Enter)" aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter" disabled>Play here</button>',
  '<button class="stop-button" id="stop" title="Stop playback or cancel queued play (Esc)" aria-keyshortcuts="Escape" disabled>■</button></div></div>',
  '<div class="shortcut-hint"><span class="zoom-controls"><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><output id="zoom-level">100%</output><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button></span><kbd>Ctrl/Cmd + Enter</kbd> Start <span>·</span> <kbd>Ctrl/Cmd + Shift + Enter</kbd> Play here <span>·</span> <kbd>Esc</kbd> Stop <span>·</span> Space starts / stops</div>',
  '<div class="preview-scroll" id="preview-scroll"><div id="score-output" class="score-output"><div class="empty-state"><span class="empty-glyph">𝄞</span><b>Your score will appear here</b><span>Open a .ly file or edit the example.</span></div></div></div>',
  '<div class="playback-footer"><span id="audio-state">Audio is prepared with the score.</span><span id="duration"></span></div></section></main>',
  '<footer class="footnote"><span>Your score stays in this browser</span><span id="engine-state">Loading LilyPond engine…</span></footer>',
  '<div id="error-toast" class="error-toast" role="status" aria-live="polite"></div>',
].join('');

const $ = selector => document.querySelector(selector);
const sourceEl = $('#source'), output = $('#score-output');
const playButton = $('#play'), stopButton = $('#stop');
const playHereButton = $('#play-here');
const audioState = $('#audio-state'), previewMessage = $('#preview-message');
const marker = $('#source-highlight');
let revision = 0, compiledRevision = 0, compileTimer, watchdog, toastTimer;
let lastGoodSvgs = [], playableNotes = null, compiledSource = '';
let saveName = 'my-score.ly', pendingPlay = false, engineReady = false;
let mappings = [], activeMapping = null, sourcePlaybackMap = [], pendingPlayFrom = 0, scoreZoom = 1, worker;
const player = new ScorePlayer({ onState: playing => {
  document.body.dataset.playing = String(playing);
  playButton.classList.toggle('playing', playing);
  playButton.lastElementChild.textContent = playing ? 'Restart' : 'Start';
  stopButton.disabled = !playing && !pendingPlay;
  if (playing) audioState.textContent = 'Playing compiled audio…';
  else if (compiledRevision === revision && playableNotes?.length)
    audioState.textContent = playableNotes.length + ' notes ready to play.';
}});

function setStatus(kind, text) {
  $('#compile-status').className = 'status ' + kind;
  $('#compile-status span').textContent = text;
}
function showError(message) {
  $('#error-toast').textContent = String(message).split('\n').slice(0, 8).join('\n');
  $('#error-toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#error-toast').classList.remove('visible'), 10000);
}
function stopPlayback() {
  const cancelled = pendingPlay;
  pendingPlay = false;
  player.stop();
  stopButton.disabled = true;
  if (cancelled && compiledRevision !== revision) audioState.textContent = 'Queued playback cancelled. Compilation continues.';
}
function spawnWorker() {
  worker = new CompilerWorker();
  worker.onmessage = ({ data }) => {
    if (data.type === 'loading') {
      $('#engine-state').textContent = 'Loading engine… ' + data.percent + '%';
      return;
    }
    queue.receive(data);
  };
  worker.onerror = event => {
    event.preventDefault();
    recoverWorker('The compiler stopped unexpectedly. Edit again to retry.');
  };
  worker.onmessageerror = () => recoverWorker('The compiler returned an unreadable result. Edit again to retry.');
}
function recoverWorker(message) {
  const id = queue.active?.id;
  worker.terminate();
  engineReady = false;
  spawnWorker();
  if (id !== undefined) queue.receive({ type: 'error', id, message, restarted: true });
}
const queue = new CompileQueue({
  send(request) {
    request.startedAt = performance.now();
    document.body.dataset.compiling = 'true';
    setStatus('compiling', request.id === revision ? 'Compiling score…' : 'Finishing previous compile…');
    watchdog = setTimeout(() => recoverWorker('Compilation took too long. Edit again to retry.'), engineReady ? 45000 : 90000);
    worker.postMessage({ type: 'compile', id: request.id, source: request.source });
  },
  settled(data) {
    clearTimeout(watchdog);
    document.body.dataset.compiling = 'false';
    if (data.type === 'compiled') engineReady = true;
  },
  result(data, request) {
    if (data.type === 'error' || !data.svgs?.length) {
      stopPlayback();
      playButton.disabled = true;
      setStatus('error', 'Fix notation to update');
      previewMessage.textContent = lastGoodSvgs.length ? 'Last valid preview · current source has errors' : 'Current source could not be compiled.';
      audioState.textContent = 'Playback waits for a successful compile.';
      $('#engine-state').textContent = 'Ready to retry on the next edit';
      showError(data.message || 'No score page was produced.');
      return;
    }
    lastGoodSvgs = data.svgs;
    compiledSource = request.source;
    compiledRevision = request.id;
    document.body.dataset.compiledRevision = String(compiledRevision);
    playableNotes = data.midiNotes?.length ? data.midiNotes : null;
    renderSvgs(data.svgs, data.sourceMap, playableNotes);
    output.classList.remove('stale');
    playButton.disabled = !playableNotes;
    $('#duration').textContent = playableNotes ? duration(playableNotes).toFixed(1) + ' s' : '';
    audioState.textContent = playableNotes ? playableNotes.length + ' notes ready to play.' : 'Use a \\score { } block to prepare playback.';
    previewMessage.textContent = data.svgs.length + ' page(s) · compiled in ' + ((performance.now() - request.startedAt) / 1000).toFixed(1) + ' s';
    setStatus('ready', playableNotes ? 'Score and audio ready' : 'Score ready · no audio');
    $('#engine-state').textContent = 'LilyPond engine ready';
    $('#edit-state').textContent = 'Compiled';
    $('#mapping-hint').textContent = mappings.length ? 'Hover either pane · click a note to edit its source' : 'No source links in this score';
    playHereButton.disabled = !sourcePlaybackMap.length;
    if (pendingPlay && playableNotes) { pendingPlay = false; playFromTime(pendingPlayFrom); }
    else if (!playableNotes) stopPlayback();
  },
});
spawnWorker();

function updateEditorChrome() {
  const count = sourceEl.value.split('\n').length;
  $('#line-numbers').textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  $('#source-count').textContent = count + ' lines';
}
function queueCompile(immediate = false) {
  clearTimeout(compileTimer);
  stopPlayback();
  revision++;
  queue.invalidate(revision);
  document.body.dataset.revision = String(revision);
  playButton.disabled = true;
  playHereButton.disabled = true;
  output.classList.add('stale');
  clearMapping();
  setStatus('queued', 'Compiling shortly…');
  previewMessage.textContent = lastGoodSvgs.length ? 'Updating · last compiled preview shown' : 'Preparing first preview…';
  audioState.textContent = 'Audio updates with the next successful compile.';
  $('#edit-state').textContent = 'Unsaved changes';
  $('#mapping-hint').textContent = 'Source links update after compilation';
  $('#error-toast').classList.remove('visible');
  try { localStorage.setItem('lilypond-live-source', sourceEl.value); } catch { /* storage may be unavailable */ }
  const request = { type: 'compile', id: revision, source: sourceEl.value };
  compileTimer = setTimeout(() => queue.submit(request), immediate ? 0 : 250);
}
function setSource(text) {
  sourceEl.value = text;
  updateEditorChrome();
  queueCompile();
}
function duration(notes) {
  return notes.reduce((end, note) => Math.max(end, note.time + note.duration), 0);
}
async function startPlayback() {
  return playFromTime(0);
}
async function playFromTime(time) {
  pendingPlay = false;
  if (compiledRevision !== revision || !playableNotes?.length) return;
  try { await player.play(playableNotes, time); }
  catch (error) { stopPlayback(); showError('Audio could not start: ' + error.message); }
}
function selectedPlaybackTime() {
  if (!sourcePlaybackMap.length) return null;
  const offset = sourceEl.selectionStart;
  const linked = sourcePlaybackMap.find(item => offset >= item.start && offset < item.end);
  const next = sourcePlaybackMap.find(item => item.start >= offset);
  return (linked ?? next ?? sourcePlaybackMap.at(-1)).time;
}
function requestPlay(toggle = false, fromHere = false) {
  if (toggle && (player.playing || pendingPlay)) { stopPlayback(); return; }
  const selectedTime = fromHere ? selectedPlaybackTime() : 0;
  if (fromHere && selectedTime === null) return;
  if (compiledRevision === revision && playableNotes?.length) { playFromTime(selectedTime); return; }
  if ($('#compile-status').classList.contains('error')) return;
  pendingPlay = true;
  pendingPlayFrom = selectedTime;
  const targetRevision = revision;
  player.prepare().catch(error => {
    if (pendingPlay && targetRevision === revision) { stopPlayback(); showError('Audio could not start: ' + error.message); }
  });
  stopButton.disabled = false;
  audioState.textContent = (fromHere ? 'Will play from the selected note' : 'Will play from the beginning') + ' when compilation finishes. Esc cancels.';
}

function clearMapping() {
  output.querySelectorAll('.linked-active').forEach(link => link.classList.remove('linked-active'));
  activeMapping = null;
  marker.hidden = true;
}
function textMetrics() {
  const style = getComputedStyle(sourceEl);
  const canvas = textMetrics.canvas ??= document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = style.fontSize + ' ' + style.fontFamily;
  return { char: context.measureText('M').width, line: parseFloat(style.lineHeight),
    left: parseFloat(style.paddingLeft), top: parseFloat(style.paddingTop), context };
}
function textWidth(text, metrics) {
  let width = 0;
  for (const part of text.split('\t').entries()) {
    if (part[0]) width = (Math.floor(width / (2 * metrics.char) + 0.001) + 1) * 2 * metrics.char;
    width += metrics.context.measureText(part[1]).width;
  }
  return width;
}
function showMapping(mapping, fromScore = false) {
  if (!mapping || compiledRevision !== revision) return clearMapping();
  output.querySelectorAll('.linked-active').forEach(link => link.classList.remove('linked-active'));
  activeMapping = mapping;
  mappings.filter(item => item.start === mapping.start).forEach(item => item.element.classList.add('linked-active'));
  const lines = compiledSource.slice(0, mapping.start).split('\n');
  const row = lines.length - 1, column = [...lines.at(-1)].length;
  const metrics = textMetrics();
  const x = textWidth(lines.at(-1), metrics);
  if (fromScore) {
    const y = row * metrics.line;
    if (y < sourceEl.scrollTop || y + metrics.line > sourceEl.scrollTop + sourceEl.clientHeight - 32)
      sourceEl.scrollTop = Math.max(0, y - sourceEl.clientHeight / 2);
    if (x < sourceEl.scrollLeft || x > sourceEl.scrollLeft + sourceEl.clientWidth - 60)
      sourceEl.scrollLeft = Math.max(0, x - sourceEl.clientWidth / 2);
  } else mapping.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const area = sourceEl.getBoundingClientRect(), wrap = $('.editor-wrap').getBoundingClientRect();
  marker.hidden = false;
  marker.style.left = (area.left - wrap.left + metrics.left + x - sourceEl.scrollLeft) + 'px';
  marker.style.top = (metrics.top + row * metrics.line - sourceEl.scrollTop) + 'px';
  marker.style.width = Math.max(metrics.char, textWidth(compiledSource.slice(mapping.start, mapping.end), metrics)) + 'px';
  marker.style.height = metrics.line + 'px';
  $('#mapping-hint').textContent = 'Linked source: line ' + (row + 1) + ', character ' + (column + 1);
}
function mappingAt(offset) {
  return mappings.find(item => offset >= item.start && offset < item.end);
}
function renderSvgs(svgs, sourceMap, notes = []) {
  clearMapping();
  mappings = [];
  sourcePlaybackMap = [];
  output.replaceChildren();
  for (let pageIndex = 0; pageIndex < svgs.length; pageIndex++) {
    const doc = new DOMParser().parseFromString(svgs[pageIndex].svg, 'image/svg+xml');
    if (doc.querySelector('parsererror')) continue;
    const svg = doc.documentElement;
    svg.querySelectorAll('script,foreignObject,iframe,style,image,audio,video').forEach(el => el.remove());
    const wrapper = document.createElement('div');
    wrapper.className = 'score-page';
    svg.setAttribute('aria-label', 'Engraved score page ' + (pageIndex + 1));
    for (const element of [svg, ...svg.querySelectorAll('*')]) {
      for (const attr of [...element.attributes]) {
        if (/^on/i.test(attr.name) || /javascript:|expression\(|url\(\s*['"]?(?!#)/i.test(attr.value))
          element.removeAttributeNode(attr);
      }
      const href = element.getAttribute('href') || element.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href) continue;
      element.removeAttribute('href');
      element.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (href.startsWith('#')) { element.setAttribute('href', href); continue; }
      const location = /\/input\/score\.ly:(\d+):(\d+):(\d+)$/.exec(href);
      if (!location || !sourceMap) continue;
      const generated = sourceOffset(sourceMap.source, Number(location[1]), Number(location[2]));
      const start = generated === null ? null : originalOffset(generated, sourceMap.insertions);
      if (start === null || start >= compiledSource.length) continue;
      const mapping = { ...tokenRange(compiledSource, start), element };
      mappings.push(mapping);
      element.classList.add('score-link');
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      const originalLines = compiledSource.slice(0, start).split('\n');
      element.setAttribute('aria-label', 'Source line ' + originalLines.length + ', character ' + ([...originalLines.at(-1)].length + 1));
      element.dataset.sourceStart = String(start);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = compiledSource.slice(mapping.start, mapping.end) + ' · click to edit source';
      element.append(title);
    }
    wrapper.append(svg);
    output.append(wrapper);
    for (const mapping of mappings.filter(item => item.element.ownerSVGElement === svg)) {
      let bounds;
      try { bounds = mapping.element.getBBox(); } catch { continue; }
      const padX = Math.max(4, (22 - bounds.width) / 2), padY = Math.max(4, (26 - bounds.height) / 2);
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', String(bounds.x - padX)); hit.setAttribute('y', String(bounds.y - padY));
      hit.setAttribute('width', String(bounds.width + 2 * padX)); hit.setAttribute('height', String(bounds.height + 2 * padY));
      hit.setAttribute('fill', 'transparent'); hit.setAttribute('pointer-events', 'all');
      hit.classList.add('score-hit-target'); hit.setAttribute('aria-label', mapping.element.getAttribute('aria-label'));
      hit.dataset.sourceStart = String(mapping.start); hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button');
      const select = event => {
        event.preventDefault();
        if (compiledRevision !== revision) return;
        showMapping(mapping, true);
        sourceEl.focus();
        sourceEl.setSelectionRange(mapping.start, mapping.end);
      };
      hit.addEventListener('pointerenter', () => showMapping(mapping, true));
      hit.addEventListener('pointerleave', clearMapping);
      hit.addEventListener('focus', () => showMapping(mapping, true));
      hit.addEventListener('click', select);
      hit.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') select(event); });
      svg.append(hit);
    }
  }
  const starts = [...new Set(mappings.map(item => item.start))].sort((a, b) => a - b);
  const orderedNotes = notes.slice().sort((a, b) => a.time - b.time || a.midi - b.midi);
  if (starts.length && orderedNotes.length) {
    sourcePlaybackMap = starts.map((start, index) => {
      const noteIndex = starts.length === orderedNotes.length ? index : Math.round(index * (orderedNotes.length - 1) / Math.max(1, starts.length - 1));
      return { start, end: tokenRange(compiledSource, start).end, time: orderedNotes[noteIndex].time };
    });
  }
  document.body.dataset.sourceNoteCount = String(sourcePlaybackMap.length);
  document.body.dataset.midiNoteCount = String(orderedNotes.length);
  playHereButton.disabled = !sourcePlaybackMap.length;
  $('#download-svg').disabled = svgs.length === 0;
}

function applyZoom() {
  $('#zoom-level').value = Math.round(scoreZoom * 100) + '%';
  output.querySelectorAll('.score-page').forEach(page => { page.style.width = (scoreZoom * 100) + '%'; });
}
$('#zoom-in').addEventListener('click', () => { scoreZoom = Math.min(3, +(scoreZoom + .25).toFixed(2)); applyZoom(); });
$('#zoom-out').addEventListener('click', () => { scoreZoom = Math.max(.5, +(scoreZoom - .25).toFixed(2)); applyZoom(); });

sourceEl.addEventListener('input', () => { updateEditorChrome(); queueCompile(); });
sourceEl.addEventListener('pointermove', event => {
  if (compiledRevision !== revision) return;
  const metrics = textMetrics(), rect = sourceEl.getBoundingClientRect();
  const row = Math.floor((event.clientY - rect.top - metrics.top + sourceEl.scrollTop) / metrics.line);
  const targetX = event.clientX - rect.left - metrics.left + sourceEl.scrollLeft;
  const lines = compiledSource.split('\n');
  if (row < 0 || row >= lines.length || targetX < 0) return clearMapping();
  let visual = 0, index = 0;
  for (const c of lines[row]) {
    const width = c === '\t' ? 2 * metrics.char - visual % (2 * metrics.char) : metrics.context.measureText(c).width;
    if (visual + width > targetX) break;
    visual += width; index += c.length;
  }
  if (index === lines[row].length) return clearMapping();
  const start = lines.slice(0, row).reduce((n, line) => n + line.length + 1, 0) + index;
  showMapping(mappingAt(start));
});
sourceEl.addEventListener('pointerleave', clearMapping);
sourceEl.addEventListener('keyup', event => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
    showMapping(mappingAt(sourceEl.selectionStart));
});
sourceEl.addEventListener('click', () => showMapping(mappingAt(sourceEl.selectionStart)));
sourceEl.addEventListener('click', () => { playHereButton.disabled = !sourcePlaybackMap.length; });
sourceEl.addEventListener('keyup', () => { playHereButton.disabled = !sourcePlaybackMap.length; });
sourceEl.addEventListener('scroll', () => {
  $('#line-numbers').scrollTop = sourceEl.scrollTop;
  if (activeMapping) showMapping(activeMapping);
});
$('#new-score').addEventListener('click', () => { saveName = 'my-score.ly'; setSource(sampleScore); });
$('#open-score').addEventListener('click', () => $('#file-picker').click());
$('#file-picker').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  saveName = file.name.endsWith('.ly') ? file.name : file.name + '.ly';
  setSource(await file.text());
  event.target.value = '';
});
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#save-score').addEventListener('click', () => {
  download(sourceEl.value, 'text/plain;charset=utf-8', saveName);
  $('#edit-state').textContent = 'Saved .ly file';
});
$('#download-svg').addEventListener('click', () => {
  if (lastGoodSvgs.length) download(lastGoodSvgs[0].svg, 'image/svg+xml', saveName.replace(/\.ly$/i, '') + '.svg');
});
playButton.addEventListener('click', () => requestPlay());
playHereButton.addEventListener('click', () => requestPlay(false, true));
stopButton.addEventListener('click', stopPlayback);
document.addEventListener('keydown', event => {
  if (event.isComposing || event.repeat) return;
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault(); requestPlay(false, event.shiftKey);
  } else if (event.key === 'Escape') {
    event.preventDefault(); stopPlayback();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault(); $('#save-score').click();
  } else if (event.code === 'Space' && !['TEXTAREA', 'INPUT', 'BUTTON'].includes(event.target.tagName) && !event.target.isContentEditable) {
    event.preventDefault(); requestPlay(true);
  }
});
window.addEventListener('pagehide', event => { stopPlayback(); if (!event.persisted) worker.terminate(); });
window.addEventListener('resize', clearMapping);
let savedSource;
try { savedSource = localStorage.getItem('lilypond-live-source'); } catch { /* storage may be unavailable */ }
sourceEl.value = savedSource ?? sampleScore;
updateEditorChrome();
queueCompile(true);
