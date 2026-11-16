'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, FileText, Download, Eye, Layers, Lock, Check, RefreshCw, Save, Send, Upload, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BOARDS, CATEGORIES, SOURCE_STATUSES, parseValues, type Actor, type Values, type Field, type CaseRow, type EvidenceRow } from '@/lib/types';
import { fieldsFor, valuesForCase, screenById } from '@/lib/forms';
import { Badge, Empty, date, number, text, pretty, draftscreens, type Detail } from './mhada-application';
export function Filters(p: {
    q: string;
    setQ: (v: string) => void;
    filter: string;
    setFilter: (v: string) => void;
    board: string;
    setBoard: (v: string) => void;
    category: string;
    setCategory: (v: string) => void;
    status: string;
    setStatus: (v: string) => void;
}) { return <div className="filters"><label className="search-field"><Search size={17}/><input aria-label="Search permitted cases" value={p.q} onChange={e => p.setQ(e.target.value)} placeholder="Search reference, property or document"/></label><select aria-label="Work queue" value={p.filter} onChange={e => p.setFilter(e.target.value)}><option value="">All records</option><option value="source-nonterminal">Source non-terminal</option><option value="active">Operationally active source cohort</option><option value="unassigned">Ownership gaps</option><option value="narrative">Full narrative pending</option><option value="legacy">Legacy terminal labels</option><option value="overdue">Approved deadline overdue</option></select><select aria-label="Board filter" value={p.board} onChange={e => p.setBoard(e.target.value)}><option value="">All permitted boards</option>{BOARDS.map(x => <option key={x}>{x}</option>)}</select><select aria-label="Category filter" value={p.category} onChange={e => p.setCategory(e.target.value)}><option value="">All categories</option><option>Unclassified</option>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select><select aria-label="Source label filter" value={p.status} onChange={e => p.setStatus(e.target.value)}><option value="">All source labels</option>{SOURCE_STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>; }
export function CaseTable({ cases, total, page, setPage, onOpen, title, loading }: {
    cases: CaseRow[];
    total: number;
    page: number;
    setPage: (n: number) => void;
    onOpen: (id: string) => void;
    title: string;
    loading: boolean;
}) { return <section className="panel table-panel" aria-busy={loading}><div className="panel-heading"><h2>{title}</h2><span className="subtle">{number(total)} matching records</span></div>{cases.length ? <div className="table-wrap"><table><thead><tr><th>Case & reference</th><th>Board / office family</th><th>Source label</th><th>Internal progress</th><th>Original receipt</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{cases.map(c => <tr key={c.id} className="case-row" onClick={() => onOpen(c.id)}><td><button className="case-link" onClick={e => { e.stopPropagation(); onOpen(c.id); }}>{c.reference}</button><small className="truncate" title={c.title}>{c.title}</small><small>{c.source_portal} · {c.source_token}</small></td><td>{c.board}<small>{c.owner_name || 'No accepted owner'}</small></td><td><Badge>{c.source_status || 'Unavailable'}</Badge></td><td><Badge>{c.stage}</Badge><small>{c.outcome}</small></td><td>{date(c.received_date)}</td><td><button className="icon-button" aria-label={'Open ' + c.reference} onClick={e => { e.stopPropagation(); onOpen(c.id); }}><ArrowUpRight size={18}/></button></td></tr>)}</tbody></table></div> : <Empty title={loading ? 'Loading permitted records…' : 'No matching records'} body="Adjust the filters, register a grievance or complete an import to populate this queue."/>}<div className="table-footer"><span>{total ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, total)}` : '0'} of {number(total)}</span><div><button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18}/></button><b>Page {page}</b><button className="icon-button" aria-label="Next page" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}><ChevronRight size={18}/></button></div></div></section>; }
export function DefinitionRows({ data }: {
    data: Record<string, unknown>;
}) { return <dl className="definition-rows">{Object.entries(data).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{text(v) || '—'}</dd></div>)}</dl>; }
export function CaseValues({ detail }: {
    detail: Detail;
}) {
    const c = detail.case;
    const narrative = c.narrative || c.preview || '';
    const facts = Object.entries({
        Citizen: c.citizen_name,
        Category: c.category,
        Office: c.office,
        'Source portal': c.source_portal,
        'Source token': c.source_token,
        'Source label': c.source_status,
        'Internal stage': c.stage,
        Outcome: c.outcome,
        Priority: c.priority,
        'Accountable owner': c.owner_name,
        'Original receipt': date(c.received_date),
    }).filter(([, value]) => text(value) && text(value) !== '—');
    const sources = detail.sources || [];
    return <section className="panel case-values"><div className="panel-heading"><h2>Case values</h2><span className="subtle">{c.reference}</span></div>{narrative ? <p className="preserve-text">{narrative}</p> : !sources.length && <p>Personal narrative stays in the workspace that is allowed to read it. The operational values for this case are below.</p>}{!!facts.length && <DefinitionRows data={Object.fromEntries(facts)}/>}{sources.map(src => { const raw = parseValues(src.raw); const filled = Object.fromEntries(Object.entries(raw).filter(([, value]) => text(value))); return <div key={src.id}><h3>{src.portal} · source row {src.row_number}</h3><DefinitionRows data={filled}/></div>; })}</section>;
}
export function Timeline({ events }: {
    events: any[];
}) { return events.length ? <ol className="timeline">{events.map(ev => <li key={ev.id}><span className="timeline-dot"/><div><h3>{ev.message}</h3><p>{date(ev.created_at)} · {ev.actor_role || 'System'} · {pretty(ev.kind)}</p></div></li>)}</ol> : <Empty title="No visible events yet" body="Persisted events appear when permitted actions are recorded."/>; }
export function Records({ records, onOpen, title = 'Recorded work', embedded = false }: {
    records: any[];
    onOpen: (id: string) => void;
    title?: string;
    embedded?: boolean;
}) { return <div className={embedded ? 'records' : 'panel records'}>{!embedded && <div className="panel-heading"><h2>{title}</h2><span className="subtle">{records.length} visible records</span></div>}{records.length ? records.map(r => <details key={r.id} className="record-details"><summary><span><b>{pretty(r.type)}</b>{r.case_reference && <small>{r.case_reference}</small>}<small>{r.id}</small></span><span><Badge>{r.status}</Badge><small>{date(r.created_at)}{r.due_date ? ' · Due ' + date(r.due_date) : ''}</small></span></summary><DefinitionRows data={parseValues(r.values)}/><div className="record-meta">{r.parent_id && <code>Linked record {r.parent_id}</code>}<span>Version {r.version} · {r.actor_role}</span>{r.case_id && r.case_reference && <button className="button small" onClick={() => onOpen(r.case_id)}>Open case</button>}</div></details>) : <Empty title="No work recorded yet" body="The case form creates an accountable record, retaining its author, links and evidence references."/>}</div>; }
export function EvidenceTable({ evidence, onChoose, href, onVersion, canVersion }: {
    evidence: EvidenceRow[];
    onChoose: (id: string) => void;
    href: (s: string) => string;
    onVersion: (id: string) => void;
    canVersion: boolean;
}) { return evidence.length ? <div className="table-wrap"><table><thead><tr><th>Document</th><th>Version & review</th><th>Sharing</th><th>Integrity</th><th>Actions</th></tr></thead><tbody>{evidence.map(e => <tr key={e.id}><td><b>{e.filename}</b><small>{e.description}</small><small>{(e.size / 1024).toFixed(1)} KB · {date(e.uploaded_at)}</small></td><td><Badge>{e.review_state}</Badge><small>Version {e.version}</small></td><td><Badge>{e.classification}</Badge><small>{[e.citizen_safe ? 'Citizen-safe' : '', e.respondent_safe ? 'Respondent-safe' : ''].filter(Boolean).join(' · ') || 'Staff view'}</small></td><td><code title={e.checksum}>{e.checksum.slice(0, 16)}…</code><small>{e.id}</small></td><td><div className="button-row"><button className="icon-button" aria-label={'Inspect ' + e.filename} onClick={() => onChoose(e.id)}><Eye size={17}/></button><a className="icon-button" aria-label={'Download ' + e.filename} href={href('evidence/' + e.id)}><Download size={17}/></a>{canVersion && <button className="icon-button" aria-label={'New version of ' + e.filename} onClick={() => onVersion(e.id)}><Layers size={17}/></button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No evidence supplied" body="Upload a document. Its original bytes, checksum, version and access classification will be retained."/>; }
export function RecordForm({ id, c, actor, detail, members, configs, preferences = {}, evidenceId = '', busy, t, onSave, onUpload }: {
    id: string;
    c: CaseRow | null;
    actor: Actor;
    detail: Detail | null;
    members: any[];
    configs: any[];
    preferences?: Values;
    evidenceId?: string;
    busy: boolean;
    t: (s: string) => string;
    onSave: (v: Values, p?: boolean) => Promise<any>;
    onUpload: (f: File, l: string, v: Values) => Promise<any>;
}) {
    const initial = () => { const v = valuesForCase(id, c, actor); if (id === 'S06')
        Object.assign(v, preferences); if (id === 'L06')
        v.Period = 'All dates'; if (id === 'A06') {
        v['Case / review scope'] = c?.reference || 'All permitted cases';
        v['Document versions'] = 'All preserved versions';
    } if (id.startsWith('T') && !['T01', 'T02', 'T03', 'T04', 'T10', 'T13'].includes(id)) {
        const conf = configs.find(x => x.screen === id);
        if (conf)
            Object.assign(v, parseValues(conf.payload));
    } if (id === 'C06' && c) {
        v['Original narrative'] = c.narrative || '';
        v['Requested remedy'] = text(parseValues(c.details)['Requested outcome']);
        v['Source channel'] = actor.role === 'Intake' ? 'Assisted intake' : 'MHADA Citizen Portal';
        v['Contact preference'] = text(parseValues(c.details)['Preferred contact']);
    } if (['O09', 'M02'].includes(id) && evidenceId)
        v['Evidence reference'] = evidenceId; if (id === 'M01')
        v['Submission channel'] = actor.role === 'Intake' ? 'Assisted intake' : 'Citizen portal'; return v; };
    const [values, setValues] = useState<Values>(initial), [formError, setFormError] = useState('');
    const formRef = useRef<HTMLFormElement>(null), editRef = useRef(false);
    const fields = fieldsFor(id).sort((a, b) => Number(a.kind === 'file') - Number(b.kind === 'file')), records = detail?.records || [];
    useEffect(() => { if (!editRef.current)
        setValues(initial()); }, [configs, detail?.evidence.length, preferences]);
    useEffect(() => { if (['O09', 'M02'].includes(id) && evidenceId)
        setValues(v => ({ ...v, 'Evidence reference': evidenceId })); }, [evidenceId, id]);
    const set = (label: string, value: Values[string]) => { editRef.current = true; setValues(v => ({ ...v, [label]: value })); setFormError(''); };
    function optionsFor(f: Field): {
        value: string;
        label: string;
    }[] {
        if (f.label === 'Board / office')
            return BOARDS.map(value => ({ value, label: value }));
        if (f.label === 'Case owner')
            return members.filter(m => m.active && JSON.parse(m.roles).includes('Officer')).map(m => ({ value: m.id, label: m.name + ' · ' + m.email }));
        if (['Provider account email', 'Executor account email', 'Respondent account email'].includes(f.label))
            return members.filter(m => m.active).map(m => ({ value: m.email, label: m.name + ' · ' + m.email }));
        if (['Evidence reference', 'Evidence references', 'Supporting evidence reference', 'Acceptance evidence', 'Implementation evidence'].includes(f.label) && f.kind !== 'file')
            return (detail?.evidence || []).map(e => ({ value: e.id, label: e.filename + ' · v' + e.version + ' · ' + e.review_state }));
        if (f.label === 'Issue reference' && id !== 'O03')
            return records.filter(r => r.type === 'issue').map(r => ({ value: r.id, label: text(parseValues(r.values)['Issue reference']) + ' · ' + text(parseValues(r.values)['Add an issue']) }));
        if (['Action reference', 'Action checked'].includes(f.label))
            return records.filter(r => ['action', 'review_action'].includes(r.type) && r.status !== 'Superseded').map(r => ({ value: r.id, label: text(parseValues(r.values).description) + ' · ' + r.status + ' · ' + r.id.slice(0, 8) }));
        if (['Replacement hearing reference', 'Hearing reference'].includes(f.label))
            return records.filter(r => ['hearing', 'review_hearing'].includes(r.type) && r.status === 'Scheduled').map(r => ({ value: r.id, label: text(parseValues(r.values)['Hearing purpose'] || 'Review hearing') + ' · ' + date(r.due_date) + ' · ' + r.id.slice(0, 8) }));
        if (f.label === 'Exception reference')
            return records.filter(r => r.type === 'extension' && r.status === 'Approval pending').map(r => ({ value: r.id, label: text(parseValues(r.values)['Exception reason']) + ' · ' + r.id.slice(0, 8) }));
        if (f.label === 'Input task reference')
            return records.filter(r => r.type === 'input').map(r => ({ value: r.id, label: text(parseValues(r.values)['Required input']) + ' · ' + r.status }));
        return f.options.map(value => ({ value, label: value }));
    }
    const saveForm = async (partial = false) => { if (!partial && !formRef.current?.reportValidity())
        return; setFormError(''); for (const f of fields)
        if (!partial && f.required && f.kind === 'file' && !text(values[f.label])) {
            setFormError('Supply ' + f.label + ' before continuing.');
            return;
        } const result = await onSave(values, partial); if (result)
        editRef.current = false; };
    return <form id={'record-form-'+id} ref={formRef} onSubmit={e => { e.preventDefault(); void saveForm(); }} className="record-form"><div className="form-grid">{fields.map((f, i) => { const value = values[f.label] ?? '', options = optionsFor(f), dynamic = options.length > 0 && f.kind !== 'multi' && f.kind !== 'file' && f.kind !== 'check' && f.kind !== 'long', fid = id + '-field-' + i, readonly = id === 'C06' && f.kind !== 'check'; return <div key={f.label} className={'field ' + (['long', 'multi', 'file'].includes(f.kind) ? 'field-wide' : '') + (f.kind === 'check' ? ' check-field' : '')}><label htmlFor={fid}>{t(f.label)}{f.required && <span aria-label="Required"> *</span>}</label>{f.kind === 'check' ? <div className="checkbox-line"><input id={fid} type="checkbox" checked={value === true} required={f.required} onChange={e => set(f.label, e.target.checked)}/><span>{t(f.label)}{f.required ? ' must be confirmed.' : ''}</span></div> : f.kind === 'multi' ? <div id={fid} className="checkbox-group">{f.options.map(option => <label key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => set(f.label, e.target.checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value : []).filter(x => x !== option))}/>{option}</label>)}</div> : f.kind === 'file' ? <div className="upload-field">{id !== 'M02' && !!detail?.evidence.length && <select aria-label={'Choose existing ' + f.label} value={text(value)} onChange={e => set(f.label, e.target.value)}><option value="">Use an existing case document…</option>{detail.evidence.map(e => <option key={e.id} value={e.id}>{e.filename} · v{e.version}</option>)}</select>}<label className="upload-target" htmlFor={fid}><Upload size={21}/><strong>{busy ? 'Uploading…' : text(value) ? 'Stored document selected' : 'Choose a supporting file'}</strong><span>PDF, images, Office or text · up to 10 MB</span><input id={fid} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt" disabled={busy} onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; if (id === 'O08' && !text(values['Evidence description'])) {
        setFormError('Describe the evidence before uploading it.');
        return;
    } if (id === 'M02' && (!text(values['Evidence reference']) || !text(values['Version reason']))) {
        setFormError('Choose the original document and explain this version before uploading.');
        return;
    } const r = await onUpload(file, f.label, values); if (r)
        set(f.label, r.id); }}/></label>{text(value) && <small className="file-saved"><CheckCircle2 size={14}/>Stored reference: {text(value)}</small>}</div> : f.kind === 'long' ? <textarea id={fid} value={text(value)} onChange={e => set(f.label, e.target.value)} required={f.required} readOnly={readonly} rows={5} maxLength={20000}/> : dynamic || f.kind === 'select' ? <select id={fid} value={text(value)} required={f.required} onChange={e => set(f.label, e.target.value)} disabled={readonly}><option value="">Choose {f.label.toLowerCase()}…</option>{options.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}{text(value) && !options.find(o => o.value === text(value)) && <option value={text(value)}>{text(value)}</option>}</select> : <input id={fid} type={['date', 'number', 'email'].includes(f.kind) ? f.kind : 'text'} min={f.kind === 'number' ? 0 : undefined} step={f.kind === 'number' ? '0.01' : undefined} value={text(value)} onChange={e => set(f.label, e.target.value)} required={f.required} readOnly={readonly} maxLength={f.kind === 'text' ? 1000 : undefined}/>}</div>; })}</div>{formError && <div className="alert red" role="alert">{formError}</div>}<div className="form-footer"><span className="subtle"><Lock size={13}/>{id.startsWith('T') || id === 'S06' ? 'Versioned workspace settings' : ['L06','A06'].includes(id) ? 'Exports respect your permitted scope' : 'Saved to this workspace and case'}</span><div>{draftscreens.has(id) && <button className="button" type="button" disabled={busy} onClick={() => void saveForm(true)}><Save size={16}/>Save draft</button>}<button type="submit" className="button primary" disabled={busy}>{busy ? <RefreshCw size={16} className="spinning"/> : id === 'M01' ? <Send size={16}/> : <Check size={16}/>} {id === 'O08' ? 'Done' : id === 'M01' ? 'Confirm & register' : id === 'C06' ? 'Review submission' : ['L06','A06'].includes(id) ? 'Apply report filters' : id.startsWith('T') ? 'Save & continue' : t(screenById[id]?.primary.label || 'Save record')}</button></div></div></form>;
}
export function ImportsTable({ imports, href, onChoose, canDownload = true }: {
    imports: any[];
    href: (p: string) => string;
    onChoose: (id: string) => void;
    canDownload?: boolean;
}) { return imports.length ? <div className="table-wrap"><table><thead><tr><th>Original export</th><th>Rows</th><th>Reconciliation</th><th>Status</th><th>Actions</th></tr></thead><tbody>{imports.map(b => <tr key={b.id}><td><button className="case-link" onClick={() => onChoose(b.id)}>{b.filename}</button><small>{b.source} · {date(b.created_at)}</small><code title={b.checksum}>{b.checksum.slice(0, 20)}…</code></td><td>{number(b.row_count)}</td><td><small>{b.accepted} accepted · {b.updated} updated</small><small>{b.unchanged} unchanged · {b.rejected} rejected</small></td><td><Badge>{b.status}</Badge></td><td>{canDownload && <a className="icon-button" aria-label={'Download ' + b.filename} href={href('imports/' + b.id + '/download')}><Download size={17}/></a>}</td></tr>)}</tbody></table></div> : <Empty title="No imports yet"/>; }
export function ImportWorkspace({ screen, batchId, batch, imports, busy, api, href, onRun, onBatch, onNavigate, onCommit, refresh }: {
    screen: string;
    batchId: string;
    batch: any;
    imports: any[];
    busy: boolean;
    api: (p: string, i?: RequestInit) => Promise<any>;
    href: (p: string) => string;
    onRun: (op: () => Promise<any>) => Promise<any>;
    onBatch: (id: string) => void;
    onNavigate: (s: string) => void;
    onCommit: () => void;
    refresh: () => void;
}) {
    const [source, setSource] = useState('Aaple Sarkar'), [file, setFile] = useState<File | null>(null), [mapping, setMapping] = useState<Record<string, string>>({}), [cutoff, setCutoff] = useState(''), [purpose, setPurpose] = useState('Snapshot reconciliation'), [filters, setFilters] = useState('');
    useEffect(() => { if (batch)
        setMapping(parseValues(batch.batch.mapping) as Record<string, string>); }, [batch]);
    return <><div className="wizard-steps">{['I02', 'I03', 'I04', 'I05'].map((id, i) => <button key={id} className={screen === id ? 'current' : ''} disabled={!batchId && i > 0} onClick={() => onNavigate(id)}><span>{i + 1}</span>{['Upload source', 'Map columns', 'Validate rows', 'Reconcile'][i]}</button>)}</div>{screen === 'I02' && <section className="panel"><h2>Preserve and validate a source export</h2><form id="source-import-form" className="record-form" onSubmit={e => { e.preventDefault(); void onRun(async () => { if (!file)
        throw new Error('Choose an XLSX or CSV export.'); const data = new FormData(); data.set('source', source); data.set('file', file); data.set('cutoff', cutoff); data.set('purpose', purpose); data.set('filters', filters); const r = await api('imports', { method: 'POST', body: data }); onBatch(r.id); onNavigate(r.duplicate ? 'I05' : 'I03'); refresh(); }); }}><div className="form-grid"><div className="field"><label htmlFor="source-select">Source portal *</label><select id="source-select" value={source} onChange={e => setSource(e.target.value)}><option>Aaple Sarkar</option><option>PG Portal</option></select></div><div className="field"><label htmlFor="source-file">Original source export *</label><input id="source-file" type="file" accept=".xlsx,.csv" required onChange={e => setFile(e.target.files?.[0] || null)}/></div><div className="field"><label htmlFor="cutoff">Export cutoff</label><input id="cutoff" type="date" value={cutoff} onChange={e => setCutoff(e.target.value)}/></div><div className="field"><label htmlFor="import-purpose">Import purpose *</label><input required id="import-purpose" value={purpose} onChange={e => setPurpose(e.target.value)}/></div><div className="field field-wide"><label htmlFor="import-filters">Export filters</label><textarea id="import-filters" value={filters} onChange={e => setFilters(e.target.value)} rows={3}/></div></div><p className="subtle">Maximum 5,000 records and 16 MB per batch. Original bytes, hashes and row values are retained. Baseline totals do not constrain future batches.</p><div className="form-footer"><span>Repeated tokens preserve one case and versioned snapshots.</span><button className="button primary" disabled={busy}><Upload size={16}/>Preserve & validate</button></div></form></section>}{batch && <section className="panel"><div className="panel-heading"><h2>{batch.batch.filename}</h2><Badge>{batch.batch.status}</Badge></div><DefinitionRows data={{ 'Source portal': batch.batch.source, 'Original rows': batch.batch.row_count, Checksum: batch.batch.checksum, 'Accepted / new': batch.batch.accepted, 'Updated source snapshots': batch.batch.updated, Unchanged: batch.batch.unchanged, Rejected: batch.batch.rejected }}/>{screen === 'I03' && <form id="source-mapping-form" onSubmit={e => { e.preventDefault(); void onRun(async () => { await api('imports/' + batchId + '/mapping', { method: 'POST', body: JSON.stringify({ mapping }) }); refresh(); onNavigate('I04'); }); }}><div className="form-grid">{Object.entries(mapping).filter(([key]) => !key.startsWith('_')).map(([key, value]) => <div className="field" key={key}><label htmlFor={'map-' + key}>{pretty(key)}</label><select id={'map-' + key} value={value} onChange={e => setMapping({ ...mapping, [key]: e.target.value })}>{batch.headers.map((h: string) => <option key={h}>{h}</option>)}</select></div>)}</div><div className="form-footer"><span>Mapping changes rerun validation against preserved rows.</span><button className="button primary" disabled={busy}>Save mapping & validate</button></div></form>}{['I04', 'I05'].includes(screen) && <><div className="alert info"><ShieldCheck size={18}/><span>Original receipt and internal workflow records are protected. Conflicts remain exceptions.</span></div>{JSON.parse(batch.batch.errors || '[]').length > 0 && <><h3>Validation exceptions</h3><div className="table-wrap"><table><thead><tr><th>Original row</th><th>Reason</th></tr></thead><tbody>{JSON.parse(batch.batch.errors).map((err: any) => <tr key={err.row}><td>{err.row}</td><td>{err.reason}</td></tr>)}</tbody></table></div><a className="button" href={href('imports/' + batchId + '/exceptions')}><Download size={16}/>Export exceptions</a></>}{batch.preview.length > 0 && <><h3>Original row preview</h3>{batch.preview.map((row: any) => <details className="record-details" key={row.row_number}><summary>Source row {row.row_number}<Badge>{row.status}</Badge></summary><DefinitionRows data={parseValues(row.raw)}/></details>)}</>}{batch.job && <div className="import-progress"><progress value={batch.job.completed} max={batch.job.total}/><span>{batch.job.completed} / {batch.job.total} persisted rows</span></div>}<div className="form-footer"><a className="button" href={href('imports/' + batchId + '/download')}><Download size={16}/>Download original</a>{batch.batch.status === 'Complete' ? <Badge>Reconciled</Badge> : <button className="button primary" disabled={busy} onClick={screen === 'I04' ? () => onNavigate('I05') : onCommit}>{screen === 'I04' ? 'Review reconciliation' : 'Confirm & commit'}<ChevronRight size={16}/></button>}</div></>}</section>}<section className="panel"><h2>Import history</h2><ImportsTable imports={imports} href={href} onChoose={id => { onBatch(id); onNavigate('I05'); }}/></section></>;
}
export function CommitConfirmation({ busy, onCommit, purpose = '' }: {
    busy: boolean;
    onCommit: () => void;
    purpose?: string;
}) { const [checked, setChecked] = useState(false), [preserved, setPreserved] = useState(false); return <><div className="field"><label htmlFor="commit-purpose">Batch purpose</label><input id="commit-purpose" value={purpose || 'Not supplied in preserved batch metadata'} readOnly/></div><label className="checkbox-line"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/>Reconciliation checked</label><label className="checkbox-line"><input type="checkbox" checked={preserved} onChange={e => setPreserved(e.target.checked)}/>Original preserved</label><div className="form-footer"><span>Validated rows are committed; rejected rows retained.</span><button className="button primary" disabled={busy || !checked || !preserved} onClick={onCommit}>{busy ? 'Committing persisted rows…' : 'Commit reconciled batch'}</button></div></>; }
export function CalendarView({ records, month, setMonth, onOpen }: {
    records: any[];
    month: string;
    setMonth: (s: string) => void;
    onOpen: (s: string) => void;
}) { const hearings = records.filter(r => ['hearing', 'review_hearing'].includes(r.type) && r.status === 'Scheduled'); const first = new Date(month + '-01T12:00:00Z'), offset = (first.getUTCDay() + 6) % 7, days = new Date(first.getUTCFullYear(), first.getUTCMonth() + 1, 0).getUTCDate(); const next = (n: number) => { const d = new Date(first); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); }; return <section className="panel"><div className="panel-heading"><h2>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><div className="button-row"><button className="icon-button" aria-label="Previous month" onClick={() => next(-1)}><ChevronLeft size={18}/></button><button className="icon-button" aria-label="Next month" onClick={() => next(1)}><ChevronRight size={18}/></button></div></div><div className="calendar-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div className="calendar-day-label" key={day}>{day}</div>)}{Array.from({ length: offset }, (_, i) => <div className="calendar-cell muted" key={'blank' + i}/>)}{Array.from({ length: days }, (_, i) => { const d = month + '-' + String(i + 1).padStart(2, '0'), relevant = hearings.filter(r => { const v = parseValues(r.values); return text(v['Hearing date'] || v['Review date'] || r.due_date) === d; }); return <div key={d} className="calendar-cell"><b>{i + 1}</b>{relevant.map(r => <button className="calendar-event" key={r.id} onClick={() => onOpen(r.case_id)}>{r.case_reference || pretty(r.type)}<small>{text(parseValues(r.values)['Hearing purpose'] || 'Review hearing')}</small></button>)}</div>; })}</div><p className="subtle">Persisted notices within your scope. Reschedule requests retain the date until authorised scheduling.</p></section>; }
export function KnowledgeSearch({ api }: {
    api: (p: string) => Promise<any>;
}) { const [q, setQ] = useState(''), [result, setResult] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''); return <section className="panel"><h2>Approved policy lookup</h2><p>Search controlled sources. References and versions are retained; applicability requires officer review.</p><form className="search-field" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    setResult(await api('knowledge?q=' + encodeURIComponent(q)));
    setError('');
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><Search size={17}/><input aria-label="Policy query" value={q} onChange={e => setQ(e.target.value)} placeholder="Search an approved policy topic"/><button className="button primary" disabled={busy}>Search sources</button></form>{error && <div role="alert" className="alert red">{error}</div>}{result && <><p>{result.message}</p>{result.sources.map((source: any) => <article className="knowledge-card" key={source.id}><h3>{source.title}</h3><small>{source.reference} · version {source.version}</small><p className="preserve-text">{source.text}</p></article>)}</>}<p className="subtle">No model provider is configured. This tool retrieves approved text and does not infer missing evidence or make decisions.</p></section>; }
