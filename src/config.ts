export const site = {
  id: 'gh-sheets', name: 'GuideHollow Sheets', url: 'https://sheets.guidehollow.com',
  description: 'Practical Excel & Google Sheets Guides, Examples and Free Tools',
  repository: 'https://github.com/emfls/guidehollow-sheets',
  contactEmail: 'emfls24777@daum.net', language: 'en-US', timezone: 'Asia/Seoul',
  registryPageId: '402db4c0-a991-813e-9641-dcac9b1e46f5',
  launchedOn: '', // Record the actual first verified HTTPS release date; never backdate a DNS-blocked launch.
};
export const categories = [
  {slug:'formulas',name:'Formulas',icon:'ƒx',description:'Find the right function. Understand every argument.',color:'teal'},
  {slug:'data-cleaning',name:'Data Cleaning',icon:'≋',description:'Keep the data you need. Fix the data you do not.',color:'blue'},
  {slug:'troubleshooting',name:'Troubleshooting',icon:'!∑',description:'Trace an error back to its cause.',color:'orange'},
  {slug:'templates',name:'Templates',icon:'▦',description:'Small, transparent starting points you can inspect.',color:'green'},
  {slug:'comparisons',name:'Comparisons',icon:'⇄',description:'Know what changes when you switch apps.',color:'purple'},
] as const;
