import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const articles=defineCollection({loader:glob({pattern:'**/*.md',base:'./src/content/articles'}),schema:z.object({
  title:z.string().min(12),description:z.string().min(35),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category:z.enum(['formulas','data-cleaning','troubleshooting','templates','comparisons']),
  tags:z.array(z.string()).default([]),publishedDate:z.coerce.date(),updatedDate:z.coerce.date(),
  sources:z.array(z.object({title:z.string(),url:z.url()})).min(1),
  verification:z.string().min(15),author:z.string().default('GuideHollow Sheets Editorial'),
  draft:z.boolean().default(false),featured:z.boolean().default(false),notionPageId:z.string().optional(),
})});
export const collections={articles};
