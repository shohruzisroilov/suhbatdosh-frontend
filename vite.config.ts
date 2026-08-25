import { defineConfig, Plugin } from 'vite';
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

export default defineConfig({
  plugins: [extensionResolverPlugin(), react()],
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
  },
});
