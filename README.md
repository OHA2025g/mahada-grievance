# MHADA Grievance and Redressal

Persistent private application based on the 28-page grievance report and the 113-screen wireframe specification. It preserves the two original exports, 1,935 distinct source tickets and their lineage. Source state, internal stage, approved decisions, remedy execution, evidence verification and citizen response are separate records.

## Modern application and screen connections

The v2 application implements the modern design pack as responsive React pages. The white navigation, purple accents, KPI cards, contextual forms, case guidance, tables, calendars, original-file viewer and dialogs use real service data.

All 101 main pages use `/workspace/<screen-id>` routes. Twelve contextual dialogs link to their associated parent page with `?dialog=Mxx`. URLs preserve the selected case, workspace, import batch, filters, pagination and KPI library. Old `?screen=...` links remain supported. Platform sign-in preserves task context, and browser Back/Forward restores the page. The searchable **All pages** directory (`Ctrl/Cmd K`) includes pages permitted by the account's assigned roles. Screen definitions and connections are exported in `docs/screen-route-map.json`.

Each of the nine workspaces has four actionable headline measures and a library of 12 KPI definitions. Shared services adds 12 definitions, for 120 in total. Counts are calculated within the API's case/document scope. Measures without events or an approved denominator display N/A. Historical source terminal labels never count as verified relief. Access screens use the actual platform identity rather than simulated passwords or phone codes.

Forms, evidence versions, import confirmations, assignments, review actions, reports and configuration controls are connected to the existing APIs. Cross-workspace steps open an assigned workspace; otherwise the successful save confirms which authorised team handles the next step. No database reset or source re-import is needed for the UI update.

## Workspaces

Citizen: saved drafts, issue/property/evidence registration, acknowledgement, tracking, clarification, published decisions/ATR, feedback and linked challenges.

Intake: XLSX/CSV imports, column mapping, row exceptions, reconciliation, full-record enrichment, classification, assignment, reviewed related-case links, urgency, restricted referral, verified handoff and assisted intake.

Case officer: acceptance, material issues, investigation plans, supporting input, evidence catalogue and original-file viewer, inspections, hearing notices and supersession, minutes, cited findings, approval proposals, authorised actions, execution, verification, ATR versions and communications.

Supervisor: assignment and input queues, workload, versioned deadline policies and authorised exceptions, decision approval, ATR quality review, verified closure, legacy reconsideration and preventive programmes.

Developer/respondent: permitted served notices, issue replies, reported transit-rent ledger, hearing response and compliance evidence. Reported payments do not establish verified entitlement or settlement.

Independent review: admissibility, evidence assessment, new material, review hearings, reasoned decisions, ordered actions and original/reviewed comparison. Original decisions remain preserved.

Leadership: source coverage, board families, categories, receipt cohorts, internal outcome coverage and governed reports. Historical property clustering requires reliable identifiers; unstructured previews are not automatically merged.

Audit: event history, case record/evidence links, hashes, import lineage, permissions and scoped export manifests. Leadership masks direct personal fields. Restricted case/document access is separately granted.

Administration: organisation, member roles and board scope, effective delegated powers, routing rule register, SLA policies, working calendars/holidays, closure policy, integration register, import-job resume, communication templates, retention/access policy register, accessibility preferences and approved knowledge sources.

## First use

1. Open the private Site while signed in. The configured owner receives all nine application workspaces. The historical import resumes in bounded, leased batches. Progress reflects committed records.
2. Review Intake > import history. Baseline source populations are Aaple Sarkar 1,653 and PG Portal 282. Office families are provisional, not verified jurisdiction.
3. In Administration, register staff emails, roles and board scope. Pending account records bind to the trusted platform identity on first sign-in. App permissions do not share the private Site; grant Site audience separately if needed.
4. Register approved, effective delegations before approving decisions, payment-related decisions, review determinations or deadline exceptions. Configure an independent approver when required by policy.
5. Configure and approve working calendars, holidays and applicable SLA policy references. Policies begin unconfigured. Source age is never used as an SLA clock. A frozen deadline snapshot is retained; later policy edits do not rebase it.
6. Retrieve complete narratives, verify citizen identity explicitly where a historical account link is needed, accept ownership, record each material issue and inspect supporting documents.
7. Follow proposal > approval > execution > checked evidence verification > ATR > quality review > communication > citizen response > closure. Changed proposals require new approvals; superseded actions cannot execute. A closed case needs a linked review for new investigation.

## Architecture

Vinext App Router / React, native Sites identity headers, server-side scoped APIs, Cloudflare D1 and R2. Fifteen schema tables are managed through generated Drizzle migrations. Workflow changes use revision checks and atomic batches; retries carry idempotency keys. Events and configuration history are append only through the API. Evidence original bytes and previous versions are retained with SHA-256 hashes. Structured source snapshots use source/token/hash identity. Original exports are kept in private object storage.

The seed payload is gzip/AES-GCM encrypted, imported only by server code and decrypted with a runtime secret. No source plaintext or secret is included in client assets. Runtime secrets are managed by Sites, not tracked files. Authenticated headers are trusted only behind Sites dispatch. Stable platform IDs are required for ordinary members. Legacy private-owner requests with the trusted owner email are supported through a Site-scoped owner identifier; their database member ID is retained when a stable platform ID becomes available.

## Scope and configuration

- Government portal live adapters and portal writeback are not configured. Manual exports reconcile source snapshots without overriding the internal workflow.
- In-app notifications are active. Email/SMS transmission, payment execution and voice channels need approved external adapters. Historical records without a linked account require evidenced manual service.
- File type, signature, size, access, versions and hashes are checked. Antivirus, OCR and automated document interpretation are not configured. Content must be inspected by the assigned reviewer.
- Controlled knowledge lookup retrieves approved source text and versions. No generative AI provider is configured. It does not make eligibility, legal, approval or closure decisions.
- Retention, routing, communication and organisational rule registers are versioned administrative records. They do not automatically delete files, send external messages or establish legal authority.
- Common controls and citizen field labels support English, Marathi and Hindi. Source narratives remain in their original language; translation coverage does not include every administrative paragraph.
- Printable reports expose the browser Print / Save PDF command. Case packs contain permitted records and an evidence manifest; original evidence files remain guarded downloads.

## Verification

`node tests/run.mjs` (with the original workbooks in `data/original`, or `MHADA_TEST_SOURCE_DIR` pointing to their directory) bundles the service and runs the generated schema in SQLite with a D1-compatible transactional adapter and memory object storage. It parses both actual original XLSX files, reconciles all 1,935 rows and office populations, tests the full registration-to-verified-closure/review path, checked evidence requirements, delegation, party isolation, stale revisions, source label preservation, repeated imports, a smaller future batch with rejected rows, immutable file versions, approved working-calendar arithmetic, frozen policy clocks, authorised extensions, role revocation and scoped exports. Only aggregate results are printed.

`node tests/ui.mjs` validates server-rendered form controls and empty/document/calendar states against the full screen inventory. This checks rendering and field availability, not browser behaviour.

`node tests/navigation.mjs` checks the complete route inventory, role access, direct and legacy links, case/batch/dialog context, directory destinations and live/empty KPI rendering. The automated checks cover 189 role/context combinations.

Run `pnpm exec tsc --noEmit` and the supplied Sites build helper after changes. The managed build environment has no browser-control capability; browser interaction and visual QA were not executed. Complete user acceptance testing with citizen, respondent and staff accounts before broader operational use.

Source baselines: source review 14 October 2026. The 349 source non-terminal labels and 1,586 terminal labels do not establish an active operational backlog or implemented remedy. All historical narratives start as previews. No legal duration or prescribed appeal procedure is inferred from the spreadsheets.
