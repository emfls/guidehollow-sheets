import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://sheets.guidehollow.com', base: '/', output: 'static', trailingSlash: 'always',
  markdown: { shikiConfig: { theme: 'github-light', langAlias: { excel: 'text' } } },
});
