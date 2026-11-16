import encryptedSeed from './source-seed.enc.json';
import { screens,screenById,fieldsFor,RECORD_TYPES } from './forms';
import { ROLES,TERMINAL,CATEGORIES,BOARDS,parseValues,type Actor,type Role,type ApiEnv,type CaseRow,type RecordRow,type EvidenceRow,type Values,type SeedData,type SourceRow } from './types';
import { workbook,normalise,safeCsv } from './files';
import { exportCases,printReport } from './exports';
import { calculateDue } from './policy';
import { trustedIdentity } from './trusted-identity';
import { dashboardFacts } from './dashboard';

export class AppError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const now=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const uuid=()=>crypto.randomUUID();
const str=(v:unknown)=>String(v??'').trim();
const b64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const stable=(v:unknown):string=>JSON.stringify(v,(_k,val)=>val&&typeof val==='object'&&!Array.isArray(val)?Object.fromEntries(Object.entries(val).sort(([a],[b])=>a.localeCompare(b))):val);
export async function checksum(bytes:string|Uint8Array){const x=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',x as BufferSource))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const statement=(e:ApiEnv,sql:string,...params:unknown[])=>e.DB.prepare(sql).bind(...params.map(v=>v===undefined?null:v));
const one=<T>(e:ApiEnv,sql:string,...params:unknown[])=>statement(e,sql,...params).first<T>();
const all=async<T>(e:ApiEnv,sql:string,...params:unknown[])=>((await statement(e,sql,...params).all<T>()).results||[]);
const run=(e:ApiEnv,sql:string,...params:unknown[])=>statement(e,sql,...params).run();
export const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function requireRole(a:Actor,roles:Role[]){if(!roles.includes(a.role))throw new AppError('Your current workspace cannot perform this action.',403);}
function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new AppError('Cross-origin changes are not allowed.',403);}
async function body(req:Request):Promise<any>{if(Number(req.headers.get('content-length')||0)>2*1024*1024)throw new AppError('Request is too large.',413);try{return await req.json()}catch{throw new AppError('Request must contain valid JSON.');}}
async function audit(e:ApiEnv,a:Actor,kind:string,message:string,caseId:string|null=null,payload:unknown={}){await run(e,'INSERT INTO events (case_id,kind,actor_id,actor_role,message,payload,created_at) VALUES (?,?,?,?,?,?,?)',caseId,kind,a.id,a.role,message,stable(payload),now());}
async function notify(e:ApiEnv,userId:string|null,caseId:string|null,title:string,message:string,kind='Case update'){if(!userId)return;await run(e,'INSERT INTO notifications(id,user_id,case_id,kind,title,message,channel,delivery,created_at) VALUES(?,?,?,?,?,?,?,?,?)',uuid(),userId,caseId,kind,title,message,'In-app','Available in app',now());}
export async function actorFor(req:Request,e:ApiEnv,ignoreRole=false):Promise<Actor>{
 const identity=await trustedIdentity(req.headers,e.OWNER_EMAIL);if(!identity)throw new AppError('Sign in to access this workspace.',401);const authId=identity.id,email=identity.email;
 const encoded=req.headers.get('oai-authenticated-user-full-name');let name=email;
 if(encoded){try{name=req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'?decodeURIComponent(encoded):encoded;}catch{name=email;}}
 let m=await one<any>(e,'SELECT * FROM members WHERE auth_id=? OR (email=? AND (auth_id IS NULL OR (is_owner=1 AND ?=1))) ORDER BY auth_id IS NOT NULL DESC LIMIT 1',authId,email,email===e.OWNER_EMAIL?.toLowerCase().trim()?1:0);
 if(!m){const owner=!!e.OWNER_EMAIL&&email===e.OWNER_EMAIL.toLowerCase().trim();const id=authId;
  await run(e,'INSERT OR IGNORE INTO members(id,auth_id,email,name,roles,boards,active,is_owner,created_at) VALUES(?,?,?,?,?,?,?,?,?)',id,authId,email,name,JSON.stringify(owner?ROLES:['Citizen']),JSON.stringify(owner?['All']:[]),1,owner?1:0,now());m=await one<any>(e,'SELECT * FROM members WHERE auth_id=?',authId);
 }
 if(!m||!m.active)throw new AppError('Your application access is disabled.',403);
 if(!m.auth_id){await run(e,'UPDATE members SET auth_id=?,name=? WHERE id=? AND auth_id IS NULL',authId,name,m.id);m.auth_id=authId;}
 if(m.auth_id!==authId){if(m.is_owner&&email===e.OWNER_EMAIL?.toLowerCase().trim()&&(identity.ownerFallback||m.auth_id.startsWith('private-owner:'))){if(!identity.ownerFallback)await run(e,'UPDATE members SET auth_id=? WHERE id=?',authId,m.id);}else throw new AppError('This access record belongs to a different account.',403);}
 const roles:Role[]=JSON.parse(m.roles);const requested=ignoreRole?'':req.headers.get('x-workspace-role')||new URL(req.url).searchParams.get('role')||'';
 const role=(requested||(m.is_owner?'Leadership':roles[0])) as Role;
 if(!roles.includes(role))throw new AppError('This workspace is not assigned to your account.',403);
 const access=await config(e,'access:'+m.id);
 return {id:m.id,email,name:m.name||name,role,roles,boards:JSON.parse(m.boards||'[]'),isOwner:!!m.is_owner,canRestricted:!!m.is_owner||access['Restricted case access']===true};
}
function caseScope(a:Actor):{sql:string;args:unknown[]}{
 const args:unknown[]=[];let sql="c.kind<>'draft'";
 if(a.role==='Citizen'){sql+=" AND c.citizen_id=?";args.push(a.id);}
 else if(a.role==='Developer'){sql+=" AND c.respondent_id=? AND (c.restricted=0 OR COALESCE(json_extract(c.details,'$.respondentNotice'),'')<>'')";args.push(a.id);}
 else {
  if(!a.canRestricted)sql+=' AND c.restricted=0';
  if(a.role==='Officer'&&!a.isOwner){sql+=' AND (c.owner_id=? OR EXISTS (SELECT 1 FROM records tr WHERE tr.case_id=c.id AND tr.assignee_id=?))';args.push(a.id,a.id);}
  if(!a.boards.includes('All')){if(!a.boards.length)return {sql:'0=1',args:[]};sql+=` AND c.board IN (${a.boards.map(()=>'?').join(',')})`;args.push(...a.boards);}
 }
 return {sql,args};
}
export async function permittedCase(e:ApiEnv,a:Actor,id:string){if(['Citizen','Intake'].includes(a.role)){const draft=await one<CaseRow>(e,'SELECT * FROM cases WHERE id=? AND kind=? AND citizen_id=?',id,'draft',a.id);if(draft)return draft;}const scope=caseScope(a);const c=await one<CaseRow>(e,`SELECT c.* FROM cases c WHERE c.id=? AND ${scope.sql}`,id,...scope.args);if(!c)throw new AppError('Case unavailable or outside your permitted scope.',404);return c;}
function visibleCase(a:Actor,c:CaseRow):CaseRow{
 if(a.role==='Leadership'||a.role==='Audit')return {...c,citizen_name:null,mobile:null,narrative:null,preview:null,source_nog:null,title:`${c.category==='Unclassified'?'Historical grievance':c.category} · ${c.reference}`,details:JSON.stringify({confirmation:parseValues(c.details).confirmation||'Unavailable'})};
 if(a.role==='Developer')return {...c,citizen_name:'Complainant',mobile:null,preview:null,narrative:str(parseValues(c.details).respondentNotice)||'Read the served notice and permitted documents.',source_nog:null,details:'{}'};
 if(a.role==='Citizen'){const d=parseValues(c.details);const keys=new Set(['Subject','Submitted by','Affected person','Preferred contact','Service category','When did it happen?','Urgent impact','What happened?','Requested outcome','Original language','Representative relationship','Board','Service / scheme','Application reference','District / city','Colony / building','Plot / CTS reference','Tenement / unit','Incident location','Earlier grievance reference','Declaration','confirmation','satisfaction','remaining','registeredAt','publishedDecisionId','publishedAtrId','challengeOpen']);return {...c,mobile:null,details:JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k])=>keys.has(k))))};}
 return c;
}
export async function readCases(e:ApiEnv,a:Actor,url:URL){
 const scope=caseScope(a);const args=[...scope.args];let where=scope.sql;const q=str(url.searchParams.get('q'));
 if(q){let bounded='';for(const char of q){if(new TextEncoder().encode(bounded+char).length>46)break;bounded+=char;}const text='%'+bounded+'%';const columns=['reference','source_token','category',...(!['Leadership','Audit','Developer'].includes(a.role)?['title']:[])];const searches=columns.map(col=>'c.'+col+' LIKE ?');args.push(...columns.map(()=>text));if(!['Leadership','Audit','Developer'].includes(a.role)){for(const field of ['Colony / building','Application reference','Plot / CTS reference','Tenement / unit']){searches.push('json_extract(c.details,?) LIKE ?');args.push('$."'+field+'"',text);}let visibility=a.role==='Citizen'?' AND (ev.citizen_safe=1 OR ev.uploaded_by=?)':!a.canRestricted?" AND ev.classification<>'Restricted'":'';searches.push('EXISTS(SELECT 1 FROM evidence ev WHERE ev.case_id=c.id AND ev.filename LIKE ?'+visibility+')');args.push(text,...(a.role==='Citizen'?[a.id]:[]));}where+=' AND ('+searches.join(' OR ')+')';}
 for(const [param,col] of [['board','board'],['category','category'],['status','source_status'],['stage','stage'],['owner','owner_id']] as const){const v=str(url.searchParams.get(param));if(v){where+=` AND c.${col}=?`;args.push(v);}}
 const filter=url.searchParams.get('filter');if(filter==='active')where+=" AND c.source_status NOT IN ('Auto Closed','Closed','Resolved') AND c.closed_at IS NULL";
 if(filter==='source-nonterminal')where+=" AND c.source_status NOT IN ('Auto Closed','Closed','Resolved')";
 if(filter==='legacy')where+=" AND c.kind='historical' AND c.source_status IN ('Auto Closed','Closed','Resolved')";
 if(filter==='unassigned')where+=" AND (c.owner_id IS NULL OR c.acceptance<>'Accepted')";
 if(filter==='narrative')where+=' AND c.narrative_complete=0';
 if(filter==='overdue'){where+=' AND c.due_date<? AND c.closed_at IS NULL';args.push(today());}
 const page=Math.max(1,Number(url.searchParams.get('page')||1)||1),limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||25)||25));
 const count=await one<{n:number}>(e,`SELECT COUNT(*) n FROM cases c WHERE ${where}`,...args);
 const rows=await all<CaseRow>(e,`SELECT c.* FROM cases c WHERE ${where} ORDER BY c.received_date DESC,c.reference LIMIT ? OFFSET ?`,...args,limit,(page-1)*limit);
 return {cases:rows.map(c=>visibleCase(a,c)),total:count?.n||0,page,limit};
}
async function config(e:ApiEnv,key:string):Promise<any>{const r=await one<{payload:string;version:number}>(e,'SELECT payload,version FROM configs WHERE key=?',key);return r?{...parseValues(r.payload),_version:r.version}:{};}
async function recordList(e:ApiEnv,id:string,type?:string){return all<RecordRow>(e,'SELECT * FROM records WHERE case_id=?'+(type?' AND type=?':'')+' ORDER BY created_at DESC,rowid DESC',...(type?[id,type]:[id]));}
function citizenRecord(r:RecordRow){return ['decision','review_decision','atr','hearing','review_hearing','clarification','feedback','review','admissibility','communication','handoff'].includes(r.type);}
function respondentRecord(r:RecordRow){return ['hearing','review_hearing','respondent_response','rent_ledger','compliance','hearing_response','reschedule'].includes(r.type);}
export async function readCase(e:ApiEnv,a:Actor,id:string){
 const original=await permittedCase(e,a,id);const allRecords=await recordList(e,id);const details=parseValues(original.details);
 let records=allRecords;
 if(a.role==='Citizen')records=records.filter(r=>citizenRecord(r)&&(!['decision','atr'].includes(r.type)||r.id===details.publishedDecisionId||r.id===details.publishedAtrId));
 if(a.role==='Developer')records=records.filter(r=>respondentRecord(r)&&(['hearing','review_hearing'].includes(r.type)||r.author_id===a.id)).map(r=>r.type==='hearing'?{...r,values:JSON.stringify(Object.fromEntries(Object.entries(parseValues(r.values)).filter(([k])=>['Hearing purpose','Hearing date','Venue / approved mode','Access requirements','Respondent notice summary'].includes(k))))}:r);
 if(a.role==='Leadership'||(a.role==='Audit'&&!a.canRestricted))records=records.map(r=>({...r,values:JSON.stringify({summary:`${r.type} · ${r.status}`,recorded_at:r.created_at})}));
 let ev=await all<EvidenceRow>(e,'SELECT * FROM evidence WHERE case_id=? ORDER BY uploaded_at DESC',id);
 ev=ev.filter(r=>a.role==='Citizen'?(r.citizen_safe===1||r.uploaded_by===a.id):a.role==='Developer'?(r.respondent_safe===1||r.uploaded_by===a.id):r.classification!=='Restricted'||a.canRestricted);
 if(a.role==='Leadership'||(a.role==='Audit'&&!a.canRestricted))ev=ev.map(r=>({...r,filename:'Protected evidence',description:null}));
 const events=await all<any>(e,'SELECT id,kind,actor_id,actor_role,message,created_at FROM events WHERE case_id=? ORDER BY id DESC LIMIT 150',id);
 const safeEvents=['Citizen','Developer'].includes(a.role)?events.filter(x=>['case_submitted','clarification','hearing','communication','feedback','review','review_decision','closure','reschedule'].includes(x.kind)):events;
 const sources=['Admin','Intake','Officer','Supervisor','Review'].includes(a.role)?await all<any>(e,'SELECT s.*,i.filename,i.checksum file_checksum FROM sources s JOIN imports i ON i.id=s.import_id WHERE s.case_id=? ORDER BY s.created_at DESC',id):[];
 const scope=caseScope(a);const links=await all<any>(e,`SELECT l.*,c.reference other_reference,c.category other_category FROM links l JOIN cases c ON c.id=l.other_id WHERE l.case_id=? AND ${scope.sql}`,id,...scope.args);
 return {case:visibleCase(a,original),records,evidence:ev.map(({object_key,...r})=>r),events:safeEvents,sources,links};
}
export async function dashboard(e:ApiEnv,a:Actor){
 const scope=caseScope(a);const grouped=async(col:string)=>all<{label:string;count:number}>(e,`SELECT COALESCE(c.${col},'Unknown') label,COUNT(*) count FROM cases c WHERE ${scope.sql} GROUP BY c.${col} ORDER BY count DESC`,...scope.args);
 const count=(extra='')=>one<any>(e,`SELECT COUNT(*) n FROM cases c WHERE ${scope.sql}${extra}`,...scope.args);
 const [total,statuses,stages,boards,categories,active,legacy,unassigned,incomplete,verified,closed,cohorts]=await Promise.all([count(),grouped('source_status'),grouped('stage'),grouped('board'),grouped('category'),count(" AND c.source_status NOT IN ('Auto Closed','Closed','Resolved')"),count(" AND c.source_status IN ('Auto Closed','Closed','Resolved')"),count(" AND (c.owner_id IS NULL OR c.acceptance<>'Accepted') AND c.source_status NOT IN ('Auto Closed','Closed','Resolved')"),count(' AND c.narrative_complete=0'),count(" AND c.outcome='Implemented and verified'"),count(' AND c.closed_at IS NOT NULL'),all<any>(e,`SELECT substr(c.received_date,1,7) label,COUNT(*) count FROM cases c WHERE ${scope.sql} GROUP BY label ORDER BY label DESC LIMIT 24`,...scope.args)]);
 const facts=await dashboardFacts(e,a,scope);
 const properties=await all<any>(e,`SELECT json_extract(c.details,'$."Colony / building"') label,c.board,COUNT(*) count FROM cases c WHERE ${scope.sql} AND c.restricted=0 AND COALESCE(json_extract(c.details,'$."Colony / building"'),'')<>'' GROUP BY label,c.board ORDER BY count DESC LIMIT 30`,...scope.args);return {total:total.n,statuses,stages,boards,categories,properties,provisional_active:active.n,source_terminal:legacy.n,ownership_gaps:unassigned.n,narrative_pending:incomplete.n,verified_remedies:verified.n,internally_closed:closed.n,cohorts:cohorts.reverse(),...facts,source_cutoff:'2026-10-14',outcome_coverage:'New workflow events; historical remedy evidence is not supplied',refreshed_at:now()};
}
let seedCache:Promise<SeedData>|null=null;
export async function seedData(e:ApiEnv){
 if(e.testSeed)return e.testSeed;if(!e.SEED_DATA_KEY)throw new AppError('Initial source configuration is unavailable.',503);
 if(!seedCache)seedCache=(async()=>{const key=await crypto.subtle.importKey('raw',b64(e.SEED_DATA_KEY!) as BufferSource,{name:'AES-GCM'},false,['decrypt']);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(encryptedSeed.iv) as BufferSource},key,b64(encryptedSeed.ciphertext) as BufferSource);const stream=new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text()) as SeedData;})();return seedCache;
}
const historicalId=async(r:SourceRow)=>'hist-'+(r.portal==='Aaple Sarkar'?'as':'pg')+'-'+(await checksum(r.portal+'|'+r.token)).slice(0,20);
type ImportCache={id:string;hash:string;prior:CaseRow|null;priorSnapshot:boolean};
async function importOneStatements(e:ApiEnv,r:SourceRow,batchId:string,actorId:string,cache?:ImportCache){
 const {raw:rawFields,row:rowNumber,...facts}=r;const id=cache?.id||await historicalId(r),ref='MHD-'+(r.portal==='Aaple Sarkar'?'AS':'PG')+'-'+id.slice(-8).toUpperCase(),raw=stable(rawFields),hash=cache?.hash||await checksum(stable(facts)),n=now();
 const prior=cache?cache.prior:await one<CaseRow>(e,'SELECT * FROM cases WHERE source_portal=? AND source_token=?',r.portal,r.token);
 const priorSnapshot=cache?cache.priorSnapshot:await one<any>(e,'SELECT id FROM sources WHERE portal=? AND token=? AND snapshot_hash=?',r.portal,r.token,hash);
 const stmts:D1PreparedStatement[]=[];
 if(prior&&prior.received_date!==r.received)throw new AppError('Original receipt date conflicts with the existing source record; human reconciliation is required.');
 if(!prior)stmts.push(statement(e,'INSERT OR IGNORE INTO cases(id,reference,kind,citizen_name,mobile,title,preview,narrative_complete,source_portal,source_token,source_status,source_age,source_updated,source_nog,received_date,board,office,stage,outcome,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,ref,'historical',r.citizen,r.mobile,str(r.nog||'Historical grievance').slice(0,180),r.preview,0,r.portal,r.token,r.status,r.age,r.updated,r.nog,r.received,r.board,r.office,TERMINAL.includes(r.status)?'Legacy review':'Triage','Unknown','Unassessed',n,n));
 else if(!priorSnapshot)stmts.push(statement(e,'UPDATE cases SET source_status=?,source_age=?,source_updated=?,source_nog=?,preview=?,updated_at=?,revision=revision+1 WHERE id=?',r.status,r.age,r.updated,r.nog,r.preview,n,prior.id));
 const caseId=prior?.id||id;
 if(!priorSnapshot)stmts.push(statement(e,'INSERT OR IGNORE INTO sources(id,case_id,import_id,portal,token,row_number,raw,snapshot_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)',uuid(),caseId,batchId,r.portal,r.token,r.row,raw,hash,n));
 if(!prior)stmts.push(statement(e,'INSERT INTO events(case_id,kind,actor_id,actor_role,message,payload,created_at) VALUES(?,?,?,?,?,?,?)',caseId,'historical_import',actorId,'Intake','Historical source record imported; live state and remedy remain unverified.',JSON.stringify({batch_id:batchId,row:r.row,portal:r.portal}),n));
 return {stmts,result:!prior?'accepted':priorSnapshot?'unchanged':'updated'};
}
export async function setupStep(e:ApiEnv,by:string){
 const seed=await seedData(e);const n=now();const jobId='initial-source-import';
 await run(e,'INSERT OR IGNORE INTO jobs(id,type,status,total,completed,payload,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',jobId,'Initial source import','Running',seed.records.length,0,'{}',by,n,n);
 let job=await one<any>(e,'SELECT * FROM jobs WHERE id=?',jobId);if(job.status==='Complete')return {ready:true,completed:job.completed,total:job.total};const lease=await acquireJob(e,jobId);if(!lease)return {ready:false,completed:job.completed,total:job.total,busy:true};try{
 for(const f of seed.files){const batch='baseline-'+(f.source==='Aaple Sarkar'?'as':'pg');const object='imports/baseline/'+f.checksum+'/'+f.name;
  if(!await one<any>(e,'SELECT id FROM imports WHERE id=?',batch)){await e.BUCKET.put(object,b64(f.bytes),{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});await run(e,'INSERT OR IGNORE INTO imports(id,source,filename,checksum,object_key,row_count,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)',batch,f.source,f.name,f.checksum,object,f.rows,'Importing',by,n);}
 }
 job=await one<any>(e,'SELECT * FROM jobs WHERE id=?',jobId);const start=job.completed,group=seed.records.slice(start,start+40),statements:D1PreparedStatement[]=[];
 const facts=await Promise.all(group.map(async r=>{const {raw,row,...normalised}=r;return {id:await historicalId(r),hash:await checksum(stable(normalised))};}));
 const existingCases:CaseRow[]=[],existingSnapshots:any[]=[];
 for(let i=0;i<group.length;i+=40){const chunk=group.slice(i,i+40),hashes=facts.slice(i,i+40).map(r=>r.hash);const [casesFound,snapshotsFound]=await Promise.all([all<CaseRow>(e,`SELECT * FROM cases WHERE source_token IN (${chunk.map(()=>'?').join(',')})`,...chunk.map(r=>r.token)),all<any>(e,`SELECT portal,token,snapshot_hash FROM sources WHERE snapshot_hash IN (${hashes.map(()=>'?').join(',')})`,...hashes)]);existingCases.push(...casesFound);existingSnapshots.push(...snapshotsFound);}
 const caseMap=new Map(existingCases.map(c=>[c.source_portal+'|'+c.source_token,c])),snapshotSet=new Set(existingSnapshots.map(r=>r.portal+'|'+r.token+'|'+r.snapshot_hash));
 for(let i=0;i<group.length;i++){const r=group[i],cache={...facts[i],prior:caseMap.get(r.portal+'|'+r.token)||null,priorSnapshot:snapshotSet.has(r.portal+'|'+r.token+'|'+facts[i].hash)};const result=await importOneStatements(e,r,'baseline-'+(r.portal==='Aaple Sarkar'?'as':'pg'),by,cache);statements.push(...result.stmts);}
 if(statements.length)for(let i=0;i<statements.length;i+=90)await e.DB.batch(statements.slice(i,i+90));
 const next=start+group.length;await run(e,'UPDATE jobs SET completed=MAX(completed,?),status=?,updated_at=? WHERE id=?',next,next===seed.records.length?'Complete':'Running',now(),jobId);
 if(next===seed.records.length){for(const f of seed.files)await run(e,'UPDATE imports SET accepted=row_count,status=? WHERE id=?','Complete','baseline-'+(f.source==='Aaple Sarkar'?'as':'pg'));}
 return {ready:next===seed.records.length,completed:next,total:seed.records.length};}finally{await releaseJob(e,jobId,lease);}
}

function validateValues(screen:string,input:unknown,partial=false):Values{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new AppError('Form values are required.');
 const allowed=fieldsFor(screen);const v:Values={};
 for(const f of allowed){const value=(input as Record<string,unknown>)[f.label];
  if(value===undefined){if(!partial&&f.required&&f.kind!=='file')throw new AppError(`Complete ${f.label}.`);continue;}
  if(typeof value!=='string'&&typeof value!=='boolean'&&typeof value!=='number'&&!(Array.isArray(value)&&value.every(x=>typeof x==='string')))throw new AppError(`Invalid ${f.label}.`);
  if(str(value).length>20000)throw new AppError(`${f.label} is too long.`);
  if(!partial&&f.required&&(f.kind==='check'?value!==true:f.kind==='file'?false:!str(value)))throw new AppError(`Complete ${f.label}.`);
 if(str(value)&&f.kind==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(str(value))||!Number.isFinite(Date.parse(str(value)))||new Date(str(value)).toISOString().slice(0,10)!==str(value)))throw new AppError(`${f.label} must be a valid date.`);
  if(str(value)&&f.kind==='number'&&(!Number.isFinite(Number(value))||Number(value)<0))throw new AppError(`${f.label} must be zero or greater.`);
  if(str(value)&&f.kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(value)))throw new AppError(`${f.label} must be a valid email.`);
  if(f.options.length&&f.kind==='select'&&str(value)&&!f.options.includes(str(value)))throw new AppError(`Choose a permitted ${f.label}.`);
  if(f.kind==='multi'&&(!Array.isArray(value)||value.some(x=>!f.options.includes(x))||(!partial&&f.required&&!value.length)))throw new AppError(`Choose a permitted ${f.label}.`);
  v[f.label]=value as Values[string];
 }return v;
}
function need(v:Values,label:string){if(!str(v[label]))throw new AppError(`Complete ${label}.`);return str(v[label]);}
function confirm(v:Values,label:string){if(v[label]!==true)throw new AppError(`Confirm ${label}.`);}
async function activeMember(e:ApiEnv,email:string){const m=await one<any>(e,'SELECT * FROM members WHERE lower(email)=? AND active=1',email.toLowerCase().trim());if(!m)throw new AppError('Choose an account in the active application directory.');return m;}
function latest(rows:RecordRow[],type:string){return rows.find(r=>r.type===type);}
async function evidenceReference(e:ApiEnv,a:Actor,c:CaseRow,reference:unknown,checked=false){const id=str(reference);const row=await one<EvidenceRow>(e,'SELECT * FROM evidence WHERE case_id=? AND (id=? OR filename=?)',c.id,id,id);if(!row)throw new AppError('Select existing evidence from this case.');if(row.classification==='Restricted'&&!a.canRestricted&&row.uploaded_by!==a.id)throw new AppError('This evidence requires restricted access.',403);if(checked&&row.review_state!=='Checked')throw new AppError('The cited evidence must be checked in the document workspace first.');return row;}
async function delegation(e:ApiEnv,a:Actor,scope:string,c?:CaseRow){const d=await config(e,'delegation:'+a.id);if(d['Delegation approved']!==true||!str(d['Delegated authority'])||!str(d['Effective from'])||str(d['Effective from'])>today()||(str(d['Effective until'])&&str(d['Effective until'])<today()))throw new AppError('An approved, effective delegation must be configured for this account in Officers & delegation.',403);const value=Array.isArray(d['Delegation scope'])?d['Delegation scope']:str(d['Delegation scope']).split(',');if(!value.includes(scope))throw new AppError('Your current delegation does not cover this decision.',403);if(c&&str(d['Permitted board'])&&str(d['Permitted board'])!=='All'&&str(d['Permitted board'])!==c.board)throw new AppError('This delegation does not cover the case board.',403);return d;}

type Change={patch?:Record<string,unknown>;recordType?:string;status?:string;parentId?:string;assignee?:string;due?:string;extraRecords?:{type:string;status:string;values:Values;parentId?:string;assignee?:string;due?:string}[];recordUpdates?:{id:string;status:string}[];evidenceChecked?:string;link?:{id:string;relationship:string;reason:string};notifications?:{userId:string;title:string;message:string;kind:string}[];message?:string;target?:string};
async function changeCase(e:ApiEnv,a:Actor,c:CaseRow,screen:string,v:Values,change:Change,key:string,hash:string){
 const mutation=uuid(),time=now(),recordId=uuid();const response={ok:true,case_id:c.id,reference:c.reference,record_id:recordId,target:change.target||screenById[screen]?.primary.target||'O02',message:change.message||'Record saved.'};
 const patch={...(change.patch||{}),updated_at:time};const columns=new Set(['reference','kind','citizen_id','citizen_name','mobile','title','narrative','preview','narrative_complete','source_portal','source_token','source_status','received_date','board','office','category','stage','outcome','priority','restricted','owner_id','owner_name','respondent_id','acceptance','original_due','due_date','closed_at','details','updated_at']);
 if(Object.keys(patch).some(k=>!columns.has(k)))throw new AppError('Invalid workflow change.');
 const names=Object.keys(patch);const stmts:D1PreparedStatement[]=[statement(e,`UPDATE cases SET ${names.map(k=>k+'=?').join(',')},revision=revision+1,mutation_id=? WHERE id=? AND revision=?`,...names.map(k=>(patch as Record<string,unknown>)[k]),mutation,c.id,c.revision)];
 const condition='EXISTS(SELECT 1 FROM cases WHERE id=? AND mutation_id=?)';
 const addRecord=(id:string,type:string,status:string,values:Values,parentId?:string,assignee?:string,due?:string)=>statement(e,`INSERT INTO records(id,case_id,type,screen,status,"values",author_id,actor_role,assignee_id,due_date,parent_id,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${condition}`,id,c.id,type,screen,status,stable(values),a.id,a.role,assignee||null,due||null,parentId||null,time,time,c.id,mutation);
 const type=change.recordType||RECORD_TYPES[screen]||'case_note';stmts.push(addRecord(recordId,type,change.status||'Recorded',v,change.parentId,change.assignee,change.due));
 for(const r of change.extraRecords||[])stmts.push(addRecord(uuid(),r.type,r.status,r.values,r.parentId==='CURRENT_RECORD'?recordId:r.parentId,r.assignee,r.due));
 for(const r of change.recordUpdates||[])stmts.push(statement(e,`UPDATE records SET status=?,version=version+1,updated_at=? WHERE id=? AND case_id=? AND ${condition}`,r.status,time,r.id,c.id,c.id,mutation));
 if(change.evidenceChecked)stmts.push(statement(e,`UPDATE evidence SET review_state='Checked' WHERE id=? AND case_id=? AND ${condition}`,change.evidenceChecked,c.id,c.id,mutation));
 if(change.link)stmts.push(statement(e,`INSERT OR IGNORE INTO links(id,case_id,other_id,relationship,reason,actor_id,created_at) SELECT ?,?,?,?,?,?,? WHERE ${condition}`,uuid(),c.id,change.link.id,change.link.relationship,change.link.reason,a.id,time,c.id,mutation));
 for(const n of change.notifications||[])stmts.push(statement(e,`INSERT INTO notifications(id,user_id,case_id,kind,title,message,channel,delivery,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${condition}`,uuid(),n.userId,c.id,n.kind,n.title,n.message,'In-app','Available in app',time,c.id,mutation));
 const auditPayload={screen,record_id:recordId,before:Object.fromEntries(names.map(k=>[k,(c as any)[k]])),after:patch,record_updates:change.recordUpdates||[],values:v};
 stmts.push(statement(e,`INSERT INTO events(case_id,kind,actor_id,actor_role,message,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE ${condition}`,c.id,type,a.id,a.role,`${screenById[screen]?.title||screen}: ${change.message||'recorded'}`,stable(auditPayload),time,c.id,mutation));
 stmts.push(statement(e,`INSERT OR IGNORE INTO idempotency(key,actor_id,body_hash,response,created_at) SELECT ?,?,?,?,? WHERE ${condition}`,key,a.id,hash,JSON.stringify(response),time,c.id,mutation));
 const result=await e.DB.batch(stmts);if(result[0].meta.changes!==1){const prior=await one<any>(e,'SELECT response,body_hash FROM idempotency WHERE key=? AND actor_id=?',key,a.id);if(prior&&prior.body_hash===hash)return JSON.parse(prior.response);throw new AppError('This case changed while you were working. Refresh the case and review the current state.',409);}
 return response;
}

export async function saveDraft(e:ApiEnv,a:Actor,p:any){
 requireRole(a,['Citizen','Intake']);const screen=str(p.screen);if(!['C03','C04','C05','C06','I12'].includes(screen))throw new AppError('Invalid draft step.');
 const v=validateValues(screen,p.values,p.partial===true);let c:CaseRow|null=null;
 if(p.case_id){c=await one<CaseRow>(e,'SELECT * FROM cases WHERE id=? AND kind=? AND citizen_id=?',p.case_id,'draft',a.id);if(!c)throw new AppError('Draft not found.',404);}
 const id=c?.id||uuid(),time=now();const details={...parseValues(c?.details),...v};
 const patch={citizen_name:str(details['Affected person'])||a.name,title:str(details.Subject)||'Untitled draft',narrative:str(details['What happened?']||details['Citizen narrative']),board:str(details.Board)||'To verify',category:str(details['Service category'])||'Unclassified',details:JSON.stringify(details),updated_at:time};
 if(c)await run(e,'UPDATE cases SET citizen_name=?,title=?,narrative=?,board=?,category=?,details=?,revision=revision+1,updated_at=? WHERE id=? AND kind=? AND citizen_id=?',patch.citizen_name,patch.title,patch.narrative,patch.board,patch.category,patch.details,time,id,'draft',a.id);
 else await run(e,'INSERT INTO cases(id,reference,kind,citizen_id,citizen_name,title,narrative,received_date,board,category,stage,details,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,'DRAFT-'+id.slice(0,8).toUpperCase(),'draft',a.id,patch.citizen_name,patch.title,patch.narrative,today(),patch.board,patch.category,'Draft',patch.details,time,time);
 return {ok:true,case_id:id,draft:await one<CaseRow>(e,'SELECT * FROM cases WHERE id=?',id),message:'Draft saved securely.'};
}
async function submitDraft(e:ApiEnv,a:Actor,p:any,key:string,hash:string){
 requireRole(a,['Citizen','Intake']);const c=await one<CaseRow>(e,'SELECT * FROM cases WHERE id=? AND kind=? AND citizen_id=?',p.case_id,'draft',a.id);if(!c)throw new AppError('Draft not found or already submitted. Refresh My grievances.',409);
 const d=parseValues(c.details);for(const label of ['Subject','Affected person','Requested outcome'])if(!str(d[label]))throw new AppError(`Complete ${label} before submission.`);if(!str(d['What happened?']||d['Citizen narrative']))throw new AppError('Complete the grievance narrative before submission.');
 if(str(d['Submitted by'])==='Representative'&&!str(d['Representative relationship']))throw new AppError('Record the representative relationship and authority.');
 if(str(d['Submitted by']||d.Representation)==='Representative'&&!await one(e,'SELECT id FROM evidence WHERE case_id=? AND description LIKE ? LIMIT 1',c.id,'%Representative authorisation%'))throw new AppError('Supply the representative authorisation before submission.');
 if(d.Declaration!==true&&p.values?.['Citizen confirmation']!==true)throw new AppError('Review the declaration before submission.');
 const reference='MHD-'+today().slice(0,4)+'-'+uuid().slice(0,8).toUpperCase();
 const result=await changeCase(e,a,c,'M01',{'Citizen confirmation':true},{patch:{reference,kind:'new',narrative_complete:1,stage:'Triage',source_status:'Submitted',source_portal:a.role==='Citizen'?'MHADA Citizen Portal':'Assisted intake',source_token:reference,received_date:today(),details:JSON.stringify({...d,registeredAt:now(),confirmation:'Unavailable'})},recordType:'case_submitted',status:'Registered',target:'C07',message:'Your grievance is registered.'},key,hash);
 result.reference=reference;await run(e,'UPDATE idempotency SET response=? WHERE key=? AND actor_id=?',JSON.stringify(result),key,a.id);await notify(e,a.id,c.id,'Grievance registered',reference+' is registered. The intake team will establish jurisdiction and ownership.','Acknowledgement');return result;
}

export async function action(e:ApiEnv,a:Actor,p:any){
 const screen=str(p.screen),s=screenById[screen];if(!s)throw new AppError('Unknown screen action.');
 const dialogRoles:Record<string,Role[]>={M01:['Citizen','Intake'],M02:['Citizen','Officer','Intake','Review','Developer'],M03:['Intake'],M04:['Officer'],M05:['Supervisor'],M06:['Intake'],M07:['Supervisor'],M08:['Citizen','Developer','Officer','Review'],M09:['Citizen'],M11:['Officer'],M12:['Intake','Admin']};if(dialogRoles[screen]&&!dialogRoles[screen].includes(a.role))throw new AppError('This operation is outside your assigned workspace.',403);
 const expectedRole=s.role==='Shared'?a.role:s.role;
 if(expectedRole!==a.role&&!['M08'].includes(screen)&&!(screen==='M01'&&a.role==='Intake'))throw new AppError('Open the assigned workspace for this operation.',403);
 if(['Leadership','Audit'].includes(a.role)&&screen!=='S06')throw new AppError('This workspace is read-only.',403);
 const key=a.id+':'+need({key:p.key},'key');const hash=await checksum(stable(p));const prior=await one<any>(e,'SELECT * FROM idempotency WHERE key=? AND actor_id=?',key,a.id);
 if(prior){if(prior.body_hash!==hash)throw new AppError('This retry key was used for different data.',409);return JSON.parse(prior.response);}
 if(screen==='M01')return submitDraft(e,a,p,key,hash);
 if(screen==='S06'){const v=validateValues(screen,p.values);await run(e,'INSERT INTO preferences(user_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',a.id,stable(v),now());return {ok:true,message:'Preferences saved.',target:'S06'};}
 if(screen.startsWith('T'))return saveConfig(e,a,screen,p);
 const c=await permittedCase(e,a,str(p.case_id));if(c.kind==='draft')throw new AppError('Register the grievance before staff processing.');
 if(p.revision!==undefined&&Number(p.revision)!==c.revision)throw new AppError('Refresh this case before saving changes.',409);
 if(a.role==='Officer'&&c.owner_id!==a.id&&!['O09','O07'].includes(screen))throw new AppError('Accept responsibility for this assigned case before recording owner work.',403);
 if(c.closed_at&&['O03','O05','O06','O10','O11','O12','O13','O14'].includes(screen))throw new AppError('A closed case requires a linked authorised review before new investigation.');const v=validateValues(screen,p.values);const rows=await recordList(e,c.id),d=parseValues(c.details);const change:Change={};
 const requireOwner=()=>{if(c.acceptance!=='Accepted')throw new AppError('Ownership must be accepted before this investigation step.');};
 const requireFull=()=>{if(c.kind==='historical'&&TERMINAL.includes(c.source_status||'')&&screen!=='V09'&&!rows.some(r=>r.type==='legacy_review'&&str(parseValues(r.values)['Review determination'])==='Authorised reconsideration'))throw new AppError('A historical terminal record needs an authorised legacy reconsideration before findings.');if(!c.narrative_complete)throw new AppError('Retrieve and confirm the complete narrative before findings or decisions.');};
 const currentProposal=latest(rows,'proposal'),decision=latest(rows,'decision'),atr=latest(rows,'atr');
 const approved=()=>{if(!currentProposal||!decision||decision.status!=='Approved'||decision.parent_id!==currentProposal.id)throw new AppError('The current proposal must have a valid approval before implementation.');return decision;};
 const approvedAction=(act:RecordRow)=>{if(act.type==='action'){approved();if(act.parent_id!==currentProposal?.id)throw new AppError('This action belongs to an earlier proposal and cannot be executed.');}else{const rd=rows.find(r=>r.id===act.parent_id&&r.type==='review_decision');if(!rd||rd.status!=='Decision issued')throw new AppError('An issued review decision is required for this ordered action.');}if(act.status==='Superseded')throw new AppError('This action was superseded by a later decision.');};
 const issues=rows.filter(r=>r.type==='issue'),findings=rows.filter(r=>r.type==='finding');
 const evidenceId=async(label:string,checked=false)=>(await evidenceReference(e,a,c,v[label],checked)).id;
 switch(screen){
 case 'C09':change.message='Clarification recorded without restarting the original receipt date.';break;
 case 'C11':{if(!d.publishedDecisionId)throw new AppError('A communicated decision is required before outcome feedback.');const confirmation=str(v['Did the remedy reach you?']);change.patch={details:JSON.stringify({...d,confirmation:confirmation==='Yes'?'Confirmed':['No','Partly'].includes(confirmation)?'Disputed':'Unavailable',satisfaction:v['Handling satisfaction']||null,remaining:str(v['What remains unresolved?']),confirmationDecisionId:d.publishedDecisionId,confirmationAtrId:d.publishedAtrId,decisionReceipt:str(v['Decision received?'])==='Yes'?'Confirmed':'Unavailable'})};change.message='Remedy confirmation and satisfaction recorded separately.';break;}
 case 'C12':case 'M09':{
  const published=rows.find(r=>r.id===d.publishedDecisionId);if(!published)throw new AppError('A communicated decision is required before a linked challenge.');const mechanism=str(v.Mechanism||v['Review mechanism']||'Reconsideration');
  if(mechanism==='Prescribed appeal'){const policy=await config(e,'appeals');if(policy.approved!==true)throw new AppError('The prescribed appeal procedure and authority have not been configured.');}
  if(!str(v['Grounds for challenge'])&&!str(v.Grounds))throw new AppError('Explain the grounds of challenge.');change.recordType='review';change.status='Received';change.parentId=published.id;change.patch={stage:'Independent review',details:JSON.stringify({...d,challengeOpen:true})};change.target='C13';break;}
 case 'I06':{confirm(v,'Full text confirmed');change.patch={narrative:need(v,'Complete original narrative'),narrative_complete:1};if(str(v['Verified citizen account email'])){confirm(v,'Citizen identity verified');need(v,'Identity verification reference');const member=await activeMember(e,str(v['Verified citizen account email']));if(!JSON.parse(member.roles).includes('Citizen'))throw new AppError('The selected account has no citizen portal role.');change.patch.citizen_id=member.id;}change.message='Full narrative and explicit identity verification retained alongside source provenance.';break;}
 case 'I07':{const clock=await freezeDeadline(e,c);change.patch={category:str(v.Category),priority:str(v.Priority)||c.priority,stage:'Ownership routing',...(clock?{original_due:clock.due,due_date:clock.due}:{}),details:JSON.stringify({...d,...v,...(clock?{slaSnapshot:clock.snapshot}:{})})};break;}
 case 'I08':{const owner=await one<any>(e,'SELECT * FROM members WHERE (id=? OR lower(email)=?) AND active=1',str(v['Case owner']),str(v['Case owner']).toLowerCase());if(!owner)throw new AppError('Select an active case owner from the directory.');const roles:Role[]=JSON.parse(owner.roles);if(!roles.includes('Officer')&&!owner.is_owner)throw new AppError('The selected account is not a case officer.');if(!JSON.parse(owner.boards).includes('All')&&!JSON.parse(owner.boards).includes(str(v.Board)||c.board))throw new AppError('The chosen owner is not authorised for the selected board.');let respondentId=c.respondent_id;if(str(v['Respondent account email']))respondentId=(await activeMember(e,str(v['Respondent account email']))).id;change.patch={owner_id:owner.id,owner_name:owner.name,office:str(v['Lead office']),board:str(v.Board)||c.board,respondent_id:respondentId,acceptance:'Pending acceptance',stage:'Assignment pending',details:JSON.stringify({...d,...v})};change.assignee=owner.id;break;}
 case 'I10':change.patch={priority:'Urgent',restricted:str(v['Restricted visibility']).toLowerCase().includes('designated')?1:c.restricted,details:JSON.stringify({...d,...v})};change.message='Urgent assessment recorded; investigation and enrichment remain separate.';break;
 case 'I11':{const ref=await evidenceId('Acceptance evidence');change.patch={details:JSON.stringify({...d,handoffAccepted:true,handoffEvidence:ref,handoffAuthority:str(v['Destination authority'])})};change.status='Acceptance verified';break;}
 case 'I09':case 'M03':{const other=str(v['Related case reference']||p.other_id);const match=await one<CaseRow>(e,'SELECT * FROM cases WHERE id=? OR reference=?',other,other);if(!match||match.id===c.id)throw new AppError('Choose a different permitted case.');await permittedCase(e,a,match.id);change.link={id:match.id,relationship:str(v.Relationship)||'Related incident',reason:need(v,'Reason and evidence')};change.message='Reviewed link recorded; both cases and individual remedies are retained.';break;}
 case 'O03':requireOwner();need(v,'Add an issue');need(v,'Requested remedy');if(issues.some(i=>str(parseValues(i.values)['Issue reference'])===str(v['Issue reference'])))throw new AppError('Choose a unique issue reference.');change.status='Open';change.message='A separate issue and requested remedy are recorded.';break;
 case 'O04':{if(c.owner_id!==a.id)throw new AppError('This assignment is not addressed to your account.',403);confirm(v,'Jurisdiction check');confirm(v,'Conflict check');if(str(v.Acceptance)!=='Accept')throw new AppError('Use Decline with reason to redirect the assignment.');change.patch={acceptance:'Accepted',stage:'Investigation planning'};change.status='Accepted';break;}
 case 'M04':change.patch={acceptance:'Declined',stage:'Ownership exception'};change.status='Declined';change.target='V03';break;
 case 'O05':requireOwner();change.patch={stage:'Investigation'};change.due=str(v['Next update date']);break;
 case 'O06':{requireOwner();const provider=await activeMember(e,need(v,'Provider account email'));change.assignee=provider.id;change.status='Requested';change.due=need(v,'Task due date');change.patch={stage:'Supporting input requested'};break;}
 case 'O07':{const input=rows.find(r=>r.type==='input'&&r.id===str(v['Input task reference']));if(!input)throw new AppError('Choose an existing input task.');change.parentId=input.id;if(str(v['Response completeness'])==='Complete'){if(str(parseValues(input.values)['Requested evidence']))await evidenceId('Supporting evidence reference');change.recordUpdates=[{id:input.id,status:'Complete'}];change.status='Accepted';}else change.status='Further input required';break;}
 case 'O09':{const ev=await evidenceReference(e,a,c,v['Evidence reference']);if(v['Document checked']===true)change.evidenceChecked=ev.id;change.parentId=ev.id;change.recordType='citation';break;}
 case 'O10':requireOwner();change.status='Inspection recorded';break;
 case 'O11':requireOwner();if(str(v['Replacement hearing reference'])){const prior=rows.find(r=>r.type==='hearing'&&r.status==='Scheduled'&&r.id===str(v['Replacement hearing reference']));if(!prior)throw new AppError('Select the original scheduled notice.');change.parentId=prior.id;change.recordUpdates=[{id:prior.id,status:'Superseded'}];}change.status='Scheduled';change.due=need(v,'Hearing date');change.patch={stage:'Hearing preparation',details:JSON.stringify({...d,respondentNotice:str(v['Respondent notice summary'])||str(v['Hearing purpose'])})};break;
 case 'O12':requireOwner();change.status='Minutes recorded';break;
 case 'M08':if(!rows.some(r=>['hearing','review_hearing'].includes(r.type)&&r.status==='Scheduled'&&r.id===str(v['Hearing reference'])))throw new AppError('Select an existing scheduled hearing.');change.parentId=str(v['Hearing reference']);change.status='Reschedule requested';change.message='Request recorded; the original appointment is retained until authorised scheduling.';change.target=a.role==='Developer'?'D05':'O11';break;
 case 'O13':{requireOwner();requireFull();const issue=issues.find(r=>r.id===str(v['Issue reference']));if(!issue)throw new AppError('Choose an existing issue.');await evidenceId('Evidence references',true);change.parentId=issue.id;change.status='Finding recorded';change.patch={stage:'Findings recorded'};break;}
 case 'O14':{requireOwner();requireFull();if(currentProposal&&rows.some(r=>r.type==='execution'&&['Completed - requires verification','Verified'].includes(r.status)&&rows.some(act=>act.id===r.parent_id&&act.parent_id===currentProposal.id)))throw new AppError('An executed decision requires a linked review before the remedy is changed.');if(!issues.length)throw new AppError('Record the material issues first.');if(issues.some(issue=>!findings.some(f=>f.parent_id===issue.id)))throw new AppError('Every material issue requires an evidence-linked finding.');change.recordUpdates=rows.filter(r=>r.type==='action'&&r.status!=='Verified'&&r.status!=='Superseded').map(r=>({id:r.id,status:'Superseded'}));change.status='Pending approval';change.patch={stage:'Decision approval pending'};break;}
 case 'V06':{confirm(v,'Authority confirmed');const power=await delegation(e,a,'Decision approval',c);if(c.category.toLowerCase().includes('payment')||c.category.toLowerCase().includes('refund'))await delegation(e,a,'Payment authorisation',c);if(!currentProposal)throw new AppError('No current proposal is available.');if(decision?.parent_id===currentProposal.id&&decision.status==='Approved')throw new AppError('This proposal is already approved; use its authorised action records.');const policy=await config(e,'T07');if(policy['Independent approver required']===true&&currentProposal.author_id===a.id)throw new AppError('This policy requires a different approving account.',403);const chosen=need(v,'Decision');change.parentId=currentProposal.id;change.recordType='decision';change.status=chosen==='Approve'?'Approved':chosen==='Return for correction'?'Returned':'Declined';
  if(chosen==='Approve'){const proposal=parseValues(currentProposal.values);const adverse=str(proposal['Proposed outcome'])==='Reasoned adverse decision';const referral=str(proposal['Proposed outcome']).includes('Referral');if(!adverse&&!referral){change.extraRecords=issues.map(issue=>({type:'action',status:'Pending implementation',values:{issue_id:issue.id,description:str(proposal['Proposed action']),approval_proposal_id:currentProposal.id,authority_reference:str(power['Delegated authority'])},parentId:currentProposal.id,assignee:c.owner_id||undefined,due:str(proposal['Implementation due date'])}));}change.patch={stage:adverse?'ATR drafting':referral?'Referral coordination':'Remedy execution',details:JSON.stringify({...d,decisionKind:adverse?'Adverse':referral?'Referral':'Remedy',delegationVersion:power._version,confirmation:'Unavailable',decisionReceipt:'Unavailable'})};}else change.patch={stage:'Decision proposal'};break;}
 case 'O15':{requireOwner();const act=rows.find(r=>['action','review_action'].includes(r.type)&&r.id===str(v['Action reference']));if(!act)throw new AppError('Choose an authorised action.');approvedAction(act);if(act.status==='Verified')throw new AppError('This action is already verified; use a linked review for a disputed result.');const result=str(v['Execution result']);if(result==='Completed - requires verification')await evidenceId('Implementation evidence');change.parentId=act.id;change.status=result;change.recordUpdates=[{id:act.id,status:result}];break;}
 case 'O16':{requireOwner();const act=rows.find(r=>['action','review_action'].includes(r.type)&&r.id===str(v['Action checked']||v['Action reference']));if(!act)throw new AppError('Choose the action being checked.');approvedAction(act);if(act.status!=='Completed - requires verification')throw new AppError('Record completed execution before verifying the result.');const proof=await evidenceId('Evidence reference',true);if(str(v['Implementation conclusion'])!=='Verified')throw new AppError('Record a supported verification conclusion.');change.parentId=act.id;change.status='Verified';change.recordUpdates=[{id:act.id,status:'Verified'}];change.patch={stage:'Implementation verification',details:JSON.stringify({...d,lastVerificationEvidence:proof})};break;}
 case 'O17':requireOwner();approved();change.status='Draft';change.parentId=decision!.id;change.patch={stage:'ATR quality review'};break;
 case 'V07':case 'M07':{if(!atr)throw new AppError('Prepare an ATR version first.');change.parentId=atr.id;change.recordType='atr_review';const returnIt=screen==='M07'||str(v['Reviewer conclusion'])==='Return for correction';change.status=returnIt?'Returned':'Approved';if(!returnIt)confirm(v,'All issues checked');change.patch={stage:returnIt?'ATR correction':'Closure review'};change.message=returnIt?'ATR returned with corrections; the prior version is retained.':'ATR reviewed against the case and evidence.';break;}
 case 'V08':{await delegation(e,a,'Decision approval',c);approved();confirm(v,'Closure authority confirmed');const quality=latest(rows,'atr_review');if(!atr||!quality||quality.parent_id!==atr.id||quality.status!=='Approved')throw new AppError('The latest ATR version must pass quality review before closure.');const acts=rows.filter(r=>(r.type==='action'&&r.parent_id===currentProposal?.id)||(r.type==='review_action'&&r.status!=='Superseded'));if(acts.some(r=>r.status!=='Verified'))throw new AppError('Material actions remain incomplete or unverified.');const policy=await config(e,'T07');if((d.decisionKind==='Adverse'?d.decisionReceipt!=='Confirmed':d.confirmation!=='Confirmed')&&policy['Permit closure without citizen confirmation']!==true)throw new AppError('Citizen confirmation is unavailable or disputed. Obtain feedback or configure the approved non-response policy.');if(d.publishedDecisionId!==decision!.id||d.publishedAtrId!==atr.id)throw new AppError('Communicate the current approved decision and reviewed ATR before closure.');if(policy['Permit closure without citizen confirmation']!==true&&(d.confirmationDecisionId!==decision!.id||d.confirmationAtrId!==atr.id))throw new AppError('Feedback must relate to the current decision and ATR.');const kind=d.decisionKind;if(kind==='Referral'&&d.handoffAccepted!==true)throw new AppError('Verify the receiving authority and acceptance evidence before referral closure.');if(kind==='Remedy'&&!acts.length)throw new AppError('No authorised remedy action has been verified.');const outcome=kind==='Adverse'?'Reasoned adverse decision':kind==='Referral'?'Referral verified':'Implemented and verified';if(str(v['Internal closure outcome'])!==outcome)throw new AppError('The requested closure outcome does not match the approved and verified decision.');change.patch={stage:'Closed',outcome,closed_at:now(),details:JSON.stringify({...d,closureReason:need(v,'Approval reason')})};change.status='Approved closure';change.target='O18';break;}
 case 'O18':{const channel=str(v['Safe channel']);change.status=channel.toLowerCase().includes('email')||channel.toLowerCase().includes('sms')?'External channel not configured':channel==='In-app'?(c.citizen_id?'Available in app':'Unlinked citizen account - manual service required'):'Manual service verified';if(channel==='Assisted manual contact')await evidenceId('Service evidence',true);change.parentId=decision?.id;if(decision?.status==='Approved')change.patch={details:JSON.stringify({...d,publishedDecisionId:decision.id,publishedAtrId:atr&&latest(rows,'atr_review')?.parent_id===atr.id&&latest(rows,'atr_review')?.status==='Approved'?atr.id:null})};change.message='Communication retained with the actual channel state.';break;}
 case 'M11':change.status='External channel not configured';change.message='Retry request retained. Configure the approved delivery adapter before external transmission.';break;
 case 'V05':change.status='Intervention recorded';break;
 case 'M05':{const chosen=str(v['Exception decision']);if(chosen==='Request exception'){if(!c.original_due)throw new AppError('An approved original SLA deadline is required before requesting an extension.');change.status='Approval pending';change.message='Exception requested; deadlines remain unchanged.';}else{await delegation(e,a,'Deadline exceptions',c);const request=rows.find(r=>r.type==='extension'&&r.status==='Approval pending'&&r.id===str(v['Exception reference']));if(!request)throw new AppError('Select a pending deadline exception.');need(v,'Decision reason');change.parentId=request.id;change.status=chosen==='Approve exception'?'Approved':'Declined';change.recordUpdates=[{id:request.id,status:change.status}];if(change.status==='Approved'){const due=need(v,'Proposed milestone');if(due<str(c.due_date))throw new AppError('An extension must not precede the current deadline.');change.patch={due_date:due};}change.message='Authorised exception decision recorded; original deadline retained.';}break;}
 case 'M06':change.status='Referral pending';change.patch={restricted:1};break;
 case 'V09':requireFull();change.status='Reviewed';change.patch={stage:'Authorised legacy review',details:JSON.stringify({...d,...v})};break;
 case 'V10':change.status='Open preventive action';break;
 case 'D03':change.status='Response received - assessment required';break;
 case 'D04':{const due=Number(v['Declared obligation (INR)']),paid=Number(v['Reported payment (INR)']);if(str(v['Period to'])<str(v['Period from']))throw new AppError('The period end must follow its start.');v['Unreconciled balance (INR)']=Math.round((due-paid)*100)/100;change.status='Reported - not verified';break;}
 case 'D05':change.status='Response recorded';break;
 case 'D06':await evidenceId('Implementation evidence');change.status='Compliance claimed - verification required';break;
 case 'R02':{const review=latest(rows,'review');if(!review)throw new AppError('No linked challenge exists.');change.parentId=review.id;change.status=str(v['Admissibility conclusion']);break;}
 case 'R03':{const admissible=latest(rows,'admissibility');if(admissible?.status!=='Admitted')throw new AppError('Record an admitted review before independent assessment.');change.parentId=latest(rows,'review')?.id;change.status='Assessment recorded';break;}
 case 'R04':change.status='Material requested';change.due=str(v['Response milestone']);break;
 case 'R05':change.status='Scheduled';change.due=str(v['Review date']);break;
 case 'R06':{const admitted=latest(rows,'admissibility');if(admitted?.status!=='Admitted'||!latest(rows,'review_assessment'))throw new AppError('Complete admissibility and independent assessment first.');await delegation(e,a,'Review authority',c);const policy=await config(e,'T07');if(policy['Independent approver required']===true&&decision?.author_id===a.id)throw new AppError('An independent reviewing account is required.',403);change.parentId=latest(rows,'review')?.id;change.status='Decision issued';if(str(v['Review conclusion'])!=='Confirm original decision'){const executor=await activeMember(e,need(v,'Executor account email'));change.extraRecords=[{type:'review_action',status:'Pending implementation',values:{description:need(v,'Ordered action'),review_of:decision?.id||'',authority:need(v,'Competent authority')},parentId:'CURRENT_RECORD',assignee:executor.id,due:need(v,'Ordered action due date')}];}change.patch={stage:'Review action tracking'};break;}
 case 'R07':{const act=rows.find(r=>r.type==='review_action'&&r.id===str(v['Action reference']));if(!act)throw new AppError('Select a review-ordered action.');approvedAction(act);const state=need(v,'Follow-up result');if(['Completed - requires verification','Verified'].includes(state))await evidenceId('Evidence reference',state==='Verified');if(state==='Verified'&&act.status!=='Completed - requires verification')throw new AppError('Record completed execution before independent verification.');change.parentId=act.id;change.status=state;change.recordUpdates=[{id:act.id,status:state}];break;}
 case 'O19':change.status='Query recorded';break;
 default:throw new AppError('This view uses its dedicated controls rather than a generic save action.');
 }
 change.notifications=[];
 if(screen==='I08'&&change.assignee)change.notifications.push({userId:change.assignee,title:'Ownership acceptance requested',message:c.reference+' is awaiting your acceptance.',kind:'Assignment'});
 if(screen==='O06'&&change.assignee)change.notifications.push({userId:change.assignee,title:'Supporting input requested',message:need(v,'Required input'),kind:'Input'});
 if(screen==='O18'&&c.citizen_id)change.notifications.push({userId:c.citizen_id,title:'Case update available',message:str(v['Message content'])||'A decision or update is available for '+c.reference,kind:'Communication'});
 const result=await changeCase(e,a,c,screen,v,change,key,hash);
 return result;
}

async function saveConfig(e:ApiEnv,a:Actor,screen:string,p:any){
 requireRole(a,['Admin']);const v=validateValues(screen,p.values);let key=screen;const stmts:D1PreparedStatement[]=[];
 if(screen==='T02'||screen==='T03'){
  const email=need(v,'Account email').toLowerCase(),role=need(v,'Application role') as Role;if(!ROLES.includes(role))throw new AppError('Choose an application role.');const m=await one<any>(e,'SELECT * FROM members WHERE lower(email)=?',email);
  if(m?.is_owner&&screen==='T03'&&(v['Access enabled']!==true||v['Revoke selected role']===true))throw new AppError('The owner must retain their access and assigned roles.');
  const id=m?.id||uuid();let roles:Role[]=m?JSON.parse(m.roles):[];if(screen==='T03'&&v['Revoke selected role']===true)roles=roles.filter(r=>r!==role);else if(!roles.includes(role))roles.push(role);if(!roles.length&&v['Access enabled']===true)throw new AppError('An enabled account needs at least one assigned role.');
  const board=str(v['Permitted board'])||'All',active=screen==='T03'?(v['Access enabled']===true?1:0):1;
  if(m)stmts.push(statement(e,'UPDATE members SET roles=?,boards=?,active=? WHERE id=?',JSON.stringify(roles),JSON.stringify(m.is_owner?['All']:[board]),active,id));
  else stmts.push(statement(e,'INSERT INTO members(id,email,name,roles,boards,active,is_owner,created_at) VALUES(?,?,?,?,?,?,?,?)',id,email,str(v['Current officer'])||email,JSON.stringify(roles),JSON.stringify([board]),active,0,now()));
  key=(screen==='T02'?'delegation:':'access:')+id;
  if(screen==='T02'&&str(v['Effective until'])&&str(v['Effective until'])<str(v['Effective from']))throw new AppError('Delegation expiry must follow its start.');
 }
 if(screen==='T05'){
  key='sla:'+need(v,'Source / procedure');if(v['Approved policy']===true){need(v,'Policy reference');need(v,'Version / effective date');need(v,'Policy effective date');if(Number(v['Day duration'])<=0||!Number.isInteger(Number(v['Day duration'])))throw new AppError('Set a positive whole-day duration.');const cal=await config(e,'calendar:'+need(v,'Calendar'));if(cal['Calendar approved']!==true)throw new AppError('Approve the referenced calendar before approving this policy.');}
 }
 if(screen==='T06'){key=(str(v['Holiday date'])?'holiday:'+str(v['Holiday date'])+':':'calendar:')+need(v,'Calendar name');if(v['Calendar approved']===true){need(v,'Approval reference');need(v,'Calendar version');}}
 if(screen==='T13')key='knowledge:'+uuid();if(screen==='T01')key='organisation:'+uuid();if(screen==='T04')key='routing:'+uuid();if(screen==='T10')key='template:'+uuid();
 const old=await one<any>(e,'SELECT * FROM configs WHERE key=?',key),version=(old?.version||0)+1,time=now();
 stmts.push(statement(e,'INSERT INTO configs(key,screen,payload,version,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at',key,screen,stable(v),version,a.id,time));
 stmts.push(statement(e,'INSERT INTO config_history(id,key,payload,version,actor_id,created_at) VALUES(?,?,?,?,?,?)',uuid(),key,stable(v),version,a.id,time));
 stmts.push(statement(e,'INSERT INTO events(case_id,kind,actor_id,actor_role,message,payload,created_at) VALUES(?,?,?,?,?,?,?)',null,'configuration',a.id,a.role,'Configuration version saved.',stable({key,version,values:v}),time));await e.DB.batch(stmts);return {ok:true,message:'Configuration version saved.',target:screen,key,version};
}
async function freezeDeadline(e:ApiEnv,c:CaseRow){
 if(c.original_due)return null;const p=await config(e,'sla:'+c.source_portal);if(p['Approved policy']!==true||str(p['Policy effective date'])>today())return null;
 const calendar=await config(e,'calendar:'+str(p.Calendar));if(calendar['Calendar approved']!==true)return null;const holidays=await all<any>(e,"SELECT * FROM configs WHERE screen='T06' AND key LIKE 'holiday:%'");const approved=holidays.filter(r=>{const h=parseValues(r.payload);return h['Calendar approved']===true&&h['Calendar name']===p.Calendar;});const due=calculateDue(c.received_date,p,calendar,approved.map(r=>str(parseValues(r.payload)['Holiday date'])));if(!due)return null;
 return {due,snapshot:{policy:p,calendar,holidays:approved.map(r=>({key:r.key,version:r.version,date:parseValues(r.payload)['Holiday date']})),frozen_at:now(),received_date:c.received_date}};
}

async function multipart(req:Request,max=22*1024*1024){
 if(Number(req.headers.get('content-length')||0)>max)throw new AppError('This upload is too large.',413);
 return req.formData();
}
export async function uploadEvidence(e:ApiEnv,a:Actor,req:Request){
 requireRole(a,['Citizen','Intake','Officer','Supervisor','Review','Developer','Admin']);const form=await multipart(req,12*1024*1024);const c=await permittedCase(e,a,str(form.get('case_id')));
 const file=form.get('file');if(!(file instanceof File)||!file.size)throw new AppError('Select an evidence file.');if(file.size>10*1024*1024)throw new AppError('Evidence files must be 10 MB or smaller.',413);
 const bytes=new Uint8Array(await file.arrayBuffer());const ext=file.name.split('.').pop()?.toLowerCase();const accepted:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',txt:'text/plain'};const mime=accepted[ext||''];if(!mime)throw new AppError('Use PDF, PNG, JPG, DOCX, XLSX, CSV or TXT.');
 if(ext==='pdf'&&new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new AppError('The selected file is not a valid PDF.');
 if(ext==='png'&&![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))throw new AppError('The selected file is not a PNG.');
 if(['jpg','jpeg'].includes(ext||'')&&!(bytes[0]===255&&bytes[1]===216))throw new AppError('The selected file is not a JPEG.');
 if(['docx','xlsx'].includes(ext||'')&&!(bytes[0]===80&&bytes[1]===75))throw new AppError('The selected Office file has an invalid container.');
 const previousId=str(form.get('previous_id'));let previous:EvidenceRow|null=null;if(previousId){previous=await one<EvidenceRow>(e,'SELECT * FROM evidence WHERE id=? AND case_id=?',previousId,c.id);if(!previous)throw new AppError('The earlier evidence version was not found.');if(['Citizen','Developer'].includes(a.role)&&previous.uploaded_by!==a.id)throw new AppError('Only your own supplied evidence can be versioned.',403);if(!str(form.get('version_reason')))throw new AppError('Explain the new version.');}
 const id=uuid(),name=file.name.replace(/[\r\n/\\]/g,'_').slice(0,180),hash=await checksum(bytes),object='evidence/'+c.id+'/'+id+'/'+name;const classification=str(form.get('classification'))==='Restricted'?'Restricted':'Normal';
 const citizenSafe=a.role==='Citizen'?1:form.get('citizen_safe')==='true'?1:0;const respondentSafe=a.role==='Developer'?1:form.get('respondent_safe')==='true'?1:0;
 if(classification==='Restricted'&&((citizenSafe&&a.role!=='Citizen')||(respondentSafe&&a.role!=='Developer')))throw new AppError('Provide a normal-classification redacted copy before sharing restricted material.');
 await e.BUCKET.put(object,bytes,{httpMetadata:{contentType:mime}});
 try{await e.DB.batch([statement(e,'INSERT INTO evidence(id,case_id,filename,mime,size,checksum,object_key,version,previous_id,classification,citizen_safe,respondent_safe,description,review_state,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,c.id,name,mime,file.size,hash,object,previous?previous.version+1:1,previous?.id||null,classification,citizenSafe,respondentSafe,str(form.get('description'))||null,'Unreviewed',a.id,now()),statement(e,'INSERT INTO events(case_id,kind,actor_id,actor_role,message,payload,created_at) VALUES(?,?,?,?,?,?,?)',c.id,'evidence',a.id,a.role,previous?'New evidence version supplied; original retained.':'Evidence supplied.',JSON.stringify({evidence_id:id,checksum:hash,version:previous?previous.version+1:1,validation:'Type and size checked; content review pending'}),now())]);}
 catch(error){await e.BUCKET.delete(object);throw error;}
 return {ok:true,id,filename:name,checksum:hash,version:previous?previous.version+1:1,message:'Evidence stored. Content review remains pending.'};
}
async function downloadEvidence(e:ApiEnv,a:Actor,id:string,url:URL){
 const ev=await one<EvidenceRow>(e,'SELECT * FROM evidence WHERE id=?',id);if(!ev)throw new AppError('Evidence unavailable.',404);await permittedCase(e,a,ev.case_id);
 if(a.role==='Citizen'&&ev.citizen_safe!==1&&ev.uploaded_by!==a.id)throw new AppError('Evidence unavailable.',404);
 if(a.role==='Developer'&&ev.respondent_safe!==1&&ev.uploaded_by!==a.id)throw new AppError('Evidence unavailable.',404);
 if(a.role==='Leadership')throw new AppError('Open permitted case evidence from an authorised operational workspace.',403);
 if(ev.classification==='Restricted'&&!a.canRestricted&&ev.uploaded_by!==a.id)throw new AppError('Evidence unavailable.',404);
 const object=await e.BUCKET.get(ev.object_key!);if(!object)throw new AppError('Document bytes are unavailable.',404);
 await audit(e,a,'evidence_access','Permitted evidence downloaded.',ev.case_id,{evidence_id:ev.id,checksum:ev.checksum});
 const inline=url.searchParams.get('inline')==='1'&&['application/pdf','image/png','image/jpeg'].includes(ev.mime);
 return new Response(object.body,{headers:{'Content-Type':ev.mime,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(ev.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(inline?{'Content-Security-Policy':'sandbox'}:{})}});
}
async function stageImport(e:ApiEnv,a:Actor,req:Request){
 requireRole(a,['Intake','Admin']);if(!a.boards.includes('All'))throw new AppError('Whole-source imports require the nodal workspace scope.',403);
 const form=await multipart(req);const file=form.get('file');if(!(file instanceof File)||!file.size)throw new AppError('Select an XLSX or CSV source export.');if(file.size>16*1024*1024)throw new AppError('The export exceeds 16 MB.',413);
 if(!/\.(xlsx|csv)$/i.test(file.name))throw new AppError('Use an XLSX or CSV source export.');const source=str(form.get('source'));if(!['Aaple Sarkar','PG Portal'].includes(source))throw new AppError('Choose the source portal.');
 const bytes=new Uint8Array(await file.arrayBuffer()),hash=await checksum(bytes);let parsed;try{parsed=await workbook(bytes,file.name);}catch(error){throw new AppError(error instanceof Error?error.message:'The source file cannot be parsed.');}const mapped=normalise(parsed.rows,source);const prior=await one<any>(e,'SELECT * FROM imports WHERE checksum=? AND source=? AND status=? ORDER BY created_at DESC LIMIT 1',hash,source,'Complete');
 const id=prior?uuid():'batch-'+(source==='Aaple Sarkar'?'as':'pg')+'-'+hash.slice(0,28),object='imports/'+hash+'/'+file.name.replace(/[\r\n/\\]/g,'_');await e.BUCKET.put(object,bytes,{httpMetadata:{contentType:file.name.endsWith('.csv')?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
 if(prior){await run(e,'INSERT INTO imports(id,source,filename,checksum,object_key,row_count,accepted,updated,unchanged,rejected,status,mapping,errors,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,source,file.name,hash,object,parsed.rows.length,0,0,prior.row_count-prior.rejected,prior.rejected,'Complete',prior.mapping,prior.errors,a.id,now());await audit(e,a,'repeat_import','Identical export reconciled without duplicate cases.',null,{batch_id:id,unchanged:prior.row_count-prior.rejected});return {ok:true,id,duplicate:true,status:'Complete',unchanged:prior.row_count-prior.rejected,headers:parsed.headers};}
 await run(e,'INSERT OR IGNORE INTO imports(id,source,filename,checksum,object_key,row_count,rejected,status,mapping,errors,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,source,file.name,hash,object,parsed.rows.length,mapped.errors.length,'Validation',JSON.stringify({...mapped.mapping,_cutoff:str(form.get('cutoff')),_purpose:str(form.get('purpose')),_filters:str(form.get('filters'))}),JSON.stringify(mapped.errors),a.id,now());
 const errorRows=new Map(mapped.errors.map(r=>[r.row,r.reason]));const stmts=parsed.rows.map((raw,i)=>statement(e,'INSERT OR IGNORE INTO import_rows(id,import_id,row_number,raw,status,error) VALUES(?,?,?,?,?,?)',id+':'+(i+2),id,i+2,stable(raw),errorRows.has(i+2)?'Rejected':'Validated',errorRows.get(i+2)||null));for(let i=0;i<stmts.length;i+=80)await e.DB.batch(stmts.slice(i,i+80));
 await audit(e,a,'import_staged','Original export preserved and validation completed.',null,{batch_id:id,row_count:parsed.rows.length,rejected:mapped.errors.length,checksum:hash});return {ok:true,id,headers:parsed.headers,valid:mapped.valid.length,rejected:mapped.errors.length,status:'Validation'};
}
async function importDetail(e:ApiEnv,a:Actor,id:string){
 requireRole(a,['Admin','Intake','Audit','Supervisor']);const batch=await one<any>(e,'SELECT * FROM imports WHERE id=?',id);if(!batch)throw new AppError('Import not found.',404);
 const preview=['Admin','Intake'].includes(a.role)?await all<any>(e,'SELECT row_number,raw,status,error FROM import_rows WHERE import_id=? ORDER BY row_number LIMIT 8',id):[];const job=await one<any>(e,'SELECT * FROM jobs WHERE id=?','import:'+id);const {object_key,...publicBatch}=batch;
 return {batch:publicBatch,preview,job,headers:preview[0]?Object.keys(JSON.parse(preview[0].raw)):Object.values(JSON.parse(batch.mapping||'{}'))};
}
async function remapImport(e:ApiEnv,a:Actor,id:string,p:any){
 requireRole(a,['Admin','Intake']);const b=await one<any>(e,'SELECT * FROM imports WHERE id=?',id);if(!b||b.status==='Complete'||b.status==='Importing')throw new AppError('Only a staged import can be remapped.');const rows=await all<any>(e,'SELECT * FROM import_rows WHERE import_id=? ORDER BY row_number',id);const mapped=normalise(rows.map(r=>JSON.parse(r.raw)),b.source,p.mapping||{});const errors=new Map(mapped.errors.map(r=>[r.row,r.reason]));const stmts=rows.map(r=>statement(e,'UPDATE import_rows SET status=?,error=? WHERE id=?',errors.has(r.row_number)?'Rejected':'Validated',errors.get(r.row_number)||null,r.id));stmts.push(statement(e,'UPDATE imports SET mapping=?,errors=?,rejected=?,status=? WHERE id=?',JSON.stringify(mapped.mapping),JSON.stringify(mapped.errors),mapped.errors.length,'Validation',id));for(let i=0;i<stmts.length;i+=80)await e.DB.batch(stmts.slice(i,i+80));return {ok:true,valid:mapped.valid.length,rejected:mapped.errors.length};
}
async function acquireJob(e:ApiEnv,id:string){const lease=uuid();const r=await run(e,"UPDATE jobs SET payload=json_set(payload,'$.lease',?,'$.leaseUntil',?),attempts=attempts+1 WHERE id=? AND COALESCE(json_extract(payload,'$.leaseUntil'),0)<?",lease,Date.now()+90000,id,Date.now());return r.meta.changes===1?lease:null;}
async function releaseJob(e:ApiEnv,id:string,lease:string){await run(e,"UPDATE jobs SET payload=json_remove(payload,'$.lease','$.leaseUntil') WHERE id=? AND json_extract(payload,'$.lease')=?",id,lease);}
async function commitImport(e:ApiEnv,a:Actor,id:string){
 requireRole(a,['Admin','Intake']);const b=await one<any>(e,'SELECT * FROM imports WHERE id=?',id);if(!b)throw new AppError('Import not found.',404);if(b.status==='Complete')return {ok:true,ready:true,completed:b.row_count,total:b.row_count};
 const jobId='import:'+id;await run(e,'INSERT OR IGNORE INTO jobs(id,type,status,total,completed,payload,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',jobId,'Source import','Running',b.row_count,0,JSON.stringify({batch_id:id}),a.id,now(),now());const lease=await acquireJob(e,jobId);if(!lease){const job=await one<any>(e,'SELECT * FROM jobs WHERE id=?',jobId);return {ok:true,ready:job.status==='Complete',completed:job.completed,total:job.total,busy:true};}
 try{
  await run(e,'UPDATE imports SET status=? WHERE id=?','Importing',id);const rows=await all<any>(e,"SELECT * FROM import_rows WHERE import_id=? AND status='Validated' ORDER BY row_number LIMIT 30",id);
  for(const row of rows){const parsed=normalise([JSON.parse(row.raw)],b.source,JSON.parse(b.mapping)),source=parsed.valid[0];if(!source){await run(e,'UPDATE import_rows SET status=?,error=? WHERE id=?','Rejected',parsed.errors[0]?.reason||'Invalid row',row.id);continue;}source.row=row.row_number;
   try{const result=await importOneStatements(e,source,id,a.id);await e.DB.batch([...result.stmts,statement(e,'UPDATE import_rows SET status=?,error=NULL WHERE id=?',prettyResult(result.result),row.id)]);}catch(error){await run(e,'UPDATE import_rows SET status=?,error=? WHERE id=?','Rejected',error instanceof Error?error.message:'Reconciliation exception',row.id);}
  }
  const counts=await all<any>(e,'SELECT status,COUNT(*) n FROM import_rows WHERE import_id=? GROUP BY status',id),get=(status:string)=>counts.find(x=>x.status===status)?.n||0,remaining=get('Validated'),completed=b.row_count-remaining,ready=remaining===0;
  await e.DB.batch([statement(e,'UPDATE jobs SET completed=?,status=?,updated_at=? WHERE id=?',completed,ready?'Complete':'Running',now(),jobId),statement(e,'UPDATE imports SET accepted=?,updated=?,unchanged=?,rejected=?,status=? WHERE id=?',get('Accepted'),get('Updated'),get('Unchanged'),get('Rejected'),ready?'Complete':'Importing',id)]);
  if(ready)await audit(e,a,'import_committed','Source batch reconciled.',null,{batch_id:id});return {ok:true,ready,completed,total:b.row_count};
 }finally{await releaseJob(e,jobId,lease);}
}
const prettyResult=(result:string)=>result[0].toUpperCase()+result.slice(1);

async function exportResponse(e:ApiEnv,a:Actor,url:URL){
 const id=url.searchParams.get('case');const format=url.searchParams.get('format')||'json';
 if(id){const data=await readCase(e,a,id);const manifest={case:data.case,records:data.records,evidence:data.evidence,events:data.events,sources:data.sources,links:data.links,generated_at:now(),scope:a.role};const hash=await checksum(stable(manifest));await audit(e,a,'export','Case export generated.',id,{format,manifest_hash:hash,purpose:str(url.searchParams.get('purpose'))||'Case report'});
  if(format==='print'){const sections=[{title:'Grievance and source references',body:[data.case.reference,data.case.source_portal+' / '+data.case.source_token,'Source label: '+data.case.source_status,'Internal stage: '+data.case.stage,'Outcome: '+data.case.outcome].join('\n')},{title:'Original narrative',body:data.case.narrative||data.case.preview||'Restricted or pending full retrieval'},...data.records.filter(r=>['decision','review_decision','atr','feedback','verification','case_submitted'].includes(r.type)).map(r=>({title:r.type.replaceAll('_',' ')+' · '+r.status,body:Object.entries(parseValues(r.values)).map(([k,v])=>k+': '+String(v)).join('\n')})),{title:'Evidence manifest',body:data.evidence.map(v=>v.filename+' · v'+v.version+' · '+v.checksum).join('\n')||'No permitted evidence supplied.'},{title:'Integrity and scope',body:'Manifest SHA-256: '+hash+'\nExport scope: '+a.role}];return new Response(printReport('Case '+data.case.reference,sections),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  return new Response(JSON.stringify({...manifest,manifest_hash:hash},null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${data.case.reference}-audit-pack.json"`,'Cache-Control':'private, no-store'}});
 }
 requireRole(a,['Leadership','Supervisor','Intake','Audit','Admin']);const scope=caseScope(a);let where=scope.sql;const args=[...scope.args];const dateColumn=url.searchParams.get('cohort')==='Due cases'?'due_date':url.searchParams.get('cohort')==='Completed cases'?'closed_at':'received_date';if(dateColumn==='closed_at')where+=' AND c.closed_at IS NOT NULL';if(dateColumn==='due_date')where+=' AND c.due_date IS NOT NULL';for(const [param,comparison] of [['from','>='],['to','<=']] as const){const value=str(url.searchParams.get(param));if(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new AppError('Select valid report dates.');where+=` AND substr(c.${dateColumn},1,10)${comparison}?`;args.push(value);}}const selectedBoard=str(url.searchParams.get('board'));if(selectedBoard){if(!BOARDS.includes(selectedBoard))throw new AppError('Choose a recognised board for the report.');where+=' AND c.board=?';args.push(selectedBoard);}const rows=await all<CaseRow>(e,`SELECT c.* FROM cases c WHERE ${where} ORDER BY c.received_date DESC LIMIT 5000`,...args);await audit(e,a,'export','Scoped register export generated.',null,{format,count:rows.length,purpose:str(url.searchParams.get('purpose'))||'Operational monitoring',filters:Object.fromEntries(url.searchParams)});
 if(format==='csv')return new Response(exportCases(rows.map(c=>visibleCase(a,c))),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="MHADA-case-register.csv"','Cache-Control':'private, no-store'}});
 if(format==='print'){const grouped=(key:keyof CaseRow)=>Object.entries(rows.reduce((counts:Record<string,number>,r)=>{const value=str(r[key])||'Unknown';counts[value]=(counts[value]||0)+1;return counts;},{})).sort((a,b)=>b[1]-a[1]).map(([label,count])=>label+': '+count).join('\n');return new Response(printReport(str(url.searchParams.get('report_type'))||'Grievance operational report',[{title:'Scope and report filters',body:`Workspace: ${a.role}\nCohort: ${url.searchParams.get('cohort')||'Received cases'}\nPeriod: ${url.searchParams.get('from')||'All dates'} through ${url.searchParams.get('to')||'All dates'}\nBoard: ${selectedBoard||'All permitted boards'}\nPurpose: ${url.searchParams.get('purpose')||'Operational monitoring'}`},{title:'Population and source coverage',body:`${rows.length} permitted records. ${rows.filter(r=>!TERMINAL.includes(r.source_status||'')).length} source non-terminal labels. Source labels do not establish verified relief.`},{title:'Internal outcomes',body:grouped('outcome')},{title:'Board / office families',body:grouped('board')},{title:'Source labels',body:grouped('source_status')},{title:'Internal stages',body:grouped('stage')},{title:'Limitations',body:'Source age is excluded from SLA measurements. Historical descriptions are previews until retrieved. No live portal synchronisation is asserted. Baseline source review: 14 October 2026.'}]),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});}

 return json({cases:rows.map(c=>visibleCase(a,c)),generated_at:now(),scope:a.role});
}

export async function handle(req:Request,e:ApiEnv):Promise<Response>{
 try{
  const url=new URL(req.url),path=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);if(!e.DB||!e.BUCKET)throw new AppError('The workspace is being prepared. Retry shortly.',503);
  if(req.method!=='GET')checkOrigin(req);
  if(path[0]==='health')return json({ok:true,version:'1.0.0',storage:'Bound',authentication:'Required for records'});
  if(path[0]==='setup'&&req.method==='POST'&&e.INITIALIZATION_TOKEN&&req.headers.get('x-initialization-token')===e.INITIALIZATION_TOKEN)return json(await setupStep(e,'workspace-initialisation'));
  const a=await actorFor(req,e,path[0]==='session');
  if(path[0]==='session')return json({actor:a,preferences:await one<any>(e,'SELECT payload FROM preferences WHERE user_id=?',a.id)});
  if(path[0]==='setup'){
   if(req.method==='POST'){if(!a.isOwner)throw new AppError('The application owner must prepare the source register.',403);return json(await setupStep(e,a.id));}
   const job=await one<any>(e,'SELECT status,completed,total,error FROM jobs WHERE id=?','initial-source-import');return json({ready:job?.status==='Complete',completed:job?.completed||0,total:job?.total||encryptedSeed.count,can_initialize:a.isOwner,error:job?.error||null});
  }
  if(path[0]==='dashboard')return json(await dashboard(e,a));
  if(path[0]==='collections'){
   const scope=caseScope(a);let rows=await all<any>(e,`SELECT r.*,c.reference case_reference,c.category,c.board,c.details scope_details FROM records r JOIN cases c ON c.id=r.case_id WHERE ${scope.sql} ORDER BY r.created_at DESC LIMIT 600`,...scope.args);
   if(a.role==='Citizen')rows=rows.filter(r=>{const d=parseValues(r.scope_details);return citizenRecord(r)&&(!['decision','atr'].includes(r.type)||r.id===d.publishedDecisionId||r.id===d.publishedAtrId);});rows=rows.map(({scope_details,...row})=>row);if(a.role==='Developer')rows=rows.filter(r=>respondentRecord(r)&&(['hearing','review_hearing'].includes(r.type)||r.author_id===a.id)).map(r=>['hearing','review_hearing'].includes(r.type)?{...r,values:JSON.stringify(Object.fromEntries(Object.entries(parseValues(r.values)).filter(([k])=>['Hearing purpose','Hearing date','Review date','Venue / approved mode','Respondent notice summary'].includes(k))))}:r);
   if(a.role==='Leadership'||(a.role==='Audit'&&!a.canRestricted))rows=rows.map(r=>({...r,values:JSON.stringify({summary:r.type+' · '+r.status})}));
   return json({records:rows});
  }
  if(path[0]==='cases'&&!path[1])return json(await readCases(e,a,url));
  if(path[0]==='cases'&&path[1])return json(await readCase(e,a,path[1]));
  if(path[0]==='drafts'){requireRole(a,['Citizen','Intake']);return json({drafts:await all<CaseRow>(e,'SELECT * FROM cases WHERE citizen_id=? AND kind=? ORDER BY updated_at DESC',a.id,'draft')});}
  if(path[0]==='draft'&&req.method==='POST')return json(await saveDraft(e,a,await body(req)));
  if(path[0]==='actions'&&req.method==='POST')return json(await action(e,a,await body(req)));
  if(path[0]==='evidence'&&req.method==='POST')return json(await uploadEvidence(e,a,req));
  if(path[0]==='evidence'&&path[1]&&req.method==='GET')return await downloadEvidence(e,a,path[1],url);
  if(path[0]==='imports'&&req.method==='POST'&&!path[1])return json(await stageImport(e,a,req));
  if(path[0]==='imports'&&path[1]){
   if(path[2]==='mapping'&&req.method==='POST')return json(await remapImport(e,a,path[1],await body(req)));
   if(path[2]==='commit'&&req.method==='POST')return json(await commitImport(e,a,path[1]));
   if(path[2]==='download'){requireRole(a,['Admin','Intake']);const b=await one<any>(e,'SELECT * FROM imports WHERE id=?',path[1]);if(!b)throw new AppError('Original export unavailable.',404);const obj=await e.BUCKET.get(b.object_key);if(!obj)throw new AppError('Original export bytes unavailable.',404);return new Response(obj.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(b.filename)}`,'Cache-Control':'private, no-store'}});}
   if(path[2]==='exceptions'){requireRole(a,['Admin','Intake','Audit']);const rows=await all<any>(e,'SELECT row_number,error FROM import_rows WHERE import_id=? AND error IS NOT NULL ORDER BY row_number',path[1]);return new Response(safeCsv(['Source row','Exception'],rows.map(r=>[r.row_number,r.error])),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="import-exceptions.csv"','Cache-Control':'private, no-store'}});}
   return json(await importDetail(e,a,path[1]));
  }
  if(path[0]==='imports'){requireRole(a,['Admin','Intake','Audit','Supervisor']);return json({imports:await all<any>(e,'SELECT id,source,filename,checksum,row_count,accepted,updated,unchanged,rejected,status,created_at FROM imports ORDER BY created_at DESC LIMIT 100')});}
  if(path[0]==='directory'){requireRole(a,['Admin','Intake','Officer','Supervisor','Review','Audit']);const members=await all<any>(e,'SELECT id,email,name,roles,boards,active,is_owner,auth_id FROM members ORDER BY name');return json({members:['Admin','Intake'].includes(a.role)?members:members.filter(m=>JSON.parse(m.roles).some((r:string)=>!['Citizen','Developer'].includes(r)))});}
  if(path[0]==='configs'){requireRole(a,['Admin','Intake','Officer','Supervisor','Review','Audit']);return json({configs:await all<any>(e,'SELECT * FROM configs ORDER BY updated_at DESC LIMIT 300')});}
  if(path[0]==='jobs'){requireRole(a,['Admin','Intake','Supervisor','Audit']);return json({jobs:await all<any>(e,'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100')});}
  if(path[0]==='notifications'){
   if(req.method==='POST'){const p=await body(req);await run(e,'UPDATE notifications SET read_at=? WHERE id=? AND user_id=?',now(),str(p.id),a.id);return json({ok:true});}
   return json({notifications:await all<any>(e,'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100',a.id)});
  }
  if(path[0]==='events'){requireRole(a,['Admin','Audit','Supervisor']);const scope=caseScope(a);return json({events:await all<any>(e,`SELECT ev.id,ev.case_id,ev.kind,ev.actor_id,ev.actor_role,ev.message,ev.created_at,c.reference FROM events ev LEFT JOIN cases c ON c.id=ev.case_id WHERE ev.case_id IS NULL OR (${scope.sql}) ORDER BY ev.id DESC LIMIT 250`,...scope.args)});}
  if(path[0]==='export')return await exportResponse(e,a,url);
  if(path[0]==='knowledge'){
   requireRole(a,['Admin','Officer','Review','Supervisor']);const q=str(url.searchParams.get('q')).toLowerCase();const entries=await all<any>(e,"SELECT * FROM configs WHERE key LIKE 'knowledge:%' ORDER BY updated_at DESC");const sources=entries.filter(r=>{const p=parseValues(r.payload);return p['Approved source']===true&&(!q||str(p['Knowledge title']).toLowerCase().includes(q)||str(p['Knowledge text']).toLowerCase().includes(q));}).slice(0,8).map(r=>{const p=parseValues(r.payload);return {id:r.key,title:p['Knowledge title'],version:r.version,reference:p['Source reference'],text:str(p['Knowledge text']).slice(0,3500)}});return json({sources,mode:'Controlled policy retrieval',message:sources.length?'Review the approved source version and applicability.':'No approved source matches. Add controlled sources in Administration > AI & knowledge.'});
  }
  throw new AppError('This application operation was not found.',404);
 }catch(error){const status=error instanceof AppError?error.status:500;if(status===500){const message=error instanceof Error?error.message:'Unknown failure';console.error('MHADA operation failed',message.replace(/'[^']*'/g,"'[redacted]'").replace(/\b\d{7,}\b/g,'[number]').slice(0,280));}return json({error:error instanceof AppError?error.message:'This operation could not complete. Your saved work is retained; retry or review the exception.'},status);}
}
