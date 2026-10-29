import { sourceOffset, originalOffset, tokenRange } from './source-map.js';

// Observe the MIDI interpreter, where simultaneous voices, repeats, tempo changes,
// and source locations have already been resolved by LilyPond itself.
export const playbackSettings = String.raw`\version "2.26.0"
#(define lilypond-live-score-count 0)
\midi {
  \context {
    \Score
    \consists #(lambda (context)
      (let ((score-number 0))
        (make-performer
          ((initialize performer)
            (set! lilypond-live-score-count (+ lilypond-live-score-count 1))
            (set! score-number lilypond-live-score-count)
            (ly:message "LPLIVE:SCORE:~a" score-number)
            (ly:message "LPLIVE:START:~a:~a:~a" score-number
              (ly:moment-main (ly:context-current-moment context))
              (ly:moment-grace (ly:context-current-moment context))))
          (listeners
            ((note-event performer event)
              (let* ((origin (ly:event-property event 'origin))
                     (pitch (ly:event-property event 'pitch))
                     (loc (and (ly:input-location? origin)
                               (ly:input-file-line-char-column origin)))
                     (now (ly:context-current-moment context)))
                (if (and loc (equal? (car loc) "/input/score.ly") (ly:pitch? pitch))
                  (ly:message "LPLIVE:NOTE:~a:~a:~a:~a:~a:~a"
                    score-number (cadr loc) (caddr loc)
                    (ly:moment-main now) (ly:moment-grace now)
                    (+ 60 (ly:pitch-semitones pitch)))))))
          ((finalize performer)
            (ly:message "LPLIVE:END:~a:~a" score-number
              (ly:moment-main (ly:context-current-moment context)))))))
  }
}`;

const rational = value => {
  const [num, den = '1'] = value.split('/');
  return Number(num) / Number(den);
};

export function readPlaybackEvents(logs) {
  const scores = [];
  let current;
  for (const match of logs.join('\n').matchAll(/LPLIVE:(SCORE|START|NOTE|END):([^\s]+)|MIDI output to [`']([^'`]+)['`]/g)) {
    if (match[3]) {
      if (current) current.filename = match[3].split('/').at(-1);
      continue;
    }
    const [id, ...fields] = match[2].split(':');
    const score = scores[Number(id) - 1] ??= { events: [], end: 0 };
    current = score;
    if (match[1] === 'START') score.start = { moment: rational(fields[0]), grace: rational(fields[1]) };
    if (match[1] === 'END') score.end = rational(fields[0]);
    if (match[1] === 'NOTE') {
      const [line, character, moment, grace, midi] = fields;
      score.events.push({ line: Number(line), character: Number(character),
        moment: rational(moment), grace: rational(grace), midi: Number(midi) });
    }
  }
  return scores;
}

export function mapPlaybackEvents(score, midi, sourceMap, source, timeOffset = 0) {
  const initialTicks = momentTicks(score.start ?? { moment: 0, grace: 0 }, midi.header.ppq);
  const result = [];
  for (const event of score.events) {
    const generated = sourceOffset(sourceMap.source, event.line, event.character);
    const start = generated === null ? null : originalOffset(generated, sourceMap.insertions);
    if (start === null || start >= source.length) continue;
    const ticks = momentTicks(event, midi.header.ppq) - initialTicks;
    const time = midi.header.ticksToSeconds(Math.max(0, ticks));
    result.push({ ...tokenRange(source, start), time: time + timeOffset });
  }
  return result;
}

// LilyPond 2.26 converts grace time at 9/40 of notated duration and truncates
// absolute tick positions before subtracting the performance's initial tick.
// See LilyPond's moment_to_ticks and ly/articulate.ly (ac:defaultGraceFactor).
function momentTicks({ moment, grace = 0 }, ppq) {
  const ticks = (moment + grace * 9 / 40) * 4 * ppq;
  return Math.trunc(ticks + Math.sign(ticks) * 1e-8);
}

export function playbackEndTime(score, midi) {
  const start = momentTicks(score.start ?? { moment: 0 }, midi.header.ppq);
  return midi.header.ticksToSeconds(momentTicks({ moment: score.end }, midi.header.ppq) - start);
}
