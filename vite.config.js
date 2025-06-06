import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.join(__dirname, 'www'),
  resolve: {
    alias: {
      'img': path.resolve(__dirname, 'www/img'),
    },
  },
})