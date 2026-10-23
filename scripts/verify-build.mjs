import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const origin='https://sheets.guidehollow.com';
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&#x27;',"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const strip=s=>decode(s.replace(/<[^>]*>/g,'')).trim();
async function files(dir){return(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const output=await files('dist');const htmlFiles=output.filter(f=>f.endsWith('.html'));const titles=new Set();const descriptions=new Set();const indexed=[];let references=0;let articles=0;
assert.equal((await fs.readFile('dist/CNAME','utf8')).trim(),'sheets.guidehollow.com');
const robots=await fs.readFile('dist/robots.txt','utf8');assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`));assert(!robots.includes('Disallow: /'));
for(const file of htmlFiles){
  const html=await fs.readFile(file,'utf8');const route='/'+file.replace(/^dist\//,'').replace(/index\.html$/,'');
  const title=html.match(/<title>([\s\S]*?)<\/title>/)?.[1];assert(title&&!titles.has(title),`Unique title: ${file}`);titles.add(title);
  const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];assert(description&&!descriptions.has(description),`Unique description: ${file}`);descriptions.add(description);
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];assert.equal(canonical,origin+route,`Self canonical: ${file}`);
  assert.equal(html.match(/<h1\b/g)?.length,1,`One h1: ${file}`);assert.equal(html.match(/<main\b/g)?.length,1,`One main landmark: ${file}`);
  assert(html.includes('<html lang="en-US"'));assert(html.includes('name="viewport"'));assert(html.includes(`${origin}/social.png`));
  assert(!/google-adsense-account|googlesyndication|googletagmanager|google-analytics|ca-pub-/.test(html),`No copied ad or tracking configuration: ${file}`);
  for(const img of html.matchAll(/<img\b[^>]*>/g))assert(/\balt=/.test(img[0])&&/\bwidth=/.test(img[0])&&/\bheight=/.test(img[0]),`Image alt and dimensions: ${file}`);
  const noindex=html.includes('content="noindex, follow"');if(!noindex)indexed.push(origin+route);
  for(const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
    const graph=JSON.parse(script[1]);assert(!JSON.stringify(graph).includes('https://guidehollow.com'),`Schema uses new domain: ${file}`);
    const article=graph['@graph'].find(node=>node['@type']==='BlogPosting');if(article){articles++;assert.equal(strip(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]??''),article.headline);assert.equal(article.mainEntityOfPage,canonical);assert(article.author.name==='GuideHollow Sheets Editorial');}
  }
  for(const reference of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const value=decode(reference[1]);if(/^(mailto:|tel:|data:)/.test(value))continue;const url=new URL(value,canonical);if(url.origin!==origin)continue;
    const local=path.join('dist',decodeURIComponent(url.pathname));let target=local;
    try{const st=await fs.stat(target);if(st.isDirectory())target=path.join(target,'index.html');await fs.access(target);}catch{assert.fail(`Broken internal link ${value} from ${file}`);}
    if(url.hash&&target.endsWith('.html')){const targetHtml=await fs.readFile(target,'utf8');assert(targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`Missing anchor ${value} from ${file}`);}references++;
  }
}
assert(articles>=6,`At least six public launch guides; found ${articles}`);
const sitemap=await fs.readFile('dist/sitemap.xml','utf8');const locations=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.deepEqual(locations.sort(),indexed.sort(),'Sitemap equals indexable pages');assert.equal(new Set(locations).size,locations.length);
const search=JSON.parse(await fs.readFile('dist/search-index.json','utf8'));assert.equal(search.length,articles+2);for(const entry of search)assert(entry.url.startsWith('/')&&!entry.url.startsWith('//'));
const feed=await fs.readFile('dist/rss.xml','utf8');assert.equal(feed.match(/<item>/g)?.length,articles);assert(!feed.includes('https://guidehollow.com/'));
const slugs=new Set();for(const file of await files('src/content/articles')){if(!file.endsWith('.md'))continue;const body=await fs.readFile(file,'utf8');const slug=body.match(/^slug: ["']?([^"'\n]+)["']?$/m)?.[1];assert(slug&&!slugs.has(slug),`Unique source slug ${file}`);slugs.add(slug);assert(body.includes('verification:'));assert(body.match(/^## /gm)?.length>=3,`Substantive sections ${file}`);}
console.log(`Verified ${htmlFiles.length} HTML pages, ${articles} guides, ${references} internal links/assets, unique metadata, canonical/sitemap/robots/RSS/search, accessibility landmarks and zero ad trackers.`);
