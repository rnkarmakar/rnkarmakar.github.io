# LilyPond Live

A browser based LilyPond editor with automatic engraving and playback preparation. The site compiles LilyPond to SVG and MIDI together in the browser. Press **Play** whenever you want to hear the most recently compiled score; it does not render an MP3.

## Use

Open the [LilyPond Live site](https://rnkarmakar.github.io/lilypond-live/). Type or paste LilyPond source in the left pane. The score and MIDI update after a short pause. Use **Open .ly** and **Save .ly** to work with ordinary LilyPond files.

The first compile loads and initializes the included LilyPond WebAssembly engine. Later compiles run in the browser. The MIDI is ready when a successful score compile finishes; browsers require a user click on **Play** to start audio. Playback uses a simple synthesized tone.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run start
```

## Deployment

The source lives in the parent site repository under `_lilypond-live-src/`. The built static site lives in `lilypond-live/` and is served at https://rnkarmakar.github.io/lilypond-live/. The app is intentionally not linked from the personal site navigation.

## Third party licenses

The embedded LilyPond engine and engraving assets are distributed under their upstream licenses. Their notices are included in [`licenses/lilypond-wasm/`](licenses/lilypond-wasm/). The app also uses Tone.js and `@tonejs/midi`.
