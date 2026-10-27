"""Prepare an anonymized, independently hosted copy of the user's shared dashboard."""
import hashlib
import json
import re
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://workbuddy-space-static.codebuddy.work/page/TLnwVZuv6cHmuRsWtXp5eK/5fVfS7kWFdKl/index.html'
CHART = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js'

def download(url):
    with urlopen(url, timeout=45) as response:
        return response.read()

def main():
    html = download(SOURCE).decode('utf-8')
    marker = 'window.__DATA__ = '
    start = html.index(marker) + len(marker)
    data, length = json.JSONDecoder().raw_decode(html[start:])
    aliases = {}
    for row in data['invite_records']:
        name = row.get('cand')
        if name:
            aliases.setdefault(name, f'候选人{len(aliases) + 1:03d}')
            row['cand'] = aliases[name]
    # Render only the replacement data; do not retain a second raw copy in Git.
    replacement = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    html = html[:start] + replacement + html[start + length:]
    # Remove WorkBuddy's editor/host integration; the dashboard's own scripts remain.
    html, count = re.subn(r'<script\b[^>]*\bsrc=["\']/page/page_comm/inject\.js["\'][^>]*>\s*</script>', '', html, flags=re.I)
    if count != 1:
        raise RuntimeError('Unexpected source: expected one platform loader')
    if CHART not in html:
        raise RuntimeError('Unexpected chart dependency')
    html = html.replace(CHART, '../assets/echarts.min.js')
    if any(name in html for name in aliases):
        raise RuntimeError('Candidate names remain outside the expected data field')
    for directory in ('embeds', 'assets'):
        (ROOT / directory).mkdir(exist_ok=True)
    (ROOT / 'embeds/dashboard.html').write_text(html, encoding='utf-8')
    chart = download(CHART)
    if not chart or b'echarts' not in chart[:10000].lower():
        raise RuntimeError('Unexpected chart download')
    (ROOT / 'assets/echarts.min.js').write_bytes(chart)
    (ROOT / 'assets/ECHARTS-LICENSE.txt').write_bytes(download('https://cdn.jsdelivr.net/npm/echarts@5.5.0/LICENSE'))
    manifest = {'source_url': SOURCE, 'snapshot_generated_at': data['meta']['generated_at'],
                'latest_report': data['meta']['latest_report'], 'candidate_names_anonymized': len(aliases),
                'chart_version': '5.5.0', 'chart_sha256': hashlib.sha256(chart).hexdigest(),
                'changes': ['anonymize candidate names', 'remove platform editor loader', 'host chart dependency locally']}
    (ROOT / 'embeds/source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'prepared': 'embeds/dashboard.html', 'candidate_names_anonymized': len(aliases), 'latest_report': data['meta']['latest_report']}))

if __name__ == '__main__':
    main()
