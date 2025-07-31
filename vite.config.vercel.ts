import { defineConfig } from 'vite';

export default defineConfig({
  root: './example',
  base: '/',
  server: {
    fs: {
      allow: ['..']
    }
  },
  build: {
    outDir: '../demo',
    // esbuildを使用してminify
    minify: 'esbuild',
    sourcemap: false,
    // 静的アセットの処理
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        index: 'example/index.html',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  // Vercel用の環境変数設定
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}); 