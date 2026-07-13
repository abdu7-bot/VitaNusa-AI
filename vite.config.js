import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vitacheck: resolve(__dirname, 'vitacheck.html'),
        faq: resolve(__dirname, 'faq.html'),
        contact: resolve(__dirname, 'contact.html'),
        prinsipAmanah: resolve(__dirname, 'prinsip-amanah.html'),
        articles: resolve(__dirname, 'articles/index.html'),
        products: resolve(__dirname, 'products/index.html'),
        documents: resolve(__dirname, 'documents/index.html'),
        komik: resolve(__dirname, 'komik/index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/ask': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/feedback': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false
  }
});
