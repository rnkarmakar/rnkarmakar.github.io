# Browser stress tests — 2026-10-30 (Asia/Tokyo)

Tested the deployed HTTPS product in Chrome first, then the repaired production
build at `http://127.0.0.1:4175/lilypond-live/`. Browser actions used the actual
editor, buttons, keyboard, pointer, file picker and downloads. DOM observations
checked the visible state and source selections; unit tests were supplementary.

## Repairs found during this pass

- Ordinary `\score` blocks without `\layout` stopped engraving when automatic
  MIDI was inserted. Both output definitions are now supplied when absent.
- Play here guessed times from source order. Simultaneous staves, dynamics
  attached to notes, chords and ties could select the wrong playback time.
  A MIDI performer now records LilyPond's interpreted source positions and
  musical moments. Tempo changes and grace timing use the actual MIDI header.
- Recompiling reset the page size while the zoom label retained its old value.
  Zoom is now reapplied; enlarged pages also remain reachable from their left edge.
- Programmatic brace/indent/comment commands discarded native Undo history.
  Commands now use a native editing transaction, with a fallback where unavailable.
- Editor click/keyup could re-enable Play here against stale source mappings.
  It now stays disabled until the current revision succeeds.
- Score elements exposed duplicate keyboard targets, some without working
  activation. Only the working targets are focusable, and selecting with Space
  no longer also triggers the global playback shortcut.
- SVG export silently omitted every page after the first. It now combines all
  pages into one SVG, with separate identifiers for page-local definitions.
- Uppercase `.LY` filenames gained a second `.ly` suffix; file reads could reject
  without feedback. Filename matching is now case insensitive and read errors
  are surfaced.
- Compilation diagnostics disappeared after ten seconds. They now remain visible
  until an edit, and obsolete diagnostics are removed from the accessibility tree.

## Actual browser coverage

| Feature | Result |
| --- | --- |
| Initial/default example | Compiled voice, piano, chord names and lyrics; 163 MIDI notes and 129 mapped source positions. |
| Automatic edit/compile/preview | Small scores compiled and enabled audio; ordinary blocks without layout now engrave. |
| Status/errors/recovery | Invalid notation disables playback and leaves the last preview dimmed; a corrected source recovers. |
| Start/stop/restart | Actual browser AudioContext entered playback; 20 Ctrl+Enter restarts followed by Esc stopped it cleanly. |
| Selected score/source note | Both simultaneous first-staff notes map to 0 seconds; the next lower-staff note plays from 1 second, through Play here and Ctrl+Shift+Enter. |
| Source/score relationship | Pointer movement over source highlighted the score, and movement over a rendered note highlighted its source. Clicking and arrow-key caret movement were checked too. |
| Zoom | 50%, 150%, and 300%; zoomed score selection; left edge remains accessible; 150% survives recompilation. |
| Shortcuts | Ctrl+Enter, Ctrl+Shift+Enter, Esc, Space outside the editor, and literal spaces inside the editor. |
| Editing commands | Paired braces, selection wrapping, Enter indentation, Tab, Shift+Tab, Ctrl+/ twice, and native Undo/Redo. |
| Open/save | Actual file picker loaded an uppercase `.LY` file with Unicode text. Source download and retention across reload were checked. The user confirmed SVG downloads succeed in Chrome. |
| Multiple pages | Two-page score rendered; Save SVG completed for both pages. |
| Rapid edits | Twelve source replacements were made while a prior compile was active; revision 30 became the applied revision with 19 notes; stale playback remained stopped and Play here disabled during recompilation. |

## Automated regression coverage

`npm test`: **24 passing tests**. Five tests execute the real WebAssembly
LilyPond compiler, checking simultaneous voices, attached dynamics, variables,
chords, rests, tuplets, tempo changes, tie continuations, grace-note onsets,
multiple MIDI files, final rests between scores, and the full default example.
The other 19 cover player cancellation/scheduling, compile coalescing, source
offsets and editor transformations. `npm run build` creates the production bundle.

## Known engine limitation

The bundled LilyPond/Pango/HarfBuzz engine can abort on unsupported text glyphs
(reproduced with Japanese and emoji in a title). The source is retained, playback
is disabled, and removing the unsupported text allows the next edit to compile.
The app now gives an actionable message instead of the raw `unreachable` trap.
This does not add missing fonts or repair the upstream WebAssembly text shaper.
Browser coverage here is Chrome on Windows; other browser/OS combinations are
not claimed as tested. Ctrl shortcuts were exercised; Cmd uses the same handler
but was not tested on macOS.

---

# Earlier feedback-loop tests (2026-10-29)

Date: 2026-10-29 (Asia/Tokyo)

## Automated checks

Run npm test. All 19 tests pass.

- 500 consecutive playback restarts: every previous oscillator is stopped and disconnected; exactly one scheduler remains.
- 100 simultaneous Play requests: only the most recent session starts.
- Stop during asynchronous audio unlock: no late playback.
- An obsolete rejected audio unlock cannot cancel newer playback.
- 10,000 notes: only the short lookahead window is scheduled; delayed scheduler ticks skip expired notes instead of emitting them together.
- Starting from a selected time: expired notes are skipped, notes already sounding continue with their remaining duration, and later notes retain their relative timing.
- Source-position mapping counts pitch tokens but excludes tempo, key, and meter directives from note selection.
- The default example has four score systems, two staves, lyrics, chord names, and representative expressive notation; legacy pristine sample text is migrated while custom saved scores remain untouched.
- Tab insertion and multiline selection indentation, Shift+Tab unindent, Enter indentation inside braces, paired opening/closing braces with selection wrapping, and Ctrl+/ LilyPond comment toggling.
- 10,000 source revisions: one compilation runs and only the newest pending revision is sent next. Old results cannot replace the new revision.
- Edits before debounce, compiler errors, and recovery.
- MIDI injection through strings and nested comments.
- Exact source offsets after MIDI injection, including multiple score blocks on one line.
- Unicode, tabs, CRLF, and out-of-range source positions.

The audio tests use a deterministic AudioContext substitute to inspect node cancellation and scheduling. Browser tests below exercise the actual browser AudioContext and compiler.

## Browser checks on the production build

Chrome, localhost production preview at /lilypond-live/:

- 20 consecutive edit–compile–play cycles, with 4–23 notes. Every next edit stopped playback. Each applied revision matched the requested revision. Warm compile times: 1.1–1.6 seconds.
- 12 rapid edits during compilation: the latest revision (14) was applied and 15 notes were prepared. Intermediate results did not replace it.
- 20 rapid keyboard restarts followed by Esc. Playback stopped; Stop became disabled; no console errors.
- Syntax error while Play was queued: the old preview stayed dimmed, playback remained stopped, and Play stayed disabled. A corrected score compiled successfully.
- Ctrl+Enter during compilation: actual playback started when the current revision completed. Esc stopped it.
- Esc before compilation completed: no automatic playback afterward. The status correctly reported cancellation.
- The example produced 22 notes and 25 point-and-click links.
- Clicking the first score note selected c4 in the editor. Moving the editor cursor to d highlighted the corresponding score element. A pointer click on that source token also matched the correct note.
- The source highlight was visually checked against the note token.
- Two score blocks on one source line produced four playable notes and four source links.
- No console errors were reported during these checks.

The example's initial compile took 5.9–7.4 seconds in earlier cold-start checks; a subsequent example compile took 3.2 seconds. Network and machine speed affect these timings.

## Live deployment

The same built HTML, JavaScript, CSS, engine assets, editable source, and tests are included in the website repository PR. After merging and GitHub Pages deployment, the public HTTPS URL is checked separately. Results of that check are recorded in the PR follow-up and task completion message.

## Practical limits

LilyPond still engraves in seconds rather than instantaneously. Typing is debounced by 250 ms. One in-flight compilation is allowed to finish, with only the newest pending edit retained; an unresponsive worker times out and is replaced.

Source navigation is limited to point-and-click locations emitted by LilyPond for /input/score.ly. It does not provide graphical note editing or an editor for external include files. The test set is not an exhaustive check of every LilyPond construct or browser.
