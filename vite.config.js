import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Har build par unique ID — isse service worker auto-update ho jata hai
const BUILD_ID = Date.now().toString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SW_VERSION__: JSON.stringify(BUILD_ID)
  },
  base: './', // Relative base path for flexible deployment under subfolders
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
