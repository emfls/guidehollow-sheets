# GuideHollow Sheets launch checklist

## Implementation completed

- [x] New independent Astro/TypeScript repository and lockfile; root base and trailing slash policy.
- [x] Six launch guides, original datasets, official citations and per-guide verification/learning records.
- [x] Two working local browser tools and strict parser/error/encoding tests.
- [x] Responsive pages, source-aware article layout, full-text search, canonical/meta/JSON-LD, sitemap, robots, RSS, favicon and sharing image.
- [x] Manual-only Notion publisher with relation/identity/approval/date/daily-limit/duplicate/recovery/deployment safeguards.
- [x] Site Registry `gh-sheets` created as `preparing`; shared queue category additions preserve all original option IDs/colors and statuses.
- [x] Six bootstrap manuscript drafts and six separate learning records created in the existing shared databases, with manuscript and site relations.
- [x] GitHub Pages configured for workflow publishing; custom domain registered as sheets.guidehollow.com before any requested DNS change.

## External prerequisites still open

- [ ] DNS owner: CNAME `sheets` → `emfls.github.io`. No protocol or repository path. DNS was unresolved during initial implementation.
- [ ] GitHub custom-domain verification/certificate and HTTPS enforcement: wait until DNS resolves, then verify Pages settings and independently request HTTPS.
- [ ] Verify home title, six guide URLs, all tools, metadata, sitemap/robots/favicon and unknown-path404 on the actual hostname. Workflow success alone does not complete this.
- [ ] Record the actual first verified release date in `site.launchedOn` and the initial article publication dates. Current dates reflect preparation; do not claim an earlier live launch.
- [ ] Repository-only `NOTION_API_TOKEN` secret. The connector's ability to edit Notion is not proof that a GitHub integration token can access the three data sources.
- [ ] Integration token explicitly shared with shared Queue, Site Registry and Quality records. Run read-only connection check, verify relations and repository/domain identity, then owner may promote only this registry row to active.
- [ ] One approved due post's complete live end-to-end publisher check. Offline/mocked tests are not production publishing evidence.
- [ ] Optional Search Console registration, sitemap submission and actual indexing verification. No analytics/traffic claims without measured data.
- [ ] Advertising remains absent. Any later AdSense setup needs separate account-scope approval, applicable privacy disclosures and consent/CMP review; no main-site ID has been copied.

## Scheduling remains disabled

No GitHub schedule event or cron-job.org job is created for this site. After explicit owner approval, a repository-scoped minimum-permission API token can POST `{"ref":"main"}` to the documented workflow dispatch endpoint. Existing GuideHollow 09:30 KST scheduling must not be edited. Manual workflow's default is read-only check-connection; use its explicit publish input for a controlled trial after all gates are ready.

## Reference architecture review

The main GuideHollow's typed Markdown, static search, output validation and official Pages-action patterns informed the new implementation. Its dark AI layout, content, advertising account, queue ownership constants and scheduling were not copied. Latest reference publisher files were read into a temporary directory without updating the existing checkout. This repository adds strict multi-site routing, bootstrap identity mapping, source revision validation and explicitly documented failed-finalization recovery limits.

## Initial GitHub release evidence (2026-10-24 KST)

- [x] PR #1 merged after passing CI: https://github.com/emfls/guidehollow-sheets/pull/1
- [x] Main Pages build and deploy succeeded: https://github.com/emfls/guidehollow-sheets/actions/runs/40034089367
- [x] Actual manual read-only connection check safely stopped for missing NOTION_API_TOKEN: https://github.com/emfls/guidehollow-sheets/actions/runs/40034106268 (failure, not a successful connection).
- [x] All 23 local routes inspected at 390px without page overflow; tools/search/menu interactions checked.
- [ ] Public custom-domain release remains unverified: DNS has no answer; HTTPS request fails name resolution. Keep preparing and do not label bootstrap queue items published.
