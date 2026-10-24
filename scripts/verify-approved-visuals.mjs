import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

/** Build-time integrity proof for SVGs embedded by the Notion image converter. */
export async function verifyApprovedVisuals({articleDir='src/content/articles', assetDir='public', outputDir='dist'}={}) {
  let verified = 0;
  for (const filename of await readdir(articleDir)) {
    if (!filename.endsWith('.md')) continue;
    const markdown = await readFile(path.join(articleDir, filename), 'utf8');
    const marker = 'data-asset-sha256=';
    if (!markdown.includes(marker)) continue;
    const expression = /<figure class="article-visual" data-asset-sha256="([a-f0-9]{64})">\s*<img src="(\/visuals\/[a-z0-9]+(?:-[a-z0-9]+)*\.svg)"/g;
    const references = [...markdown.matchAll(expression)];
    const total = markdown.split(marker).length - 1;
    assert.equal(references.length, total, filename + ': visual asset metadata is malformed');
    assert(references.length <= 4, filename + ': too many approved article figures');
    const slug = markdown.match(/^slug: "([a-z0-9-]+)"$/m)?.[1];
    const category = markdown.match(/^category: "([a-z0-9-]+)"$/m)?.[1];
    assert(slug && category, filename + ': missing category or slug');
    const html = await readFile(path.join(outputDir, category, slug, 'index.html'), 'utf8');
    for (const [, pinnedSha, url] of references) {
      const bytes = await readFile(path.join(assetDir, url.substring(1)));
      const actualSha = createHash('sha256').update(bytes).digest('hex');
      assert.equal(actualSha, pinnedSha, filename + ': visual asset changed after editorial approval: ' + url);
      assert(html.includes('data-asset-sha256="' + pinnedSha + '"'), filename + ': approved figure is missing in the published HTML');
      assert(html.includes('src="' + url + '"'), filename + ': approved image URL is missing in the published HTML');
      assert(html.includes('<figcaption>'), filename + ': approved figure needs a visible caption');
      verified++;
    }
  }
  return verified;
}
