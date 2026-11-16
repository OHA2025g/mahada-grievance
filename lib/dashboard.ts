import type { Actor, ApiEnv } from './types';

type Scope = {sql: string; args: unknown[]};
export type RecordStatistic = {type: string; status: string; count: number; upcoming: number};

/** All aggregates use the same case scope and record visibility as the case API. */
export async function dashboardFacts(e: ApiEnv, a: Actor, scope: Scope) {
  const day = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'});
  const rows = async <T>(sql: string, ...args: unknown[]) => (await e.DB.prepare(sql).bind(...args).all<T>()).results || [];
  const first = async <T>(sql: string, ...args: unknown[]) => e.DB.prepare(sql).bind(...args).first<T>();
  let visibility = '', visibilityArgs: unknown[] = [];
  if (a.role === 'Citizen') {
    visibility = ` AND r.type IN ('decision','review_decision','atr','hearing','review_hearing','clarification','feedback','review','admissibility','communication','handoff')
      AND (r.type NOT IN ('decision','atr') OR r.id=json_extract(c.details,'$.publishedDecisionId') OR r.id=json_extract(c.details,'$.publishedAtrId'))`;
  } else if (a.role === 'Developer') {
    visibility = ` AND r.type IN ('hearing','review_hearing','respondent_response','rent_ledger','compliance','hearing_response','reschedule')
      AND (r.type IN ('hearing','review_hearing') OR r.author_id=?)`;
    visibilityArgs = [a.id];
  }
  let evVisibility = '', evArgs: unknown[] = [];
  if (a.role === 'Citizen') {evVisibility = ' AND (ev.citizen_safe=1 OR ev.uploaded_by=?)'; evArgs = [a.id];}
  else if (a.role === 'Developer') {evVisibility = ' AND (ev.respondent_safe=1 OR ev.uploaded_by=?)'; evArgs = [a.id];}
  else if (!a.canRestricted) evVisibility = " AND ev.classification<>'Restricted'";

  const [sources, records, facts, evidence, lineage, tasks, configuration] = await Promise.all([
    rows<{label:string;count:number}>(`SELECT COALESCE(c.source_portal,'Citizen / assisted intake') label,COUNT(*) count FROM cases c WHERE ${scope.sql} GROUP BY c.source_portal ORDER BY count DESC`, ...scope.args),
    rows<RecordStatistic>(`SELECT r.type,r.status,COUNT(*) count,SUM(CASE WHEN r.due_date>=? THEN 1 ELSE 0 END) upcoming FROM records r JOIN cases c ON c.id=r.case_id WHERE ${scope.sql}${visibility} GROUP BY r.type,r.status`, day, ...scope.args, ...visibilityArgs),
    first<Record<string,number|null>>(`SELECT
      SUM(CASE WHEN c.kind='historical' THEN 1 ELSE 0 END) historical,
      SUM(CASE WHEN c.source_portal='Aaple Sarkar' AND (c.source_nog IS NULL OR trim(c.source_nog)='') THEN 1 ELSE 0 END) missing_nog,
      COUNT(DISTINCT CASE WHEN c.source_portal='Aaple Sarkar' THEN COALESCE(c.source_nog,'') END) raw_nog_labels,
      SUM(CASE WHEN c.kind='historical' AND (c.citizen_name IS NULL OR trim(c.citizen_name)='') THEN 1 ELSE 0 END) missing_citizen_name,
      SUM(CASE WHEN c.kind='historical' AND c.source_updated IS NULL THEN 1 ELSE 0 END) missing_source_update,
      SUM(CASE WHEN c.kind='historical' AND (c.preview LIKE '%...' OR c.preview LIKE '%…') THEN 1 ELSE 0 END) visible_truncation,
      SUM(CASE WHEN c.kind='historical' AND c.source_status NOT IN ('Auto Closed','Closed','Resolved') AND julianday('2026-10-14')-julianday(c.source_updated)>30 THEN 1 ELSE 0 END) stale_at_baseline,
      SUM(CASE WHEN c.owner_id=? THEN 1 ELSE 0 END) owned_by_me,
      SUM(CASE WHEN c.acceptance='Accepted' THEN 1 ELSE 0 END) ownership_accepted,
      SUM(CASE WHEN c.acceptance='Pending acceptance' AND c.owner_id IS NOT NULL THEN 1 ELSE 0 END) acceptance_pending,
      SUM(CASE WHEN c.source_status IN ('Transferred','Send To CPGRAMS') THEN 1 ELSE 0 END) handoffs,
      SUM(CASE WHEN c.source_status='Forwarded For Input' THEN 1 ELSE 0 END) source_input_forwarded,
      SUM(CASE WHEN c.source_status='Received with Input' THEN 1 ELSE 0 END) source_input_received,
      SUM(CASE WHEN c.due_date IS NOT NULL THEN 1 ELSE 0 END) approved_clocks,
      SUM(CASE WHEN c.due_date<? AND c.closed_at IS NULL THEN 1 ELSE 0 END) approved_overdue,
      SUM(CASE WHEN c.closed_at IS NULL THEN 1 ELSE 0 END) internally_open,
      SUM(CASE WHEN json_extract(c.details,'$.confirmation')='Confirmed' THEN 1 ELSE 0 END) citizen_confirmed,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM records f WHERE f.case_id=c.id AND f.type='feedback') THEN 1 ELSE 0 END) feedback_cases,
      AVG(CASE WHEN json_extract(c.details,'$.satisfaction') GLOB '[1-5]*' THEN CAST(substr(json_extract(c.details,'$.satisfaction'),1,1) AS REAL) END) satisfaction_average,
      SUM(CASE WHEN json_extract(c.details,'$.decisionKind')='Remedy' THEN 1 ELSE 0 END) remedy_eligible,
      SUM(CASE WHEN c.closed_at IS NOT NULL AND c.due_date IS NOT NULL THEN 1 ELSE 0 END) completed_clocks,
      SUM(CASE WHEN c.closed_at IS NOT NULL AND c.due_date IS NOT NULL AND substr(c.closed_at,1,10)<=c.due_date THEN 1 ELSE 0 END) clocks_on_time
      FROM cases c WHERE ${scope.sql}`, a.id, day, ...scope.args),
    first<{count:number}>(`SELECT COUNT(*) count FROM evidence ev JOIN cases c ON c.id=ev.case_id WHERE ${scope.sql}${evVisibility}`, ...scope.args, ...evArgs),
    first<{files:number;records:number;snapshots:number}>(`SELECT COUNT(DISTINCT s.import_id) files,COUNT(DISTINCT s.case_id) records,COUNT(*) snapshots FROM sources s JOIN cases c ON c.id=s.case_id WHERE ${scope.sql}`, ...scope.args),
    rows<{id:string;case_id:string;type:string;status:string;due_date:string|null;case_reference:string}>(`SELECT r.id,r.case_id,r.type,r.status,r.due_date,c.reference case_reference FROM records r JOIN cases c ON c.id=r.case_id WHERE ${scope.sql}${visibility} AND r.type IN ('input','action','review_action','hearing','review_hearing','clarification','review') AND r.status NOT IN ('Verified','Complete','Held','Cancelled','Superseded') ORDER BY COALESCE(r.due_date,'9999'),r.created_at DESC LIMIT 100`, ...scope.args, ...visibilityArgs),
    ['Admin','Supervisor','Audit','Intake','Officer','Review'].includes(a.role) ? first<{sla:number;calendars:number;knowledge:number;closure:number}>(`SELECT
      SUM(CASE WHEN screen='T05' AND json_extract(payload,'$."Approved policy"')=1 THEN 1 ELSE 0 END) sla,
      SUM(CASE WHEN screen='T06' AND key LIKE 'calendar:%' AND json_extract(payload,'$."Calendar approved"')=1 THEN 1 ELSE 0 END) calendars,
      SUM(CASE WHEN screen='T13' AND json_extract(payload,'$."Approved source"')=1 THEN 1 ELSE 0 END) knowledge,
      SUM(CASE WHEN screen='T07' THEN 1 ELSE 0 END) closure FROM configs`) : Promise.resolve(null),
  ]);
  return {
    sources, record_statistics: records,
    operational: Object.fromEntries(Object.entries(facts || {}).map(([k,v]) => [k, k==='satisfaction_average' ? v : Number(v || 0)])),
    evidence_count: evidence?.count || 0,
    source_files: lineage?.files || 0, source_rows: lineage?.records || 0, source_snapshots: lineage?.snapshots || 0,
    tasks,
    configuration: configuration ? Object.fromEntries(Object.entries(configuration).map(([k,v]) => [k,Number(v || 0)])) : null,
  };
}
