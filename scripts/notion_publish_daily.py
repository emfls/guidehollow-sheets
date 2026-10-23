#!/usr/bin/env python3
"""Fail-closed, manually dispatched Notion -> Sheets source -> Pages publisher."""
import argparse
from datetime import datetime, timezone
from html import escape, unescape
from html.parser import HTMLParser
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://sheets.guidehollow.com'
REPO = 'emfls/guidehollow-sheets'
SITE_ID = 'gh-sheets'
QUEUE_ID = 'b788e982-fc20-4df0-9f1b-8ff2a19f271d'
REGISTRY_ID = '99edf088-9778-4b8d-80f0-c7d7777f2fc4'
SITE_PAGE = '402db4c0-a991-813e-9641-dcac9b1e46f5'
QUALITY_ID = '1e28a0aa-72ec-4e24-850b-c97fe2eb8ce0'
LEDGER = ROOT / 'data/publications.json'
CATEGORIES = ('formulas', 'data-cleaning', 'troubleshooting', 'templates', 'comparisons')
KST = ZoneInfo('Asia/Seoul')


def now():
    return datetime.now(timezone.utc)


def day():
    return now().astimezone(KST).date().isoformat()


def identity(value):
    value = value.replace('-', '').lower()
    if not re.fullmatch('[0-9a-f]{32}', value):
        raise ValueError('Invalid Notion page identity')
    return value


def require_token():
    if not os.getenv('NOTION_API_TOKEN', '').strip():
        raise RuntimeError('SETUP_REQUIRED: add repository Actions secret NOTION_API_TOKEN and share the queue/registry with that integration')


def notion(method, route, data=None):
    require_token()
    request = Request('https://api.notion.com/v1' + route,
                      data=None if data is None else json.dumps(data).encode(),
                      headers={'Authorization': 'Bearer ' + os.environ['NOTION_API_TOKEN'],
                               'Notion-Version': '2025-09-03', 'Content-Type': 'application/json'},
                      method=method)
    # Never print headers, tokens, or API response bodies on failure.
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def plain(items):
    return ''.join(item.get('plain_text', item.get('text', {}).get('content', '')) for item in items)


def prop(properties, name):
    value = properties[name]
    if value['type'] not in ('title', 'rich_text'):
        raise ValueError('Unexpected Notion property type: ' + name)
    return plain(value[value['type']]).strip()


def query(data_source, payload):
    result = []
    while True:
        batch = notion('POST', '/data_sources/' + data_source + '/query', payload)
        result.extend(batch['results'])
        if not batch.get('has_more'):
            return result
        payload = dict(payload, start_cursor=batch['next_cursor'])


def verify_site_registry():
    rows = query(REGISTRY_ID, {'filter': {'property': 'Site ID', 'title': {'equals': SITE_ID}}})
    if len(rows) != 1:
        raise ValueError('SITE_REGISTRY_MISMATCH: expected exactly one gh-sheets record')
    row = rows[0]
    p = row['properties']
    expected = {'Site ID': SITE_ID, 'Site Name': 'GuideHollow Sheets', 'Repository': REPO,
                'Language': 'en', 'Timezone': 'Asia/Seoul', 'Content Format': 'astro-markdown',
                'Workflow': 'notion-daily-publisher.yml'}
    if any(prop(p, key) != value for key, value in expected.items()) or (
            p['Base URL'].get('url') != SITE or p['Daily Limit'].get('number') != 1 or
            (p['Status'].get('select') or {}).get('name') != 'active'):
        raise ValueError('SITE_REGISTRY_MISMATCH: site identity must match and Status must be active')
    if identity(row['id']) != identity(SITE_PAGE):
        raise ValueError('SITE_REGISTRY_MISMATCH: unexpected registry page')
    return row


def children(block_id):
    items, cursor = [], None
    while True:
        route = '/blocks/' + block_id + '/children?page_size=100'
        if cursor:
            route += '&start_cursor=' + quote(cursor)
        batch = notion('GET', route)
        items.extend(batch['results'])
        if not batch.get('has_more'):
            return items
        cursor = batch['next_cursor']


def safe_inline(items, table_cell=False):
    output = []
    for item in items:
        if item.get('type', 'text') != 'text':
            raise ValueError('Unsupported inline object')
        text = plain([item])
        if '\x00' in text:
            raise ValueError('Null byte in content')
        if not text:
            continue
        annotations = item.get('annotations', {})
        if annotations.get('code') and table_cell and '|' in text:
            # GFM splits pipes even inside code spans; generated HTML keeps literal pipes/backslashes.
            text = '<code>' + re.sub(r'[\\`*_\[\]#!|~]', lambda match: '&#' + str(ord(match.group())) + ';', escape(text)) + '</code>'
        elif annotations.get('code'):
            fence = '`' * max((len(match.group()) + 1 for match in re.finditer(r'`+', text)), default=1)
            # CommonMark trims one surrounding space; padding preserves ticks and boundary spaces.
            if text.startswith('`') or text.endswith('`') or (text.startswith(' ') and text.endswith(' ') and text.strip(' ')):
                text = ' ' + text + ' '
            text = fence + text + fence
        else:
            text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            text = re.sub(r'([\\`*_\[\]#!|])', r'\\\1', text)
        if annotations.get('bold'):
            text = '**' + text + '**'
        if annotations.get('italic'):
            text = '*' + text + '*'
        if annotations.get('strikethrough'):
            text = '~~' + text + '~~'
        url = item.get('href') or (item.get('text', {}).get('link') or {}).get('url')
        if url:
            parsed = urlsplit(url)
            if parsed.hostname == 'app.notion.com' and any(parsed.path.startswith('/' + c + '/') for c in CATEGORIES):
                url = parsed.path + ('?' + parsed.query if parsed.query else '') + ('#' + parsed.fragment if parsed.fragment else '')
                parsed = urlsplit(url)
            if not ((parsed.scheme == 'https' and parsed.netloc) or (url.startswith('/') and not url.startswith('//')) or url.startswith('#')):
                raise ValueError('Unsafe inline link')
            if any(ord(c) < 33 for c in url):
                raise ValueError('Whitespace/control character in inline link')
            text = '[' + text + '](' + url.replace('(', '%28').replace(')', '%29').replace('<', '%3C').replace('>', '%3E') + ')'
        output.append(text)
    return ''.join(output)


def markdown(block_id):
    output, previous_list = [], None
    for block in children(block_id):
        kind = block['type']
        data = block[kind]
        list_kind = kind if kind in ('bulleted_list_item', 'numbered_list_item') else None
        if previous_list and list_kind != previous_list:
            output.append('')
        previous_list = list_kind
        if kind == 'table':
            rows = children(block['id'])
            cells = []
            for row in rows:
                if row['type'] != 'table_row':
                    raise ValueError('Unsupported table child')
                cells.append([safe_inline(cell, table_cell=True).replace('\\|', '&#124;') for cell in row['table_row']['cells']])
            if not cells or not cells[0] or any(len(row) != len(cells[0]) for row in cells):
                raise ValueError('Invalid table')
            output.extend(['| ' + ' | '.join(cells[0]) + ' |', '| ' + ' | '.join('---' for _ in cells[0]) + ' |'])
            output.extend('| ' + ' | '.join(row) + ' |' for row in cells[1:])
            output.append('')
            continue
        if block.get('has_children'):
            raise ValueError('Unsupported nested block: ' + kind)
        if kind == 'code':
            code = plain(data['rich_text'])
            fence = '`' * max(3, max((len(m.group()) + 1 for m in re.finditer(r'`+', code)), default=3))
            language = data.get('language', 'text')
            language = language if re.fullmatch('[a-zA-Z0-9+#-]+', language) else 'text'
            output.extend([fence + language, code, fence, ''])
        elif kind == 'divider':
            output.extend(['---', ''])
        elif kind in ('paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'):
            text = safe_inline(data.get('rich_text', []))
            prefix = {'paragraph': '', 'heading_1': '## ', 'heading_2': '## ', 'heading_3': '### ',
                      'bulleted_list_item': '- ', 'numbered_list_item': '1. ', 'quote': '> '}[kind]
            output.append(prefix + text)
            if not list_kind:
                output.append('')
        else:
            raise ValueError('Unsupported block: ' + kind)
    return '\n'.join(output).strip() + '\n'


def load_ledger():
    try:
        ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
        if ledger['version'] != 1 or not isinstance(ledger['records'], list):
            raise ValueError('Invalid ledger schema')
        seen_pages, seen_slugs, counts = set(), set(), {}
        for row in ledger['records']:
            for key in ('site_id', 'page_id', 'slug', 'kst_date', 'state', 'url', 'file', 'sha256', 'body_excerpt', 'title', 'source_revision'):
                if not isinstance(row[key], str) or not row[key]:
                    raise ValueError('Incomplete publication record')
            identity(row['page_id'])
            if datetime.strptime(row['kst_date'], '%Y-%m-%d').date().isoformat() != row['kst_date']:
                raise ValueError('Invalid accounting date')
            if row['state'] == 'published':
                published = datetime.fromisoformat(row['published_at'].replace('Z', '+00:00'))
                if (published.tzinfo is None or published.astimezone(KST).date().isoformat() != row['kst_date'] or
                        not re.fullmatch('[0-9a-f]{40}', row['commit']) or
                        not isinstance(row['deployment_run_id'], int) or row['deployment_run_id'] <= 0):
                    raise ValueError('Incomplete published deployment evidence')
            if row['state'] not in ('staged', 'published') or not re.fullmatch('[0-9a-f]{64}', row['sha256']) or not re.fullmatch('[0-9a-f]{64}', row['source_revision']):
                raise ValueError('Invalid publication record')
            page_key = (row['site_id'], identity(row['page_id']))
            slug_key = (row['site_id'], row['slug'])
            if page_key in seen_pages or slug_key in seen_slugs:
                raise ValueError('Duplicate publication record')
            seen_pages.add(page_key)
            seen_slugs.add(slug_key)
            if row['site_id'] == SITE_ID:
                if row['file'] != 'src/content/articles/' + row['slug'] + '.md' or not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', row['slug']):
                    raise ValueError('Unsafe ledger file')
                if row['url'] not in [SITE + '/' + c + '/' + row['slug'] + '/' for c in CATEGORIES]:
                    raise ValueError('Wrong ledger URL')
                counts[row['kst_date']] = counts.get(row['kst_date'], 0) + 1
        if any(count > 1 for count in counts.values()):
            raise ValueError('Daily publication accounting exceeds limit')
        return ledger
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ValueError('LEDGER_INVALID: restore verified data/publications.json; publishing is closed') from error


def save_ledger(ledger):
    temporary = LEDGER.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(LEDGER)


def due(properties):
    value = properties['발행예정일'].get('date')
    if not value or not value.get('start'):
        return False
    start = value['start']
    if len(start) == 10:
        return start <= day()
    parsed = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Scheduled timestamp requires timezone')
    return parsed <= now()


def eligible(row, site_page, resume=False):
    p = row['properties']
    relation = p['배포 사이트']
    related = relation.get('relation', [])
    if relation.get('has_more'):
        raise ValueError('Incomplete site relation')
    ids = [identity(item['id']) for item in related]
    if identity(site_page) not in ids:
        return False
    if len(ids) != 1:
        raise ValueError('Queue article must have exactly one site relation')
    states = ('발행대기', '발행중') if resume else ('발행대기',)
    return ((p['상태'].get('select') or {}).get('name') in states and
            p['검수승인'].get('checkbox') is True and due(p))


def source_revision(page, body=None):
    properties = page['properties']
    content = {name: prop(properties, name) for name in ('제목', '설명', '슬러그', '태그', '공식출처')}
    content['카테고리'] = (properties['카테고리'].get('select') or {}).get('name')
    content['body'] = markdown(page['id']) if body is None else body
    return hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def require_unfinished(page):
    if (page['properties']['상태'].get('select') or {}).get('name') == '발행완료':
        raise ValueError('RECONCILIATION_REQUIRED: Notion is already completed but the durable ledger is staged; preserve the original publication timestamp, commit and accounting day. Owner must reconcile deployment/live evidence manually.')


def verify_source_revision(page, row):
    if source_revision(page) != row['source_revision']:
        raise ValueError('NOTION_SOURCE_CHANGED: approved queue content differs from the staged revision; owner review is required')


def staged_result(row, status):
    return {'status': status, 'page_id': row['page_id'], 'url': row['url'], 'file': row['file']}


def stage():
    require_token()
    registry = verify_site_registry()
    ledger = load_ledger()
    own = [row for row in ledger['records'] if row['site_id'] == SITE_ID]
    pending = [row for row in own if row['state'] == 'staged']
    if len(pending) > 1:
        raise ValueError('Multiple interrupted publications need operator reconciliation')
    if pending:
        row = pending[0]
        page = notion('GET', '/pages/' + row['page_id'])
        require_unfinished(page)
        if not eligible(page, registry['id'], resume=True):
            raise ValueError('Interrupted publication is no longer approved, due, or correctly routed')
        verify_source_revision(page, row)
        source = ROOT / row['file']
        if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Staged source is missing or changed; reconcile ledger before retry')
        if any(x['kst_date'] == day() and x is not row for x in own):
            return {'status': 'DAILY_LIMIT'}
        row['kst_date'] = day()
        save_ledger(ledger)
        return staged_result(row, 'RESUME')
    if any(row['kst_date'] == day() for row in own):
        return {'status': 'DAILY_LIMIT'}
    ready = query(QUEUE_ID, {'filter': {'property': '상태', 'select': {'equals': '발행대기'}},
                             'sorts': [{'property': '발행순서', 'direction': 'ascending'}], 'page_size': 100})
    candidates = [row for row in ready if eligible(row, registry['id'])]
    if not candidates:
        return {'status': 'QUEUE_EMPTY'}
    page = candidates[0]
    p = page['properties']
    page_id = page['id']
    identity(page_id)
    slug, title, description = (prop(p, key) for key in ('슬러그', '제목', '설명'))
    category = (p['카테고리'].get('select') or {}).get('name')
    if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', slug) or category not in CATEGORIES:
        raise ValueError('Invalid slug or category')
    if len(title) < 12 or len(description) < 35:
        raise ValueError('Invalid article title or description (12/35 character minimums)')
    tags = [tag.strip() for tag in prop(p, '태그').split(',') if tag.strip()]
    if not tags or any(not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', tag) for tag in tags):
        raise ValueError('Invalid tags')
    sources = prop(p, '공식출처').splitlines()
    if not sources or any(urlsplit(url).scheme != 'https' or not urlsplit(url).netloc for url in sources):
        raise ValueError('Official HTTPS sources required')
    if any(identity(row['page_id']) == identity(page_id) or row['slug'] == slug for row in own):
        raise ValueError('Duplicate Notion page or slug in publication ledger')
    # Frontmatter slugs also protect initial editorial articles without Notion IDs.
    for existing in (ROOT / 'src/content/articles').glob('*.md*'):
        text = existing.read_text(encoding='utf-8')
        if existing.stem == slug or re.search(r'^slug:\s*[\"\']?' + re.escape(slug) + r'[\"\']?\s*$', text, re.M):
            raise ValueError('Duplicate existing article slug')
        existing_page = re.search(r'^notionPageId:\s*[\"\']?([a-fA-F0-9-]{32,36})[\"\']?\s*$', text, re.M)
        if existing_page and identity(existing_page.group(1)) == identity(page_id):
            raise ValueError('Duplicate existing Notion page')
    body = markdown(page_id)
    excerpt = body_excerpt(body)
    frontmatter = {'title': title, 'description': description, 'slug': slug, 'category': category,
                   'tags': tags, 'publishedDate': day(), 'updatedDate': day(),
                   'sources': [{'title': urlsplit(url).netloc + ' — reference', 'url': url} for url in sources],
                   'verification': 'Editorial approval recorded in Notion; this automated publication does not establish native Excel or Google Sheets execution.',
                   'draft': False, 'featured': False, 'author': 'GuideHollow Sheets Editorial', 'notionPageId': page_id}
    text = '---\n' + '\n'.join(key + ': ' + json.dumps(value, ensure_ascii=False) for key, value in frontmatter.items()) + '\n---\n\n' + body
    destination = ROOT / 'src/content/articles' / (slug + '.md')
    destination.write_text(text, encoding='utf-8')
    row = {'site_id': SITE_ID, 'page_id': page_id, 'slug': slug, 'title': title, 'kst_date': day(),
           'state': 'staged', 'url': SITE + '/' + category + '/' + slug + '/',
           'file': str(destination.relative_to(ROOT)), 'sha256': hashlib.sha256(text.encode()).hexdigest(),
           'body_excerpt': excerpt, 'source_revision': source_revision(page, body)}
    ledger['records'].append(row)
    save_ledger(ledger)
    return staged_result(row, 'STAGED')


def body_excerpt(markdown_body):
    # Use ordinary paragraph text, so rendered HTML can prove real body delivery.
    for paragraph in markdown_body.split('\n\n'):
        if not paragraph.startswith(('#', '-', '|', '`', '>', '1.')) and len(paragraph) >= 80:
            text = re.sub(r'\[([^\]]+)\]\([^\s]*\)', r'\1', paragraph)
            text = re.sub(r'\\([\\`*_\[\]#!|])', r'\1', text)
            text = re.sub(r'[*`~]', '', text)
            return ' '.join(unescape(text).split())[:120]
    raise ValueError('Article needs a substantive prose paragraph for live body verification')


class LiveHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals, self.article_ids, self.text = [], [], []
        self.article_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'article':
            self.article_ids.append(attrs.get('data-notion-page-id'))
            self.article_depth += 1

    def handle_endtag(self, tag):
        if tag == 'article':
            self.article_depth = max(0, self.article_depth - 1)

    def handle_data(self, data):
        if self.article_depth:
            self.text.append(data)


def verify_live(row):
    request = Request(row['url'] + '?verify-notion=' + str(int(time.time())), headers={'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=25) as response:
        if response.status != 200 or response.geturl().split('?')[0] != row['url']:
            raise ValueError('Live URL must return HTTP 200 without redirect')
        parser = LiveHTML()
        parser.feed(response.read().decode('utf-8'))
    if parser.canonicals != [row['url']] or row['page_id'] not in parser.article_ids:
        raise ValueError('Live canonical or Notion article identity mismatch')
    if row['body_excerpt'] not in ' '.join(''.join(parser.text).split()):
        raise ValueError('Live article body mismatch')


def log_quality(page_id, site_page, public_url):
    rows = query(QUALITY_ID, {'filter': {'and': [
        {'property': '연결 원고', 'relation': {'contains': page_id}},
        {'property': '배포 사이트', 'relation': {'contains': site_page}},
        {'property': '단계', 'select': {'equals': '사전검수'}}]}})
    for row in rows:
        properties = row['properties']
        for name, expected in (('연결 원고', page_id), ('배포 사이트', site_page)):
            relation = properties[name]
            if relation.get('has_more') or [identity(x['id']) for x in relation.get('relation', [])] != [identity(expected)]:
                raise ValueError('QUALITY_LOG_RELATION_MISMATCH')
    if not rows:
        rich = lambda text: [{'type': 'text', 'text': {'content': text}}]
        notion('POST', '/pages', {'parent': {'type': 'data_source_id', 'data_source_id': QUALITY_ID}, 'properties': {
            '기록명': {'title': rich('gh-sheets prepublication ' + page_id)},
            '연결 원고': {'relation': [{'id': page_id}]}, '배포 사이트': {'relation': [{'id': site_page}]},
            '단계': {'select': {'name': '사전검수'}}, '성과 검증': {'select': {'name': '미측정'}},
            '기록일': {'date': {'start': day()}}, '주제': {'rich_text': rich('Approved queue source publication')},
            '핵심 개선점': {'rich_text': rich('Notion editorial approval and site routing checked. Source regression checks precede deployment; native spreadsheet execution and live performance are not established.')},
            '관련 게시 URL': {'url': public_url}, '차기 적용상태': {'select': {'name': '미적용'}}}})


def gh(*args):
    if not os.getenv('GH_TOKEN'):
        raise RuntimeError('SETUP_REQUIRED: GH_TOKEN is required for explicit Pages dispatch')
    result = subprocess.run(['gh', *args], check=True, capture_output=True, text=True)
    return json.loads(result.stdout) if result.stdout.strip() else None


def verify_deployment(run, sha):
    if (run.get('head_sha') != sha or run.get('event') != 'workflow_dispatch' or
            run.get('head_branch') != 'main' or run.get('path', '').split('@')[0] != '.github/workflows/deploy.yml' or
            run.get('status') != 'completed' or run.get('conclusion') != 'success'):
        raise ValueError('PAGES_DEPLOYMENT_NOT_SUCCESSFUL_FOR_EXPECTED_SHA')
    jobs = gh('api', f'repos/{REPO}/actions/runs/{run["id"]}/jobs?per_page=100')
    if not any(job.get('name') == 'deploy' and job.get('conclusion') == 'success' for job in jobs['jobs']):
        raise ValueError('Pages deploy job did not succeed')


def deploy_and_finalize(page_id, sha):
    require_token()
    registry = verify_site_registry()
    if not re.fullmatch('[0-9a-f]{40}', sha or ''):
        raise ValueError('Expected full Git commit SHA')
    ledger = load_ledger()
    rows = [r for r in ledger['records'] if r['site_id'] == SITE_ID and identity(r['page_id']) == identity(page_id)]
    if len(rows) != 1:
        raise ValueError('Finalization ledger identity mismatch')
    row = rows[0]
    if row['state'] != 'staged' or row['kst_date'] != day():
        raise ValueError('Run stage first: finalization needs a current-day staged reservation')
    if hashlib.sha256((ROOT / row['file']).read_bytes()).hexdigest() != row['sha256']:
        raise ValueError('Finalization source changed')
    remote = gh('api', f'repos/{REPO}/git/ref/heads/main')
    if remote['object']['sha'] != sha:
        raise ValueError('MAIN_ADVANCED: expected source SHA no longer current')
    page = notion('GET', '/pages/' + page_id)
    require_unfinished(page)
    if not eligible(page, registry['id'], resume=True):
        raise ValueError('Finalization article is no longer approved, due, or correctly routed')
    verify_source_revision(page, row)
    log_quality(page_id, registry['id'], row['url'])
    notion('PATCH', '/pages/' + page_id, {'properties': {'상태': {'select': {'name': '발행중'}}}})
    before = gh('api', f'repos/{REPO}/actions/workflows/deploy.yml/runs?event=workflow_dispatch&per_page=100')
    previous_ids = {run['id'] for run in before['workflow_runs']}
    dispatched = now()
    gh('api', '--method', 'POST', f'repos/{REPO}/actions/workflows/deploy.yml/dispatches', '-f', 'ref=main')
    selected = None
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        runs = gh('api', f'repos/{REPO}/actions/workflows/deploy.yml/runs?event=workflow_dispatch&per_page=100')
        matches = [run for run in runs['workflow_runs'] if run['id'] not in previous_ids and
                   run.get('head_sha') == sha and run.get('head_branch') == 'main' and
                   datetime.fromisoformat(run['created_at'].replace('Z', '+00:00')) >= dispatched.replace(microsecond=0)]
        if len(matches) > 1:
            raise ValueError('Ambiguous deploy dispatch; operator must reconcile')
        if matches:
            selected = gh('api', f'repos/{REPO}/actions/runs/{matches[0]["id"]}')
            if selected['status'] == 'completed':
                verify_deployment(selected, sha)
                break
        time.sleep(10)
    else:
        raise ValueError('Timed out waiting for explicit Pages deployment of expected SHA')
    for attempt in range(12):
        try:
            verify_live(row)
            break
        except (OSError, ValueError):
            if attempt == 11:
                raise
            time.sleep(10)
    registry = verify_site_registry()
    current = notion('GET', '/pages/' + page_id)
    require_unfinished(current)
    if not eligible(current, registry['id'], resume=True):
        raise ValueError('Approval or site routing changed during deployment')
    verify_source_revision(current, row)
    if any(other['site_id'] == SITE_ID and other['kst_date'] == day() and other is not row for other in ledger['records']):
        raise ValueError('Daily limit reached during deployment')
    row['kst_date'] = day()
    timestamp = now().isoformat()
    notion('PATCH', '/pages/' + page_id, {'properties': {
        '상태': {'select': {'name': '발행완료'}}, '게시 URL': {'url': row['url']},
        '발행일시': {'date': {'start': timestamp}},
        'GitHub 커밋': {'url': f'https://github.com/{REPO}/commit/{sha}'}, '오류': {'rich_text': []}}})
    row.update(state='published', published_at=timestamp, deployment_run_id=selected['id'], commit=sha)
    save_ledger(ledger)
    return staged_result(row, 'PUBLISHED')


def check_connection():
    require_token()
    notion('GET', '/users/me')
    # Read-only check works while the registry is deliberately preparing.
    rows = query(REGISTRY_ID, {'filter': {'property': 'Site ID', 'title': {'equals': SITE_ID}}})
    notion('GET', '/data_sources/' + QUEUE_ID)
    return {'status': 'CONNECTED', 'site_records': len(rows), 'publishing_enabled': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', nargs='?', choices=('stage', 'deploy-finalize'))
    parser.add_argument('--check-connection', action='store_true')
    parser.add_argument('--page-id')
    parser.add_argument('--sha')
    args = parser.parse_args()
    try:
        if args.check_connection:
            result = check_connection()
        elif args.command == 'stage':
            result = stage()
        elif args.command == 'deploy-finalize':
            result = deploy_and_finalize(args.page_id, args.sha)
        else:
            parser.error('choose stage, deploy-finalize, or --check-connection')
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        # HTTP errors include status/route only; no raw Notion request or response is emitted.
        print('PUBLICATION_ERROR: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
