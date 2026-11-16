import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {build} from '../node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/service.ts','lib/forms.ts','lib/files.ts','lib/policy.ts'],outdir:'.sites-runtime/tests',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {handle}=await import('../.sites-runtime/tests/service.js');
const {fieldsFor}=await import('../.sites-runtime/tests/forms.js');
const {workbook,normalise,safeCsv}=await import('../.sites-runtime/tests/files.js');
const {calculateDue}=await import('../.sites-runtime/tests/policy.js');
class Prepared{
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args){return new Prepared(this.db,this.sql,args);}
 async first(column){const row=this.db.prepare(this.sql).get(...this.args)||null;return column?row?.[column]:row;}
 async all(){return {results:this.db.prepare(this.sql).all(...this.args),success:true,meta:{}};}
 async run(){const r=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
}
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
const DB={prepare:sql=>new Prepared(sqlite,sql),async batch(stmts){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of stmts)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const objects=new Map();const BUCKET={async put(key,value){objects.set(key,new Uint8Array(value));},async get(key){const value=objects.get(key);return value?{body:new Blob([value]).stream()}:null;},async delete(key){objects.delete(key);}};
const sourceRoot=resolve(process.env.MHADA_TEST_SOURCE_DIR||'data/original');const seed={records:[],files:[],cutoff:'2026-10-14'};
for(const [name,portal] of [['ReportGrievance Aaple sarkar.xlsx','Aaple Sarkar'],['PgPortalReportGrievance.xlsx','PG Portal']]){
 const bytes=readFileSync(resolve(sourceRoot,name)),book=await workbook(bytes,name),result=normalise(book.rows,portal);assert.equal(result.errors.length,0,'Baseline must parse without exceptions');seed.records.push(...result.valid);seed.files.push({name,source:portal,bytes:bytes.toString('base64'),checksum:await hash(bytes),rows:book.rows.length});
}
assert.equal(seed.records.length,1935);for(const row of seed.records)if(row.nog&&/^\d+(?:\.\d+)?$/.test(row.nog))row.nog=Number(row.nog);const totals={};for(const r of seed.records)totals[r.board]=(totals[r.board]||0)+1;
assert.deepEqual(totals,{'MHADA VP/CEO office family':1015,'Mumbai Board':458,'Repairs / Reconstruction Board':206,'Konkan Board':132,'Pune Board':65,'Other office families':59});
const env={DB,BUCKET,OWNER_EMAIL:'owner@example.test',testSeed:seed};
const owner={id:'owner-test',email:'owner@example.test'},citizen={id:'citizen-test',email:'citizen@example.test'},other={id:'other-test',email:'other@example.test'},developer={id:'developer-test',email:'developer@example.test'};
let checks=0;const good=(value,msg)=>{assert.ok(value,msg);checks++;};
async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function request(path,{user=owner,role='Leadership',method='GET',data,form,expect=200}={}){
 const headers={'oai-authenticated-user-id':user.id,'oai-authenticated-user-email':user.email,'x-workspace-role':role,origin:'https://mhada.test'};if(data)headers['content-type']='application/json';const response=await handle(new Request('https://mhada.test/api/'+path,{method,headers,body:form||data&&JSON.stringify(data)}),env);const content=response.headers.get('content-type')||'',result=content.includes('json')?await response.json():await response.text();assert.equal(response.status,expect,`${method} ${path}: ${JSON.stringify(result).slice(0,220)}`);checks++;return result;
}
function values(screen,overrides={}){const v={};for(const f of fieldsFor(screen)){if(f.kind==='check')v[f.label]=f.required;else if(f.kind==='multi')v[f.label]=f.options.slice(0,1);else if(f.kind==='select'&&f.options.length)v[f.label]=f.options[0];else if(f.kind==='date')v[f.label]='2026-10-14';else if(f.kind==='number')v[f.label]=1;else if(f.kind==='email')v[f.label]=f.required?owner.email:'';else if(f.kind!=='file')v[f.label]=f.required?'Test '+f.label:'';}return {...v,...overrides};}
async function action(screen,caseId,v,options={}){let revision;if(caseId){const row=sqlite.prepare('SELECT revision FROM cases WHERE id=?').get(caseId);revision=row?.revision;}return request('actions',{user:options.user||owner,role:options.role||screenRole(screen),method:'POST',data:{screen,case_id:caseId,revision,values:values(screen,v),key:options.key||crypto.randomUUID()},expect:options.expect||200});}
function screenRole(s){return ({C:'Citizen',I:'Intake',O:'Officer',V:'Supervisor',D:'Developer',R:'Review',T:'Admin',S:'Leadership'})[s[0]]||'Supervisor';}
async function evidence(caseId,user=citizen,role='Citizen',classification='Normal',previous){const form=new FormData();form.set('case_id',caseId);form.set('file',new File(['%PDF-1.4\nTest evidence original\n%%EOF'],'proof.pdf',{type:'application/pdf'}));form.set('description','Checked payment proof');form.set('classification',classification);if(previous){form.set('previous_id',previous);form.set('version_reason','Corrected supporting proof');}return request('evidence',{method:'POST',form,user,role});}
console.log('Testing original sources, schema, access, imports and workflow…');
await request('session');await request('session',{user:citizen,role:'Citizen'});await request('session',{user:other,role:'Citizen'});await request('session',{user:developer,role:'Citizen'});
await request('cases',{user:citizen,role:'Admin',expect:403});
let progress;do{progress=await request('setup',{method:'POST'});}while(!progress.ready);
const baseline=await request('dashboard');good(baseline.total===1935,'Historical cases reconciled');good(baseline.provisional_active===349,'Source nonterminal baseline');good(baseline.source_terminal===1586,'Source terminal baseline');good(baseline.narrative_pending===1935,'All historical narratives need full retrieval');good(baseline.verified_remedies===0,'No relief inferred');
good(baseline.source_files===2&&baseline.source_rows===1935&&baseline.source_snapshots===1935,'All source lineage aggregates reconcile');
good(baseline.sources.find(x=>x.label==='Aaple Sarkar')?.count===1653&&baseline.sources.find(x=>x.label==='PG Portal')?.count===282,'Source composition reconciles');
good(baseline.operational.historical===1935&&baseline.operational.visible_truncation===1846,'Historical quality metrics use actual preserved values');
good(baseline.operational.source_input_forwarded===167&&baseline.operational.source_input_received===6&&baseline.operational.handoffs===31,'Input and handoff source labels stay distinct');
good(baseline.operational.completed_clocks===0&&baseline.operational.remedy_eligible===0,'No eligible SLA or remedy denominator is fabricated');
await request('cases?filter=source-nonterminal').then(x=>good(x.total===349,'Non-terminal KPI link matches its source cohort'));
await request('setup',{method:'POST'});good(sqlite.prepare('SELECT COUNT(*) n FROM cases').get().n===1935,'Initialisation idempotent');good(objects.size===2,'Original files preserved');
await request('cases',{user:citizen,role:'Citizen'}).then(x=>good(x.total===0,'Citizen cannot list historical PII'));
const registration=values('C03',{'Subject':'Test roof repair grievance','Affected person':'Test citizen','What happened?':'A documented roof leak affecting the unit.','Requested outcome':'Inspect and repair the roof.','Service category':'Repairs and amenities'});
const draft=await request('draft',{user:citizen,role:'Citizen',method:'POST',data:{screen:'C03',values:registration,partial:false}});const id=draft.case_id;
await request('draft',{user:citizen,role:'Citizen',method:'POST',data:{screen:'C04',case_id:id,values:values('C04',{Board:'Mumbai Board'}),partial:false}});
await evidence(id);await request('draft',{user:citizen,role:'Citizen',method:'POST',data:{screen:'C06',case_id:id,values:values('C06',{Declaration:true}),partial:false}});
const regKey=crypto.randomUUID();const registered=await action('M01',id,{'Citizen confirmation':true},{user:citizen,role:'Citizen',key:regKey});good(registered.reference.startsWith('MHD-'),'Permanent acknowledgement');await request('cases/'+id,{user:other,role:'Citizen',expect:404});
await action('I07',id,{Category:'Repairs and amenities',Priority:'Normal'});
await action('I08',id,{'Case owner':owner.id,Board:'Mumbai Board','Lead office':'Mumbai Board','Respondent account email':developer.email});
await action('T03',null,{'Account email':developer.email,'Application role':'Developer','Permitted board':'Mumbai Board','Access enabled':true});
await action('O04',id,{Acceptance:'Accept','Jurisdiction check':true,'Conflict check':true});
await action('O03',id,{'Add an issue':'Leaking roof','Issue reference':'ISS-001','Requested remedy':'Repair and inspect'});
const issue=sqlite.prepare("SELECT id FROM records WHERE case_id=? AND type='issue'").get(id).id,proof=sqlite.prepare('SELECT id FROM evidence WHERE case_id=?').get(id).id;
await action('O13',id,{'Evidence references':proof,'Issue reference':issue},{expect:400});
await action('O09',id,{'Evidence reference':proof,'Page citation':'1','Document checked':true});
await action('O13',id,{'Evidence references':proof,'Issue reference':issue,'Finding category':'Substantiated','Reasoned finding':'The inspected records support the roof repair claim.'});
await action('O15',id,{'Action reference':'unapproved','Execution result':'Completed - requires verification','Implementation evidence':proof},{expect:400});
await action('O14',id,{'Issue reference':issue,'Proposed outcome':'Authorised remedy','Proposed action':'Repair the leaking roof','Implementation due date':'2026-11-05'});
await action('V06',id,{'Decision':'Approve','Authority confirmed':true},{expect:403});
await action('T02',null,{'Account email':owner.email,'Application role':'Supervisor','Permitted board':'All','Current officer':'Test Owner','Delegated authority':'Test authority record D-01','Effective from':'2026-01-01','Effective until':'2027-12-31','Delegation scope':['Decision approval','Payment authorisation','Review authority','Deadline exceptions'],'Delegation approved':true});
await action('V06',id,{'Decision':'Approve','Authority confirmed':true});
let remedy=sqlite.prepare("SELECT id FROM records WHERE case_id=? AND type='action'").get(id).id;
await action('O16',id,{'Action checked':remedy,'Evidence reference':proof,'Implementation conclusion':'Verified'},{expect:400});
await action('O15',id,{'Action reference':remedy,'Execution result':'Completed - requires verification','Implementation evidence':proof});
await action('O16',id,{'Action checked':remedy,'Evidence reference':proof,'Implementation conclusion':'Verified','Verification method':'Inspection','Observed result':'Roof inspected after documented repair.'});
await action('V08',id,{'Closure authority confirmed':true},{expect:400});
await action('O17',id,{'Grievance summary':'Roof leak reported','Investigation and evidence':'Inspection record and checked proof','Findings and decision':'Repair approved','Implemented action / limitations':'Repair completed; inspection verified','Challenge route':'Request reconsideration in the citizen portal'});
await action('V07',id,{'Reviewer conclusion':'Approve ATR','All issues checked':true});
await action('O18',id,{'Safe channel':'In-app','Message content':'Decision and ATR are available.','Recipient':'Registered citizen'});
const published=await request('cases/'+id,{user:citizen,role:'Citizen'});good(published.records.some(r=>r.type==='atr'),'Published ATR visible');good(!('Routing reason' in JSON.parse(published.case.details)),'Staff routing details not exposed');
await action('V08',id,{'Closure authority confirmed':true},{expect:400});
await action('C11',id,{'Did the remedy reach you?':'Yes','Handling satisfaction':'4 - Satisfied'},{user:citizen});
await action('V08',id,{'Closure authority confirmed':true,'Approval reason':'All approved actions verified and citizen confirmed.','Internal closure outcome':'Implemented and verified'});
const closed=await request('cases/'+id);good(closed.case.outcome==='Implemented and verified','Approved verified closure');good(closed.case.source_status==='Submitted','Source label retained through closure');
await action('O03',id,{'Issue reference':'ISS-002','Requested remedy':'Unapproved new work'},{expect:400});
await action('C12',id,{Mechanism:'Reconsideration','Grounds for challenge':'New material about recurring leakage','Requested correction':'Review further repair need'},{user:citizen});
await action('R02',id,{'Admissibility conclusion':'Admitted'});await action('R03',id,{'Independent assessment':'Review evidence and original decision.','Evidence references':proof});await action('R06',id,{'Review conclusion':'Modify decision','Ordered action':'Inspect recurring leak','Executor account email':owner.email,'Ordered action due date':'2026-11-10'});
good(sqlite.prepare("SELECT COUNT(*) n FROM records WHERE case_id=? AND type='review_action'").get(id).n===1,'Review creates action without overwriting original decision');
const rv=sqlite.prepare("SELECT id FROM records WHERE case_id=? AND type='review_action'").get(id).id;await action('R07',id,{'Action reference':rv,'Follow-up result':'Verified','Evidence reference':proof},{expect:400});await action('R07',id,{'Action reference':rv,'Follow-up result':'Completed - requires verification','Evidence reference':proof});await action('R07',id,{'Action reference':rv,'Follow-up result':'Verified','Evidence reference':proof});
const secret=await evidence(id,owner,'Officer','Restricted');await request('evidence/'+secret.id,{user:citizen,role:'Citizen',expect:404});await request('evidence/'+proof,{user:other,role:'Citizen',expect:404});await request('export?case='+id,{user:other,role:'Citizen',expect:404});
await action('O11',id,{'Hearing purpose':'Unauthorised after closure'},{expect:400});
await evidence(id,citizen,'Citizen','Normal',proof);good(sqlite.prepare('SELECT COUNT(*) n FROM evidence WHERE previous_id=?').get(proof).n===1,'New immutable evidence version');good(sqlite.prepare('SELECT checksum FROM evidence WHERE id=?').get(proof).checksum,'Original evidence retained');
const original=new FormData();original.set('source','Aaple Sarkar');original.set('file',new File([readFileSync(resolve(sourceRoot,seed.files[0].name))],seed.files[0].name));const repeated=await request('imports',{role:'Intake',method:'POST',form:original});good(repeated.duplicate,'Identical source reconciled without cases');good(sqlite.prepare('SELECT COUNT(*) n FROM cases').get().n===1936,'No duplicate historical cases');
const historical=sqlite.prepare("SELECT id FROM cases WHERE source_status='Assigned' LIMIT 1").get().id;await action('I08',historical,{'Case owner':owner.id,'Lead office':'Mumbai Board',Board:'Mumbai Board'});await action('O04',historical,{Acceptance:'Accept'});await action('O03',historical,{'Issue reference':'H-1','Add an issue':'Historical complaint','Requested remedy':'Retrieve record'});await action('O13',historical,{'Issue reference':issue,'Evidence references':proof},{expect:400});
const stale=await request('cases/'+historical,{role:'Intake'});await action('I06',historical,{'Complete original narrative':'Complete test narrative retrieved from original case record','Retrieval source':'Original case file test','Full text confirmed':true});await request('actions',{role:'Intake',method:'POST',expect:409,data:{screen:'I07',case_id:historical,revision:stale.case.revision,values:values('I07'),key:crypto.randomUUID()}});
const p={'Approved policy':true,'Day duration':2,'Day-count convention':'Exclude receipt day','Day counting':'Working days'},cal={'Calendar approved':true,'Working days':'Monday to Friday'};good(calculateDue('2026-10-16',p,cal,['2026-10-19'])==='2026-10-21','Working calendar and holiday arithmetic');good(calculateDue('2026-10-16',{...p,'Approved policy':false},cal,[])===null,'Draft policy cannot invent deadlines');
good(safeCsv(['Test'],[[' \t=1+1']]).includes("' \t=1+1"),'CSV formula prefix escaped');
const unauth=await handle(new Request('https://mhada.test/api/cases'),env);good(unauth.status===401,'Anonymous access rejected');
const emailOwner=await handle(new Request('https://mhada.test/api/session',{headers:{'oai-authenticated-user-email':owner.email}}),env);good(emailOwner.status===200,'Verified private owner compatibility');const emailCitizen=await handle(new Request('https://mhada.test/api/session',{headers:{'oai-authenticated-user-email':citizen.email}}),env);good(emailCitizen.status===401,'Non-owner still requires stable platform identity');
// A later batch has its own population, including a rejected duplicate and receipt conflict.
const baseRaw={...seed.records[0].raw,'तक्रार टोकन':'FUTURE-TEST-001','स्थिती':'Assigned'};const headers=Object.keys(baseRaw),futureRows=[baseRaw,{...baseRaw},{...baseRaw,'तक्रार टोकन':'FUTURE-TEST-002','दाखल केले':'invalid-date'}];
const futureForm=new FormData();futureForm.set('source','Aaple Sarkar');futureForm.set('file',new File([safeCsv(headers,futureRows.map(r=>headers.map(h=>r[h])))],'future-test.csv'));
const future=await request('imports',{role:'Intake',method:'POST',form:futureForm});good(future.valid===1&&future.rejected===2,'Future batch validates its own row count');
let committed;do{committed=await request('imports/'+future.id+'/commit',{role:'Intake',method:'POST'});}while(!committed.ready);
const batchInfo=await request('imports/'+future.id,{role:'Intake'});good(batchInfo.batch.accepted===1&&batchInfo.batch.rejected===2,'Rejected-row counters reconcile exactly');await request('imports/'+future.id+'/commit',{role:'Intake',method:'POST'});good(sqlite.prepare('SELECT COUNT(*) n FROM cases').get().n===1937,'Resuming a committed batch preserves unique cases');
await action('T06',null,{'Calendar name':'TestCalendar','Working days':'Monday to Friday','Calendar approved':true,'Calendar version':'1','Approval reference':'Test calendar authority','Holiday date':''});
await action('T05',null,{'Source / procedure':'Aaple Sarkar','Policy reference':'Test SLA authority','Calendar':'TestCalendar','Day duration':21,'Day counting':'Working days','Approved policy':true,'Policy effective date':'2026-01-01','Version / effective date':'v1'});
await action('I07',historical,{Category:'Repairs and amenities',Priority:'Normal'});const clocked=sqlite.prepare('SELECT original_due,due_date,received_date,details FROM cases WHERE id=?').get(historical);good(!!clocked.original_due&&JSON.parse(clocked.details).slaSnapshot.policy._version===1,'Approved policy and calendar snapshot frozen');
await action('T05',null,{'Source / procedure':'Aaple Sarkar','Policy reference':'Test SLA authority','Calendar':'TestCalendar','Day duration':30,'Day counting':'Working days','Approved policy':true,'Policy effective date':'2026-01-01','Version / effective date':'v2'});await action('I07',historical,{Category:'Repairs and amenities',Priority:'Normal'});good(sqlite.prepare('SELECT original_due FROM cases WHERE id=?').get(historical).original_due===clocked.original_due,'Policy revision cannot silently rebase a deadline');
const extension=await action('M05',historical,{'Exception decision':'Request exception','Proposed milestone':'2027-01-10'},{role:'Supervisor'});good(sqlite.prepare('SELECT due_date FROM cases WHERE id=?').get(historical).due_date===clocked.due_date,'Requested exception does not extend due date');await action('M05',historical,{'Exception decision':'Approve exception','Exception reference':extension.record_id,'Proposed milestone':'2027-01-10','Decision reason':'Approved operational exception with authority record'},{role:'Supervisor'});good(sqlite.prepare('SELECT due_date FROM cases WHERE id=?').get(historical).due_date==='2027-01-10','Authorised exception changes current deadline');good(sqlite.prepare('SELECT original_due FROM cases WHERE id=?').get(historical).original_due===clocked.original_due,'Original due date retained after extension');
await action('T03',null,{'Account email':other.email,'Application role':'Officer','Permitted board':'Pune Board','Access enabled':true});await request('cases/'+id,{user:other,role:'Officer',expect:404});await action('T03',null,{'Account email':other.email,'Application role':'Officer','Permitted board':'Pune Board','Access enabled':true,'Revoke selected role':true});await request('cases',{user:other,role:'Officer',expect:403});
await request('export?format=csv&board=Mumbai%20Board').then(csv=>good(!csv.includes('owner@example.test'),'Register exports omit contacts'));
const receipt=await request('export?case='+id+'&format=print',{user:citizen,role:'Citizen'});good(receipt.includes('Print / Save PDF'),'Printable actual case report');
// The redesigned dashboards must obey the same visibility as each party's case records.
for(const [user,role] of [[citizen,'Citizen'],[developer,'Developer']]){
 const dashboard=await request('dashboard',{user,role});
 const own=await request('cases/'+id,{user,role});
 const visible=new Map();for(const row of own.records){const key=row.type+'|'+row.status;visible.set(key,(visible.get(key)||0)+1);}
 good(dashboard.total===1,'Party dashboard contains only the linked case');
 good(dashboard.configuration===null,'Party dashboard does not expose staff configuration');
 good(dashboard.record_statistics.every(r=>visible.get(r.type+'|'+r.status)===r.count)&&dashboard.record_statistics.reduce((n,r)=>n+r.count,0)===own.records.length,'Dashboard record statistics match permitted case visibility');
 good(dashboard.tasks.every(t=>t.case_id===id&&!('values' in t)&&!('author_id' in t)&&!('assignee_id' in t)),'Task cards do not expose raw record payloads or staff identity');
 good(dashboard.evidence_count===own.evidence.length,'Evidence KPIs include only documents visible to this party');
}
const otherDashboard=await request('dashboard',{user:other,role:'Citizen'});good(otherDashboard.total===0&&otherDashboard.tasks.length===0&&otherDashboard.evidence_count===0,'Unlinked citizen has an empty dashboard');
const summary={checks,baseline:1935,total_cases:sqlite.prepare('SELECT COUNT(*) n FROM cases').get().n,original_files:2,workflow:'Registration to verified closure and linked review',browser_qa:'Not available in managed build environment',passed:true};writeFileSync('.sites-runtime/tests/verification.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
