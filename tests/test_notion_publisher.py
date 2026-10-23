"""Offline boundary and recovery regressions. No live Notion/GitHub writes."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock

SPEC = importlib.util.spec_from_file_location('publisher', Path(__file__).resolve().parents[1] / 'scripts/notion_publish_daily.py')
p = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(p)
PAGE = '11111111-1111-1111-1111-111111111111'
OTHER = '22222222-2222-2222-2222-222222222222'
SHA = 'a' * 40


def text(value, title=False):
    kind = 'title' if title else 'rich_text'
    return {'type': kind, kind: [{'plain_text': value}]}


def registry():
    properties = {key: text(value, key == 'Site ID') for key, value in {
        'Site ID': p.SITE_ID, 'Site Name': 'GuideHollow Sheets', 'Repository': p.REPO,
        'Language': 'en', 'Timezone': 'Asia/Seoul', 'Content Format': 'astro-markdown',
        'Workflow': 'notion-daily-publisher.yml'}.items()}
    properties.update({'Base URL': {'url': p.SITE}, 'Daily Limit': {'number': 1}, 'Status': {'select': {'name': 'active'}}})
    return {'id': p.SITE_PAGE, 'properties': properties}


def article():
    properties = {name: text(value, name == '제목') for name, value in {
        '제목': 'Useful spreadsheet formula', '설명': 'Understand a useful spreadsheet formula with a clear example, limitations, and references.',
        '슬러그': 'sample-formula', '태그': 'excel, google-sheets', '공식출처': 'https://support.microsoft.com/\nhttps://support.google.com/docs/'}.items()}
    properties.update({'배포 사이트': {'relation': [{'id': p.SITE_PAGE}]}, '상태': {'select': {'name': '발행대기'}},
                       '검수승인': {'checkbox': True}, '발행예정일': {'date': {'start': '2026-10-24'}},
                       '카테고리': {'select': {'name': 'formulas'}}})
    return {'id': PAGE, 'properties': properties}


def paragraph(value):
    return {'id': PAGE, 'type': 'paragraph', 'paragraph': {'rich_text': [{'plain_text': value}]}}


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'src/content/articles').mkdir(parents=True)
        (self.root / 'data').mkdir()
        self.ledger = self.root / 'data/publications.json'
        self.ledger.write_text('{"version":1,"records":[]}')
        self.patches = [patch.object(p, 'ROOT', self.root), patch.object(p, 'LEDGER', self.ledger),
                        patch.object(p, 'now', return_value=datetime(2026, 10, 24, 3, 0, tzinfo=timezone.utc)),
                        patch.dict(os.environ, {'NOTION_API_TOKEN': 'test-token', 'GH_TOKEN': 'test-gh-token'})]
        for mock in self.patches:
            mock.start()
        self.page = article()
        self.site = registry()
        self.body = 'A spreadsheet formula should be checked against its input data and expected result. This paragraph describes the example without claiming native application execution.\n'
        self.notion = patch.object(p, 'notion', side_effect=self.api).start()
        self.addCleanup(patch.stopall)
        self.addCleanup(self.temp.cleanup)

    def api(self, method, route, data=None):
        if route == '/data_sources/' + p.REGISTRY_ID + '/query':
            return {'results': [self.site], 'has_more': False}
        if route == '/data_sources/' + p.QUEUE_ID + '/query':
            return {'results': [self.page], 'has_more': False}
        if route == '/data_sources/' + p.QUALITY_ID + '/query':
            return {'results': [], 'has_more': False}
        if route == '/pages/' + PAGE and method == 'GET':
            return self.page
        if route.startswith('/blocks/'):
            return {'results': [paragraph(self.body)], 'has_more': False}
        return {}

    def stage(self):
        return p.stage()

    def test_success_stages_honest_frontmatter_and_ledger_without_notion_write(self):
        result = self.stage()
        self.assertEqual(result['status'], 'STAGED')
        source = (self.root / result['file']).read_text()
        self.assertIn('notionPageId: "' + PAGE, source)
        self.assertIn('does not establish native Excel', source)
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')
        self.assertFalse(any(call.args[0] == 'PATCH' for call in self.notion.call_args_list))

    def test_missing_token_setup_required(self):
        with patch.dict(os.environ, {'NOTION_API_TOKEN': ''}):
            with self.assertRaisesRegex(RuntimeError, 'SETUP_REQUIRED'):
                self.stage()

    def test_missing_gh_token(self):
        with patch.dict(os.environ, {'GH_TOKEN': ''}):
            with self.assertRaisesRegex(RuntimeError, 'SETUP_REQUIRED'):
                p.gh('api', 'test')


    def test_published_accounting_needs_deployment_evidence(self):
        self.stage()
        ledger = p.load_ledger()
        ledger['records'][0]['state'] = 'published'
        p.save_ledger(ledger)
        with self.assertRaisesRegex(ValueError, 'LEDGER_INVALID'):
            p.load_ledger()

    def test_registry_every_identity_field_fail_closed(self):
        for key in ('Site ID', 'Site Name', 'Repository', 'Language', 'Timezone', 'Content Format', 'Workflow'):
            with self.subTest(key=key):
                original = self.site['properties'][key]
                self.site['properties'][key] = text('wrong', key == 'Site ID')
                with self.assertRaisesRegex(ValueError, 'SITE_REGISTRY_MISMATCH'):
                    self.stage()
                self.site['properties'][key] = original
        for key, bad in [('Base URL', {'url': 'https://guidehollow.com'}), ('Status', {'select': {'name': 'preparing'}}), ('Daily Limit', {'number': 2})]:
            original = self.site['properties'][key]
            self.site['properties'][key] = bad
            with self.assertRaisesRegex(ValueError, 'SITE_REGISTRY_MISMATCH'):
                self.stage()
            self.site['properties'][key] = original
        self.site['id'] = OTHER
        with self.assertRaisesRegex(ValueError, 'unexpected registry page'):
            self.stage()

    def test_wrong_site_is_ignored(self):
        self.page['properties']['배포 사이트']['relation'] = [{'id': OTHER}]
        self.assertEqual(self.stage()['status'], 'QUEUE_EMPTY')

    def test_multiple_site_or_duplicate_relation_is_rejected(self):
        for second in (p.SITE_PAGE, OTHER):
            self.page['properties']['배포 사이트']['relation'] = [{'id': p.SITE_PAGE}, {'id': second}]
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                self.stage()

    def test_unapproved_future_missing_due_wrong_status(self):
        for name, bad in [('검수승인', {'checkbox': False}), ('발행예정일', {'date': {'start': '2026-10-25'}}),
                          ('발행예정일', {'date': {'start': '2026-10-24T20:00:00+09:00'}}),
                          ('발행예정일', {'date': None}), ('상태', {'select': {'name': '검수대기'}})]:
            original = self.page['properties'][name]
            self.page['properties'][name] = bad
            self.assertEqual(self.stage()['status'], 'QUEUE_EMPTY')
            self.page['properties'][name] = original

    def test_empty_queue_no_write(self):
        with patch.object(p, 'query', side_effect=[[self.site], []]):
            self.assertEqual(self.stage()['status'], 'QUEUE_EMPTY')
        self.assertEqual(p.load_ledger()['records'], [])

    def test_missing_corrupt_or_incomplete_ledger_is_closed(self):
        self.ledger.unlink()
        with self.assertRaisesRegex(ValueError, 'LEDGER_INVALID'):
            self.stage()
        for value in ('not json', '{}', '{"version":1,"records":[{}]}'):
            self.ledger.write_text(value)
            with self.assertRaisesRegex(ValueError, 'LEDGER_INVALID'):
                self.stage()

    def test_daily_limit_and_retry(self):
        first = self.stage()
        self.assertEqual(self.stage()['status'], 'RESUME')
        self.assertEqual(len(p.load_ledger()['records']), 1)
        ledger = p.load_ledger()
        ledger['records'][0].update(state='published', published_at='2026-10-24T03:00:00Z', commit=SHA, deployment_run_id=42)
        p.save_ledger(ledger)
        self.assertEqual(self.stage()['status'], 'DAILY_LIMIT')
        self.assertEqual(first['page_id'], PAGE)

    def test_resume_requires_unchanged_source_and_approval(self):
        first = self.stage()
        self.page['properties']['검수승인']['checkbox'] = False
        with self.assertRaisesRegex(ValueError, 'no longer approved'):
            self.stage()
        self.page['properties']['검수승인']['checkbox'] = True
        (self.root / first['file']).write_text('tampered')
        with self.assertRaisesRegex(ValueError, 'missing or changed'):
            self.stage()

    def test_duplicate_page_and_slug_historical_ledger(self):
        self.stage()
        ledger = p.load_ledger()
        ledger['records'][0].update(state='published', kst_date='2026-10-23', published_at='2026-10-23T03:00:00Z', commit=SHA, deployment_run_id=42)
        p.save_ledger(ledger)
        with self.assertRaisesRegex(ValueError, 'Duplicate Notion page or slug'):
            self.stage()
        self.page['id'] = OTHER
        with self.assertRaisesRegex(ValueError, 'Duplicate Notion page or slug'):
            self.stage()

    def test_initial_content_slug_protected_even_different_filename(self):
        (self.root / 'src/content/articles/initial.md').write_text('---\nslug: sample-formula\n---\nExisting article')
        with self.assertRaisesRegex(ValueError, 'Duplicate existing article slug'):
            self.stage()

    def test_duplicate_ledger_and_over_limit_are_closed(self):
        self.stage()
        ledger = p.load_ledger()
        ledger['records'].append(deepcopy(ledger['records'][0]))
        p.save_ledger(ledger)
        with self.assertRaisesRegex(ValueError, 'LEDGER_INVALID'):
            self.stage()
        ledger['records'][1].update(page_id=OTHER, slug='another', file='src/content/articles/another.md', url=p.SITE + '/formulas/another/')
        p.save_ledger(ledger)
        with self.assertRaisesRegex(ValueError, 'LEDGER_INVALID'):
            self.stage()

    def test_unsupported_blocks_do_not_silently_disappear(self):
        for kind in ('image', 'callout', 'child_page', 'embed'):
            with patch.object(p, 'children', return_value=[{'type': kind, kind: {}}]):
                with self.assertRaisesRegex(ValueError, 'Unsupported block'):
                    p.markdown(PAGE)
        with patch.object(p, 'children', return_value=[dict(paragraph('Text'), has_children=True)]):
            with self.assertRaisesRegex(ValueError, 'Unsupported nested'):
                p.markdown(PAGE)

    def test_list_paragraph_boundary_and_links_preserved(self):
        blocks = [{'type': 'bulleted_list_item', 'bulleted_list_item': {'rich_text': [{'plain_text': 'List'}]}}, paragraph('Following paragraph')]
        with patch.object(p, 'children', return_value=blocks):
            self.assertIn('- List\n\nFollowing paragraph', p.markdown(PAGE))
        for url in ('/formulas/sum/', 'https://app.notion.com/formulas/sum/', 'https://app.notion.com/data-cleaning/trim/'):
            rendered = p.safe_inline([{'plain_text': 'Guide', 'href': url}])
            self.assertNotIn('app.notion.com', rendered)
        real = 'https://app.notion.com/p/' + PAGE
        self.assertIn(real, p.safe_inline([{'plain_text': 'Notion source', 'href': real}]))
        with self.assertRaisesRegex(ValueError, 'Unsafe inline link'):
            p.safe_inline([{'plain_text': 'x', 'href': 'javascript:alert(1)'}])


    def test_inline_code_preserves_formula_characters_and_backticks(self):
        cases = {
            '=A1<10': '`=A1<10`', '=A1>10': '`=A1>10`', '=A1&" & "&B1': '`=A1&" & "&B1`',
            'SUM(`column`)': '``SUM(`column`)``', '`edge`': '`` `edge` ``',
            'a``b': '```a``b```', '`': '`` ` ``', '  formula  ': '`   formula   `',
            ' formula': '` formula`', 'formula ': '`formula `', '   ': '`   `',
        }
        for original, expected in cases.items():
            with self.subTest(original=original):
                self.assertEqual(p.safe_inline([{'plain_text': original, 'annotations': {'code': True}}]), expected)
        self.assertEqual(p.safe_inline([{'plain_text': '', 'annotations': {'code': True, 'bold': True}}]), '')

    def test_ordinary_inline_escaping_is_preserved(self):
        self.assertEqual(p.safe_inline([{'plain_text': '<tag> & `formula`'}]), '&lt;tag&gt; &amp; \`formula\`')
        self.assertEqual(p.safe_inline([{'plain_text': '=A1<10', 'annotations': {'code': True}, 'href': '/formulas/sum/'}]), '[`=A1<10`](/formulas/sum/)')

    def test_table_code_pipe_is_preserved_without_gfm_cell_split(self):
        table = {'id': PAGE, 'type': 'table', 'has_children': True, 'table': {}}
        rows = [{'type': 'table_row', 'table_row': {'cells': [
            [{'plain_text': 'Formula'}], [{'plain_text': '=A1&"|"&B1', 'annotations': {'code': True}}]]}}]
        with patch.object(p, 'children', side_effect=[[table], rows]):
            self.assertIn('<code>=A1&amp;&quot;&#124;&quot;&amp;B1</code>', p.markdown(PAGE))
        self.assertEqual(p.safe_inline([{'plain_text': r'a\|`b`', 'annotations': {'code': True}}], table_cell=True), '<code>a&#92;&#124;&#96;b&#96;</code>')

    def test_empty_or_no_prose_body_is_rejected(self):
        with patch.object(p, 'markdown', return_value=''):
            with self.assertRaisesRegex(ValueError, 'substantive prose'):
                self.stage()

    def test_wrong_sha_failed_or_nonmanual_deploy_rejected(self):
        run = {'id': 42, 'head_sha': SHA, 'event': 'workflow_dispatch', 'head_branch': 'main',
               'path': '.github/workflows/deploy.yml', 'status': 'completed', 'conclusion': 'success'}
        with patch.object(p, 'gh', return_value={'jobs': [{'name': 'deploy', 'conclusion': 'success'}]}):
            p.verify_deployment(run, SHA)
            for key, bad in [('head_sha', 'b' * 40), ('event', 'push'), ('head_branch', 'feature'),
                             ('conclusion', 'failure'), ('status', 'in_progress'), ('path', '.github/workflows/other.yml')]:
                with self.assertRaisesRegex(ValueError, 'EXPECTED_SHA'):
                    p.verify_deployment(dict(run, **{key: bad}), SHA)
        with patch.object(p, 'gh', return_value={'jobs': [{'name': 'deploy', 'conclusion': 'skipped'}]}):
            with self.assertRaisesRegex(ValueError, 'deploy job'):
                p.verify_deployment(run, SHA)

    def live(self, html, row):
        response = MagicMock()
        response.status = 200
        response.geturl.return_value = row['url'] + '?verify-notion=1'
        response.read.return_value = html.encode()
        response.__enter__.return_value = response
        return patch.object(p, 'urlopen', return_value=response)

    def test_live_requires_canonical_exact_page_and_body(self):
        self.stage()
        row = p.load_ledger()['records'][0]
        good = f'<link rel="canonical" href="{row["url"]}"><article data-notion-page-id="{PAGE}">{self.body}</article>'
        with self.live(good, row):
            p.verify_live(row)
        for bad in (good.replace(row['url'], p.SITE + '/wrong/'), good.replace(PAGE, OTHER), good.replace(self.body, 'stale content')):
            with self.live(bad, row), self.assertRaises(ValueError):
                p.verify_live(row)

    def test_failed_deploy_never_finalizes(self):
        self.stage()
        self.notion.reset_mock()
        with patch.object(p, 'gh', side_effect=[{'object': {'sha': SHA}}, {'workflow_runs': []}, None,
                     {'workflow_runs': [{'id': 42, 'head_sha': SHA, 'head_branch': 'main', 'created_at': '2026-10-24T03:00:00Z'}]},
                     {'id': 42, 'head_sha': SHA, 'event': 'workflow_dispatch', 'head_branch': 'main', 'path': '.github/workflows/deploy.yml', 'status': 'completed', 'conclusion': 'failure'}]):
            with self.assertRaisesRegex(ValueError, 'EXPECTED_SHA'):
                p.deploy_and_finalize(PAGE, SHA)
        writes = [c.args[2] for c in self.notion.call_args_list if c.args[0] == 'PATCH']
        self.assertFalse(any(w['properties']['상태']['select']['name'] == '발행완료' for w in writes))
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')


    def deploy_api(self, *args):
        route = args[-1]
        if route.endswith('/git/ref/heads/main'):
            return {'object': {'sha': SHA}}
        if 'dispatches' in args:
            return None
        if any('dispatches' in arg for arg in args):
            return None
        if '/actions/workflows/deploy.yml/runs?' in route:
            self.run_queries = getattr(self, 'run_queries', 0) + 1
            old = {'id': 40, 'head_sha': SHA, 'head_branch': 'main', 'created_at': '2026-10-24T02:00:00Z'}
            wrong = {'id': 41, 'head_sha': 'b' * 40, 'head_branch': 'main', 'created_at': '2026-10-24T03:00:00Z'}
            correct = {'id': 42, 'head_sha': SHA, 'head_branch': 'main', 'created_at': '2026-10-24T03:00:00Z'}
            return {'workflow_runs': [old] if self.run_queries == 1 else [old, wrong, correct]}
        if route.endswith('/actions/runs/42'):
            return {'id': 42, 'head_sha': SHA, 'event': 'workflow_dispatch', 'head_branch': 'main',
                    'path': '.github/workflows/deploy.yml', 'status': 'completed', 'conclusion': 'success'}
        if '/actions/runs/42/jobs' in route:
            return {'jobs': [{'name': 'deploy', 'conclusion': 'success'}]}
        raise AssertionError('Unexpected GitHub request: ' + str(args))

    def test_full_finalize_only_after_exact_new_run_and_live_proof(self):
        self.stage()
        self.notion.reset_mock()
        with patch.object(p, 'gh', side_effect=self.deploy_api) as github, patch.object(p, 'verify_live') as live:
            result = p.deploy_and_finalize(PAGE, SHA)
        self.assertEqual(result['status'], 'PUBLISHED')
        live.assert_called_once()
        routes = [call.args[-1] for call in github.call_args_list]
        self.assertIn('repos/' + p.REPO + '/actions/runs/42', routes)
        self.assertNotIn('repos/' + p.REPO + '/actions/runs/40', routes)
        self.assertNotIn('repos/' + p.REPO + '/actions/runs/41', routes)
        row = p.load_ledger()['records'][0]
        self.assertEqual((row['state'], row['deployment_run_id'], row['commit']), ('published', 42, SHA))
        writes = [call.args[2] for call in self.notion.call_args_list if call.args[0] == 'PATCH']
        self.assertEqual(writes[-1]['properties']['상태']['select']['name'], '발행완료')
        self.assertEqual(writes[-1]['properties']['GitHub 커밋']['url'], 'https://github.com/' + p.REPO + '/commit/' + SHA)
        self.assertEqual(self.stage()['status'], 'DAILY_LIMIT')

    def test_live_failure_keeps_reservation_and_never_finalizes(self):
        self.stage()
        self.notion.reset_mock()
        with patch.object(p, 'gh', side_effect=self.deploy_api), patch.object(p, 'verify_live', side_effect=ValueError('body mismatch')), patch.object(p.time, 'sleep'):
            with self.assertRaisesRegex(ValueError, 'body mismatch'):
                p.deploy_and_finalize(PAGE, SHA)
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')
        writes = [call.args[2] for call in self.notion.call_args_list if call.args[0] == 'PATCH']
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0]['properties']['상태']['select']['name'], '발행중')

    def test_stale_successful_run_is_never_reused(self):
        self.stage()
        old = {'id': 40, 'head_sha': SHA, 'head_branch': 'main', 'created_at': '2026-10-24T02:00:00Z', 'conclusion': 'success'}
        def github(*args):
            if args[-1].endswith('/git/ref/heads/main'):
                return {'object': {'sha': SHA}}
            if any('dispatches' in arg for arg in args):
                return None
            return {'workflow_runs': [old]}
        with patch.object(p, 'gh', side_effect=github), patch.object(p.time, 'monotonic', side_effect=[0, 0, 1201]), patch.object(p.time, 'sleep'):
            with self.assertRaisesRegex(ValueError, 'Timed out'):
                p.deploy_and_finalize(PAGE, SHA)
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')

    def test_main_advanced_and_direct_published_finalize_fail_closed(self):
        self.stage()
        with patch.object(p, 'gh', return_value={'object': {'sha': 'b' * 40}}):
            with self.assertRaisesRegex(ValueError, 'MAIN_ADVANCED'):
                p.deploy_and_finalize(PAGE, SHA)
        ledger = p.load_ledger()
        ledger['records'][0].update(state='published', published_at='2026-10-24T03:00:00Z', commit=SHA, deployment_run_id=42)
        p.save_ledger(ledger)
        with self.assertRaisesRegex(ValueError, 'Run stage first'):
            p.deploy_and_finalize(PAGE, SHA)

    def test_changed_approval_during_deploy_blocks_completion(self):
        self.stage()
        def revoke(_row):
            self.page['properties']['검수승인']['checkbox'] = False
        with patch.object(p, 'gh', side_effect=self.deploy_api), patch.object(p, 'verify_live', side_effect=revoke):
            with self.assertRaisesRegex(ValueError, 'changed during deployment'):
                p.deploy_and_finalize(PAGE, SHA)
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')

    def test_compact_existing_notion_page_id_prevents_duplicate(self):
        (self.root / 'src/content/articles/initial.md').write_text('---\nnotionPageId: "' + PAGE.replace('-', '') + '"\n---\nExisting article')
        with self.assertRaisesRegex(ValueError, 'Duplicate existing Notion page'):
            self.stage()


    def test_resume_rejects_changed_notion_body(self):
        self.stage()
        before = self.ledger.read_bytes()
        self.body += ' An editor changed this approved body after staging.'
        with self.assertRaisesRegex(ValueError, 'NOTION_SOURCE_CHANGED'):
            self.stage()
        self.assertEqual(self.ledger.read_bytes(), before)

    def test_resume_rejects_changed_source_metadata(self):
        self.stage()
        for name, replacement in [('제목', text('A newly edited spreadsheet title', True)),
                                  ('설명', text('A newly edited sufficiently detailed description.')),
                                  ('슬러그', text('changed-slug')), ('태그', text('changed-tag')),
                                  ('카테고리', {'select': {'name': 'templates'}}),
                                  ('공식출처', text('https://support.microsoft.com/changed'))]:
            original = self.page['properties'][name]
            self.page['properties'][name] = replacement
            with self.subTest(property=name), self.assertRaisesRegex(ValueError, 'NOTION_SOURCE_CHANGED'):
                self.stage()
            self.page['properties'][name] = original

    def test_source_revision_ignores_own_status_and_publication_fields(self):
        self.stage()
        self.page['properties']['상태'] = {'select': {'name': '발행중'}}
        self.page['properties']['GitHub 커밋'] = {'url': 'https://github.com/' + p.REPO + '/commit/' + SHA}
        self.page['last_edited_time'] = '2026-10-24T03:30:00Z'
        self.assertEqual(self.stage()['status'], 'RESUME')

    def test_body_edit_during_deployment_blocks_finalization(self):
        self.stage()
        self.notion.reset_mock()
        def edit(_row):
            self.body += ' Newly edited approved body.'
        with patch.object(p, 'gh', side_effect=self.deploy_api), patch.object(p, 'verify_live', side_effect=edit):
            with self.assertRaisesRegex(ValueError, 'NOTION_SOURCE_CHANGED'):
                p.deploy_and_finalize(PAGE, SHA)
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')
        writes = [call.args[2] for call in self.notion.call_args_list if call.args[0] == 'PATCH']
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0]['properties']['상태']['select']['name'], '발행중')

    def test_metadata_edits_during_deployment_block_finalization(self):
        self.stage()
        for name, replacement in [('제목', text('A changed approved title', True)),
                                  ('카테고리', {'select': {'name': 'templates'}}),
                                  ('공식출처', text('https://support.microsoft.com/changed'))]:
            original = self.page['properties'][name]
            self.run_queries = 0
            def edit(_row):
                self.page['properties'][name] = replacement
            with self.subTest(property=name), patch.object(p, 'gh', side_effect=self.deploy_api), patch.object(p, 'verify_live', side_effect=edit):
                with self.assertRaisesRegex(ValueError, 'NOTION_SOURCE_CHANGED'):
                    p.deploy_and_finalize(PAGE, SHA)
            self.page['properties'][name] = original
        self.assertEqual(p.load_ledger()['records'][0]['state'], 'staged')

    def test_completed_notion_with_staged_ledger_requires_manual_reconciliation(self):
        self.stage()
        self.page['properties'].update({'상태': {'select': {'name': '발행완료'}},
            '발행일시': {'date': {'start': '2026-10-24T03:00:00Z'}},
            'GitHub 커밋': {'url': 'https://github.com/' + p.REPO + '/commit/' + SHA}})
        original_page = deepcopy(self.page)
        original_ledger = self.ledger.read_bytes()
        self.notion.reset_mock()
        with patch.object(p, 'now', return_value=datetime(2026, 10, 25, 3, 0, tzinfo=timezone.utc)):
            with self.assertRaisesRegex(ValueError, 'RECONCILIATION_REQUIRED'):
                self.stage()
        self.assertEqual(self.ledger.read_bytes(), original_ledger)
        self.assertEqual(self.page, original_page)
        self.assertFalse(any(call.args[0] == 'PATCH' for call in self.notion.call_args_list))
        with patch.object(p, 'gh', return_value={'object': {'sha': SHA}}):
            with self.assertRaisesRegex(ValueError, 'RECONCILIATION_REQUIRED'):
                p.deploy_and_finalize(PAGE, SHA)
        self.assertFalse(any(call.args[0] == 'PATCH' for call in self.notion.call_args_list))

    def test_quality_log_relationships_fail_closed(self):
        malformed = {'properties': {'연결 원고': {'relation': [{'id': OTHER}]}, '배포 사이트': {'relation': [{'id': p.SITE_PAGE}]}}}
        with patch.object(p, 'query', return_value=[malformed]):
            with self.assertRaisesRegex(ValueError, 'QUALITY_LOG_RELATION_MISMATCH'):
                p.log_quality(PAGE, p.SITE_PAGE, p.SITE + '/formulas/sample/')

    def test_workflow_manual_only_protection_and_permissions(self):
        workflow = (Path(__file__).resolve().parents[1] / '.github/workflows/notion-daily-publisher.yml').read_text()
        self.assertIn('workflow_dispatch:', workflow)
        self.assertNotIn('schedule:', workflow)
        self.assertNotIn('pull-requests: write', workflow)
        self.assertNotIn('--force', workflow)
        self.assertIn('branches/main', workflow)
        self.assertIn('NOTION_API_TOKEN: ${{ secrets.NOTION_API_TOKEN }}', workflow)
        self.assertIn('Explicit Pages dispatch', workflow)


if __name__ == '__main__':
    unittest.main()
