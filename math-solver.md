---
layout: default
title: Math Problem Solver
permalink: /math-solver/
---

<section class="solver-hero">
  <div class="solver-hero__content">
    <p class="eyebrow">Interactive prototype</p>
    <h1>Math Problem Solver</h1>
    <p class="lede">
      Run the GPT-powered math queue agent directly in the browser, keep your API keys stored locally for reuse,
      and optionally sign in to Google Drive to save solution transcripts.
    </p>
    <div class="hero-actions">
      <a class="pill" href="#solver-app">Open the app</a>
      <a class="pill pill--ghost" href="/assets/python/gpt_math_queue_gpt_html.py">View source Python logic</a>
    </div>
  </div>
</section>

<section id="solver-app" class="solver-app card">
  <header class="card__header">
    <div>
      <p class="eyebrow">Configuration</p>
      <h2>Connect services</h2>
      <p class="hint">Keys are stored in your browser's local storage only. Nothing leaves your device unless you run a solve.</p>
    </div>
  </header>
  <div class="grid">
    <div class="field">
      <label for="provider">Model provider</label>
      <select id="provider">
        <option value="openai">OpenAI</option>
        <option value="openrouter">OpenRouter</option>
      </select>
      <p class="hint">Choose the API endpoint for the math agent.</p>
    </div>
    <div class="field">
      <label for="openaiKey">OpenAI API key</label>
      <input id="openaiKey" name="openaiKey" autocomplete="off" placeholder="sk-..." />
      <p class="hint">Used when provider is OpenAI. Stored locally after you type.</p>
    </div>
    <div class="field">
      <label for="openrouterKey">OpenRouter API key</label>
      <input id="openrouterKey" name="openrouterKey" autocomplete="off" placeholder="or-..." />
      <p class="hint">Used when provider is OpenRouter. Stored locally after you type.</p>
    </div>
    <div class="field">
      <label for="driveClientId">Google Drive Client ID</label>
      <input id="driveClientId" name="driveClientId" autocomplete="off" placeholder="your-client-id.apps.googleusercontent.com" />
      <p class="hint">Required for Drive sign-in. Stored locally.</p>
    </div>
    <div class="field">
      <label for="driveApiKey">Google API key</label>
      <input id="driveApiKey" name="driveApiKey" autocomplete="off" placeholder="Drive API key" />
      <p class="hint">Used with the Drive client ID to request file access.</p>
    </div>
    <div class="field">
      <label for="saveToDrive" class="checkbox-row">
        <input type="checkbox" id="saveToDrive" />
        <span>Save solver transcripts to Drive when signed in</span>
      </label>
      <div class="stacked-actions">
        <button id="driveSignIn" class="pill">Sign in to Drive</button>
        <span id="driveStatus" class="hint">Not signed in</span>
      </div>
    </div>
  </div>
</section>

<section class="solver-app card">
  <header class="card__header">
    <div>
      <p class="eyebrow">Problem</p>
      <h2>Describe the task</h2>
      <p class="hint">Give the model enough structure—add hints, steps, and constraints.</p>
    </div>
    <div class="pill pill--ghost" id="persistStatus">Settings saved locally</div>
  </header>
  <div class="grid">
    <div class="field field--full">
      <label for="problem">Problem statement</label>
      <textarea id="problem" rows="3" placeholder="Enter the math question in natural language"></textarea>
    </div>
    <div class="field field--full">
      <label for="hints">Hints or partial steps</label>
      <textarea id="hints" rows="2" placeholder="Key hints, lemmas, or intermediate steps"></textarea>
    </div>
    <div class="field">
      <label for="context">Context</label>
      <textarea id="context" rows="2" placeholder="Textbook, lecture, or topic focus"></textarea>
    </div>
    <div class="field">
      <label for="parameters">Other parameters</label>
      <textarea id="parameters" rows="2" placeholder="Difficulty, format, constraints, or evaluation notes"></textarea>
    </div>
    <div class="field">
      <label for="temperature">Creativity</label>
      <input id="temperature" type="range" min="0" max="1" step="0.05" value="0.15" />
      <div class="range-labels"><span>deterministic</span><span>creative</span></div>
    </div>
    <div class="field">
      <label for="maxTokens">Max tokens</label>
      <input id="maxTokens" type="number" min="128" max="4096" value="1200" />
    </div>
  </div>
  <div class="actions">
    <button id="solve" class="pill">Run solver</button>
    <button id="clearForm" class="pill pill--ghost">Clear</button>
  </div>
</section>

<section class="solver-app card">
  <header class="card__header">
    <div>
      <p class="eyebrow">Output</p>
      <h2>Reasoning & solution</h2>
    </div>
    <div class="pill pill--ghost" id="solveStatus">Idle</div>
  </header>
  <article id="solution" class="solution"></article>
</section>

<link rel="stylesheet" href="/assets/css/math-solver.css">
<script src="https://apis.google.com/js/api.js" async defer></script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
<script src="/assets/js/math-solver.js"></script>

