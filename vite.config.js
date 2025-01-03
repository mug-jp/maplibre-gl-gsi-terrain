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
	test: {
		browser: {
			provider: 'playwright', // or 'webdriverio'
			enabled: true,
			name: 'chromium', // browser name is required
			headless: true,
		},
	},
});
