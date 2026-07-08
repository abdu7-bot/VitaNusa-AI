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
    port: 5173,
    strictPort: false
  },
  preview: {
    port: 4173,
    strictPort: false
  }
});
