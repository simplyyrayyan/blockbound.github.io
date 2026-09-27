import { defineConfig } from 'vite';

// Preview sandboxes proxy the dev server through a generated *.e2b.app host.
// Vite refuses unknown Host headers unless they are allowlisted.
const allowedHosts = ['.e2b.app', 'localhost', '127.0.0.1'];

export default defineConfig({
  // Relative asset URLs work both locally and under a GitHub Pages repository path.
  base: './',
  server: { allowedHosts },
  preview: { allowedHosts },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
