import {publishedArticles,articleUrl} from '../lib/content';
export async function GET(){
  const posts=await publishedArticles();
  return Response.json([...posts.map(post=>({title:post.data.title,description:post.data.description,url:articleUrl(post),category:post.data.category,text:post.body??''})),
    {title:'CSV Duplicate Checker',description:'Find matching rows locally, select key columns, preview removals, and download a cleaned CSV.',url:'/tools/csv-duplicate-checker/',category:'Free tool',text:'CSV duplicate rows quotes commas UTF-8 BOM keep first'},
    {title:'Spreadsheet Formula Finder',description:'Find curated Excel and Google Sheets formulas by function, task and app.',url:'/tools/formula-finder/',category:'Free tool',text:'SUMIFS COUNTIFS XLOOKUP FILTER UNIQUE TRIM IFERROR TEXTJOIN'},
  ]);
}
