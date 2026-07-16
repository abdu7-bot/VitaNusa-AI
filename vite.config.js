import { defineConfig } from 'vite';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const PWA_STATIC_FILES = [
  'manifest.webmanifest',
  'images/icon-192.png',
  'images/icon-512.png',
  'assets/css/android-pwa.css',
  'assets/css/nusa-agent.css',
];

function copyPwaStaticFiles() {
  let buildShellAssets = [];

  return {
    name: 'copy-vitanusa-pwa-static-files',
    apply: 'build',
    generateBundle(_options, bundle) {
      buildShellAssets = Object.values(bundle)
        .filter((output) => {
          if (!/\.(?:js|css)$/i.test(output.fileName)) return false;
          if (/admin/i.test(output.fileName)) return false;
          if (
            output.type === 'chunk'
            && /[/\\]admin[/\\]/i.test(output.facadeModuleId || '')
            && !/[/\\]admin[/\\]firebase-config\.js$/i.test(output.facadeModuleId || '')
          ) return false;
          return true;
        })
        .map((output) => output.fileName)
        .sort();
    },
    async closeBundle() {
      await Promise.all(PWA_STATIC_FILES.map(async (file) => {
        const target = resolve(__dirname, 'dist', file);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(resolve(__dirname, file), target);
      }));

      const workerSource = await readFile(resolve(__dirname, 'service-worker.js'), 'utf8');
      const builtWorker = workerSource.replace(
        'const BUILD_ASSETS = [];',
        `const BUILD_ASSETS = ${JSON.stringify(buildShellAssets, null, 2)};`,
      );
      await writeFile(resolve(__dirname, 'dist/service-worker.js'), builtWorker, 'utf8');
    },
  };
}

export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [copyPwaStaticFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vitacheck: resolve(__dirname, 'vitacheck.html'),
        account: resolve(__dirname, 'account.html'),
        settings: resolve(__dirname, 'settings.html'),
        shareTarget: resolve(__dirname, 'share-target.html'),
        offline: resolve(__dirname, 'offline.html'),
        notFound: resolve(__dirname, '404.html'),
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
      '/admin/feedback': {
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
