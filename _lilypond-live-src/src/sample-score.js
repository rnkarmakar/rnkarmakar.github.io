export const sampleScore = `\\version "2.26.0"

\\header {
  title = "Morning Comes"
  subtitle = "A short song for voice and piano"
  composer = "LilyPond Live example"
  poet = "A traditional-style verse"
}

melody = \\relative c' {
  \\key g \\major
  \\time 4/4
  \\tempo "Andante" 4 = 96
  \\dynamicUp
  g4\\p b d b | a4 g fis e | d4( g) a g | fis2 e4 d \\break
  g4\\mp b d b | c2 a | b4( a) g fis | e2 d \\break
  \\tuplet 3/2 { e8 fis g } a4 b4 d4 | e4\\< d c b\\! | a4( g) fis e | d1~ \\break
  d2 r2 | \\grace { fis16 g } a4 b c d | e4\\f d-> c b | g1\\fermata \\bar "|."
}

bassLine = \\relative c {
  \\key g \\major
  \\time 4/4
  g,4 d' g b | d,4 a' d fis | c,4 g' c e | g,4 d' g b \\break
  e,4 b' e g | a,4 e' a c | d,4 a' d fis | g,4 d' g b \\break
  c,4 g' c e | d,4 a' d fis | c,4 g' c e | d,4 a' d fis \\break
  g,2 d' | e,4 b' e g | d,4 a' d fis | g,1
}

chordLine = \\chordmode {
  g1 | d1 | g1 | d1 |
  e1:m | a1:m7 | d1:7 | g1 |
  c1 | d1 | c1 | d1 |
  g1 | e1:m | d1:7 | g1
}

verse = \\lyricmode {
  Day breaks o -- ver hills, as birds sing through the trees.
  Clear streams run free; hope wakes and lifts the heart.
  Light on the path, love in the air, we walk as one through field and stone.
  Then when the dark rolls in, we keep a flame; by dawn, our song will rise a -- gain.
}

\\score {
  <<
    \\new ChordNames { \\chordLine }
    \\new Staff = "voice" \\with { instrumentName = "Voice" } <<
      \\new Voice = "melody" { \\melody }
    >>
    \\new Lyrics \\lyricsto "melody" { \\verse }
    \\new Staff = "piano" \\with { instrumentName = "Piano" } {
      \\clef bass
      \\bassLine
    }
  >>
  \\layout { }
}
`;

export const previousSampleScore = `\\version "2.26.0"

\\header {
  title = "A little melody"
  composer = ""
}

\\score {
  \\relative c' {
    \\key c \\major
    \\time 4/4
    \\tempo 4 = 100
    c4 d e f | g2 g |
    a4 a a a | g1 |
    f4 f f f | e2 e |
    d4 d d d | c1 \\bar "|."
  }
  \\layout { }
}
`;
