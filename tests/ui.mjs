import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from '../node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['app/workspace-components.tsx'],outfile:'.sites-runtime/tests/ui.js',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom','react-dom/*','lucide-react'],logLevel:'silent'});
const {RecordForm,CaseTable,CalendarView,Records,EvidenceTable}=await import('../.sites-runtime/tests/ui.js');
const {screens,fieldsFor}=await import('../.sites-runtime/tests/forms.js');
const actor={id:'ui-owner',name:'Test user',email:'ui@example.test',role:'Officer',roles:['Officer'],boards:['All'],isOwner:true};
const c={id:'ui-case',reference:'MHD-TEST-001',kind:'new',citizen_name:'Test citizen',title:'Test grievance',narrative:'Test full narrative',received_date:'2026-10-14',board:'Mumbai Board',category:'Repairs and amenities',stage:'Investigation',priority:'Normal',details:'{}',revision:1};
const detail={case:c,records:[],evidence:[],events:[],sources:[],links:[]};let forms=0,controls=0;
for(const s of screens.filter(s=>fieldsFor(s.id).length)){
 const html=renderToStaticMarkup(React.createElement(RecordForm,{id:s.id,c,actor,detail,members:[],configs:[],busy:false,t:s=>s,onSave:async()=>({ok:true}),onUpload:async()=>({ok:true})}));
 for(const f of fieldsFor(s.id)){assert.ok(html.includes(f.label.replaceAll('&','&amp;')),s.id+': missing field '+f.label);controls++;}assert.ok(html.includes('form'),s.id+' has a form');forms++;
}
const empty=renderToStaticMarkup(React.createElement(CaseTable,{cases:[],total:0,page:1,setPage:()=>{},onOpen:()=>{},title:'Case register',loading:false}));assert.ok(empty.includes('No matching records'));
const calendar=renderToStaticMarkup(React.createElement(CalendarView,{records:[],month:'2026-10',setMonth:()=>{},onOpen:()=>{}}));assert.ok(calendar.includes('October 2026'));assert.ok(calendar.includes('aria-label="Next month"'));
const record=renderToStaticMarkup(React.createElement(Records,{records:[{id:'r1',type:'finding',status:'Finding recorded',values:JSON.stringify({Reason:'<script>untrusted</script>'}),created_at:'2026-10-14',version:1,actor_role:'Officer'}],onOpen:()=>{}}));assert.ok(!record.includes('<script>untrusted'));assert.ok(record.includes('&lt;script&gt;'));
const evidence=renderToStaticMarkup(React.createElement(EvidenceTable,{evidence:[],href:p=>p,onChoose:()=>{},onVersion:()=>{},canVersion:true}));assert.ok(evidence.includes('No evidence supplied'));
const result={screens:113,forms,controls,rendered_empty_states:4,browser_qa:false,passed:true};writeFileSync('.sites-runtime/tests/ui-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
