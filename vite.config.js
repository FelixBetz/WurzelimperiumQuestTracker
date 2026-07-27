import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Beim Build (GitHub Pages) liegt die App unter /<repo-name>/.
// Der Workflow setzt VITE_BASE automatisch auf den Repo-Namen.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE || '/WurzelimperiumQuestTracker/' : '/',
  plugins: [svelte()],
}));
