# Feedback loop stress tests

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
