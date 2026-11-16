import { SOURCE_STATUSES,type SourceRow } from './types';
export function csv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Unterminated CSV quoted field.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
const xmlText=(s:string)=>s.replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
function textParts(s:string){return [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlText(m[1])).join('');}
export async function workbook(bytes:Uint8Array,name:string):Promise<{headers:string[];rows:Record<string,string>[]}>{
 let values:string[][];
 if(name.toLowerCase().endsWith('.csv'))values=csv(new TextDecoder().decode(bytes).replace(/^\uFEFF/,''));
 else {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65558);p--)if(view.getUint32(p,true)===0x06054b50){end=p;break;}
  if(end<0)throw new Error('The workbook is not a valid ZIP/XLSX file.');
  const entries=view.getUint16(end+10,true);if(entries>1000)throw new Error('Workbook has too many archive entries.');let pos=view.getUint32(end+16,true);const docs:Record<string,string>={};let expanded=0;
  for(let i=0;i<entries;i++){
   if(pos+46>bytes.length||view.getUint32(pos,true)!==0x02014b50)throw new Error('Corrupt workbook directory.');
   const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),uncompressed=view.getUint32(pos+24,true),nl=view.getUint16(pos+28,true),el=view.getUint16(pos+30,true),cl=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
   const entry=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nl));pos+=46+nl+el+cl;
   if(!['xl/sharedStrings.xml','xl/worksheets/sheet1.xml','xl/workbook.xml'].includes(entry))continue;
   expanded+=uncompressed;if(expanded>32*1024*1024||uncompressed>20*1024*1024)throw new Error('Workbook exceeds the safe expanded-size limit.');
   if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw new Error('Corrupt workbook entry.');
   const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);let data=bytes.slice(start,start+compressed);
   if(start+compressed>bytes.length)throw new Error('Truncated workbook entry.');
   if(method===8){const reader=new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks:Uint8Array[]=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>uncompressed||size>20*1024*1024){await reader.cancel();throw new Error('Workbook decompression exceeded its declared size.');}chunks.push(part.value);}data=new Uint8Array(size);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}}else if(method!==0)throw new Error('Unsupported workbook compression.');
   if(data.length!==uncompressed)throw new Error('Workbook entry size does not reconcile.');docs[entry]=new TextDecoder().decode(data);
   if(/<!DOCTYPE|<!ENTITY/i.test(docs[entry]))throw new Error('External XML entities are not permitted.');
  }
  if(!docs['xl/worksheets/sheet1.xml'])throw new Error('No first worksheet was found.');
  const strings=[...(docs['xl/sharedStrings.xml']||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>textParts(m[1]));
  values=[];
  for(const r of docs['xl/worksheets/sheet1.xml'].matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)){
   const row:string[]=[];
   for(const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
    const ref=c[1].match(/\br="([A-Z]+)\d+"/)?.[1]||'A';let col=0;for(const letter of ref)col=col*26+letter.charCodeAt(0)-64;col--;
    if(col>50)throw new Error('Workbook has too many columns.');const body=c[2]||'';const v=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]||'';
    row[col]=/\bt="s"/.test(c[1])?strings[Number(v)]||'':/\bt="inlineStr"/.test(c[1])?textParts(body):xmlText(v);
   }
   if(row.some(Boolean))values.push(row);
  }
 }
 if(values.length<2)throw new Error('The file contains no data rows.');if(values.length>5001)throw new Error('Import a maximum of 5,000 records per batch.');
 const headers=values[0].map(x=>String(x||'').trim());if(new Set(headers).size!==headers.length)throw new Error('Duplicate column names must be resolved before import.');
 return {headers,rows:values.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'')])))};
}
export function sourceDate(s:string):string|null{
 if(!s?.trim())return null;const v=s.trim();let date='';
 if(/^\d{4}-\d{2}-\d{2}/.test(v))date=v.slice(0,10);
 else if(/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(v)){const [d,m,y]=v.split(/[/-]/);date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}
 else if(/^\d+(\.\d+)?$/.test(v)&&Number(v)>20000&&Number(v)<80000)date=new Date(Date.UTC(1899,11,30)+Math.floor(Number(v))*86400000).toISOString().slice(0,10);
 if(!date||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Invalid source date.');return date;
}
export function officeFamily(o:string){
 const s=o.toLowerCase();if(s.includes('vice president')||s.includes('vp')||s.includes('उपाध्यक्ष'))return 'MHADA VP/CEO office family';
 if(s.includes('mumbai housing'))return 'Mumbai Board';if(s.includes('konkan'))return 'Konkan Board';if(s.includes('pune'))return 'Pune Board';if(s.includes('repairs')||s.includes('mbrrb'))return 'Repairs / Reconstruction Board';return 'Other office families';
}
export function normalise(rows:Record<string,string>[],portal:string,mapping:Record<string,string>={}){
 const defaults={token:'तक्रार टोकन',office:'कार्यालयाचे नाव',preview:'तपशील',citizen:'नागरिकांचे नाव',mobile:'Citizen Mobile',nog:'NOG',received:'दाखल केले',updated:'Status Updated On',age:'प्रलंबित',status:'स्थिती'};const map={...defaults,...mapping};const seen=new Set<string>();const valid:SourceRow[]=[];const errors:{row:number;token:string;reason:string}[]=[];
 rows.forEach((raw,i)=>{const get=(k:keyof typeof defaults)=>String(raw[map[k]]??'').trim();const token=get('token');try{
  if(!token)throw new Error('Source token is missing.');if(token.length>160)throw new Error('Source token is too long.');if(seen.has(token))throw new Error('Duplicate token in this batch.');seen.add(token);
  const status=get('status');if(!SOURCE_STATUSES.includes(status))throw new Error('Unrecognised source status.');const received=sourceDate(get('received'));if(!received)throw new Error('Original receipt date is missing.');const age=get('age')?Number(get('age')):null;if(age!==null&&(!Number.isFinite(age)||age<0))throw new Error('Invalid source age.');
  const office=get('office');valid.push({portal,token,office,board:officeFamily(office),citizen:get('citizen')||null,mobile:get('mobile')||null,preview:get('preview'),nog:get('nog')||null,received,updated:sourceDate(get('updated')),age,status,row:i+2,raw});
 }catch(e){errors.push({row:i+2,token,reason:e instanceof Error?e.message:'Invalid record'});}});return {valid,errors,mapping:map};
}
export function safeCsv(headers:string[],rows:unknown[][]){return '\uFEFF'+[headers,...rows].map(r=>r.map(x=>{let s=String(x??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
