export const sampleScore = `\\version "2.26.0"

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
