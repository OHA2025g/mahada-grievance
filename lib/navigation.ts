import { screens, screenById, home } from './forms';
import { ROLES, type Role, type Screen } from './types';

export type NavGroup = { label: string; icon: string; screens: string[] };
export type RouteContext = { caseId?: string; role?: Role; batchId?: string; dialog?: string; metrics?: boolean };
export type ResolvedRoute = { screen: string; dialog: string; caseId: string; batchId: string; role: Role; metrics: boolean; denied: boolean };

export const navigation: Record<Role, NavGroup[]> = {
  Citizen: [
    { label: 'My grievances', icon: 'grid', screens: ['C02', 'C01'] },
    { label: 'New grievance', icon: 'plus', screens: ['C03', 'C04', 'C05', 'C06', 'C07'] },
    { label: 'Track & respond', icon: 'activity', screens: ['C08', 'C09', 'C10', 'C11'] },
    { label: 'Review & appeal', icon: 'shield', screens: ['C12', 'C13'] },
    { label: 'Appointments', icon: 'calendar', screens: ['C14'] },
  ],
  Intake: [
    { label: 'Intake overview', icon: 'grid', screens: ['I01'] },
    { label: 'Source imports', icon: 'upload', screens: ['I02', 'I03', 'I04', 'I05'] },
    { label: 'Triage & complete records', icon: 'file', screens: ['I06', 'I07', 'I10'] },
    { label: 'Route & coordinate', icon: 'route', screens: ['I08', 'I09', 'I11'] },
    { label: 'Assisted intake', icon: 'users', screens: ['I12'] },
    { label: 'Legacy review', icon: 'history', screens: ['I13'] },
  ],
  Officer: [
    { label: 'My work', icon: 'grid', screens: ['O01'] },
    { label: 'Case workspace', icon: 'folder', screens: ['O02', 'O03', 'O04', 'O05'] },
    { label: 'Office inputs', icon: 'users', screens: ['O06', 'O07'] },
    { label: 'Evidence & inspection', icon: 'file', screens: ['O08', 'O09', 'O10'] },
    { label: 'Hearings', icon: 'calendar', screens: ['O11', 'O12'] },
    { label: 'Decision & remedy', icon: 'shield', screens: ['O13', 'O14', 'O15', 'O16', 'O17', 'O18'] },
    { label: 'Policy assistance', icon: 'search', screens: ['O19'] },
  ],
  Supervisor: [
    { label: 'Board overview', icon: 'grid', screens: ['V01'] },
    { label: 'People & ownership', icon: 'users', screens: ['V02', 'V03'] },
    { label: 'Office coordination', icon: 'route', screens: ['V04', 'V05'] },
    { label: 'Decision approvals', icon: 'shield', screens: ['V06'] },
    { label: 'Quality & closure', icon: 'file', screens: ['V07', 'V08', 'V09'] },
    { label: 'Prevention', icon: 'spark', screens: ['V10'] },
  ],
  Developer: [
    { label: 'Authorised cases', icon: 'grid', screens: ['D01'] },
    { label: 'Notices & response', icon: 'file', screens: ['D02', 'D03'] },
    { label: 'Rent & payments', icon: 'wallet', screens: ['D04'] },
    { label: 'Hearings', icon: 'calendar', screens: ['D05'] },
    { label: 'Compliance', icon: 'shield', screens: ['D06'] },
  ],
  Review: [
    { label: 'Review queue', icon: 'grid', screens: ['R01'] },
    { label: 'Independent assessment', icon: 'shield', screens: ['R02', 'R03', 'R04'] },
    { label: 'Review hearings', icon: 'calendar', screens: ['R05'] },
    { label: 'Decisions & actions', icon: 'file', screens: ['R06', 'R07', 'R08'] },
  ],
  Leadership: [
    { label: 'Command centre', icon: 'grid', screens: ['L01'] },
    { label: 'Boards & offices', icon: 'building', screens: ['L02'] },
    { label: 'Sources & cohorts', icon: 'chart', screens: ['L03'] },
    { label: 'Property insights', icon: 'pin', screens: ['L04'] },
    { label: 'Remedy quality', icon: 'shield', screens: ['L05'] },
    { label: 'Reports & exports', icon: 'download', screens: ['L06'] },
  ],
  Audit: [
    { label: 'Audit overview', icon: 'grid', screens: ['A01'] },
    { label: 'Event history', icon: 'history', screens: ['A02'] },
    { label: 'Evidence trace', icon: 'file', screens: ['A03'] },
    { label: 'Import lineage', icon: 'route', screens: ['A04'] },
    { label: 'Access reviews', icon: 'shield', screens: ['A05'] },
    { label: 'Audit exports', icon: 'download', screens: ['A06'] },
  ],
  Admin: [
    { label: 'Organisation', icon: 'building', screens: ['T01'] },
    { label: 'People & permissions', icon: 'users', screens: ['T02', 'T03'] },
    { label: 'Routing rules', icon: 'route', screens: ['T04'] },
    { label: 'Policies & calendars', icon: 'calendar', screens: ['T05', 'T06', 'T07'] },
    { label: 'Integrations & retries', icon: 'link', screens: ['T08', 'T09'] },
    { label: 'Service & knowledge', icon: 'settings', screens: ['T10', 'T11', 'T12', 'T13'] },
  ],
};

const dialogRoles: Record<string, Role[]> = {
  M01: ['Citizen', 'Intake'], M02: ['Citizen', 'Officer', 'Intake', 'Review', 'Developer'],
  M03: ['Intake'], M04: ['Officer'], M05: ['Supervisor'], M06: ['Intake'],
  M07: ['Supervisor'], M08: ['Citizen', 'Developer', 'Officer', 'Review'],
  M09: ['Citizen'], M10: [...ROLES], M11: ['Officer'], M12: ['Intake', 'Admin'],
};

export function dialogParent(id: string, role?: Role): string {
  if (id === 'M08') return role === 'Citizen' ? 'C14' : role === 'Developer' ? 'D05' : role === 'Review' ? 'R05' : 'O11';
  if (id === 'M01' && role === 'Intake') return 'C06';
  if (id === 'M02') return role === 'Citizen' ? 'C10' : role === 'Developer' ? 'D03' : role === 'Intake' ? 'I06' : role === 'Review' ? 'R03' : 'O08';
  if (id === 'M10') return role === 'Citizen' ? 'C10' : role === 'Developer' ? 'D02' : role === 'Officer' ? 'O09' : role === 'Audit' ? 'A03' : role ? home[role] : 'S01';
  if (id === 'M12' && role === 'Admin') return 'T09';
  return screenById[id]?.parent || 'S01';
}

export function canOpenScreen(id: string, role: Role, assigned: readonly string[]): boolean {
  const s = screenById[id];
  if (!s || !assigned.includes(role)) return false;
  if (s.template === 'modal') return (dialogRoles[id] || []).includes(role);
  if (s.role === 'Shared') return true;
  if (['C03', 'C04', 'C05', 'C06', 'C07'].includes(id) && role === 'Intake') return true;
  return s.role === role;
}

const caseEntryScreen: Partial<Record<Role, string>> = {
  Citizen: 'C08', Intake: 'I06', Officer: 'O02', Supervisor: 'V06', Developer: 'D02', Review: 'R03', Audit: 'A02',
};

export function caseEntry(role: Role): string | null {
  const id = caseEntryScreen[role];
  return id && canOpenScreen(id, role, [role]) ? id : null;
}

export function caseTabs(role: Role): [string, string][] {
  return screens.filter(s => s.case && s.template !== 'modal' && s.role === role).map(s => [conciseTitle(s), s.id]);
}

export function screenUrl(id: string, context: RouteContext = {}): string {
  const s = screenById[id];
  if (!s) return '/';
  const page = s.template === 'modal' ? dialogParent(id, context.role) : id;
  const query = new URLSearchParams();
  if (context.caseId) query.set('case', context.caseId);
  if (context.role) query.set('workspace', context.role);
  if (context.batchId) query.set('batch', context.batchId);
  if (s.template === 'modal') query.set('dialog', id);
  else if (context.dialog) query.set('dialog', context.dialog);
  if (context.metrics) query.set('view', 'metrics');
  return '/workspace/' + page + (query.size ? '?' + query : '');
}

export function resolveLocation(location: string, fallback: Role, assigned: readonly string[]): ResolvedRoute {
  const url = new URL(location, 'https://mhada.local');
  const requested = url.pathname.match(/^\/workspace\/([^/]+)\/?$/)?.[1] || url.searchParams.get('screen') || home[fallback];
  const s = screenById[requested];
  const fromQuery = url.searchParams.get('workspace') as Role;
  const role = assigned.includes(fromQuery) ? fromQuery : fallback;
  const dialog = s?.template === 'modal' ? s.id : url.searchParams.get('dialog') || '';
  const page = s?.template === 'modal' ? dialogParent(s.id, role) : s?.id || home[role];
  const denied = !s || !canOpenScreen(page, role, assigned) || (!!dialog && (screenById[dialog]?.template !== 'modal' || !canOpenScreen(dialog, role, assigned)));
  return {screen: denied ? home[role] : page, dialog: denied ? '' : dialog, caseId: url.searchParams.get('case') || '', batchId: url.searchParams.get('batch') || '', role, metrics: url.searchParams.get('view') === 'metrics', denied};
}

export const screenRoutes = screens.map(s => ({
  id: s.id, title: s.title, role: s.role, template: s.template,
  path: screenUrl(s.id, {role: (s.role === 'Shared' ? (s.template === 'modal' ? dialogRoles[s.id]?.[0] : 'Citizen') : s.role) as Role}),
  parent: s.template === 'modal' ? dialogParent(s.id, dialogRoles[s.id]?.[0]) : null,
  primary: s.primary, secondary: s.secondary,
}));

export const modernTitles: Record<string, string> = {
  S01: 'Your work. One place.', S02: 'Welcome back.', S03: 'Your work is safe.',
  C01: 'A clearer path to resolution.', C02: 'Let’s move things forward.',
  I01: 'A clear start for every case.', O01: 'Your work, in focus.',
  V01: 'A stronger service, together.', D01: 'Every response. In one place.',
  R01: 'Independent review, clearly.', L01: 'The full picture. Clearer.',
  A01: 'Trust, through traceability.', T01: 'A connected organisation.',
};

export const modernDescriptions: Record<string, string> = {
  S01: 'Choose an assigned workspace to see your cases, responsibilities and next steps.',
  S02: 'Your verified account connects you to the workspaces you are authorised to use.',
  S03: 'Verify your access and return to your intended task.',
  C01: 'Tell us what happened, follow progress and understand the response to your grievance.',
  C02: 'Your grievances, requests and next steps are together in one place.',
  I01: 'Validate incoming records, complete the case context and establish accountable ownership.',
  O01: 'Focus on your assigned cases, outstanding inputs and actions that need verification.',
  V01: 'Coordinate ownership, remove blockers and review the evidence behind decisions.',
  D01: 'Review served notices, provide evidence and track directions within your authorised cases.',
  R01: 'Assess each challenge independently, preserve the original decision and follow ordered actions.',
  L01: 'Source coverage, service progress and the evidence behind citizen outcomes.',
  A01: 'Follow the original record, each material change and the evidence relied upon.',
  T01: 'Connect the organisation, authorised people, jurisdictions and service policies.',
};

export function conciseTitle(s: Screen): string {
  return s.title.replace('New grievance - ', '').replace('MHADA grievance ', '').replace(' and ', ' & ');
}
