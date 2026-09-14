import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs work both locally and under a GitHub Pages repository path.
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
