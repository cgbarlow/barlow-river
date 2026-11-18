import { defineConfig } from 'vite';
// Two pages: the River (index.html) and the Atlas (atlas.html).
export default defineConfig({ base: './', build: { target: 'es2022', rollupOptions: { input: { index: 'index.html', atlas: 'atlas.html' } } } });
