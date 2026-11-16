'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, LayoutDashboard, ClipboardList, Search, Bell, ChevronRight, ChevronLeft, ChevronDown, Plus, ArrowUpRight, Check, CheckCircle2, Clock, ShieldCheck, FileText, FolderOpen, Upload, Download, RefreshCw, Settings, Users, Scale, CalendarDays, Activity, X, Menu, LogOut, AlertTriangle, ExternalLink, Lock, HelpCircle, Save, Send, Eye, Layers, ArrowRight, Moon, Sun } from 'lucide-react';
import { screens, screenById, home, roleNames, titles, fieldsFor, valuesForCase, NAVIGATION_ONLY } from '@/lib/forms';
import { BOARDS, CATEGORIES, SOURCE_STATUSES, parseValues, type Actor, type Role, type Values, type CaseRow, type EvidenceRow } from '@/lib/types';
import { translate, type Language } from '@/lib/locale';
import { navigation, canOpenScreen, screenUrl, resolveLocation, dialogParent, modernTitles, modernDescriptions, caseTabs, caseEntry } from '@/lib/navigation';
import type { DashboardData, LiveMetric } from '@/lib/metrics';
import { BrandGlyph, RoleNavigation, ScreenDirectory, ModernDashboard, PageGuide, MetricsLibrary, AccessExperience, ModernBars } from './modern-components';
import { CaseTable, Filters, DefinitionRows, Timeline, Records, EvidenceTable, RecordForm, ImportWorkspace, CalendarView, KnowledgeSearch, CommitConfirmation, ImportsTable, CaseValues } from './workspace-components';
export type Detail = {
    case: CaseRow;
    records: any[];
    evidence: EvidenceRow[];
    events: any[];
    sources: any[];
    links: any[];
};
export type Group = {
    label: string;
    count: number;
};
type Dashboard = DashboardData;
export const draftscreens = new Set(['C03', 'C04', 'C05', 'C06', 'I12']);
const dashboards = new Set(['C01', 'C02', 'I01', 'O01', 'V01', 'R01', 'D01', 'L01', 'A01', 'T01']), lists = new Set(['S05', 'I13', 'V02', 'V03', 'V04', 'L04']), calendars = new Set(['C14', 'O11', 'D05', 'R05']);
export const tableNames: Record<string, string[]> = { O03: ['issue'], O05: ['plan'], O06: ['input'], O07: ['input', 'input_assessment'], O10: ['inspection'], O11: ['hearing', 'reschedule'], O12: ['minutes'], O13: ['finding'], O14: ['proposal', 'decision'], O15: ['action', 'execution', 'review_action'], O16: ['action', 'verification', 'review_action'], O17: ['atr', 'atr_review'], O18: ['communication', 'communication_retry'], V04: ['input'], V05: ['extension', 'intervention'], V06: ['proposal', 'decision'], V07: ['atr', 'atr_review'], V08: ['action', 'verification', 'closure', 'feedback'], V09: ['legacy_review'], V10: ['prevention'], D03: ['respondent_response'], D04: ['rent_ledger'], D05: ['hearing', 'hearing_response'], D06: ['compliance'], R01: ['review', 'admissibility', 'review_decision'], R02: ['review', 'admissibility'], R03: ['review_assessment', 'finding'], R04: ['review_material'], R05: ['review_hearing'], R06: ['review_decision'], R07: ['review_action'], R08: ['decision', 'review_decision', 'review_action'], C13: ['review', 'admissibility', 'review_decision', 'review_action'], C10: ['decision', 'atr', 'review_decision'], C14: ['hearing', 'review_hearing'], L04: ['prevention'], L05: ['verification', 'feedback', 'closure'] };
export const pretty = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());
export const date = (s: string | null | undefined) => s ? new Date(s.length === 10 ? s + 'T12:00:00Z' : s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
export const number = (n: number | undefined) => Number(n || 0).toLocaleString('en-IN');
export const text = (v: unknown) => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '');
const tone = (s: string) => /Verified|Approved|Complete|Accepted|Confirmed|Admitted/.test(s) ? 'green' : /Return|Declined|Failed|Disput|Rejected|Unlinked/.test(s) ? 'red' : /Pending|Unassessed|Requested|Triage|Legacy|Unavail/.test(s) ? 'amber' : 'blue';
function Icon({ id }: {
    id: string;
}) { return id.startsWith('T') ? <Settings size={17}/> : calendars.has(id) ? <CalendarDays size={17}/> : id.startsWith('A') ? <ShieldCheck size={17}/> : id.startsWith('R') ? <Scale size={17}/> : id === 'S05' ? <Search size={17}/> : id === 'S04' ? <Bell size={17}/> : dashboards.has(id) ? <LayoutDashboard size={17}/> : ['O08', 'O09', 'A03', 'C10'].includes(id) ? <FolderOpen size={17}/> : <ClipboardList size={17}/>; }
export function Badge({ children, status }: {
    children: React.ReactNode;
    status?: string;
}) { return <span className={'badge ' + tone(status || String(children))}>{children}</span>; }
export function Empty({ title = 'No records yet', body = 'Saved work in this workspace will appear here.', action }: {
    title?: string;
    body?: string;
    action?: React.ReactNode;
}) { return <div className="empty"><FolderOpen size={30}/><h3>{title}</h3><p>{body}</p>{action}</div>; }
function Bars({ items }: {
    items: Group[];
}) { return <ModernBars items={items} label="Workspace distribution"/>; }
function Metric({ label, value, note, icon, onClick }: {
    label: string;
    value: number;
    note: string;
    icon: React.ReactNode;
    onClick: () => void;
}) { return <button className="metric" onClick={onClick}><span className="metric-label">{label}<span>{icon}</span></span><strong>{number(value)}</strong><span className="metric-note">{note}</span></button>; }
function Dialog({ title, children, onClose }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) { const ref = useRef<HTMLDivElement>(null), onCloseRef = useRef(onClose); onCloseRef.current = onClose; useEffect(() => { const prior = document.activeElement as HTMLElement; ref.current?.querySelector<HTMLElement>('button,input,select,textarea')?.focus(); const handler = (e: KeyboardEvent) => { if (e.key === 'Escape')
    onCloseRef.current(); if (e.key === 'Tab') {
    const f = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]');
    if (!f?.length)
        return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
} }; document.addEventListener('keydown', handler); return () => { document.removeEventListener('keydown', handler); prior?.focus(); }; }, []); return <div className="dialog-shade" onMouseDown={e => { if (e.target === e.currentTarget)
    onClose(); }}><div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></div>; }
function ThemeToggle() {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        setDark(document.documentElement.dataset.theme === 'dark');
    }, []);
    const apply = (nextDark: boolean) => {
        if (nextDark) document.documentElement.dataset.theme = 'dark';
        else delete document.documentElement.dataset.theme;
        localStorage.setItem('mhada-theme', nextDark ? 'dark' : 'light');
        setDark(nextDark);
    };
    return <button type="button" className="icon-button theme-toggle" aria-pressed={dark} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'} onClick={() => apply(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}<span>{dark ? 'Light' : 'Dark'}</span></button>;
}
export default function MhadaApplication() {
    const [actor, setActor] = useState<Actor | null>(null), [role, setRole] = useState<Role>('Leadership'), [screen, setScreen] = useState('L01'), [caseId, setCaseId] = useState(''), [detail, setDetail] = useState<Detail | null>(null), [dash, setDash] = useState<Dashboard | null>(null), [cases, setCases] = useState<CaseRow[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [q, setQ] = useState(''), [filter, setFilter] = useState(''), [board, setBoard] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState('');
    const [collections, setCollections] = useState<any[]>([]), [members, setMembers] = useState<any[]>([]), [configs, setConfigs] = useState<any[]>([]), [imports, setImports] = useState<any[]>([]), [jobs, setJobs] = useState<any[]>([]), [events, setEvents] = useState<any[]>([]), [notifications, setNotifications] = useState<any[]>([]), [drafts, setDrafts] = useState<CaseRow[]>([]), [preferences, setPreferences] = useState<Values>({}), [batchId, setBatchId] = useState(''), [batch, setBatch] = useState<any>(null), [setup, setSetup] = useState<any>(null);
    const [loading, setLoading] = useState(true), [loadingData, setLoadingData] = useState(false), [caseLoading, setCaseLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [toast, setToast] = useState(''), [modal, setModalState] = useState(''), [mobileMenu, setMobileMenu] = useState(false), [picker, setPicker] = useState(false), [refresh, setRefresh] = useState(0), [evidenceId, setEvidenceId] = useState(''), [help, setHelp] = useState(false), [reportQuery, setReportQuery] = useState(''), [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [directoryOpen, setDirectoryOpen] = useState(false), [metricsOpen, setMetricsOpen] = useState(false);
    const retryKey = useRef({ signature: '', key: '' }), epoch = useRef(0), pendingDialog = useRef(''), caseTicket = useRef(0), casePending = useRef(false), detailRef = useRef<Detail | null>(null);
    const language = (preferences['Preferred language'] || 'English') as Language;
    const t = (v: string) => translate(v, language);
    const s = screenById[screen] || screenById[home[role]], c = detail?.case.id === caseId ? detail.case : null;
    detailRef.current = detail;
    const api = useCallback(async (path: string, init: RequestInit = {}, workspace: string = role) => { const h = new Headers(init.headers); if (workspace)
        h.set('x-workspace-role', workspace); if (init.body && !(init.body instanceof FormData))
        h.set('Content-Type', 'application/json'); const r = await fetch('/api/' + path, { ...init, headers: h, cache: 'no-store' }); const result: any = await r.json(); if (!r.ok)
        throw new Error(result.error || 'The request could not complete.'); return result; }, [role]);
    const href = (path: string) => '/api/' + path + (path.includes('?') ? '&' : '?') + 'role=' + encodeURIComponent(role);
    const refreshData = () => setRefresh(x => x + 1);
    const clearRole = () => { epoch.current++; setDetail(null); setDash(null); setCases([]); setCollections([]); setMembers([]); setConfigs([]); setEvents([]); setImports([]); setJobs([]); setDrafts([]); };
    function setModal(id: string) {
        if (id && (!actor || !canOpenScreen(id, role, actor.roles))) {
            setToast('This dialog requires its authorised workspace.');
            return;
        }
        setModalState(id);
        if (id) {
            const parent = dialogParent(id, role);
            if (canOpenScreen(parent, role, actor.roles)) setScreen(parent);
        }
        const url = screenUrl(id || screen, {role, caseId, batchId, metrics:metricsOpen});
        if (id) history.pushState({}, '', url); else history.replaceState({}, '', url);
    }
    const navigate = useCallback((id: string, selected?: string) => {
        const target = screenById[id];
        if (!target || !actor) return;
        if (!canOpenScreen(id, role, actor.roles)) {
            const workspace = target.role === 'Shared' ? 'authorised' : target.role;
            setToast(`The ${workspace} workspace will handle the next step.`);
            return;
        }
        const selectedCase = selected !== undefined ? selected : caseId;
        if (selected !== undefined && selectedCase !== caseId) {setCaseId(selectedCase); setDetail(null); setCaseLoading(!!selectedCase);}
        else if (selected && selectedCase === caseId && !detailRef.current && !casePending.current) refreshData();
        const parent = target.template === 'modal' ? dialogParent(id, role) : id;
        if (target.template !== 'modal' || canOpenScreen(parent, role, actor.roles)) setScreen(parent);
        pendingDialog.current = ''; setModalState(target.template === 'modal' ? id : '');
        setPage(1); setQ(''); setError(''); setDirectoryOpen(false); setMetricsOpen(false); setMobileMenu(false);
        setFilter(id === 'I13' ? 'legacy' : id === 'V03' ? 'unassigned' : '');
        setBoard(''); setCategory(''); setStatus('');
        history.pushState({}, '', screenUrl(target.template === 'modal' && !canOpenScreen(parent, role, actor.roles) ? screen : id,{role,caseId:selectedCase,batchId}));
        window.scrollTo({top:0,behavior:'auto'});
    }, [actor, role, caseId, batchId, screen]);
    const switchRole = (next: Role) => {
        if (!actor?.roles.includes(next)) return;
        clearRole(); setRole(next); setScreen(home[next]); setCaseId(''); setModalState('');
        setFilter(''); setQ(''); setPage(1); setError(''); setMobileMenu(false); setDirectoryOpen(false); setMetricsOpen(false);
        setBoard(''); setCategory(''); setStatus(''); setBatchId(''); setBatch(null);
        history.pushState({}, '', screenUrl(home[next],{role:next}));
    };
    function restoreFilters(url: URL) {
        setQ(url.searchParams.get('q') || ''); setFilter(url.searchParams.get('filter') || '');
        setBoard(url.searchParams.get('board') || ''); setCategory(url.searchParams.get('category') || ''); setStatus(url.searchParams.get('status') || '');
        setPage(Math.max(1,Number(url.searchParams.get('page') || 1) || 1));
    }
    useEffect(() => { let alive = true; (async () => { try {
        const session = await api('session', {}, '');
        if (!alive)
            return;
        setActor(session.actor);
        setPreferences(parseValues(session.preferences?.payload));
        const route = resolveLocation(location.href,session.actor.role,session.actor.roles);
        const initialRole = route.role;
        setRole(route.role); setScreen(route.screen); setCaseId(route.caseId); setModalState(route.dialog);
        setBatchId(route.batchId); setMetricsOpen(route.metrics); restoreFilters(new URL(location.href));
        if (route.denied) setError('This page is not assigned to your account. Your authorised workspace is shown.');
        history.replaceState({},'',screenUrl(route.screen,{role:route.role,caseId:route.caseId,batchId:route.batchId,dialog:route.dialog,metrics:route.metrics}) + (location.search.includes('q=') ? '&q='+encodeURIComponent(new URLSearchParams(location.search).get('q')||'') : ''));
        let progress = await api('setup', {}, initialRole);
        setSetup(progress);
        if (!progress.ready && progress.can_initialize) {
            while (alive && !progress.ready) {
                progress = await api('setup', { method: 'POST' }, initialRole);
                if (alive)
                    setSetup(progress);
                if (progress.busy)
                    await new Promise(resolve => setTimeout(resolve, 400));
            }
        }
        if (alive) {
            setLoading(false);
            refreshData();
        }
    }
    catch (e) {
        if (alive) {
            setError((e as Error).message);
            setLoading(false);
        }
    } })(); return () => { alive = false; }; }, []);
    useEffect(() => {
        if (!actor) return;
        const pop = () => {
            const route = resolveLocation(location.href,role,actor.roles);
            clearRole(); setRole(route.role); setScreen(route.screen); setCaseId(route.caseId); setDetail(null);
            setModalState(route.dialog); setMetricsOpen(route.metrics); setBatchId(route.batchId); setDirectoryOpen(false);
            restoreFilters(new URL(location.href));
            if(route.denied) setError('This page is not assigned to your account.');
        };
        window.addEventListener('popstate',pop); return ()=>window.removeEventListener('popstate',pop);
    },[actor,role]);
    useEffect(() => {
        if(!actor||loading) return;
        const url=new URL(screenUrl(screen,{role,caseId,batchId,dialog:modal,metrics:metricsOpen}),location.origin);
        for(const [key,value] of Object.entries({q,filter,board,category,status,page:page>1?String(page):''})) if(value) url.searchParams.set(key,value);
        history.replaceState({},'',url.pathname+url.search);
    },[actor,loading,screen,role,caseId,batchId,modal,metricsOpen,q,filter,board,category,status,page]);
    useEffect(()=>{
        const handle=(e:KeyboardEvent)=>{
            if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setDirectoryOpen(v=>!v);}
            if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)){e.preventDefault();navigate('S05');}
        };
        window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
    },[navigate]);
    useEffect(() => { if (!actor || loading)
        return; let active = true; const token = epoch.current; const valid = () => active && epoch.current === token; setLoadingData(true); const params = new URLSearchParams({ page: String(page), q, filter, board, category, status }); if (screen === 'O01')
        params.set('owner', actor.id); (async () => { try {
        const [d, rows, col, n] = await Promise.all([api('dashboard'), api('cases?' + params), api('collections'), api('notifications')]);
        if (!valid())
            return;
        setDash(d);
        setCases(rows.cases);
        setTotal(rows.total);
        setCollections(col.records);
        setNotifications(n.notifications);
        const extras: Promise<any>[] = [];
        if (['Citizen', 'Intake'].includes(role))
            extras.push(api('drafts').then(x => { if (valid())
                setDrafts(x.drafts); }));
        if (['Admin', 'Intake', 'Officer', 'Supervisor', 'Review', 'Audit'].includes(role)) {
            extras.push(api('directory').then(x => { if (valid())
                setMembers(x.members); }));
            extras.push(api('configs').then(x => { if (valid())
                setConfigs(x.configs); }));
        }
        if (['Admin', 'Intake', 'Supervisor', 'Audit'].includes(role)) {
            extras.push(api('imports').then(x => { if (valid())
                setImports(x.imports); }));
            extras.push(api('jobs').then(x => { if (valid())
                setJobs(x.jobs); }));
        }
        if (['Admin', 'Supervisor', 'Audit'].includes(role))
            extras.push(api('events').then(x => { if (valid())
                setEvents(x.events); }));
        const results = await Promise.allSettled(extras);
        const failed = results.find(r => r.status === 'rejected');
        if (valid() && failed?.status === 'rejected')
            setError(failed.reason.message);
    }
    catch (e) {
        if (valid())
            setError((e as Error).message);
    }
    finally {
        if (valid())
            setLoadingData(false);
    } })(); return () => { active = false; }; }, [actor, loading, role, screen, page, q, filter, board, category, status, refresh, api]);
    useEffect(() => {
        if (!actor || !caseId || loading) return;
        const ticket = ++caseTicket.current;
        const requested = caseId;
        let attempt = 0;
        let timer = 0;
        casePending.current = true;
        setCaseLoading(true);
        const load = () => {
            api('cases/' + encodeURIComponent(requested)).then(x => {
                if (caseTicket.current !== ticket) return;
                casePending.current = false;
                setDetail(x);
                setEvidenceId(x.evidence?.[0]?.id || '');
                setCaseLoading(false);
            }).catch((e: Error) => {
                if (caseTicket.current !== ticket) return;
                if (attempt < 2) {
                    attempt += 1;
                    timer = window.setTimeout(load, 350 * attempt);
                    return;
                }
                casePending.current = false;
                setCaseLoading(false);
                setError(e.message || 'The case record could not be loaded.');
            });
        };
        load();
        return () => window.clearTimeout(timer);
    }, [actor, caseId, role, refresh, loading, api]);
    useEffect(() => { if (!batchId)
        return; let active = true; api('imports/' + batchId).then(x => { if (active)
        setBatch(x); }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [batchId, refresh, api]);
    useEffect(() => { if (!toast)
        return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); }, [toast]);
    async function perform(operation: () => Promise<any>) { setBusy(true); setError(''); try {
        return await operation();
    }
    catch (e) {
        setError((e as Error).message);
        return null;
    }
    finally {
        setBusy(false);
    } }
    async function save(values: Values, partial = false, id = screen) { return perform(async () => { if (id === 'M02') {
        if (!c) throw new Error('Choose a case before saving an evidence version.');
        const current=await api('cases/'+encodeURIComponent(c.id));
        if (!current.evidence.some((e:EvidenceRow)=>e.id===text(values['New file'])&&e.previous_id===text(values['Evidence reference']))) throw new Error('Upload a replacement file for the selected original before saving this version.');
        setModal('');
        setToast('New evidence version stored; the original is retained.');
        return { ok: true };
    } if (draftscreens.has(id)) {
        const r = await api('draft', { method: 'POST', body: JSON.stringify({ screen: id, values, case_id: c?.kind === 'draft' ? c.id : undefined, partial }) });
        setCaseId(r.case_id);
        setDetail(await api('cases/' + r.case_id));
        setToast(r.message);
        if (!partial && id === 'C06')
            setModal('M01');
        else if (!partial)
            navigate(id === 'I12' ? 'C06' : screenById[id].primary.target, r.case_id);
        refreshData();
        return r;
    } const payload = { screen: id, case_id: c?.id, revision: c?.revision, values }; const signature = JSON.stringify(payload); if (retryKey.current.signature !== signature)
        retryKey.current = { signature, key: crypto.randomUUID() }; const r = await api('actions', { method: 'POST', body: JSON.stringify({ ...payload, key: retryKey.current.key }) }); retryKey.current = { signature: '', key: '' }; setToast(r.message || 'Record saved.'); setModal(''); if (id === 'S06')
        setPreferences(values); refreshData(); if (r.case_id)
        setCaseId(r.case_id); if (id === 'M01')
        navigate('C07', r.case_id);
    else if (id !== 'S06') {
        const target=id.startsWith('T')?screenById[id].primary.target:r.target;
        if(target&&target!==id){
            if(actor && canOpenScreen(target, role, actor.roles)) navigate(target,r.case_id||c?.id);
            else setToast((r.message||'Record saved.')+' The associated '+(screenById[target]?.role||'authorised')+' workspace will handle the next step.');
        }
    } return r; }); }
    async function upload(file: File, label: string, values: Values, id = screen) { return perform(async () => { let chosen = c; if (!chosen) {
        if (!draftscreens.has(id))
            throw new Error('Choose a case before uploading evidence.');
        const r = await api('draft', { method: 'POST', body: JSON.stringify({ screen: id, values, partial: true }) });
        setCaseId(r.case_id);
        chosen = r.draft;
    } const data = new FormData(); data.set('case_id', chosen!.id); data.set('file', file); data.set('description', label + ': ' + text(values['Evidence description'] || values.Description || values['Evidence explanation'] || file.name)); data.set('classification', text(values['Evidence classification'] || 'Normal')); data.set('citizen_safe', String(values['Citizen-safe copy'] === true)); data.set('respondent_safe', String(values['Respondent-safe copy'] === true)); if (id === 'M02') {
        data.set('previous_id', text(values['Evidence reference']));
        data.set('version_reason', text(values['Version reason']));
    } const r = await api('evidence', { method: 'POST', body: data }); setToast(r.message); setDetail(await api('cases/' + chosen!.id)); return r; }); }
    const selectCase = (id: string) => { if (id !== caseId) { setCaseId(id); setDetail(null); setCaseLoading(true); } else if (!detail && !casePending.current) refreshData(); };
    const openCase = (id: string) => { const entry = caseEntry(role); if (entry) navigate(entry, id); else selectCase(id); };
    const chooseCase = (id: string) => { setPicker(false); if (pendingDialog.current) { selectCase(id); setModal(pendingDialog.current); pendingDialog.current = ''; } else if (dashboards.has(screen) || screen === 'S05') openCase(id); else selectCase(id); };
    const records = ((c ? detail?.records : collections) || []).filter(r => !tableNames[screen] || tableNames[screen].includes(r.type));
    const needsCase = !screen.startsWith('T') && !draftscreens.has(screen) && !['S06', 'S05', 'L06', 'A06'].includes(screen) && (s.case || (!NAVIGATION_ONLY.has(screen) && fieldsFor(screen).length > 0));
    const formView = fieldsFor(screen).length > 0 && !['S01', 'S02', 'S05', 'I02', 'A04', 'L06', 'A06', 'M10'].includes(screen) && (!NAVIGATION_ONLY.has(screen) || screen === 'T08');
    const ev = detail?.evidence.find(x => x.id === evidenceId), unread = notifications.filter(x => !x.read_at).length, readOnly = ['Leadership', 'Audit'].includes(role);
    if (!actor)
        return <div className="boot"><div className="brand-mark"><Building2 size={28}/></div><h1>MHADA Grievance & Redressal</h1><p>{error || 'Opening your secure workspace…'}</p>{error && <button className="button primary" onClick={() => location.reload()}>Retry connection</button>}</div>;
    return <div data-design-version="2.0" className={'app ' + (preferences['High contrast'] === 'On' ? 'contrast ' : '') + (preferences['Text size'] === 'Large' ? 'large-text' : '')}><div className="app-shell" inert={modal || picker || help || directoryOpen || metricsOpen ? true : undefined}>
 <aside className={'sidebar ' + (mobileMenu ? 'mobile-open' : '')}><a className="brand" href="/" onClick={e => { e.preventDefault(); navigate(home[role]); }}><span className="brand-mark"><BrandGlyph/></span><span><strong>MHADA</strong><small>Grievance & Redressal</small></span></a><div className="sidebar-label">WORKSPACE</div><label className="workspace-select"><span className="sr-only">Workspace role</span><select value={role} onChange={e => switchRole(e.target.value as Role)}>{actor.roles.map(r => <option key={r} value={r}>{roleNames[r]}</option>)}</select><ChevronDown size={16}/></label><nav aria-label="Workspace screens" className="side-nav"><div className="sidebar-label">YOUR TOOLS</div><RoleNavigation role={role} screen={screen} caseId={caseId} batchId={batchId} onNavigate={id=>navigate(id)}/><div className="sidebar-label">SHARED SERVICES</div>{['S01', 'S04', 'S05', 'S06'].map(id => <button key={id} className={'nav-link ' + (screen === id ? 'active' : '')} onClick={() => navigate(id)}><Icon id={id}/><span>{t(id === 'S04' ? 'Notifications' : id === 'S05' ? 'Search' : id === 'S06' ? 'My profile' : 'Workspace')}</span>{id === 'S04' && unread > 0 && <span className="nav-count">{unread}</span>}</button>)}</nav><button className="sidebar-help" onClick={() => setHelp(true)}><HelpCircle size={18}/><span>Here to help.<small>Guidance & assisted access</small></span><ArrowUpRight size={15}/></button><div className="sidebar-person"><span className="avatar">{actor.name.slice(0, 1).toUpperCase()}</span><span><strong>{actor.name}</strong><small>{role}</small></span><a href="/signout-with-chatgpt?return_to=%2F" aria-label="Sign out"><LogOut size={16}/></a></div></aside>
 {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}<div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="icon-button menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Open navigation"><Menu size={22}/></button><button className="search-trigger" onClick={()=>navigate('S05')}><Search size={18}/><span>Search permitted cases, evidence or properties</span><kbd>/</kbd></button></div><div className="topbar-actions"><div className="topbar-snapshot"><CalendarDays size={19}/><span>Source baseline<b>14 Oct 2026</b></span></div><button className="icon-button" onClick={()=>setDirectoryOpen(true)} aria-label="Open screen directory" title="All pages · Ctrl / Cmd K"><Layers size={18}/></button><button className="icon-button" onClick={()=>{setError('');refreshData();}} aria-label="Refresh data"><RefreshCw size={18} className={loadingData?'spinning':''}/></button><button className="notification-button icon-button" aria-label="Notifications" onClick={()=>navigate('S04')}><Bell size={19}/>{unread>0&&<i/>}</button><ThemeToggle/><label className="language"><span className="sr-only">Language</span><select value={language} onChange={e=>setPreferences(v=>({...v,'Preferred language':e.target.value}))}><option value="English">EN</option><option value="Marathi">MR</option><option value="Hindi">HI</option></select></label><button className="topbar-avatar avatar" aria-label="My profile" onClick={()=>navigate('S06')}>{actor.name.slice(0,1).toUpperCase()}</button></div></header><main id="main-content" className="main-content">
 <a href="#page-title" className="skip-link">Skip to page content</a><div className="page-breadcrumb"><button onClick={()=>navigate(home[role])}>{roleNames[role]}</button><ChevronRight size={13}/><span>{s.id}</span><button className="page-directory-link" onClick={()=>setDirectoryOpen(true)}>All pages<Layers size={14}/></button></div>
 <div className="page-intro"><div className="page-heading"><div><h1 id="page-title">{t(modernTitles[screen]||titles[screen]||s.title)}</h1><p>{modernDescriptions[screen]||s.purpose}</p></div><div className="heading-actions">{['Citizen','Intake'].includes(role)&&<button className="button primary" onClick={()=>navigate(role==='Intake'?'I12':'C03','')}><Plus size={17}/>{t('New grievance')}</button>}{!['Citizen','Developer','Officer','Review'].includes(role)&&<a className="button" href={href('export?format=csv')}><Download size={16}/>Export register</a>}<button className="icon-button heading-metrics" title="Workspace KPI definitions" aria-label="Workspace KPI definitions" onClick={()=>setMetricsOpen(true)}><Activity size={19}/></button></div></div>
 {dash&&!['S01','S02','S03','C01'].includes(screen)&&<div className="data-provenance"><span>{['Citizen','Developer'].includes(role)?'YOUR WORKSPACE':'SOURCE & WORKFLOW'}</span><p>{['Citizen','Developer'].includes(role)?'Verified account · Authorised cases only · Saved records and current actions':`${number(dash.operational?.historical||0)} historical records in scope · Original source labels and verified outcomes remain separate.`}</p><ShieldCheck size={17}/></div>}</div>
 {loading && setup && !setup.ready && <section className="panel setup-panel"><h2>Preparing the historical register</h2><p>Progress reflects committed database records. Original exports are preserved.</p><progress value={setup.completed} max={setup.total}/><strong>{number(setup.completed)} / {number(setup.total)} records</strong></section>}{setup && !setup.ready && !loading && <div className="alert amber"><AlertTriangle size={18}/><span>Source initialisation is incomplete. {setup.can_initialize && <button onClick={() => location.reload()}>Resume initialisation</button>}</span></div>}{error && <div role="alert" className="alert red"><AlertTriangle size={19}/><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={17}/></button></div>}
 {needsCase && !c && <section className="panel"><Empty title={caseId ? 'Opening the selected case…' : 'Choose a case to continue'} body={caseId ? 'The saved case values are loading and will appear in this workspace.' : 'The form, evidence and decisions are scoped to the selected case.'} action={caseId && !caseLoading ? <button className="button primary" onClick={() => refreshData()}><RefreshCw size={16}/>Load case again</button> : !caseId ? <button className="button primary" onClick={() => setPicker(true)}><Search size={16}/>Choose case</button> : undefined}/></section>}
 {!needsCase && caseId && !c && <section className="panel"><Empty title="Opening the selected case…" body="The saved case values are loading and will appear in this workspace." action={!caseLoading ? <button className="button primary" onClick={() => refreshData()}><RefreshCw size={16}/>Load case again</button> : undefined}/></section>}
 {c && detail && <CaseValues detail={detail}/>}
 {c && !draftscreens.has(screen) && <section className="case-banner"><div><span className="eyebrow">{c.kind === 'historical' ? 'HISTORICAL SOURCE RECORD' : 'REGISTERED GRIEVANCE'}</span><h2>{c.reference}</h2><p>{c.title}</p></div><div className="case-banner-tags"><Badge>{c.stage}</Badge><Badge>{c.priority}</Badge>{!!c.restricted && <Badge><Lock size={12}/>Restricted</Badge>}<button className="button small" onClick={() => setPicker(true)}>Change case</button></div><div className="case-facts">{Object.entries({ 'Source label': c.source_status || 'Unavailable', 'Internal outcome': c.outcome, 'Accountable owner': c.owner_name || 'Unassigned', 'Original receipt': date(c.received_date), 'Approved due date': date(c.due_date), 'Board / office family': c.board }).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></section>}
 {c && s.case && !!caseTabs(role).length && <div className="case-tabs">{caseTabs(role).map(([label, id]) => <button key={id} className={screen === id ? 'selected' : ''} onClick={() => navigate(id, c.id)}>{label}</button>)}</div>}
 {screen==='C01'&&<section className="citizen-next-hero citizen-landing"><div><span className="eyebrow">MHADA CITIZEN SERVICES</span><h2>Your concern deserves<br/>a clear response.</h2><p>Tell us what happened, follow each next step and see the evidence behind the response.</p><div className="button-row"><button className="button light" onClick={()=>navigate('C03','')}><Plus size={17}/>Register a grievance</button><button className="button light outline" onClick={()=>{navigate('C08');if(!c)setPicker(true);}}>Track a grievance<ArrowRight size={17}/></button></div></div><img src="/design/civic-homes.svg" alt=""/></section>}
 {dashboards.has(screen)&&screen!=='C01'&&dash&&<div className={'command-board'+(role==='Citizen'?' command-board-citizen':'')}><ModernDashboard role={role} data={dash} onNavigate={id=>navigate(id,id==='C03'?'':undefined)} onCase={openCase} onMetrics={()=>setMetricsOpen(true)} onMetric={(m:LiveMetric)=>{if(m.filter){setFilter(m.filter);setPage(1);setPicker(true);}else if(m.target===screen){document.getElementById('workspace-records')?.scrollIntoView({behavior:'smooth'});}else navigate(m.target);}}/>
 <div id="workspace-records" className="command-register">{role==='Review'?<Records records={collections.filter(r=>tableNames.R01.includes(r.type))} onOpen={openCase} title="Independent review worklist"/>:role==='Admin'?<section className="panel"><div className="panel-heading"><h2>Organisation & jurisdiction</h2><Building2 size={20}/></div><div className="org-chain">{['Authority','Board','Department / zone','Office','Designation'].map((label,i)=><React.Fragment key={label}>{i>0&&<ChevronRight size={17}/>}<span><Building2 size={18}/>{label}</span></React.Fragment>)}</div><p className="subtle">Retain original source office strings separately. Enter the approved jurisdiction and effective period below.</p></section>:<CaseTable cases={cases} total={total} page={page} setPage={setPage} onOpen={openCase} title={role==='Officer'?'My assigned work':role==='Citizen'?'Your grievances':role==='Developer'?'Authorised cases':'Historical & operational register'} loading={loadingData}/>}</div>
 {drafts.length>0&&<section className="panel command-drafts"><div className="panel-heading"><h2>Saved drafts</h2><span className="subtle">Continue where you left off</span></div>{drafts.map(d=><button className="draft-row" key={d.id} onClick={()=>navigate(role==='Intake'?'I12':'C03',d.id)}><span className="step-icon"><FileText size={20}/></span><span><b>{d.title}</b><small>Updated {date(d.updated_at)} · awaiting submission</small></span><ChevronRight size={18}/></button>)}</section>}</div>}
 {screen === 'L04' && dash && <section className="panel"><h2>Structured property references</h2><p>Clusters use explicitly recorded building references within your scope. Historical preview text is not used to merge properties, people or remedies.</p><Bars items={dash.properties || []}/></section>}{lists.has(screen) && <><Filters q={q} setQ={v => { setQ(v); setPage(1); }} filter={filter} setFilter={v=>{setFilter(v);setPage(1);}} board={board} setBoard={v=>{setBoard(v);setPage(1);}} category={category} setCategory={v=>{setCategory(v);setPage(1);}} status={status} setStatus={v=>{setStatus(v);setPage(1);}}/>{screen === 'V04' ? <Records records={collections.filter(r => r.type === 'input')} onOpen={openCase}/> : <CaseTable cases={cases} total={total} page={page} setPage={setPage} onOpen={openCase} title="Case register" loading={loadingData}/>} {['V02', 'L04'].includes(screen) && <Records records={collections.filter(r => screen === 'V02' ? ['input', 'action', 'review_action'].includes(r.type) : r.type === 'prevention')} onOpen={openCase}/>}</>}
 {['L02', 'L03', 'L05'].includes(screen) && dash && <div className="analytics-grid"><section className="panel"><h2>{screen === 'L02' ? 'Board / office families' : screen === 'L03' ? 'Source labels' : 'Outcome coverage'}</h2><Bars items={screen === 'L02' ? dash.boards : screen === 'L03' ? dash.statuses : [{ label: 'Verified remedy', count: dash.verified_remedies }, { label: 'Approved closure', count: dash.internally_closed }, { label: 'Source terminal; remedy unverified', count: dash.source_terminal }]}/></section><section className="panel"><h2>{screen === 'L03' ? 'Receipt cohorts' : 'Category coverage'}</h2><Bars items={screen === 'L03' ? dash.cohorts : dash.categories}/></section><section className="panel"><h2>Internal progress</h2><Bars items={dash.stages}/></section><section className="panel"><h2>Measurement definitions</h2><DefinitionRows data={{ Population: 'Cases within your permitted scope', 'Source labels': 'Most recent imported label; no live synchronisation', 'Receipt cohort': 'Original receipt month retained across routing', 'Verified remedy': 'Checked execution evidence and approved internal closure', 'Source age': 'Imported field, excluded from SLA calculation', 'Policy clock': 'Approved authority and calendar; otherwise unconfigured' }}/></section></div>}
 {['S01','S02','S03'].includes(screen)&&<AccessExperience actor={actor} role={role} screen={screen} onRole={switchRole} onNavigate={id=>navigate(id)}/>}
 {screen === 'S04' && <section className="panel"><h2>Notifications · {unread} unread</h2>{notifications.length ? notifications.map(n => <article className={'notification-row ' + (!n.read_at ? 'unread' : '')} key={n.id}><Bell size={19}/><div><h3>{n.title}</h3><p>{n.message}</p><small>{date(n.created_at)} · {n.delivery}</small></div>{n.case_id && <button className="button small" onClick={() => openCase(n.case_id)}>Open case</button>}{!n.read_at && <button className="icon-button" aria-label="Mark as read" onClick={() => perform(async () => { await api('notifications', { method: 'POST', body: JSON.stringify({ id: n.id }) }); refreshData(); })}><Check size={19}/></button>}</article>) : <Empty title="You’re up to date" body="Assignments and updates addressed to you appear here."/>}</section>}
 {['O02', 'D02', 'C08', 'C07', 'I06'].includes(screen) && c && <div className="case-content-grid"><section className="panel"><div className="panel-heading"><h2>{screen === 'C07' ? 'Registration acknowledged' : screen === 'D02' ? 'Served notice' : 'Grievance narrative'}</h2><Badge>{c.narrative_complete ? 'Full narrative' : 'Preview only'}</Badge></div>{screen === 'C07' && <div className="receipt"><CheckCircle2 size={40}/><h2>{c.reference}</h2><p>Your grievance is registered with a permanent reference and original receipt date.</p></div>}<p className="preserve-text">{c.narrative || c.preview || 'No narrative is available in this permitted view.'}</p>{!c.narrative_complete && <div className="alert amber"><AlertTriangle size={17}/><span>The description is a preview. Retrieve the full original record before findings.</span></div>}<DefinitionRows data={{ Category: c.category, 'Original receipt': date(c.received_date), 'Source token': c.source_token || '—', Office: c.office || 'To verify', 'Ownership acceptance': c.acceptance, 'Citizen confirmation': text(parseValues(c.details).confirmation || 'Unavailable'), 'Source update precision': c.source_updated ? 'Date only · ' + date(c.source_updated) : 'Unavailable' }}/><div className="button-row"><a className="button" href={href('export?format=print&case=' + c.id)} target="_blank" rel="noreferrer"><FileText size={16}/>{t('Print / Save PDF')}</a>{role === 'Officer' && <button className="button primary" onClick={() => navigate(c.acceptance === 'Accepted' ? 'O03' : 'O04', c.id)}>{c.acceptance === 'Accepted' ? 'Record issues' : 'Review ownership'}<ChevronRight size={16}/></button>}</div></section><section className="panel"><h2>Case timeline</h2><Timeline events={detail?.events || []}/></section>{!!detail?.links.length && <section className="panel"><h2>Reviewed related cases</h2>{detail.links.map(l => <button className="draft-row" key={l.id} onClick={() => openCase(l.other_id)}><Layers size={18}/><span><b>{l.other_reference}</b><small>{l.relationship}</small></span><ChevronRight size={16}/></button>)}</section>}</div>}
 {calendars.has(screen) && <CalendarView records={c ? detail?.records || [] : collections} month={month} setMonth={setMonth} onOpen={id=>navigate(screen,id)}/>}
 {screen==='C14'&&c&&<Records records={detail?.records.filter(r=>['hearing','review_hearing'].includes(r.type))||[]} onOpen={id=>navigate('C14',id)} title="Your hearing notices"/>}
 {draftscreens.has(screen) && <div className="wizard-steps">{['C03', 'C04', 'C05', 'C06'].map((id, i) => <button key={id} className={screen === id ? 'current' : ''} disabled={!c && i > 0} onClick={() => navigate(id, c?.id)}><span>{i + 1}</span>{['Describe issue', 'Service & property', 'Evidence', 'Review & submit'][i]}</button>)}</div>}
 {screen === 'C06' && c && <section className="panel"><h2>Review your saved grievance</h2><DefinitionRows data={Object.fromEntries(Object.entries(parseValues(c.details)).filter(([k, v]) => v !== '' && k !== 'Declaration'))}/><p className="subtle">{detail?.evidence.length || 0} documents securely stored. Registration occurs after confirmation.</p></section>}
 {['O08', 'O09', 'A03'].includes(screen) && c && <><section className="panel"><div className="panel-heading"><h2>Evidence catalogue</h2><span className="subtle">Originals retained · immutable file versions</span></div><EvidenceTable evidence={detail?.evidence || []} onChoose={id => { setEvidenceId(id); if (screen === 'O08')
        navigate('O09', c.id); }} href={href} onVersion={id => { setEvidenceId(id); setModal('M02'); }} canVersion={!readOnly && role!=='Supervisor'}/></section>{['O09','A03'].includes(screen) && ev && <section className="panel viewer-panel"><div className="panel-heading"><h2>{ev.filename}</h2><a className="button small" href={href('evidence/' + ev.id)}><Download size={15}/>Download original</a></div><div className="viewer-meta"><Badge>Version {ev.version}</Badge><Badge>{ev.review_state}</Badge><code>SHA-256 {ev.checksum}</code></div>{ev.mime === 'application/pdf' ? <iframe title={ev.filename} src={href('evidence/' + ev.id + '?inline=1')} className="document-viewer"/> : ev.mime.startsWith('image/') ? <img className="evidence-image" src={href('evidence/' + ev.id + '?inline=1')} alt={ev.description || ev.filename}/> : <Empty title="Download to inspect this document" body="The original Office or text file is available through its guarded download."/>}</section>}{screen === 'A03' && <Records records={detail?.records.filter(x => ['proposal', 'decision', 'finding', 'verification', 'citation', 'atr'].includes(x.type)) || []} onOpen={openCase}/>}</>}
 {screen === 'O08' && c && <section className="panel"><h2>Add supporting evidence</h2><RecordForm id="O08" c={c} actor={{ ...actor, role }} detail={detail} members={members} configs={configs} busy={busy} t={t} onSave={async () => { setToast('Files are stored when each upload completes.'); }} onUpload={upload}/></section>}
 {formView&&(!needsCase||c)&&<div className="detail-layout"><section className="panel form-panel"><div className="panel-heading"><div><h2>{draftscreens.has(screen)?screen==='C06'?'Review & declaration':'Tell us the details':screen==='S06'?'Your preferences':screen.startsWith('T')?'Configuration details':role==='Developer'?'Your response & records':'Record details'}</h2><p className="panel-description">Required fields are marked * · Changes retain their author and version</p></div></div><RecordForm key={screen+'-'+(c?.id||'new')+'-'+role} id={screen} c={c} actor={{...actor,role}} detail={detail} members={members} configs={configs} preferences={preferences} evidenceId={evidenceId} busy={busy} t={t} onSave={save} onUpload={upload}/></section><PageGuide screen={s} caseRecord={c} role={role} onNavigate={id=>navigate(id)}/></div>}
 {screen === 'O19' && c && <KnowledgeSearch api={api}/>}
 {['C10', 'C13', 'R08'].includes(screen) && c && <section className="panel"><div className="panel-heading"><h2>{screen === 'R08' ? 'Original and reviewed decisions' : 'Published case records'}</h2><a className="button small" href={href('export?case=' + c.id + '&format=print')} target="_blank" rel="noreferrer">Print / Save PDF<ExternalLink size={14}/></a></div><Records records={records} onOpen={openCase} embedded/></section>}
 {!!records.length && !dashboards.has(screen) && !['C10', 'C13', 'R08', 'O08', 'O09', 'A03', 'V04', 'L04', 'V02'].includes(screen) && (formView || tableNames[screen]) && <Records records={records} onOpen={openCase} title="Recorded work & current actions"/>}
 {['I02', 'I03', 'I04', 'I05'].includes(screen) && <ImportWorkspace screen={screen} batchId={batchId} batch={batch} imports={imports} busy={busy} api={api} href={href} onRun={perform} onBatch={id => { setBatchId(id); refreshData(); }} onNavigate={navigate} onCommit={() => setModal('M12')} refresh={refreshData}/>}
 {['A02', 'A01'].includes(screen) && <section className="panel"><div className="panel-heading"><h2>{c ? 'Case event history' : 'Recent audit events'}</h2><Badge>Append only</Badge></div><Timeline events={c ? detail?.events || [] : events}/></section>}
 {screen === 'A04' && <section className="panel"><h2>Source lineage & reconciliation</h2><ImportsTable imports={imports} href={href} canDownload={false} onChoose={setBatchId}/>{batch && <DefinitionRows data={{ Filename: batch.batch.filename, 'SHA-256': batch.batch.checksum, 'Original rows': batch.batch.row_count, Accepted: batch.batch.accepted, Updated: batch.batch.updated, Unchanged: batch.batch.unchanged, Rejected: batch.batch.rejected, Status: batch.batch.status }}/>}</section>}
 {['A05', 'T02', 'T03'].includes(screen) && <section className="panel"><h2>Account & role directory</h2><div className="table-wrap"><table><thead><tr><th>Account</th><th>Roles</th><th>Board scope</th><th>Access</th><th>Identity</th></tr></thead><tbody>{members.map(m => <tr key={m.id}><td><b>{m.name}</b><small>{m.email}</small></td><td>{JSON.parse(m.roles).join(', ')}</td><td>{JSON.parse(m.boards).join(', ') || 'Own cases'}</td><td><Badge>{m.active ? 'Active' : 'Disabled'}</Badge></td><td>{m.auth_id ? 'Verified sign-in' : 'Pending first sign-in'}</td></tr>)}</tbody></table></div></section>}
 {screen.startsWith('T') && configs.some(x => x.screen === screen) && <section className="panel"><h2>Saved configuration versions</h2>{configs.filter(x => x.screen === screen).map(conf => <details className="record-details" key={conf.key}><summary><b>{conf.key.replace(/:[\s\S]+/, '')}</b><span>v{conf.version} · {date(conf.updated_at)}</span></summary><DefinitionRows data={parseValues(conf.payload)}/></details>)}</section>}
 {screen === 'T08' && <section className="panel"><h2>Connection status</h2><DefinitionRows data={{ 'Source exports': 'XLSX / CSV import active; original files preserved', 'Live government portal adapters': 'Not configured; no portal writeback', 'Notifications': 'In-app delivery active', 'Email / SMS': 'External adapter not configured', Identity: 'Platform sign-in and server-enforced roles', 'Policy assistance': 'Approved-source retrieval; no model provider configured' }}/></section>}
 {screen === 'T09' && <section className="panel"><h2>Durable import jobs</h2>{jobs.length ? jobs.map(job => <div className="job-row" key={job.id}><div><h3>{job.type}</h3><code>{job.id}</code><p>{job.error || 'Checkpoint persisted after completed work.'}</p></div><div><Badge>{job.status}</Badge><progress value={job.completed} max={job.total}/><small>{number(job.completed)} / {number(job.total)}</small></div>{job.status !== 'Complete' && <button className="button" disabled={busy} onClick={() => perform(async () => { const p = parseValues(job.payload); let r = await api(job.id === 'initial-source-import' ? 'setup' : 'imports/' + p.batch_id + '/commit', { method: 'POST' }); while (!r.ready) {
        if (r.busy)
            await new Promise(resolve => setTimeout(resolve, 400));
        r = await api(job.id === 'initial-source-import' ? 'setup' : 'imports/' + p.batch_id + '/commit', { method: 'POST' });
    } refreshData(); setToast('Job resumed and completed.'); })}>Resume job</button>}</div>) : <Empty />}</section>}
 {['L06', 'A06'].includes(screen) && <section className="panel"><h2>Governed reports & exports</h2><RecordForm id={screen} c={c} actor={{ ...actor, role }} detail={detail} members={members} configs={configs} busy={busy} t={t} onUpload={upload} onSave={async (v) => { if (v['Include personal details'] === 'Authorised restricted export' || v['Personal details'] === 'Authorised restricted copy') {
        setError('Personal-contact exports require a separately approved export procedure. Use the masked pack.');
        return null;
    } const p = new URLSearchParams(); for (const [key, label] of [['from', 'Period from'], ['to', 'Period to'], ['board', 'Board / office'], ['cohort', 'Cohort'], ['report_type', 'Report type'], ['purpose', 'Export purpose']] as const)
        if (text(v[label]))
            p.set(key, text(v[label])); setReportQuery('&' + p.toString()); setToast('Report filters applied. Choose a download format below.'); return { ok: true }; }}/><p>Reports use your permitted scope. Evidence metadata retains hashes and file versions. Register exports omit personal contacts.</p><div className="export-grid"><a href={href('export?format=csv' + reportQuery)} className="export-card"><Download size={25}/><b>Case register CSV</b><p>Source labels, internal progress and original receipt dates.</p></a><a href={href('export?format=print' + reportQuery)} target="_blank" rel="noreferrer" className="export-card"><FileText size={25}/><b>Operational report</b><p>Printable report with source coverage and definitions.</p></a><button className="export-card" onClick={() => setPicker(true)}><FolderOpen size={25}/><b>Choose a case audit pack</b><p>Case records, events and evidence manifest.</p></button></div>{c && <div className="button-row"><a className="button primary" href={href('export?case=' + c.id + reportQuery)}>Download {c.reference} audit pack</a><a className="button" href={href('export?case=' + c.id + '&format=print')} target="_blank" rel="noreferrer">Print / Save PDF</a></div>}</section>}
 {c && !!detail?.sources.length && ['I06', 'O02'].includes(screen) && <section className="panel"><h2>Original source snapshots</h2>{detail.sources.map(src => <details className="record-details" key={src.id}><summary><b>{src.portal} · row {src.row_number}</b><span>{date(src.created_at)}</span></summary><DefinitionRows data={{ 'Original file': src.filename, 'File SHA-256': src.file_checksum, 'Snapshot hash': src.snapshot_hash, ...parseValues(src.raw) }}/></details>)}</section>}
 {c && !readOnly && <div className="context-actions">{role === 'Officer' && <><button className="button small" onClick={() => setModal('M04')}>Decline assignment</button><button className="button small" onClick={() => setModal('M11')}>Communication retry</button></>}{role === 'Supervisor' && <><button className="button small" onClick={() => setModal('M05')}>Deadline exception</button><button className="button small" onClick={() => setModal('M07')}>Return ATR</button></>}{role === 'Intake' && <><button className="button small" onClick={() => setModal('M03')}>Confirm related link</button><button className="button small" onClick={() => setModal('M06')}>Restricted referral</button></>}{role === 'Citizen' && <button className="button small" onClick={() => setModal('M09')}>Confirm challenge mechanism</button>}{['Citizen', 'Developer', 'Officer', 'Review'].includes(role) && <button className="button small" onClick={() => setModal('M08')}>Request rescheduling</button>}</div>}
 <section className="workflow-footer" aria-label="Page workflow actions"><span><Lock size={14}/>Role-scoped actions</span><div>{canOpenScreen(s.secondary.target, role, actor.roles) && <button className="button" disabled={busy} onClick={()=>navigate(s.secondary.target,c?.id)}>{s.secondary.label}</button>}{formView&&(!needsCase||c)?<button className="button primary" type="submit" form={'record-form-'+screen} disabled={busy}>{busy?'Saving…':s.primary.label}<ArrowRight size={16}/></button>:screen==='I02'||screen==='I03'?<button className="button primary" type="submit" form={screen==='I02'?'source-import-form':'source-mapping-form'} disabled={busy||(screen==='I03'&&!batchId)}>{screen==='I02'?'Preserve export & map columns':'Validate mapped rows'}<ArrowRight size={16}/></button>:(['S01','S02','S03','C13','C14','A03','I05','L06','A06'].includes(screen) || canOpenScreen(s.primary.target, role, actor.roles)) && <button className="button primary" disabled={busy||(needsCase&&!c)} onClick={()=>{if(screen==='S02'||screen==='S03')navigate(home[role]);else if(screen==='S01')navigate('S02');else if(screen==='C13'||screen==='C14'||screen==='A03'){document.querySelector('.records,.viewer-panel')?.scrollIntoView({behavior:'smooth'});}else if(screen==='I05'){if(!batchId){setError('Choose an import batch before committing.');return;}if(batch?.batch.status==='Complete'){setToast('This import is already reconciled.');return;}setModal('M12');}else if(screen==='L06'||screen==='A06'){document.getElementById('record-form-'+screen)?.scrollIntoView({behavior:'smooth'});}else navigate(s.primary.target,c?.id);}}>{screen==='S02'||screen==='S03'?'Continue to workspace':screen==='C13'?'View review outcome':screen==='C14'?'View hearing notices':s.primary.label}<ArrowRight size={16}/></button>}</div></section>
 <footer className="page-footer"><span><ShieldCheck size={14}/>Private workspace · scoped access & versioned records</span><span>Refreshed {dash?.refreshed_at ? new Date(dash.refreshed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'} IST</span></footer></main></div></div>
 {directoryOpen&&<Dialog title="Find your next page" onClose={()=>setDirectoryOpen(false)}><div className="dialog-body"><ScreenDirectory actor={actor} role={role} caseId={caseId} batchId={batchId} onNavigate={id=>navigate(id)}/></div></Dialog>}
 {metricsOpen&&dash&&<Dialog title="Workspace KPI library" onClose={()=>setMetricsOpen(false)}><div className="dialog-body"><MetricsLibrary role={role} data={dash} onNavigate={id=>{setMetricsOpen(false);navigate(id);}}/></div></Dialog>}
 {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
 {picker && <Dialog title="Choose a permitted case" onClose={() => setPicker(false)}><div className="dialog-body"><Filters q={q} setQ={v => { setQ(v); setPage(1); }} filter={filter} setFilter={v=>{setFilter(v);setPage(1);}} board={board} setBoard={v=>{setBoard(v);setPage(1);}} category={category} setCategory={v=>{setCategory(v);setPage(1);}} status={status} setStatus={v=>{setStatus(v);setPage(1);}}/><CaseTable cases={cases} total={total} page={page} setPage={setPage} onOpen={chooseCase} title="Permitted cases" loading={loadingData}/></div></Dialog>}
 {modal && <Dialog title={screenById[modal]?.title || 'Confirm action'} onClose={() => setModal('')}><div className="dialog-body">{error&&<div role="alert" className="alert red">{error}</div>}{modal !== 'M10' && modal !== 'M12' && !c ? <Empty title={caseId ? 'Opening the selected case…' : 'Choose a case for this action'} body={caseId ? 'The case and its permissions are being checked.' : 'This dialog records work against a permitted case. Select one to continue.'} action={<button className="button primary" onClick={()=>{pendingDialog.current=modal;setModal('');setPicker(true);}}>Choose case<FolderOpen size={16}/></button>}/> : modal === 'M12' && !batchId ? <><p>Choose a preserved import batch. Review its validation and reconciliation before committing.</p><ImportsTable imports={imports} href={href} onChoose={id=>{setBatchId(id);refreshData();}}/></> : modal === 'M12' && (!batch || batch.batch.id!==batchId) ? <Empty title="Opening the selected batch…" body="Loading preserved rows and reconciliation results."/> : modal === 'M12' ? <><p>{batch?.batch.row_count} rows will be reconciled. Original bytes are preserved. Repeated tokens retain one case and versioned snapshots.</p><CommitConfirmation busy={busy} purpose={text(parseValues(batch?.batch.mapping)._purpose)} onCommit={() => perform(async () => { if (!batchId)
        throw new Error('Choose a batch first.'); let r = await api('imports/' + batchId + '/commit', { method: 'POST' }); refreshData(); while (!r.ready) {
        if (r.busy)
            await new Promise(resolve => setTimeout(resolve, 400));
        r = await api('imports/' + batchId + '/commit', { method: 'POST' });
        refreshData();
    } setToast('Import reconciled. ' + number(r.completed) + ' rows processed.'); setModal(''); navigate('I01'); refreshData(); })}/></> : modal === 'M10' ? <Empty title="This evidence is restricted" body="Use an authorised workspace or request a permitted redacted copy from the owner." action={<button className="button primary" onClick={()=>setModal('')}>Return to permitted workspace<ArrowRight size={16}/></button>}/> : <RecordForm key={modal} id={modal} c={c} actor={{ ...actor, role }} detail={detail} members={members} configs={configs} evidenceId={evidenceId} busy={busy} t={t} onSave={(v, p) => save(v, p, modal)} onUpload={(file, label, values) => upload(file, label, values, modal)}/>}</div></Dialog>}
 {help && <Dialog title="Operating the application" onClose={() => setHelp(false)}><div className="dialog-body operating-guide"><h3>Establish access and authority</h3><p>The owner can use all nine workspaces. Add staff accounts, board scope and effective delegated powers in Administration. Sharing this private Site is a separate hosting setting; application roles alone do not share the Site.</p><h3>Prepare policy clocks</h3><p>Enter the applicable authority reference, effective date, duration, calendar and holidays. Draft policies do not create deadlines. Approved deadlines retain policy versions. Extensions need a separate authorised decision.</p><h3>Enrich and accept responsibility</h3><p>The register preserves 1,935 original tickets and both exports. Descriptions remain previews until the full record is retrieved. Classify, route to an accountable owner and record acceptance.</p><h3>Investigate through verification</h3><p>Record issues, inspect evidence, cite checked documents, record findings and submit a proposal. Approval requires effective delegation. Record execution, verification, an ATR and quality review. Citizen feedback separates remedy confirmation from satisfaction.</p><h3>Communicate and review</h3><p>In-app notices are persisted for linked recipients. Historical records without authenticated citizen links require manual service. Challenges preserve the original decision and create review findings and ordered actions.</p><h3>Connections and limitations</h3><p>Live portal synchronisation, payment execution, external email/SMS, antivirus scanning and an AI provider are not configured. Type, size, access, hashes and versions are enforced; content requires reviewer inspection. Common navigation and citizen controls are translated; source text remains in its original language.</p><h3>Source context and acceptance testing</h3><p>Source terminal labels are not verified relief. Imported age is not a resolution duration or SLA. Office families are provisional. Confirm jurisdiction and legal procedures before adoption. Automated API and database checks accompany this release. Browser interaction could not be executed in the build environment; complete role-based user acceptance testing before wider use.</p></div></Dialog>}
 </div>;
}
