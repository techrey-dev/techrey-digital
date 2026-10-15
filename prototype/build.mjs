import {mkdir,copyFile,cp,readFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const f of ['index.html','style.css','upgrade.css','app.js','admin.js']) await copyFile(f,`dist/${f}`);
await cp('assets','dist/assets',{recursive:true});
const html=await readFile('dist/index.html','utf8');
if(!html.includes('Techrey Digital')||!html.includes('order-form')) throw Error('Missing design content');
console.log('Design build complete.');
