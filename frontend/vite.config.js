import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Tell Babel/React plugin to compile JSX in normal .js files
      include: /\.(js|jsx)$/,
    }),
  ],
  esbuild: {
    // Tell esbuild to parse JSX in .js files
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
