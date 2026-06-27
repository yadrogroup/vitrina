// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    optimizeDeps: {
      exclude: ['@huggingface/transformers', 'onnxruntime-web'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api/photo-search': 'http://127.0.0.1:8788',
      },
    },
  },
});
