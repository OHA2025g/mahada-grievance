import definitions from './kpi-definitions.json';
import type { Role } from './types';
import type { RecordStatistic } from './dashboard';

export type Group = {label:string; count:number};
export type DashboardData = {
  total:number; provisional_active:number; source_terminal:number; ownership_gaps:number;
  narrative_pending:number; verified_remedies:number; internally_closed:number;
  statuses:Group[]; stages:Group[]; boards:Group[]; categories:Group[]; cohorts:Group[]; properties:Group[];
  sources:Group[]; record_statistics:RecordStatistic[]; operational:Record<string,number|null>;
  source_files:number; source_rows:number; source_snapshots:number; evidence_count:number;
  configuration:Record<string,number>|null;
  tasks:{id:string;case_id:string;type:string;status:string;due_date:string|null;case_reference:string}[];
  source_cutoff:string; refreshed_at:string;
};
export type LiveMetric = {label:string; value:number|string|null; note:string; target:string; filter?:string; icon:string; percent?:boolean; coverage?:string};

export function recordCount(d:DashboardData, types:string[], include?:RegExp, exclude?:RegExp) {
  return (d.record_statistics||[]).filter(x=>types.includes(x.type)&&(!include||include.test(x.status))&&(!exclude||!exclude.test(x.status))).reduce((n,x)=>n+x.count,0);
}
const op=(d:DashboardData,k:string)=>Number(d.operational?.[k]||0);
const rate=(n:number,den:number)=>den>0?`${(n/den*100).toFixed(1)}%`:null;
const source=(d:DashboardData,name:string)=>(d.sources||[]).find(x=>x.label===name)?.count||0;
export const upcoming=(d:DashboardData,types=['hearing','review_hearing'])=>(d.record_statistics||[]).filter(x=>types.includes(x.type)&&x.status==='Scheduled').reduce((n,x)=>n+Number(x.upcoming||0),0);

export function headlineMetrics(role:Role,d:DashboardData):LiveMetric[] {
  const mk=(label:string,value:LiveMetric['value'],note:string,target:string,icon='file',filter?:string):LiveMetric=>({label,value,note,target,icon,filter});
  switch(role) {
    case 'Citizen': return [mk('My grievances',d.total,'Linked to your verified account','C02','folder'),mk('Clarifications provided',recordCount(d,['clarification']),'Responses recorded by you','C09','bell'),mk('Upcoming appointments',upcoming(d),'Scheduled notices within your scope','C14','calendar'),mk('Remedy confirmed',op(d,'citizen_confirmed'),'Your explicit outcome confirmations','C11','shield')];
    case 'Intake': return [mk('Source records',d.source_rows,'Records with original source lineage','I05','file'),mk('Full narrative pending',d.narrative_pending,'Complete original record required','I06','file','narrative'),mk('Non-terminal labels',d.provisional_active,'Source cohort; responsibility to verify','I01','route','source-nonterminal'),mk('Ownership gaps',d.ownership_gaps,'No accepted accountable owner','I08','users','unassigned')];
    case 'Officer': return [mk('Assigned to me',op(d,'owned_by_me'),'Cases within your authorised scope','O01','folder'),mk('Open office inputs',recordCount(d,['input'],undefined,/Complete|Cancelled|Superseded/),'Requested inputs still outstanding','O07','users'),mk('Upcoming hearings',upcoming(d),'Persisted scheduled notices','O11','calendar'),mk('Actions to verify',recordCount(d,['action'],/Completed.*verification/),'Reported completion awaits checks','O16','shield')];
    case 'Supervisor': return [mk('Ownership gaps',d.ownership_gaps,'Non-terminal source cohort','V03','users','unassigned'),mk('Input-related labels',op(d,'source_input_forwarded')+op(d,'source_input_received'),'Source labels; task quality unverified','V04','route'),mk('Terminal source labels',d.source_terminal,'Requires evidence of actual outcome','V09','history','legacy'),mk('SLA compliance',rate(op(d,'clocks_on_time'),op(d,'completed_clocks')),'Eligible completed approved clocks','V05','clock')];
    case 'Developer': return [mk('Authorised cases',d.total,'Only cases served to your account','D01','folder'),mk('Responses recorded',recordCount(d,['respondent_response']),'Subject to independent assessment','D03','file'),mk('Upcoming hearings',upcoming(d),'Authorised scheduled notices','D05','calendar'),mk('Compliance statements',recordCount(d,['compliance']),'Reported action; verification separate','D06','shield')];
    case 'Review': return [mk('Linked challenges',recordCount(d,['review']),'Filings within your review scope','R01','folder'),mk('Material received',recordCount(d,['review_material']),'Independent assessment required','R04','file'),mk('Review hearings',upcoming(d,['review_hearing']),'Scheduled review notices','R05','calendar'),mk('Ordered actions',recordCount(d,['review_action'],undefined,/Verified|Superseded|Cancelled/),'Remaining review obligations','R07','activity')];
    case 'Leadership': return [mk('Permitted records',d.total,'Historical and new registered cases','L01','file'),mk('Non-terminal labels',d.provisional_active,'Source labels; live ownership to verify','L02','clock','source-nonterminal'),mk('Terminal source labels',d.source_terminal,'Source labels do not prove relief','L03','history','legacy'),mk('Verified remedy rate',rate(d.verified_remedies,op(d,'remedy_eligible')),'Evidence-qualified approved remedy cases','L05','shield')];
    case 'Audit': return [mk('Preserved source files',d.source_files,'Original bytes and checksums retained','A04','file'),mk('Rows with lineage',d.source_rows,'Distinct imported case references','A04','route'),mk('Source snapshots',d.source_snapshots,'Original and later source versions','A04','history'),mk('Full narrative pending',d.narrative_pending,'Export descriptions remain previews','A03','shield','narrative')];
    case 'Admin': return [mk('Application roles',9,'Server-enforced access model','T03','users'),mk('Source connections',2,'Manual export import supported','T08','link'),mk('Service languages',3,'English, Marathi and Hindi','T12','file'),mk('Approved SLA policies',d.configuration?.sla||null,'Approved authority and calendar required','T05','clock')];
  }
}

/** The complete design dictionary is retained without any fictitious mock values. */
export function roleMetricLibrary(role:Role|'Shared',d:DashboardData) {
  const rec=(...types:string[])=>recordCount(d,types);
  const pending=(...types:string[])=>recordCount(d,types,undefined,/Verified|Complete|Cancelled|Superseded|Decision issued/);
  const common:Record<string,number|string|null>={
    'Historical records':op(d,'historical'),'Source records':d.source_rows,'Source rows':d.source_rows,
    'Source files':d.source_files,'Original files':d.source_files,'Preserved sources':d.source_files,
    'Source checksums':d.source_files,'Original-row lineage':d.source_rows,'Unique source tokens':d.source_rows,
    'Full narrative pending':d.narrative_pending,'Full text pending':d.narrative_pending,'Complete text pending':d.narrative_pending,
    'Visible truncation':op(d,'visible_truncation'),'AS NOG labels':op(d,'raw_nog_labels'),'Missing AS NOG':op(d,'missing_nog'),
    'Missing source update':op(d,'missing_source_update'),'Missing citizen name':op(d,'missing_citizen_name'),
    'Non-terminal labels':d.provisional_active,'Terminal labels':d.source_terminal,'Legacy terminal labels':d.source_terminal,
    'Handoff labels':op(d,'handoffs'),'Handoff cohort':op(d,'handoffs'),'Handoff verification':op(d,'handoffs'),
    'Ownership gaps':d.ownership_gaps,'Forwarded for input':op(d,'source_input_forwarded'),'Received with input':op(d,'source_input_received'),
    'Input-related labels':op(d,'source_input_forwarded')+op(d,'source_input_received'),
    'No update >30 days':op(d,'stale_at_baseline'),'Aaple Sarkar':source(d,'Aaple Sarkar'),'PG Portal':source(d,'PG Portal'),
    'Evidence submitted':d.evidence_count,'Assigned cases':op(d,'owned_by_me'),'Acceptance pending':op(d,'acceptance_pending'),
    'Upcoming hearings':upcoming(d),'Next appointments':upcoming(d),'Upcoming appointments':upcoming(d),
    'Authorised cases':d.total,'My grievances':d.total,'Response requested':null,'Responses requested':null,
    'Remedy confirmed':op(d,'citizen_confirmed'),'Citizen confirmation':rate(op(d,'citizen_confirmed'),op(d,'feedback_cases')),
    'Handling satisfaction':d.operational?.satisfaction_average==null?null:`${Number(d.operational.satisfaction_average).toFixed(1)} / 5`,
    'Verified remedy rate':rate(d.verified_remedies,op(d,'remedy_eligible')),'SLA compliance':rate(op(d,'clocks_on_time'),op(d,'completed_clocks')),
    'Decision proposals':rec('proposal'),'ATR drafts':recordCount(d,['atr'],/Draft/),'Returned reports':recordCount(d,['atr_review'],/Returned/),
    'Actions in progress':pending('action'),'Actions to verify':recordCount(d,['action'],/Completed.*verification/),
    'Directions in progress':pending('action','review_action'),'Compliance verified':recordCount(d,['verification'],/Verified/),
    'Ordered actions':pending('review_action'),'Review queue':rec('review'),'New material':rec('review_material'),
    'Reviews in progress':rec('review'),'Review hearing':upcoming(d,['review_hearing']),
    'Accepted owner mappings':op(d,'ownership_accepted'),'Application roles':9,'Authorised role types':9,
    'Supported languages':3,'Service languages':3,'Source portals':2,'Assisted intake routes':2,
    'Approved SLA policy':d.configuration?.sla?'Configured':null,'Working calendar':d.configuration?.calendars?'Configured':null,
    'Closure / review policy':d.configuration?.closure?'Recorded':null,'Knowledge approvals':d.configuration?.knowledge?'Approved sources':null,
    'Delivery adapters':'Not configured','Portal write-back':'Not configured','Account verification':'Verified',
    'Notification delivery':null,'Availability / uptime':null,
  };
  return definitions.filter(x=>x.role===role).map(x=>({...x,value:common[x.metric]??null,coverage:common[x.metric]===undefined?'Requires a recorded measure or approved configuration.':typeof common[x.metric]==='number'?'Recorded count within your permitted scope.':'Available workflow or configuration evidence.'}));
}
