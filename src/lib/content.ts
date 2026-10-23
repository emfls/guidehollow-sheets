import { getCollection, type CollectionEntry } from 'astro:content';
export type Article=CollectionEntry<'articles'>;
export const articleUrl=(post:Article)=>`/${post.data.category}/${post.data.slug}/`;
export async function publishedArticles(){const posts=await getCollection('articles');const slugs=new Set<string>();for(const post of posts){if(slugs.has(post.data.slug))throw new Error(`Duplicate article slug: ${post.data.slug}`);slugs.add(post.data.slug);if(post.data.updatedDate<post.data.publishedDate)throw new Error(`Revision precedes preparation: ${post.data.slug}`);}const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());return posts.filter(p=>!p.data.draft&&p.data.publishedDate.toISOString().slice(0,10)<=today).sort((a,b)=>b.data.publishedDate.getTime()-a.data.publishedDate.getTime()||a.data.title.localeCompare(b.data.title));}
export const dateLabel=(date:Date)=>new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'Asia/Seoul'}).format(date);
export const readingMinutes=(body='')=>Math.max(1,Math.ceil(body.split(/\s+/).length/210));
