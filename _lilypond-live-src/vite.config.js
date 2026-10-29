import { defineConfig } from 'vite';

export default defineConfig({
  base: '/lilypond-live/',
  optimizeDeps: { exclude: ['@sightread/lilypond-wasm'] },
});
