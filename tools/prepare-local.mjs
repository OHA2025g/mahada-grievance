import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes,createCipheriv,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=process.cwd(),dryRun=process.argv.includes('--dry-run'),force=process.argv.includes('--force');
const ownerArg=process.argv.find(x=>x.startsWith('--owner-email='));
const owner=ownerArg?ownerArg.slice('--owner-email='.length):'seedy@sites.test';
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner))throw new Error('Supply a valid owner email.');
if(!dryRun&&!force){try{await access(join(root,'.dev.vars'));throw new Error('Local configuration exists. Use --force only when intentionally regenerating this local seed and its key.');}catch(error){if(error.code!=='ENOENT')throw error;}}
const esbuild=await import(pathToFileURL(join(root,'node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js')).href);
await mkdir(join(root,'.data-tools'),{recursive:true});
const bundle=join(root,'.data-tools/source-files.mjs');
await esbuild.build({entryPoints:[join(root,'lib/files.ts')],outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {workbook,normalise}=await import(pathToFileURL(bundle).href);
const records=[],files=[];
for(const [source,name] of [['PG Portal','PgPortalReportGrievance.xlsx'],['Aaple Sarkar','ReportGrievance Aaple sarkar.xlsx']]){
 const bytes=await readFile(join(root,'data/original',name));
 const book=await workbook(new Uint8Array(bytes),name),parsed=normalise(book.rows,source);
 if(parsed.errors.length)throw new Error(name+': '+parsed.errors.length+' validation exceptions.');
 records.push(...parsed.valid);files.push({name,source,bytes:bytes.toString('base64'),checksum:createHash('sha256').update(bytes).digest('hex'),rows:book.rows.length});
}
if(records.length!==1935||new Set(records.map(r=>r.portal+'|'+r.token)).size!==1935)throw new Error('The supplied baseline does not reconcile to 1,935 unique source tickets.');
if(dryRun){console.log(JSON.stringify({valid:true,records:records.length,source_files:files.length,writes:'No seed or secret written'}));process.exit(0);}
const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
const payload=gzipSync(JSON.stringify({records,files,cutoff:'2026-10-14'}));
const ciphertext=Buffer.concat([cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
await writeFile(join(root,'lib/source-seed.enc.json'),JSON.stringify({iv:iv.toString('base64'),ciphertext:ciphertext.toString('base64'),compressed:'gzip',count:records.length}));
const env={OWNER_EMAIL:owner,SEED_DATA_KEY:key.toString('base64'),INITIALIZATION_TOKEN:randomBytes(36).toString('base64url')};
await writeFile(join(root,'.dev.vars'),Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
console.log(JSON.stringify({prepared:true,records:records.length,source_files:files.length,config:'.dev.vars',note:'Fresh local secrets generated; no live credentials are included or printed.'}));
