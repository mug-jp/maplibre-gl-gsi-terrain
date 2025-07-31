import { defineConfig } from 'vite';

export default defineConfig({
	root: './example',
	base: './',
	server: {
		fs: {
			allow: ['..']
		}
	},
	build: {
		outDir: '../demo',
		rollupOptions: {
			input: {
				index: 'example/index.html',
			},
		},
	},
});
