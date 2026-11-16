import definitions from './screen-definitions.json';
import { BOARDS,CATEGORIES,ROLES,type Screen,type Field,type Values,type CaseRow,parseValues } from './types';
export const screens=definitions.screens as unknown as Screen[];
export const screenById=Object.fromEntries(screens.map(s=>[s.id,s]));
export const home:Record<string,string>={Shared:'S01',Citizen:'C02',Intake:'I01',Officer:'O01',Supervisor:'V01',Developer:'D01',Review:'R01',Leadership:'L01',Audit:'A01',Admin:'T01'};
export const roleNames:Record<string,string>={Citizen:'Citizen portal',Intake:'Intake & nodal desk',Officer:'Case officer',Supervisor:'Supervisor',Developer:'Developer / respondent',Review:'Independent review',Leadership:'Command centre',Audit:'Audit & evidence',Admin:'Administration',Shared:'Shared services'};
export const titles:Record<string,string>={L01:'Grievance command centre',C01:'Every grievance deserves a clear response.',C02:'My grievances',I01:'Intake control desk',O01:'My work & next actions',V01:'Board operations',D01:'My authorised cases',R01:'Independent review queue',A01:'Audit control centre',T01:'Organisation & jurisdiction'};
const field=(label:string,kind='text',required=false,options:string[]=[]):Field=>({label,kind,required,options,value:''});
const extras:Record<string,Field[]>={
 C03:[field('Subject','text',true),field('Original language','select',true,['English','Marathi','Hindi']),field('Representative relationship')],
 C04:[field('Developer / respondent account email')],
 I12:[field('Subject','text',true),field('Requested outcome','long',true)],
 I06:[field('Complete original narrative','long',true),field('Retrieval source','text',true),field('Full text confirmed','check',true),field('Verified citizen account email','email'),field('Identity verification reference'),field('Citizen identity verified','check')],
 I08:[field('Respondent account email')],
 O03:[field('Issue reference','text',true)],
 O08:[field('Choose file','file',true),field('Evidence description','long',true),field('Evidence classification','select',true,['Normal','Restricted']),field('Citizen-safe copy','check'),field('Respondent-safe copy','check')],
 O09:[field('Evidence reference','select',true),field('Page citation','text',true),field('Cited fact','long'),field('Document checked','check')],
 O13:[field('Evidence references','select',true),field('Issue reference','select',true)],
 O14:[field('Issue reference','select',true)],
 O15:[field('Action reference','select',true)],
 O16:[field('Evidence reference','select',true)],
 V06:[field('Authority confirmed','check',true)],
 V07:[field('All issues checked','check',true)],
 V08:[field('Closure authority confirmed','check',true)],
 I09:[field('Related case reference','text',true)],
 D04:[field('Period from','date',true),field('Period to','date',true),field('Declared obligation (INR)','number',true),field('Reported payment (INR)','number',true)],
 T02:[field('Account email','email',true),field('Application role','select',true,[...ROLES]),field('Permitted board','select',true,['All',...BOARDS]),field('Delegation scope','multi',true,['Decision approval','Payment authorisation','Review authority','Engineering direction','Estate record correction','Deadline exceptions']),field('Delegation approved','check')],
 O06:[field('Provider account email','email',true)],
 O07:[field('Input task reference','select',true),field('Received reply','long',true),field('Supporting evidence reference','select')],
 T03:[field('Account email','email',true),field('Application role','select',true,[...ROLES]),field('Permitted board','select',true,['All',...BOARDS]),field('Access enabled','check'),field('Revoke selected role','check'),field('Restricted case access','check')],
 T05:[field('Day duration','number',true),field('Day counting','select',true,['Calendar days','Working days']),field('Policy effective date','date'),field('Approved policy','check')],
 T06:[field('Holiday date','date'),field('Calendar approved','check'),field('Calendar version','text')],
 T13:[field('Knowledge title','text',true),field('Knowledge text','long',true),field('Source reference','text',true),field('Approved source','check')],
 R03:[field('Independent assessment','long',true),field('Evidence references','select',true)],
 R06:[field('Executor account email','email'),field('Ordered action due date','date'),field('Issue reference','select')],
 M05:[field('Exception reference','select'),field('Exception decision','select',true,['Request exception','Approve exception','Decline exception']),field('Decision reason','long')],
 M09:[field('Grounds for challenge','long',true),field('Requested correction','long',true)],
 M03:[field('Related case reference','text',true)],
 M08:[field('Hearing reference','select',true)],
 O11:[field('Respondent notice summary','long'),field('Replacement hearing reference','select')],
 O18:[field('Service evidence','file')],
 C11:[field('Decision received?','select',false,['Yes','No','Unable to confirm'])],
 R07:[field('Action reference','select',true),field('Follow-up result','select',true,['Progress recorded','Completed - requires verification','Verified','Failed / disputed']),field('Evidence reference','select'),field('Follow-up notes','long',true)],
 V10:[field('Programme title','text',true),field('Recurring cause','long',true),field('Responsible officer','text',true),field('Target date','date',true),field('Preventive action','long',true)],
 T08:[field('Integration name','text',true),field('Connection mode','select',true,['Manual export import','Approved adapter pending configuration']),field('Responsible office','text',true),field('Reconciliation policy','long',true)],
 L06:[field('Period from','date'),field('Period to','date')],
 T07:[field('Independent approver required','check'),field('Permit closure without citizen confirmation','check'),field('Approval reference','text',true)],
};
const choices:Record<string,string[]>={
 'Source / procedure':['Aaple Sarkar','PG Portal','MHADA Citizen Portal','Assisted intake','Specialised procedure'],
 'Board':BOARDS,'Service category':CATEGORIES,'Category':CATEGORIES,'Priority':['Normal','High','Urgent'],
 'Finding category':['Substantiated','Partly substantiated','Not substantiated on available evidence','Undetermined'],
 'Decision':['Approve','Return for correction','Decline proposal'],'Reviewer conclusion':['Approve ATR','Return for correction'],
 'Did the remedy reach you?':['Yes','Partly','No','Unable to confirm'],'Handling satisfaction':['1 - Very dissatisfied','2 - Dissatisfied','3 - Neutral','4 - Satisfied','5 - Very satisfied'],
 'Was the explanation clear?':['Yes','Partly','No'],'Citizen confirmation':['Confirmed','Disputed','Unavailable'],
 'Internal closure outcome':['Implemented and verified','Reasoned adverse decision','Referral verified','Partial - remaining action'],
 'Proposed outcome':['Authorised remedy','Reasoned adverse decision','Referral to competent authority'],
 'Execution result':['Processing','Completed - requires verification','Failed','Uncertain'],
 'Implementation conclusion':['Verified','Not yet verified','Failed / disputed'],
 'Response completeness':['Complete','Partly complete','Further information required'],
 'Review conclusion':['Confirm original decision','Modify decision','Order further investigation'],
 'Admissibility conclusion':['Admitted','Clarification required','Not admissible - reasons recorded'],
 'Review determination':['Enrichment required','No further local action - reasons recorded','Authorised reconsideration'],
 'Required next action':['Obtain specific evidence','Assign accountable owner','Verify action','Issue progress update'],
 'Review mechanism':['Reopening','Reconsideration','Prescribed appeal'],
 'Safe channel':['In-app','Email (adapter not configured)','SMS (adapter not configured)','Assisted manual contact'],
 'Preferred contact':['Verified email','Assisted callback'],
 'Day-count convention':['Exclude receipt day','Include receipt day'],
 'Clock start':['Original receipt'],
 'Working days':['Monday to Friday','Monday to Saturday','All calendar days'],
 'Evidence type':['Application','Payment receipt','Agreement','Order','Letter','Photograph','Other'],
};
export function fieldsFor(id:string):Field[]{
 const s=screenById[id];if(!s)return [];
 const list=[...s.fields,...(extras[id]||[])];const seen=new Set<string>();
 return list.filter(f=>{if(seen.has(f.label))return false;seen.add(f.label);return true}).map(f=>({...f,value:'',required:f.required||(id==='O03'&&['Add an issue','Requested remedy'].includes(f.label)),options:['Case owner','Lead office','Working days'].includes(f.label)?(choices[f.label]||[]):choices[f.label]||f.options||[]}));
}
export const RECORD_TYPES:Record<string,string>={C09:'clarification',C11:'feedback',C12:'review',C14:'appointment',I06:'enrichment',I07:'triage',I08:'assignment',I09:'related',I10:'urgency',I11:'handoff',O03:'issue',O04:'acceptance',O05:'plan',O06:'input',O07:'input_assessment',O09:'citation',O10:'inspection',O11:'hearing',O12:'minutes',O13:'finding',O14:'proposal',O15:'execution',O16:'verification',O17:'atr',O18:'communication',O19:'knowledge_query',V05:'intervention',V06:'decision',V07:'atr_review',V08:'closure',V09:'legacy_review',V10:'prevention',D03:'respondent_response',D04:'rent_ledger',D05:'hearing_response',D06:'compliance',R02:'admissibility',R03:'review_assessment',R04:'review_material',R05:'review_hearing',R06:'review_decision',R07:'review_action',M03:'related',M04:'decline',M05:'extension',M06:'restricted_referral',M07:'atr_return',M08:'reschedule',M09:'review',M11:'communication_retry'};
export const NAVIGATION_ONLY=new Set(['S01','S02','S03','S04','S05','C01','C02','C07','C08','C10','C13','C14','I01','I02','I03','I04','I05','I13','O01','O02','O08','V01','V02','V03','V04','D01','D02','R01','R08','L01','L02','L03','L04','L05','A01','A02','A03','A04','A05','M10','T08','T09']);
export function valuesForCase(id:string,c:CaseRow|null,user:{name:string;email:string}):Values{
 const base:Values={};const d=c?parseValues(c.details):{};
 for(const f of fieldsFor(id)){
  if(f.kind==='check')base[f.label]=false;
  else if(f.kind==='select')base[f.label]='';
  else base[f.label]='';
 }
 if(c){const narrative=c.narrative||c.preview||'';Object.assign(base,{'Affected person':c.citizen_name||'','Board':c.board,'Category':c.category,'Service category':c.category,'Complete original narrative':narrative,'Original narrative':narrative,'Lead office':c.office||'','Case owner':c.owner_id||'','Priority':c.priority,'Evidence classification':c.restricted?'Restricted':'Normal','Original decision':c.reference,'Decision reference':c.reference});}
 if(!c){base['Affected person']=user.name;base['Submitted by']='Self';base['Preferred contact']='Verified email';base['Original language']='English';}
 if(id==='S06')Object.assign(base,{'Display name':user.name,'Preferred language':'English','Safe contact channel':'Email','Text size':'Standard','High contrast':'Off'});
 for(const f of fieldsFor(id))if(d[f.label]!==undefined)base[f.label]=d[f.label];
 return base;
}
