import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from '../node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/navigation.ts','lib/route-return.ts','lib/metrics.ts','app/modern-components.tsx'],outdir:'.sites-runtime/tests/navigation',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom','react-dom/*','lucide-react'],logLevel:'silent'});
const {navigation,screenRoutes,canOpenScreen,screenUrl,resolveLocation,dialogParent}=await import('../.sites-runtime/tests/navigation/lib/navigation.js');
const {routeReturn}=await import('../.sites-runtime/tests/navigation/lib/route-return.js');
const {headlineMetrics,roleMetricLibrary}=await import('../.sites-runtime/tests/navigation/lib/metrics.js');
const {ModernDashboard,ScreenDirectory,RoleNavigation,MetricsLibrary}=await import('../.sites-runtime/tests/navigation/app/modern-components.js');
const {screens,screenById,fieldsFor}=await import('../.sites-runtime/tests/forms.js');
const roles=Object.keys(navigation),main=screens.filter(s=>s.template!=='modal'),dialogs=screens.filter(s=>s.template==='modal');
let checks=0,roundtrips=0;const good=(ok,message)=>{assert.ok(ok,message);checks++;};
good(screens.length===113&&main.length===101&&dialogs.length===12,'Complete screen inventory');
good(new Set(screenRoutes.map(s=>s.id)).size===113,'Every screen has a unique route descriptor');
for(const role of roles){
 const menu=navigation[role].flatMap(g=>g.screens),expected=main.filter(s=>s.role===role).map(s=>s.id);
 good(new Set(menu).size===menu.length,role+': no repeated menu entries');
 good(expected.length===menu.length&&expected.every(id=>menu.includes(id)),role+': every associated page is in navigation');
 for(const id of menu){
  const html=renderToStaticMarkup(React.createElement(RoleNavigation,{role,screen:id,caseId:'case-linked',batchId:'batch-linked',onNavigate:()=>{}}));
  good(html.includes('/workspace/'+id+'?')&&html.includes('aria-current="page"'),id+': active real page link');
 }
 for(const s of screens){
  const allowed=canOpenScreen(s.id,role,[role]);
  const url=screenUrl(s.id,{role,caseId:'case/one & two',batchId:'batch?one',metrics:true});
  const resolved=resolveLocation(url,role,[role]);
  if(allowed){
   const parent=s.template==='modal'?dialogParent(s.id,role):s.id;
   good(!resolved.denied&&resolved.role===role&&resolved.screen===parent,role+' '+s.id+': role and associated page survive reload');
   good(resolved.caseId==='case/one & two'&&resolved.batchId==='batch?one'&&resolved.metrics,role+' '+s.id+': complete context survives URL encoding');
   good(resolved.dialog===(s.template==='modal'?s.id:''),role+' '+s.id+': dialog restored');
   const legacy=resolveLocation('/?screen='+s.id+'&workspace='+role+'&case=case-legacy',role,[role]);
   good(!legacy.denied&&legacy.screen===parent&&legacy.caseId==='case-legacy',role+' '+s.id+': old links continue working');roundtrips++;
  }else good(resolved.denied,role+' '+s.id+': forbidden workspace does not escalate privileges');
 }
}
for(const s of screens){
 good(!!screenById[s.primary.target]&&!!screenById[s.secondary.target],s.id+': associated action destinations exist');
 if(s.template==='modal')good(!!screenById[dialogParent(s.id)]&&screenById[dialogParent(s.id)].template!=='modal',s.id+': dialog has a real parent page');
 const route=screenRoutes.find(r=>r.id===s.id),resolved=resolveLocation(route.path,'Leadership',roles);
 good(!resolved.denied,s.id+': exported route resolves for assigned owner');
}
good(resolveLocation('/workspace/T03?workspace=Admin','Citizen',['Citizen']).denied,'Query role cannot grant Admin access');
const leadershipOfficer=resolveLocation('/workspace/O03?workspace=Leadership','Leadership',roles);
good(leadershipOfficer.denied&&leadershipOfficer.role==='Leadership'&&leadershipOfficer.screen==='L01','An officer screen opened as Leadership stays in Command centre');
const ownerDirectory=renderToStaticMarkup(React.createElement(ScreenDirectory,{actor:{id:'owner',name:'Owner',email:'owner@example.test',role:'Leadership',roles,boards:['All'],isOwner:true},role:'Leadership',caseId:'one',batchId:'two',onNavigate:()=>{}}));
const ownerLinks=[...ownerDirectory.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
good(ownerLinks.length>0&&ownerLinks.every(url=>url.includes('workspace=Leadership'))&&!ownerDirectory.includes('O03')&&!ownerDirectory.includes('I06'),'A multi-role directory lists only the current workspace');
good(resolveLocation('/workspace/ZZ99','Officer',['Officer']).denied,'Unknown screens fall back safely');
good(resolveLocation('/workspace/O02?dialog=T03','Officer',['Officer']).denied,'Page IDs cannot be injected as dialogs');
const signInReturn=routeReturn('/workspace/O09',{case:'case one',workspace:'Officer',dialog:'M02',q:'rent & repair',page:'2',ignored:'not needed'});
good(signInReturn.includes('case=case+one')&&signInReturn.includes('dialog=M02')&&!signInReturn.includes('ignored'),'Sign-in retains encoded task context only');
const empty={total:0,provisional_active:0,source_terminal:0,ownership_gaps:0,narrative_pending:0,verified_remedies:0,internally_closed:0,statuses:[],stages:[],boards:[],categories:[],cohorts:[],properties:[],sources:[],record_statistics:[],operational:{},source_files:0,source_rows:0,source_snapshots:0,evidence_count:0,configuration:null,tasks:[],source_cutoff:'2026-10-14',refreshed_at:'2026-10-15T00:00:00Z'};
const baseline={...empty,total:1935,provisional_active:349,source_terminal:1586,ownership_gaps:349,narrative_pending:1935,source_files:2,source_rows:1935,source_snapshots:1935,sources:[{label:'Aaple Sarkar',count:1653},{label:'PG Portal',count:282}],statuses:[{label:'Auto Closed',count:1040},{label:'Closed',count:269},{label:'Resolved',count:277}],operational:{historical:1935,missing_nog:3,visible_truncation:1846},boards:[{label:'Mumbai Board',count:458}]};
for(const role of roles){
 const metrics=headlineMetrics(role,empty);good(metrics.length===4,role+': four actionable headline KPIs');
 for(const metric of metrics)good(canOpenScreen(metric.target,role,[role]),role+': headline links to permitted page '+metric.target);
 good(roleMetricLibrary(role,baseline).length===12,role+': all 12 design KPIs retained');
 for(const data of [empty,baseline]){
  const html=renderToStaticMarkup(React.createElement(ModernDashboard,{role,data,onNavigate:()=>{},onMetric:()=>{},onCase:()=>{},onMetrics:()=>{}}));
  good(html.includes('metrics-grid')&&html.includes('View all 12 workspace KPIs'),role+': live and empty dashboards render');
 }
 const lib=renderToStaticMarkup(React.createElement(MetricsLibrary,{role,data:empty,onNavigate:()=>{}}));
 good(lib.includes('Evidence / configuration required')&&lib.includes('N/A'),role+': unavailable measures stay explicit');
 const actor={id:'directory-test',name:'Test user',email:'test@example.test',role,roles:[role],boards:['All'],isOwner:false};
 const directory=renderToStaticMarkup(React.createElement(ScreenDirectory,{actor,role,caseId:'one',batchId:'two',onNavigate:()=>{}}));
 const links=[...directory.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
 good(links.length>0&&links.every(url=>!resolveLocation(url,role,[role]).denied),role+': every visible directory link works under actual role permissions');
}
good(roleMetricLibrary('Shared',empty).length===12,'Shared services retains all 12 measures');
good(headlineMetrics('Leadership',baseline).find(x=>x.label==='Verified remedy rate').value===null,'Historical terminal labels do not invent a verified remedy rate');
good(headlineMetrics('Supervisor',baseline).find(x=>x.label==='SLA compliance').value===null,'No approved completed clocks means N/A');
const formsModule=readFileSync('app/workspace-components.tsx','utf8');
good(formsModule.includes("id={'record-form-'+id}")&&formsModule.includes('id="source-import-form"')&&formsModule.includes('id="source-mapping-form"'),'External page actions target actual form IDs');
const layout=readFileSync('app/globals.css','utf8');
good(layout.includes('.sidebar.mobile-open')&&layout.includes('@media(max-width:720px)')&&layout.includes('focus-visible'),'Mobile menu, responsive layout and keyboard focus styles exist');
const result={checks,page_routes:main.length,contextual_dialogs:dialogs.length,role_context_roundtrips:roundtrips,workspaces:roles.length,kpi_definitions:120,browser_qa:false,passed:true};
writeFileSync('.sites-runtime/tests/navigation-verification.json',JSON.stringify(result,null,2));
mkdirSync('docs',{recursive:true});
writeFileSync('docs/screen-route-map.json',JSON.stringify({design_version:'2.0',screens:screenRoutes.map(s=>({...s,field_count:fieldsFor(s.id).length}))},null,2));
console.log(JSON.stringify(result));
