import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function extensionResolverPlugin(): Plugin {
  return {
    name: 'extension-resolver',
    resolveId(source, importer) {
      if (importer && (source.startsWith('./') || source.startsWith('../'))) {
        const dir = path.dirname(importer);
        const cleanSource = source.replace(/\.(js|jsx)$/, '');
        const candidates = [
          path.resolve(dir, source),
          path.resolve(dir, cleanSource + '.ts'),
          path.resolve(dir, cleanSource + '.tsx'),
          path.resolve(dir, cleanSource + '.js'),
          path.resolve(dir, cleanSource + '.jsx'),
          path.resolve(dir, cleanSource + '/index.ts'),
          path.resolve(dir, cleanSource + '/index.tsx'),
          path.resolve(dir, cleanSource + '/index.js'),
          path.resolve(dir, cleanSource + '/index.jsx'),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
          }
        }
      }
      return null;
    },
  };
}


/**
 * Fails the build when a production bundle has no backend URL.
 *
 * Without this the app fell back to a hardcoded host at runtime, so a build with a
 * missing VITE_API_URL shipped and silently talked to the wrong backend. Catching it
 * here means the mistake never reaches a deploy.
 */
function requireApiUrl(): Plugin {
  return {
    name: 'require-api-url',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return;
      const url = process.env.VITE_API_URL ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL;
      if (!url || !url.trim()) {
        throw new Error(
          'VITE_API_URL is required for a production build. ' +
            'Set it in .env or in the deployment environment.'
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [requireApiUrl(), extensionResolverPlugin(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'zustand', '@tanstack/react-query'],
          // LiveKit is ~450kB of the Chat route. Splitting it out means the call SDK
          // is cached independently of our own Chat code, so a change to one does
          // not force a re-download of the other.
          'vendor-livekit': ['@livekit/components-react', 'livekit-client'],
          // The IELTS/CEFR speaking topic bank is ~50kB of static data used only by
          // SpeakingQuestions.
          'data-speaking-topics': ['./src/constants/speakingTopics.ts'],
        },
      },
    },
  },
});
