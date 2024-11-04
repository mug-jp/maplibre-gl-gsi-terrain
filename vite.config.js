// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'dist',
		base: './',
		lib: {
			entry: 'src/terrain.ts',
			name: 'terrain',
			fileName: 'terrain',
		},
	},
	base: './',
});
