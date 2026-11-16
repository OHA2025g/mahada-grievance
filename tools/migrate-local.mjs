import {readFile,readdir,writeFile,mkdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const root=process.cwd(),config=join(root,'dist/server/wrangler.json');
try{await access(config);}catch{throw new Error('Run pnpm run build first to generate the local Worker binding configuration.');}
await mkdir(join(root,'.sites-runtime'),{recursive:true});const receipt=join(root,'.sites-runtime/local-migrations.json');
let applied=[];try{applied=JSON.parse(await readFile(receipt,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const name of (await readdir(join(root,'drizzle'))).filter(x=>x.endsWith('.sql')).sort()){
 if(applied.includes(name))continue;
 const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file','drizzle/'+name],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);applied.push(name);await writeFile(receipt,JSON.stringify(applied,null,2)+'\n');
}
console.log('Local schema is ready. Original data is imported by the owner on first sign-in.');
