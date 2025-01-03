import { defineConfig } from 'vite';

export default defineConfig({
	root: './example',
	base: './',
	build: {
		outDir: '../demo',
		rollupOptions: {
			input: {
				index: 'example/index.html',
			},
		},
	},
});
