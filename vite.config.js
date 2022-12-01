// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/terrain.ts'),
            name: 'maplibre-gl-gsi-terrain',
            fileName: (format) => `maplibre-gl-gsi-terrain.${format}.js`,
        },
    },
});
