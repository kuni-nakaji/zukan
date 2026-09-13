import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@designcodeio/threeui/style.css': path.resolve(__dirname, 'src/shaders/threeui.css'),
      '@designcodeio/threeui': path.resolve(__dirname, 'src/shaders/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'threeui.html'),
      },
    },
  },
  server: {
    port: 3000,
  },
});
