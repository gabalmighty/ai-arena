#!/usr/bin/env python3
"""AI Arena deterministic grader. Runs only in a disconnected verification container.

This script MUST NOT be provided to a candidate model's workspace.
"""
import json
import pathlib
import subprocess
import sys
import tempfile
import shutil
import re
import os

ROOT = pathlib.Path(__file__).resolve().parent
TASKS = {t['id']: t for t in json.loads((ROOT/'challenges/v0.1.json').read_text())['tasks']}


def command(args, cwd, timeout=12):
    try:
        if args[0] == 'node':
            args[0] = shutil.which('node') or 'node'
        p = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                           env={'PATH': '/usr/local/bin:/usr/bin:/bin:/opt/node22/bin', 'PYTHONDONTWRITEBYTECODE': '1', 'HOME': '/tmp'})
        return p.returncode, (p.stdout + '\n' + p.stderr)[-2400:]
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 99, str(exc)[:500]


def grade(task_id, work):
    t = TASKS[task_id]
    d = pathlib.Path(work)
    checks = []
    score = 0
    if task_id == 'repo-map':
        try:
            a = json.loads((d/'answer.json').read_text())
        except (OSError, ValueError):
            a = {}
        for field, expected in [('calculator', 'app/pricing.py:apply_discount'),
                                ('audit', 'app/audit.py:record_discount')]:
            good = a.get(field) == expected
            checks.append({'test': field, 'pass': good})
        score = 50 * sum(x['pass'] for x in checks)
    elif task_id == 'code-review':
        try:
            report = json.loads((d/'review.json').read_text())
            findings = report.get('findings', [])
            assert isinstance(findings, list)
        except (OSError, ValueError, AssertionError, AttributeError):
            findings = []
        gold = {'unsigned_token': 'auth.js', 'lockout_boundary': 'auth.js'}
        matched = set()
        false = 0
        for item in findings[:30]:
            if not isinstance(item, dict):
                false += 1; continue
            kind = item.get('kind')
            if kind in gold and item.get('file') == gold[kind] and kind not in matched:
                matched.add(kind)
            else:
                false += 1
        score = max(0, 50 * len(matched) - 20 * false)
        checks = [{'test': 'real_findings', 'matched': sorted(matched), 'pass': len(matched)==2},
                  {'test': 'false_positive_count', 'count': false, 'pass': false==0}]
    elif task_id == 'devops-dockerfile':
        try:
            lines = [ln.strip() for ln in (d/'Dockerfile').read_text().splitlines()
                     if ln.strip() and not ln.lstrip().startswith('#')]
        except OSError:
            lines = []
        lower = '\n'.join(lines).lower()
        rules = {
            'entrypoint_preserved': any(x=='''CMD ["node", "server.js"]''' for x in lines),
            'node_22_pinned': any(re.fullmatch(r'FROM\s+node:22-bookworm-slim', x, re.I) for x in lines),
            'npm_ci': any(re.search(r'^RUN\s+npm\s+ci\s+--omit=dev$', x, re.I) for x in lines),
            'drop_root': any(re.fullmatch(r'USER\s+node', x, re.I) for x in lines),
            'no_npm_install': not re.search(r'\bnpm\s+install\b', lower),
            'no_curl_pipe': not re.search(r'curl.*\|\s*(sh|bash)', lower),
            'copy_lockfile': any('package-lock.json' in x and x.startswith('COPY ') for x in lines),
            'ordering': next((i for i,x in enumerate(lines) if x.startswith('COPY package.json')),999)<next((i for i,x in enumerate(lines) if 'npm ci' in x),-1)<next((i for i,x in enumerate(lines) if x=='COPY . .'),-1)<next((i for i,x in enumerate(lines) if x=='USER node'),-1)<next((i for i,x in enumerate(lines) if x.startswith('CMD ')),-1)
        }
        checks = [{'test': k, 'pass': v} for k,v in rules.items()]
        score = round(100 * sum(rules.values()) / len(rules))
    elif task_id == 'test-author':
        test_file = d/'test_shipping.py'
        try:
            content = test_file.read_text()
        except OSError:
            content = ''
        ntests = len(re.findall(r'^\s+def\s+test_[A-Za-z_0-9]+\(', content, re.M))
        with tempfile.TemporaryDirectory() as td:
            b = pathlib.Path(td)
            shutil.copyfile(d/'shipping.py', b/'shipping.py')
            if content:
                (b/'test_shipping.py').write_text(content)
            buggy_code, buggy_log = command(['python3', '-m', 'unittest', 'discover', '-p', 'test_shipping.py'], b)
            (b/'shipping.py').write_text(t['oracle_source'])
            fixed_code, fixed_log = command(['python3', '-m', 'unittest', 'discover', '-p', 'test_shipping.py'], b)
        rules = {'two_tests': ntests>=2, 'detects_bug': buggy_code==1 and ('FAIL' in buggy_log or 'AssertionError' in buggy_log),
                 'passes_reference': fixed_code==0 and 'Ran 0 tests' not in fixed_log}
        checks = [{'test': k, 'pass': v} for k,v in rules.items()]
        score = round(100 * sum(rules.values()) / len(rules))
    elif task_id in ('python-refund', 'web-escape', 'mobile-outbox', 'desktop-path'):
        if task_id == 'python-refund':
            program = '''from ledger import Ledger\nfor start in [0,12,99]:\n l=Ledger(start)\n assert l.refund("req-a", 7)==start+7\n assert l.refund("req-a", 7)==start+7\n assert l.refund("req-b", 4)==start+11\n assert l.refund("req-b", 4)==start+11\n'''
            code, log = command(['python3', '-c', program], d)
            checks = [{'test': 'refund_is_idempotent_for_varied_balances', 'pass': code==0, 'detail': log if code else ''}]
            score = 100 if code==0 else 0
        else:
            scripts = {
              'web-escape': '''const assert=require('node:assert/strict'); const {formatWelcome}=require('./render'); for(const x of ['Ada','<script>alert(1)</script>','A&B',`\"'<>`]) {let y=formatWelcome(x); assert(y.startsWith('<h1>Welcome, ')); assert(y.endsWith('</h1>')); assert(!y.slice(13,-5).includes('<'));} assert.equal(formatWelcome('A&B'),'<h1>Welcome, A&amp;B</h1>'); assert.equal(formatWelcome('<b>'),'<h1>Welcome, &lt;b&gt;</h1>'); assert.equal(formatWelcome('"'),'<h1>Welcome, &quot;</h1>'); assert.equal(formatWelcome("'"),'<h1>Welcome, &#39;</h1>');''',
              'mobile-outbox': '''const assert=require('node:assert/strict'); const {pendingUploads}=require('./queue'); const src=[{id:'a',data:1},{id:'b',data:2},{id:'a',data:3},{id:'c',data:4}]; const copy=JSON.stringify(src); assert.deepEqual(pendingUploads(src,['b']).map(x=>x.id),['a','c']); assert.deepEqual(pendingUploads(src,['a','b']).map(x=>x.id),['c']); assert.deepEqual(pendingUploads([],[]),[]); assert.equal(JSON.stringify(src),copy);''',
              'desktop-path': '''const assert=require('node:assert/strict'); const {canOpen}=require('./paths'); assert.equal(canOpen('/home/u/docs/report.txt','/home/u/docs'),true); assert.equal(canOpen('/home/u/docs','/home/u/docs'),true); assert.equal(canOpen('/home/u/docs-old/secret','/home/u/docs'),false); assert.equal(canOpen('/home/u/docs/../secret','/home/u/docs'),false); assert.equal(canOpen('/etc/passwd','/home/u/docs'),false);'''
            }
            code, log = command(['node','-e',scripts[task_id]], d)
            checks = [{'test':'functional_cases', 'pass':code==0, 'detail':log if code else ''}]
            score = 100 if code==0 else 0
    else:
        raise ValueError('unknown task')
    return {'task_id': task_id, 'score': score, 'passed': score >= 80,
            'checks': checks, 'evidence_level': 'static' if task_id=='devops-dockerfile' else 'executable'}


if __name__ == '__main__':
    if len(sys.argv)!=3 or sys.argv[1] not in TASKS:
        sys.exit('usage: evaluator.py TASK_ID /work')
    try:
        result=grade(sys.argv[1],sys.argv[2]); print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'task_id':sys.argv[1], 'score':0, 'passed':False, 'grader_error':str(e)}))
        sys.exit(3)
