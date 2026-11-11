import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env': {}
    },
    plugins: [
      react(), 
      tailwindcss()
    ],
    build: {
      target: 'esnext',
      cssCodeSplit: false,
      chunkSizeWarningLimit: 5000,
      sourcemap: false,
      reportCompressedSize: false,
      minify: false,
      cssMinify: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
              return 'vendor-charts';
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'motion',
        'motion/react',
        'firebase',
        'firebase/app',
        'firebase/firestore',
        'firebase/auth',
        'firebase/messaging',
        'firebase/storage',
        '@firebase/app',
        '@firebase/component',
        '@firebase/firestore',
        '@firebase/auth',
        '@firebase/util',
      ],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'react-router-dom',
        'motion',
        'motion/react',
        'lucide-react',
        'recharts',
        'sonner',
        'firebase/app',
        'firebase/firestore',
        'firebase/auth',
        'firebase/storage'
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
    },
  };
});
