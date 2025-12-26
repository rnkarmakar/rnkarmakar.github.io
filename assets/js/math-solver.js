const formState = {
  provider: 'openai',
  openaiKey: '',
  openrouterKey: '',
  driveClientId: '',
  driveApiKey: '',
  saveToDrive: false,
  problem: '',
  hints: '',
  context: '',
  parameters: '',
  temperature: 0.15,
  maxTokens: 1200,
};

const STORAGE_KEY = 'math-solver-preferences-v1';
let driveAuthInstance = null;
let driveReady = false;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(formState, parsed);
  } catch (err) {
    console.warn('Could not parse saved state', err);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
  const badge = document.getElementById('persistStatus');
  if (badge) {
    badge.textContent = 'Settings saved locally';
    badge.classList.add('pill--ghost');
  }
}

function bindInputs() {
  const bindings = ['provider', 'openaiKey', 'openrouterKey', 'driveClientId', 'driveApiKey', 'problem', 'hints', 'context', 'parameters'];
  bindings.forEach((field) => {
    const el = document.getElementById(field);
    if (!el) return;
    if (formState[field]) el.value = formState[field];
    el.addEventListener('input', (event) => {
      formState[field] = event.target.value;
      persistState();
    });
  });

  const temperature = document.getElementById('temperature');
  if (temperature) {
    temperature.value = formState.temperature;
    temperature.addEventListener('input', (event) => {
      formState.temperature = Number(event.target.value);
      persistState();
    });
  }

  const maxTokens = document.getElementById('maxTokens');
  if (maxTokens) {
    maxTokens.value = formState.maxTokens;
    maxTokens.addEventListener('input', (event) => {
      formState.maxTokens = Number(event.target.value);
      persistState();
    });
  }

  const saveToDrive = document.getElementById('saveToDrive');
  if (saveToDrive) {
    saveToDrive.checked = formState.saveToDrive;
    saveToDrive.addEventListener('change', (event) => {
      formState.saveToDrive = event.target.checked;
      persistState();
    });
  }
}

function renderStatus(text, kind = 'ghost') {
  const status = document.getElementById('solveStatus');
  if (status) {
    status.textContent = text;
    status.className = `pill pill--${kind === 'ghost' ? 'ghost' : ''}`.trim();
  }
}

function renderSolution(html) {
  const container = document.getElementById('solution');
  if (!container) return;
  container.innerHTML = html;
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise([container]);
  }
}

function buildPrompt() {
  const { problem, hints, context, parameters } = formState;
  const parts = [
    `Problem: ${problem}`,
    hints ? `Hints: ${hints}` : '',
    context ? `Context: ${context}` : '',
    parameters ? `Additional parameters: ${parameters}` : '',
  ].filter(Boolean);
  return parts.join('\n\n');
}

async function callModel(prompt) {
  const provider = formState.provider;
  const temperature = formState.temperature;
  const maxTokens = formState.maxTokens;
  const systemPrompt = `You are an expert math tutor that mirrors the reasoning pipeline from the Colab notebook GPT_math_queue_GPT_html. You interpret a problem, restate it, lay out subgoals, solve step-by-step with proofs where relevant, and summarize the final numeric or symbolic result. Prefer LaTeX for math formatting.`;
  const body = {
    model: provider === 'openrouter' ? 'openrouter/anthropic/claude-3.5-sonnet' : 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  const headers = { 'Content-Type': 'application/json' };
  let endpoint = '';
  if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    headers['Authorization'] = `Bearer ${formState.openrouterKey}`;
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Math Problem Solver';
  } else {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${formState.openaiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0]?.message?.content || 'No response generated.';
  return choice;
}

function buildTranscript(prompt, answer) {
  const now = new Date().toISOString();
  return `Math Problem Solver Transcript\n${now}\n\n${prompt}\n\n---\n\n${answer}`;
}

async function ensureDrive() {
  if (!window.gapi) throw new Error('Google API not loaded yet.');
  if (driveReady) return;
  const { driveClientId, driveApiKey } = formState;
  if (!driveClientId || !driveApiKey) throw new Error('Provide Drive client ID and API key.');

  return new Promise((resolve, reject) => {
    window.gapi.load('client:auth2', async () => {
      try {
        await window.gapi.client.init({
          apiKey: driveApiKey,
          clientId: driveClientId,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          scope: 'https://www.googleapis.com/auth/drive.file',
        });
        driveAuthInstance = window.gapi.auth2.getAuthInstance();
        driveReady = true;
        driveAuthInstance.isSignedIn.listen(updateDriveBadge);
        updateDriveBadge(driveAuthInstance.isSignedIn.get());
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

function updateDriveBadge(signedIn) {
  const badge = document.getElementById('driveStatus');
  if (!badge) return;
  badge.textContent = signedIn ? 'Signed in to Drive' : 'Not signed in';
  badge.style.color = signedIn ? '#16a34a' : '#6b7280';
}

async function signIntoDrive() {
  try {
    await ensureDrive();
    if (!driveAuthInstance) throw new Error('Drive auth not ready.');
    if (!driveAuthInstance.isSignedIn.get()) {
      await driveAuthInstance.signIn();
    }
    updateDriveBadge(driveAuthInstance.isSignedIn.get());
  } catch (err) {
    alert(`Drive sign-in failed: ${err.message}`);
  }
}

async function uploadToDrive(filename, content) {
  if (!driveAuthInstance || !driveAuthInstance.isSignedIn.get()) return null;
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;
  const metadata = {
    name: filename,
    mimeType: 'text/plain',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/plain\r\n\r\n' +
    content +
    closeDelim;

  const request = window.gapi.client.request({
    path: '/upload/drive/v3/files',
    method: 'POST',
    params: { uploadType: 'multipart' },
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartRequestBody,
  });

  const file = await request;
  return file.result?.id;
}

function clearForm() {
  ['problem', 'hints', 'context', 'parameters'].forEach((field) => {
    const el = document.getElementById(field);
    if (el) el.value = '';
    formState[field] = '';
  });
  persistState();
  renderSolution('');
}

async function handleSolve() {
  const { provider, openaiKey, openrouterKey } = formState;
  if (provider === 'openai' && !openaiKey) {
    alert('Add an OpenAI API key.');
    return;
  }
  if (provider === 'openrouter' && !openrouterKey) {
    alert('Add an OpenRouter API key.');
    return;
  }
  if (!formState.problem) {
    alert('Add a problem statement.');
    return;
  }

  const prompt = buildPrompt();
  renderStatus('Calling model...');
  renderSolution('<span class="badge">Running</span>Reasoning...');

  try {
    const answer = await callModel(prompt);
    renderStatus('Complete');
    renderSolution(`<span class="badge">Model</span>${answer}`);
    const transcript = buildTranscript(prompt, answer);
    if (formState.saveToDrive) {
      await ensureDrive();
      if (driveAuthInstance?.isSignedIn.get()) {
        const name = `math-solver-${Date.now()}.txt`;
        await uploadToDrive(name, transcript);
        updateDriveBadge(true);
      }
    }
  } catch (err) {
    console.error(err);
    renderStatus('Error', 'ghost');
    renderSolution(`<span class="badge">Error</span>${err.message}`);
  }
}

function attachEvents() {
  const solve = document.getElementById('solve');
  if (solve) solve.addEventListener('click', handleSolve);
  const clear = document.getElementById('clearForm');
  if (clear) clear.addEventListener('click', clearForm);
  const drive = document.getElementById('driveSignIn');
  if (drive) drive.addEventListener('click', signIntoDrive);
}

(function bootstrap() {
  loadState();
  bindInputs();
  attachEvents();
  renderSolution('Share a problem and press "Run solver" to start.');
})();

