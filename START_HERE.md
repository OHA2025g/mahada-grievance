# MHADA complete application project

This archive contains the full application source, server APIs, database schema and migrations, original datasets, design references, tests and operating documentation.

## Rebuilt modern UI

This release connects all 101 pages and 12 contextual dialogs to the application workflows. The nine workspaces use the modern purple and white design, responsive layouts, working form actions, case/evidence views and scoped KPI data. Use **All pages** or `Ctrl/Cmd K` to find a screen.

Routes use `/workspace/<screen-id>`, retain case and import context, and support browser Back/Forward. Platform sign-in preserves deep links. The exact screen-to-page/action map is in `docs/screen-route-map.json`. KPI definitions are in `lib/kpi-definitions.json`; unavailable measures display N/A. The raster PSD/image pack remains a separate design deliverable; runtime controls use React components and the actual APIs.

Automated verification passed 184 API/database checks, 2,036 navigation/rendering checks and all 436 form controls. Production build and deployment succeeded. Browser interaction testing was unavailable.

## Start locally

Use Node.js 24 and pnpm 11.25.0, matching the tested toolchain. From this extracted directory:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
node tools/prepare-local.mjs
pnpm run build
node tools/migrate-local.mjs
pnpm run dev
```

Open the loopback URL printed by the development server. The supplied portable starter simulates sign-in as `seedy@sites.test` only on loopback. The setup tool makes this development identity the local owner. Sign in and let the application initialise the 1,935-ticket register. The data and file store persist under `.wrangler/state`.

The setup tool generates a new local encryption key, regenerates the encrypted seed from the two original spreadsheets and writes private values to `.dev.vars`. It does not recover or include live credentials. Run `node tools/prepare-local.mjs --dry-run` to validate inputs without writing a seed or secrets. Use `--force` only to deliberately replace an existing local configuration.

`pnpm run dev` provides the loopback development sign-in. `pnpm start` previews the built Worker and does not simulate sign-in. Do not expose the development server publicly.

## Included

| Path | Contents |
| --- | --- |
| `app/` | React workspaces, all screen renderers, styling, sign-in guard and API routes |
| `lib/` | Permissions, case workflow, forms, imports, evidence, reports, policies, language strings and encrypted source seed |
| `db/`, `drizzle/` | Fifteen-table schema, generated SQL migrations and migration metadata |
| `data/original/` | Both original XLSX exports: 1,653 Aaple Sarkar and 282 PG Portal tickets |
| `docs/` | Complete system report, baseline wireframe PDF and complete modern route map |
| `design-wireframes/` | The original screen inventory, definitions and individual wireframe assets |
| `tests/` | Database/API workflow, rendered forms and role/navigation verification |
| `verification/` | Aggregate check results; no test-case records are imported into live storage |
| `tools/` | Local data/key preparation and local migration runner |
| `build/`, `scripts/`, `vendor/`, `components/` | Supplied runtime integration, build utilities and reusable UI components |
| `.openai/hosting.json` | Existing private Site reference and D1/R2 binding declaration |
| `pnpm-lock.yaml`, `package.json` | Exact dependency lock and package scripts |
| `README.md` | Workspaces, architecture, workflow gates, deployment scope and limitations |
| `SOURCE_COMMIT.txt` | Application source commit included in this export |

The two spreadsheets contain the supplied citizen information. Keep the archive and extracted data within your authorised team. Live secrets, Git history, installed dependencies, caches and temporary runtime databases are excluded.

## Verify

```sh
pnpm exec tsc --noEmit
node tests/run.mjs
node tests/ui.mjs
node tests/navigation.mjs
```

The test runner uses `data/original` by default. Set `MHADA_TEST_SOURCE_DIR` only when using a different input directory. The database tests create an isolated in-memory database and do not modify hosted data. The UI test checks rendered controls and empty states; it does not replace browser acceptance testing.

## Hosting

The current private application is at:
https://mhada-grievance-application.singh-aghoreshwar.chatgpt.site

This source targets the supplied Sites/Vinext runtime with Cloudflare D1 and R2. Preserve the existing project ID when updating that Site. For a separate Site, register it through the Sites workflow and use its returned project ID. Configure runtime `OWNER_EMAIL`, `SEED_DATA_KEY` and `INITIALIZATION_TOKEN` through the hosting secrets interface, apply the migrations and deploy the matching build. Regenerate and deploy the seed together with its matching key; do not mix a locally regenerated seed with the existing hosted key.

Ordinary hosted members require a stable platform identity and explicit application roles. A compatibility path supports the configured private owner when a legacy trusted request supplies verified owner email without an ID. Other accounts do not receive that fallback. Local mock authentication is a development feature and is not included in hosted production builds.

## Operational configuration

Before wider adoption, configure real staff, board scope, effective delegated powers, approved calendars and SLA policies, closure procedures and controlled knowledge sources. External government portal synchronisation, email/SMS, payment execution, antivirus scanning, OCR and a generative AI provider are not configured. Source terminal labels are not treated as verified remedies. Read `README.md` for the full operating scope and complete user acceptance testing with the actual roles.
