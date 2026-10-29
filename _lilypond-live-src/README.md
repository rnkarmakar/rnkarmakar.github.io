# LilyPond Live

Open https://rnkarmakar.github.io/lilypond-live/ and edit ordinary LilyPond source. The score and MIDI are compiled together in a browser worker. Playback uses the browser's Web Audio synthesizer, with no separate audio render step.

The default example is a multi-system voice-and-piano song with chord names, lyrics, slurs, dynamics, articulation, a tuplet, a grace note, a tie, rests, and a fermata. The first visit uses this showcase; a saved custom score is preserved.

## Controls

- **{** inserts a matching **}** and leaves the caret between them; if text is selected, the braces wrap it. Typing **}** before a pair moves past it.
- **Tab** inserts a literal tab at the caret, or indents the selected lines.
- **Enter** carries the current line's indentation forward and adds one tab after `{` or `<<`.
- **Shift+Tab** removes one tab or up to two leading spaces from the current or selected lines.
- **Ctrl+/** (Windows/Linux) or **Cmd+/** (Mac) toggles LilyPond `%` comments on the selected lines (or the current line when there is no selection).
- **Ctrl+Enter** (Windows/Linux) or **Cmd+Enter** (Mac): play or restart from the beginning, including while the editor has focus.
- **Ctrl/Cmd+Shift+Enter**: play from the note at the editor caret or the selected score note.
- **Esc**: stop all audio and cancel a Play queued during compilation.
- **Space** outside text fields and buttons: toggle play/stop.
- **Zoom − / +**: resize the score from 50% to 300%; use the preview scrollbars to move around a zoomed page.
- **Ctrl/Cmd+S**: download the current source.
- Hover a mapped score element to highlight its source token. Hover a source token, or move the text cursor through it, to highlight the score.
- Click a mapped score element to select and edit its source. Source links update only after a successful compile.
- Click a note in the editor to place the caret there, then use **Play here** to start playback at that note.

Each edit stops old playback immediately. Only the latest successful revision can play. Ctrl/Cmd+Enter during compilation queues playback for that revision; another edit or Esc cancels it.

The compiler runs one revision at a time and keeps only the newest pending edit. Stale results cannot replace the latest preview or audio. Syntax errors leave the last valid preview dimmed and disable playback until the source compiles successfully. A failed or unresponsive worker can recover on the next edit.

## Performance

There is a 250 ms typing debounce. LilyPond engraving still takes seconds: small warm compilations measured 1.1–1.6 seconds across 20 consecutive Chrome cycles (other examples took about 3 seconds). The first load additionally downloads and initializes the engine. This is automatic feedback, but not per-keystroke instantaneous engraving.

Source mapping covers the elements for which LilyPond emits point-and-click links in the current file. It is source navigation, not graphical note editing. Code that creates notes indirectly through Scheme or included files may not have a direct editable token here.

## Development and checks

Requires Node.js 22 or newer.

~~~sh
npm ci
npm run start
npm test
npm run build
~~~

The build copies engine assets into dist/engine/. For a production preview:

~~~sh
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174
~~~

Open http://127.0.0.1:4174/lilypond-live/.

## Repository layout

Editable source is in _lilypond-live-src/ in the personal site repository. Built files are in lilypond-live/. The existing GitHub Pages workflow publishes the static files. The app has no homepage navigation entry.

See STRESS-TEST-REPORT.md for automated coverage and browser checks. Third party notices are in THIRD-PARTY-NOTICES.md and licenses/lilypond-wasm/.
