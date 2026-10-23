# GuideHollow Sheets Notion publishing

This repository contains an independent, manual-only publication path for `gh-sheets`. It does not change the GuideHollow main site, that site's publisher, or any external scheduler. There is no cron trigger in this repository. A connection check or an empty queue is not a publication.

The initial registry status is **preparing**. Publishing must remain disabled until the owner has installed the repository secret, finished the domain/Pages setup, reviewed source quality, and changed this specific registry record to `active`. DNS and live publication have not been established by the offline tests.

## Identities and queue contract

| Item | Exact value |
|---|---|
| Repository | `emfls/guidehollow-sheets` |
| Site ID / Name | `gh-sheets` / `GuideHollow Sheets` |
| Public URL | `https://sheets.guidehollow.com` |
| Registry data source | `99edf088-9778-4b8d-80f0-c7d7777f2fc4` |
| Registry page | `402db4c0-a991-813e-9641-dcac9b1e46f5` |
| Shared queue data source | `b788e982-fc20-4df0-9f1b-8ff2a19f271d` |
| Shared quality log | `1e28a0aa-72ec-4e24-850b-c97fe2eb8ce0` |
| Registry language / timezone | `en-US` / `Asia/Seoul` |
| Limit / content format / workflow | `1` / `astro-markdown` / `notion-daily-publisher.yml` |

Every registry field above and `Status=active` must match, including the registry page identity. There must be exactly one registry result for `gh-sheets`. The queue article must have exactly one `배포 사이트` relation pointing to that registry page. A different site's queue rows are ignored; an article routed to Sheets and another site, a repeated relation, or a truncated relation fails closed.

Queue properties are `제목` (title), `설명`, `슬러그`, `태그`, `공식출처` (rich text), `카테고리`, `상태` (select), `검수승인` (checkbox), `배포 사이트` (relation), `발행예정일` (date), `발행순서` (number), `게시 URL`, `GitHub 커밋` (URL), `발행일시` (date), and `오류` (rich text). **The actual shared queue uses text for 태그**, parsed as comma-separated lowercase hyphenated tag names. Do not convert the shared property to multi-select. Official sources are one HTTPS URL per line. The title must have at least 12 characters and description at least 35, matching the article schema. Accepted categories are `formulas`, `data-cleaning`, `troubleshooting`, `templates`, and `comparisons`.

Only `상태=발행대기`, `검수승인=true`, and a present, due `발행예정일` qualify for a new source. Date-only schedules compare the KST day; timestamps compare the actual instant and must include a timezone. Rows are sorted by `발행순서`. Selection never generates new advice or claims to have executed Excel/Google Sheets. The emitted `verification` string reports the editorial checkbox and explicitly disclaims native spreadsheet execution. Source URLs are preserved as references, not claimed to have been independently verified by the publisher.

Paragraphs, headings, simple lists, quotes, code fences, dividers, and tables convert to Markdown. Unsupported inline objects, unsupported blocks, and nested blocks cause an error instead of disappearing. A substantive prose paragraph is needed to compare visible live body text. There is no minimum article word count. List-to-paragraph boundaries and recognized Sheets internal links normalized against `app.notion.com` are preserved; genuine Notion document links stay external.

## Setup and permissions

1. Add the **new repository's** Actions secret `NOTION_API_TOKEN`, using an integration shared with this registry, shared queue, and existing quality log. No token is committed, logged, fetched from the other repository, or supplied in workflow inputs. A missing secret returns a controlled `SETUP_REQUIRED` error.
2. Enable GitHub Pages with Actions and finish the custom domain/DNS setup. The deployment workflow is `deploy.yml`, with a Pages deployment job named `deploy`.
3. The manual publisher needs `contents: write` for source/ledger commits and `actions: write` to dispatch and inspect deployments. It does not need pull-request write permission. Its job is restricted to this repository's `main` branch. Fork/PR checks must retain read-only repository permissions.
4. Review the registry and content, then explicitly activate this site's registry record. An active registry is necessary; it is not a substitute for the queue's approval and due date.

If main is protected or the branch policy cannot be read, the workflow stops with a clear error. Do not supply an administrator token, disable protection, force push, or use a bypass. Use the normal reviewed PR process and have the owner reconcile the publication ledger/queue after verified deployment. The automated direct-push path is unavailable under that policy.

Read-only local check (token supplied through the environment, never through the command line):

```sh
python3 scripts/notion_publish_daily.py --check-connection
```

The check reads the integration identity, queue source, and matching registry records. It also works while status is `preparing`; `publishing_enabled:false` means the check itself does not enable publishing. It performs no Notion mutations.

## Manual publication and durable recovery

Run **Notion daily GuideHollow Sheets publisher** from Actions on `main`. Its default mode is `publish`, matching the future scheduler body `{"ref":"main"}`. Explicitly select `check-connection` for a read-only setup check. A dispatch cannot stage anything while this registry is preparing.

The publication path is:

1. Check branch policy, registry identity, approval, schedule, existing source slugs/Notion IDs, and `data/publications.json` accounting.
2. Write one Markdown source and a `staged` ledger reservation, or resume the one interrupted reservation. Stage performs no Notion mutations. Initial editorial articles are protected by existing filenames/frontmatter slugs even when they have no Notion page ID.
3. Run the publisher tests, dependency install, site tests, Astro check, and production build. Commit the verified source and reservation to main with a normal push; refuse if main advanced. No force push or merge is attempted.
4. Idempotently add a prepublication quality entry in the **existing shared quality log**, with the exact queue/site relations. Existing malformed linked entries block release. The log states editorial/source checks and `성과 검증=미측정`; it does not invent revenue, traffic, field performance, or spreadsheet execution evidence. Then mark the queue row `발행중`.
5. Explicitly dispatch `deploy.yml` because a `GITHUB_TOKEN` source push does not reliably trigger another workflow. Capture preexisting dispatch run IDs and wait for a new manual run on main with the **exact source commit SHA**, created after this dispatch. Never reuse a blindly selected latest run. Require both overall success and the `deploy` job's success. Ambiguous matches, failed/skipped deploys, and timeouts leave the reservation staged.
6. Require live HTTP 200 at the exact URL without a redirect, exactly one matching canonical, the source Notion page ID on the article, and a significant normalized body excerpt inside the article. Retry briefly for propagation. Only then set `발행완료`, public URL, UTC publication timestamp, source commit URL, and clear the queue error.
7. Save the ledger state as `published` with deployment run ID, source commit, and timestamp, then commit that accounting using another ordinary nonforce push.

`data/publications.json` is a versioned JSON ledger. Missing, malformed, incomplete, duplicate, or over-limit records block publishing. Do not delete or reset it to escape a daily limit. Its initial explicit empty list bootstraps this new site's automatic publisher; initial seed articles are protected by the source inventory. Daily reservations and publication records count only the Sheets site and KST day. An interrupted reservation blocks choosing a new article, even on a later day. Resume rechecks approval, relation, due time, the local source SHA-256, a canonical Notion source revision, and current-day capacity, moves an unfinished reservation to the current KST date, and publishes that same page/slug. The revision hashes title, description, slug, tags, official sources, category, and converted body; it excludes status/publication fields and Notion last-edited timestamps so the publisher’s own status updates do not invalidate it. The same revision is compared before deployment and immediately before final completion. Any changed approved body or metadata fails closed for renewed owner review. The source's initial article dates are preserved on resume.

Retry a failed run by dispatching **a new run from current main** in `publish` mode. Re-running an old workflow checkout can be stale. Never remove a staged row or choose another article manually to work around an interrupted run. If the source hash or routing/approval changed, reconcile it with the owner before retrying.

A failure before the source push has no durable reservation or Notion status change. A failure after that push leaves a staged record on main and resumes the same article. If Notion finalization succeeded but the final ledger push failed, main still holds the staged record. A retry detects `발행완료` and stops with `RECONCILIATION_REQUIRED` before changing the status, timestamp, commit, or ledger accounting day. The owner must inspect the original deployment run/commit and live body, then reconcile the staged ledger to that original publication evidence. Do not redeploy and relabel the completed article as a new publication or move its accounting to the retry day. Queue status can remain `발행중` after a deployment error; the workflow error is the failure evidence, and the staged ledger is the recovery anchor. Failed runs do not falsely mark publication complete.

Do not call the low-level `deploy-finalize` command against an arbitrary article. It requires a current-day staged reservation and expected full main SHA; the workflow supplies these after source regression checks. The ledger remains authoritative for duplicate prevention and capacity.

## Verification and limits

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_notion_publisher.py' -v
```

These are isolated tests with fake Notion/GitHub/HTTP results. They cover site routing, registry gates, approval/scheduling, missing secrets, ledger corruption/duplicates/daily accounting, resume source integrity, initial slug protection, Markdown boundaries/links, literal formula/code-span preservation, unsupported blocks, changed source revisions and completed-queue reconciliation, failed/wrong-SHA deployments, live canonical/page/body verification, shared quality relations, and workflow permission/trigger safeguards.

They do not establish real integration access, Actions push/dispatch permissions, Pages/DNS readiness, live deployed content, human factual approval, revenue, SEO/indexing, or native spreadsheet execution. None of those missing observations should be recorded as zero or a successful publication. Scheduling remains external and future-only; no scheduler is activated by these files.


## Future external scheduling (not activated)

Only after separate owner approval, POST to `https://api.github.com/repos/emfls/guidehollow-sheets/actions/workflows/notion-daily-publisher.yml/dispatches` with body `{"ref":"main"}`, `Content-Type: application/json`, `Accept: application/vnd.github+json`, and a repository-scoped minimum-permission authentication token supplied privately to the scheduler. Default `publish` mode still requires every registry/approval/due-date/daily-limit gate. Do not store the token in Git, Notion or logs. No cron-job.org job was created or enabled; preserve the existing main-site 09:30 job.
