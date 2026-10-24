import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {verifyApprovedVisuals} from '../scripts/verify-approved-visuals.mjs';

test('approved visual stays tied to original SVG and published HTML', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'approved-visual-'));
  const articles = path.join(root, 'articles'), assets = path.join(root, 'public'), output = path.join(root, 'dist');
  try {
    await mkdir(articles);
    await mkdir(path.join(assets, 'visuals'), {recursive:true});
    await mkdir(path.join(output, 'guides', 'sample'), {recursive:true});
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 460"><rect width="1200" height="460"/></svg>';
    const digest = createHash('sha256').update(svg).digest('hex');
    const figure = '<figure class="article-visual" data-asset-sha256="' + digest + '">\n<img src="/visuals/sample-visual.svg" alt="Sample image" width="1200" height="460" loading="lazy">\n<figcaption>Sample caption</figcaption>\n</figure>';
    await writeFile(path.join(articles, 'sample.md'), '---\nslug: "sample"\ncategory: "guides"\n---\n\n' + figure + '\n');
    await writeFile(path.join(assets, 'visuals', 'sample-visual.svg'), svg);
    await writeFile(path.join(output, 'guides', 'sample', 'index.html'), '<html><body>' + figure + '</body></html>');
    const args = {articleDir:articles, assetDir:assets, outputDir:output};
    assert.equal(await verifyApprovedVisuals(args), 1);
    await writeFile(path.join(assets, 'visuals', 'sample-visual.svg'), svg.replace('1200', '1199'));
    await assert.rejects(() => verifyApprovedVisuals(args), /changed after editorial approval/);
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});
