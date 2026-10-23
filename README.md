# GuideHollow Sheets

**Practical Excel & Google Sheets Guides, Examples and Free Tools**

An independent English spreadsheet publication built with Astro 7, TypeScript and Markdown. The new repository is [emfls/guidehollow-sheets](https://github.com/emfls/guidehollow-sheets); its configured origin is `https://sheets.guidehollow.com/`.

## What is implemented

- Six original launch guides, five category pages, All Guides, full-text local search, related articles, sources and transparent verification notes.
- CSV Duplicate Checker: strict UTF-8 comma-separated parsing, all/selected-column exact comparison, keep-first previews, counts and unchanged-value export with a spreadsheet-formula safety acknowledgement.
- Formula Finder: eight curated functions, app/task/name filters, product-specific syntax, examples, expected results and official links. It is not a formula execution engine.
- Accessible responsive layout, local SVG favicon and PNG sharing image, canonical metadata, JSON-LD, sitemap, RSS and custom 404.
- Manual-only Notion publisher using the existing network queue, registry and per-article quality records. No new queue, paid API, analytics, advertising identifier or scheduler.

## Run locally

Node >=22.23.4 (CI uses24), npm and Python >=3.10 are required. Python publisher uses only the standard library.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run test:publisher
npm run check
npm run build
npm run preview
```

`build` also checks every generated internal link/asset, one main/h1 per page, unique metadata, self canonical, domain isolation, sources, sitemap/robots/RSS/search and absence of ad/analytics code. Build output is `dist/`; node_modules and generated output are not committed.

## Structure

- `src/config.ts`: new-site identity and first verified launch date.
- `src/content.config.ts`, `src/content/articles/`: typed Markdown collection, fixed `/<category>/<slug>/` URLs.
- `src/lib/`, `src/scripts/`: local CSV, formula library, search and interaction logic.
- `public/examples/`: fictional downloadable data. Native Excel/Sheets execution is explicitly not claimed.
- `scripts/verify-build.mjs`: static output quality gate.
- `scripts/notion_publish_daily.py`, `data/publications.json`: isolated daily-publishing safety and durable accounting.
- `docs/quality/`, `docs/formula-verification.json`: six individual learning records and checked input/output scope.

## GitHub Pages and DNS

`.github/workflows/deploy.yml` runs tests, Python regressions, type checking and the static build before official Pages deployment. Pull requests validate without deploying. A `workflow_dispatch` supports the explicit deployment required after a `GITHUB_TOKEN` source push.

The repository Pages domain must be registered **before** DNS points to it. The configured custom domain and `public/CNAME` are `sheets.guidehollow.com`. DNS must contain:

| Type | Host | Value |
|---|---|---|
| CNAME | sheets | emfls.github.io |

Do not put `https://` or `/guidehollow-sheets` in the DNS value. Do not change the apex site's DNS or a wildcard record. Wait for GitHub certificate issuance, enforce HTTPS, and independently verify the configured hostname. A successful Pages workflow is not proof of working custom-domain DNS or HTTPS.

While DNS/HTTPS is unverified, registry status stays `preparing` and `site.launchedOn` stays empty. Initial visible dates say **Prepared**, and schema omits an unverified publication date. At the verified first release, record the actual date and align initial article publication dates with it before promotion; never backdate a blocked launch. [Launch checklist](docs/launch-checklist.md) distinguishes these steps.

## Notion and environment variables

No runtime environment variables are required for the static site. `NOTION_API_TOKEN` belongs **only** in this repository's GitHub Actions Secret, never a source file, Notion document or local committed environment file. `GH_TOKEN` inside the publisher is supplied from the run's `github.token`. Do not copy a secret from another repository.

The publisher defaults to `publish` so the documented future `{"ref":"main"}` dispatch works; explicitly choose `check-connection` for a read-only setup check. The registry must match `gh-sheets` and be `active` before staging. Missing credentials stop safely. The initial six queue records remain unapproved drafts; their local slugs and Notion page IDs prevent duplicate daily publication. See [Notion publishing](docs/notion-publishing.md), [content standards](docs/content-standards.md), and [bootstrap mappings](docs/notion-bootstrap-map.json).

Existing GuideHollow code, publishing schedule, EMFLS repositories and cron jobs are outside this repository's write scope.
