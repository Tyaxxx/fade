import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from GitHub Pages at https://tyaxxx.github.io/fade/,
// so assets need the /fade/ prefix (also for `vite preview`). The dev server stays at /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/fade/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
}));
