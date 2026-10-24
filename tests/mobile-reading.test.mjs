import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../src/pages/[category]/[slug].astro', import.meta.url), 'utf8');
const script = readFileSync(new URL('../src/scripts/site.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test('mobile readers see the article before a long expanded contents list', () => {
  assert.match(page, /<details><summary>/);
  assert.doesNotMatch(page, /<details open><summary>/);
  assert.match(script, /querySelector<HTMLDetailsElement>\('\.toc details'\)/);
  assert.match(script, /matchMedia\('\(min-width: 761px\)'\)/);
  assert.match(script, /articleToc\.open = wideScreen\.matches/);
  assert.match(script, /addEventListener\('change', updateTocForWidth\)/);
  assert.match(css, /\.toc summary \{ min-height: 44px;/);
});

test('related reading prioritizes genuinely matching topics', () => {
  assert.match(page, /candidate\.data\.tags\.filter\(tag => post\.data\.tags\.includes\(tag\)\)/);
  assert.match(page, /relatedScore\(b\) - relatedScore\(a\)/);
  assert.match(page, /candidate\.id !== post\.id/);
});
