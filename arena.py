#!/usr/bin/env python3
"""AI Arena v0.1.0 — standard-library orchestrator; agent and verifier run in separate Docker containers."""
import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

ROOT=pathlib.Path(__file__).resolve().parent
IMAGE='ai-arena-opencode:0.1.0'
TASK_FILE=ROOT/'challenges/v0.1.json'
REPORT_START='<!-- ARENA:BEGIN -->'
REPORT_END='<!-- ARENA:END -->'


def tasks():
    data=json.loads(TASK_FILE.read_text(encoding='utf-8'))
    assert data['version']=='0.1.0'
    return data['tasks']


def safe_rel(s):
    p=pathlib.PurePosixPath(s)
    return bool(s) and not p.is_absolute() and s==p.as_posix() and all(x not in ('..','.') for x in p.parts) and ':' not in s and '//' not in s


def writefiles(where, files):
    for rel,body in files.items():
        if not safe_rel(rel):
            raise ValueError(f'Unsafe task path: {rel}')
        p=where/rel
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(body,encoding='utf-8')


def stage(task, where, reference=False):
    writefiles(where,task['files'])
    if reference:
        writefiles(where,task['reference'])


def checksum(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def file_map(where):
    result={}
    for f in where.rglob('*'):
        if f.is_symlink():
            result[f.relative_to(where).as_posix()]='SYMLINK'
        elif f.is_file():
            result[f.relative_to(where).as_posix()]=checksum(f)
    return result


def checked_result(task, dir):
    from evaluator import grade
    return grade(task['id'],dir)


def selftest():
    seen=set()
    for t in tasks():
        if t['id'] in seen:
            raise ValueError('duplicate task ID')
        seen.add(t['id'])
        if not all(safe_rel(p) for p in [*t['files'],*t['reference'],*t['allowed']]):
            raise ValueError('unsafe task path')
        if set(t['reference'])-set(t['allowed']):
            raise ValueError(f"reference modifies forbidden file: {t['id']}")
        with tempfile.TemporaryDirectory(prefix='arena-qualify-') as temp:
            d=pathlib.Path(temp)
            stage(t,d)
            baseline=checked_result(t,d)
            stage(t,d,reference=True)
            fixed=checked_result(t,d)
            if baseline['score']>=80 or fixed['score']<80:
                raise ValueError(f"invalid task {t['id']}: baseline={baseline['score']} oracle={fixed['score']}")
        print(f"QUALIFIED {t['id']}: baseline={baseline['score']} reference={fixed['score']}")
    print(f'PASS: {len(seen)} task oracles independently self-qualified; no external models were called.')


def docker(args, timeout=90, cleanup=None):
    try:
        p=subprocess.run(['docker',*args],capture_output=True,text=True,timeout=timeout)
        return p.returncode,p.stdout,p.stderr
    except subprocess.TimeoutExpired as e:
        if cleanup:
            subprocess.run(['docker','rm','-f',cleanup],capture_output=True,timeout=15)
        return 124,(e.stdout or b'').decode(errors='replace') if isinstance(e.stdout,bytes) else (e.stdout or ''),'TIMEOUT'


def available():
    if not shutil.which('docker'):
        raise RuntimeError('Docker CLI missing. Install Docker Desktop/Engine first.')
    code,out,err=docker(['info','--format','{{.ServerVersion}}'],timeout=20)
    if code:
        raise RuntimeError('Docker daemon not ready: '+err[:400])
    code,_,err=docker(['image','inspect',IMAGE],timeout=20)
    if code:
        raise RuntimeError(f'Image {IMAGE} missing. Run: python arena.py build')


def build():
    if not shutil.which('docker'):
        raise RuntimeError('Docker CLI missing')
    code,out,err=docker(['build','--pull','-t',IMAGE,'-f',str(ROOT/'container/Dockerfile'),str(ROOT)],timeout=600)
    print((out+'\n'+err)[-4000:])
    if code:
        raise RuntimeError('Docker image build failed')
    print(f'Built {IMAGE}. Pin and record the digest for publication-grade comparisons.')


def qualify_verifier(task,where):
    # Independent: no network, no secrets, no writable source, separate Docker invocation.
    name='arena_verify_'+uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='arena-oracle-') as oracle_temp:
        oracle=pathlib.Path(oracle_temp)
        (oracle/'challenges').mkdir()
        shutil.copyfile(ROOT/'evaluator.py',oracle/'evaluator.py')
        shutil.copyfile(TASK_FILE,oracle/'challenges/v0.1.json')
        return _offline_grade(task,where,oracle,name)

def _offline_grade(task,where,oracle,name):
    args=['run','--rm','--name',name,'--network','none','--read-only',
          '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64',
          '--memory','512m','--cpus','1','--tmpfs','/tmp:rw,nosuid,nodev,size=32m',
          '--mount',f'type=bind,source={where},target=/work,readonly',
          '--mount',f'type=bind,source={oracle},target=/arena,readonly',
          '--workdir','/work',IMAGE,'python3','/arena/evaluator.py',task['id'],'/work']
    code,out,err=docker(args,timeout=50,cleanup=name)
    if code:
        return {'task_id':task['id'],'score':0,'passed':False,'grader_error':(out+err)[-400:]}
    try:
        result=json.loads(out.strip().splitlines()[-1]); assert result.get('task_id')==task['id']
        return result
    except (ValueError,AssertionError,IndexError):
        return {'task_id':task['id'],'score':0,'passed':False,'grader_error':'malformed independent grader output'}


def config_for(route):
    provider=route.split('/')[0]
    if provider not in ('opencode-go','openrouter'):
        raise ValueError('Only opencode-go and openrouter are accepted in the free pilot')
    key='OPENCODE_GO_API_KEY' if provider=='opencode-go' else 'OPENROUTER_API_KEY'
    return {'$schema':'https://opencode.ai/config.json',
            'providers':{provider:{'settings':{'apiKey':'{env:'+key+'}'}}},
            'permissions':[
              {'action':'*','resource':'*','effect':'deny'},
              {'action':'read','resource':'*','effect':'allow'},
              {'action':'glob','resource':'*','effect':'allow'},
              {'action':'grep','resource':'*','effect':'allow'},
              {'action':'edit','resource':'*','effect':'allow'},
              {'action':'shell','resource':'*','effect':'allow'},
              {'action':'external_directory','resource':'*','effect':'deny'},
              {'action':'subagent','resource':'*','effect':'deny'},
              {'action':'websearch','resource':'*','effect':'deny'},
              {'action':'webfetch','resource':'*','effect':'deny'}],
            'agents':{'build':{'steps':5}}}


def classify_attempt(log,code):
    x=log.lower()
    if code==124: return 'TIMEOUT'
    if any(v in x for v in ['429','rate limit','quota exceeded','free limit','daily limit','too many requests']): return 'PROVIDER_LIMIT'
    if any(v in x for v in ['model unavailable','model not found','unknown model','unsupported model']): return 'UNAVAILABLE'
    if any(v in x for v in ['401 unauthorized','403 forbidden','invalid api key','authentication failed']): return 'AUTH_ERROR'
    if code: return 'PROVIDER_ERROR'
    return 'COMPLETED'


def provider_env(group,source,private_dir):
    key='OPENCODE_GO_API_KEY' if group=='opencode-go' else 'OPENROUTER_API_KEY'
    values={}
    for line in source.read_text(encoding='utf-8-sig').splitlines():
        if not line.strip() or line.lstrip().startswith('#'): continue
        if '=' not in line: raise ValueError('Malformed secret .env line')
        k,v=line.split('=',1)
        if k.strip() in ('OPENCODE_GO_API_KEY','OPENROUTER_API_KEY'):
            v=v.strip()
            if v.startswith(('\"',"'")) and v[-1:] == v[:1]:v=v[1:-1]
            values[k.strip()]=v
    if not values.get(key) or any(c in values[key] for c in '\r\n'):
        raise ValueError('Missing provider key '+key+' in local env file')
    target=private_dir/(group+'.env')
    target.write_text(key+'='+values[key]+'\n',encoding='utf-8')
    target.chmod(0o600)
    return target

def run_task(model,group,task,env_file,run_dir,run_index):
    with tempfile.TemporaryDirectory(prefix='ai-arena-trial-') as temp:
        base=pathlib.Path(temp)
        work=base/'workspace'; work.mkdir()
        stage(task,work)
        config=json.dumps(config_for(model),indent=2)+'\n'
        (work/'opencode.json').write_text(config)
        initial=file_map(work)
        for d in [work,*[x for x in work.rglob('*') if x.is_dir()]]: d.chmod(0o777)
        for f in work.rglob('*'):
            if f.is_file(): f.chmod(0o666)
        label='arena_agent_'+uuid.uuid4().hex[:12]
        prompt=task['prompt']+'\n\nWork only inside /work. Do not use web, subagents or outside files. Report what you actually verified. Do not claim production qualification.'
        cmd=['run','--rm','--name',label,'--network','bridge','--read-only',
             '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128',
             '--memory','1g','--cpus','2','--tmpfs','/tmp:rw,nosuid,nodev,size=128m,uid=10001,gid=10001',
             '--tmpfs','/home/arena:rw,nosuid,nodev,size=256m,uid=10001,gid=10001',
             '--user','10001:10001','--env-file',str(env_file),
             '--env','HOME=/home/arena','--env','XDG_CONFIG_HOME=/home/arena/.config',
             '--env','XDG_DATA_HOME=/home/arena/.local/share',
             '--mount',f'type=bind,source={work},target=/work',
             '--workdir','/work',IMAGE,'opencode','run','--standalone','--archived',
             '--model',model,'--agent','build','--format','json',prompt]
        start=time.monotonic()
        code,out,err=docker(cmd,timeout=task['seconds']+20,cleanup=label)
        elapsed=round(time.monotonic()-start,2)
        local_log=run_dir/f'{run_index:02d}-{task["id"]}-attempt.log'
        # Private trace only. This path is gitignored; never publish raw provider output.
        local_log.write_text(out+'\n---STDERR---\n'+err,encoding='utf-8',errors='replace')
        state=classify_attempt(out[-3000:]+err[-3000:],code)
        after=file_map(work)
        unexpected=[p for p in sorted(set(after)|set(initial))
                    if after.get(p)!=initial.get(p) and p not in task['allowed']]
        altered={p:after.get(p) for p in task['allowed'] if p in after and after.get(p)!=initial.get(p)}
        if state=='COMPLETED' or altered:
            with tempfile.TemporaryDirectory(prefix='arena-regrade-') as gd:
                clean=pathlib.Path(gd)
                stage(task,clean)
                for p in task['allowed']:
                    source=work/p
                    if source.is_file() and not source.is_symlink():
                        dest=clean/p; dest.parent.mkdir(parents=True,exist_ok=True)
                        if source.stat().st_size<=1024*1024:
                            shutil.copyfile(source,dest)
                        else:
                            unexpected.append('oversized:'+p)
                    elif source.is_symlink():
                        unexpected.append('symlink:'+p)
                verified=qualify_verifier(task,clean)
        else:
            verified={'task_id':task['id'],'score':0,'passed':False,'checks':[]}
        if unexpected:
            verified['score']=0;verified['passed']=False
        if verified.get('grader_error'):
            status='INVALID_GRADER'
        elif unexpected:
            status='UNSAFE'
        elif state!='COMPLETED':
            status=state
        else:
            status='PASS' if verified.get('passed') else 'FAIL'
        return {'task':task['id'],'role':task['role'],'domain':task['domain'],
                'status':status,'score':verified.get('score',0),'seconds':elapsed,
                'evidence_level':verified.get('evidence_level'),
                'checks':verified.get('checks',[]),'unexpected_paths':unexpected,
                'patch_sha256':hashlib.sha256(json.dumps(altered,sort_keys=True).encode()).hexdigest(),
                'process_exit':code,'provider_state':state}


def verdict(items,expected_count,repeats):
    if any(t['status']=='UNSAFE' for t in items): return 'FAILED'
    if any(t['status']=='INVALID_GRADER' for t in items): return 'INCOMPLETE'
    scored=[x for x in items if x['status'] in ('PASS','FAIL')]
    if len(items)<expected_count or len(scored)<expected_count: return 'INCOMPLETE'
    average=sum(t['score'] for t in scored)/len(scored)
    if average<70: return 'FAILED'
    if average>=90 and repeats>=2 and all(t['score']>=80 for t in scored):
        return 'RECOMMENDED | PASSED'
    return 'PASS WITH WARNINGS'


def make_run(model,group,profile,env_file,repeats):
    available()
    if group=='openrouter' and (not model.startswith('openrouter/') or not model.endswith(':free')):
        raise ValueError('For zero-paid OpenRouter pilot, model must be openrouter/<id>:free')
    if group=='opencode-go' and not model.startswith('opencode-go/'):
        raise ValueError('Expected explicit opencode-go model route')
    if not env_file.is_file(): raise ValueError('Missing provider --env-file (do not commit secrets)')
    candidates=tasks() if profile=='full' else [t for t in tasks() if t['id'] in ('repo-map','python-refund','code-review')]
    timestamp=dt.datetime.now(dt.timezone.utc)
    run_id=timestamp.strftime('%Y%m%dT%H%M%SZ')+'_'+re.sub(r'[^a-zA-Z0-9_.-]','_',model)
    private=ROOT/'.arena-private'/run_id; private.mkdir(parents=True,exist_ok=False)
    narrow_env=provider_env(group,env_file,private)
    items=[]
    for index,t in enumerate(candidates*repeats):
        print(f'[{len(items)+1}/{len(candidates)*repeats}] {model} -> {t["id"]}',flush=True)
        result=run_task(model,group,t,narrow_env,private,index+1)
        items.append(result)
        print(' ',result['status'],result['score'],'in',result['seconds'],'s',flush=True)
        if result['status'] in ('PROVIDER_LIMIT','UNAVAILABLE','AUTH_ERROR','INVALID_GRADER','UNSAFE'):
            print('Stopping remaining tasks; no guessed scores for unexecuted work.')
            break
    end=dt.datetime.now(dt.timezone.utc)
    state=verdict(items,len(candidates)*repeats,repeats) if profile=='full' else 'INCOMPLETE'
    rec={'schema':'ai-arena/v0.1.0','id':run_id,'model':model,'provider_group':group,'profile':profile,
         'started_utc':timestamp.isoformat(),'finished_utc':end.isoformat(),
         'finished_manila':end.astimezone(dt.timezone(dt.timedelta(hours=8))).isoformat(),
         'benchmark_version':'0.1.0','benchmark_sha256':checksum(TASK_FILE),
         'runner_sha256':checksum(ROOT/'arena.py'),'opencode_image':IMAGE,
         'run_repeats':repeats,'expected_trials':len(candidates)*repeats,
         'finished_trials':len(items),'status':state,
         'avg_quality':round(sum(x['score'] for x in items if x['status'] in ('PASS','FAIL'))/max(1,sum(x['status'] in ('PASS','FAIL') for x in items)),1),
         'trials':items,'independent_grader':True,
         'warning':'Pilot public tasks; static DevOps and logic-only mobile/desktop. Not production certification.',
         'provenance':'self-reported runner output; check run hashes and reproduce before trusting external submissions'}
    out=ROOT/'results/runs';out.mkdir(parents=True,exist_ok=True)
    path=out/f'{run_id}.json';path.write_text(json.dumps(rec,indent=2)+'\n',encoding='utf-8')
    render()
    print('WROTE',path,'VERDICT',state)
    return path


def render():
    rows=[]
    for f in (ROOT/'results/runs').glob('*.json'):
        try:
            x=json.loads(f.read_text())
            if x.get('schema')!='ai-arena/v0.1.0' or x.get('model') is None: continue
            rows.append((x,f))
        except (ValueError,OSError): continue
    latest={}
    for x,f in sorted(rows,key=lambda r:r[0].get('finished_utc','')):
        latest[x['model']]=(x,f)
    body=['### Latest verified evaluations','',
          '> These are self-reported OpenCode harness runs, not independent third-party certifications. See each linked run. Models without an executed run remain **NOT TESTED**.','',
          '| Model route | Verdict | Score | Coverage | Run date (Asia/Manila) | Evidence |',
          '| --- | --- | ---: | ---: | --- | --- |']
    if latest:
        for model,(r,f) in sorted(latest.items()):
            cov=f"{r['finished_trials']}/{r['expected_trials']}"
            stamp=r.get('finished_manila','unknown')[:19].replace('T',' ')
            body.append(f"| `{model}` | **{r['status']}** | {r['avg_quality']:.1f}/100 | {cov} | {stamp} +08 | [Run](results/runs/{f.name}) |")
    else:
        body.append('| No results yet | **NOT TESTED** | — | 0/8 | — | — |')
    body.extend(['','**Verdict gates:** RECOMMENDED | PASSED requires full coverage, ≥90 mean, ≥80 on each trial, at least two full repetitions, and zero safety violations. PASS WITH WARNINGS is full coverage with ≥70 mean but without full recommendation evidence. FAILED means <70 mean on a complete run or a critical scope violation. INCOMPLETE includes quotas, timeouts, authentication or missing tasks.','',
                 'These scores do **not** establish real-device mobile/desktop reliability, live DevOps safety, or production readiness.',''])
    latest_json={r[0]['model']:{'id':r[0]['id'],'status':r[0]['status'],'finished_manila':r[0]['finished_manila'],'quality':r[0]['avg_quality']} for r in latest.values()}
    (ROOT/'results/latest.json').write_text(json.dumps({'schema':'ai-arena/latest/v0.1.0','models':latest_json},indent=2)+'\n',encoding='utf-8')
    r=ROOT/'README.md';text=r.read_text(encoding='utf-8')
    a,b=text.index(REPORT_START),text.index(REPORT_END)
    r.write_text(text[:a+len(REPORT_START)]+'\n'+'\n'.join(body)+text[b:],encoding='utf-8')
    print('README scoreboard updated:',len(latest),'models')



def catalog(group, source):
    available()
    with tempfile.TemporaryDirectory(prefix='arena-catalog-') as temp:
        d=pathlib.Path(temp)
        narrow=provider_env(group,source,d)
        work=d/'workspace';work.mkdir();work.chmod(0o777)
        (work/'opencode.json').write_text(json.dumps(config_for(group+'/catalog-placeholder')))
        (work/'opencode.json').chmod(0o644)
        label='arena_catalog_'+uuid.uuid4().hex[:12]
        args=['run','--rm','--name',label,'--network','bridge','--read-only',
              '--cap-drop','ALL','--security-opt','no-new-privileges',
              '--pids-limit','64','--memory','1g',
              '--tmpfs','/tmp:rw,size=64m,uid=10001,gid=10001',
              '--tmpfs','/home/arena:rw,size=128m,uid=10001,gid=10001',
              '--user','10001:10001','--env-file',str(narrow),
              '--env','HOME=/home/arena','--env','XDG_CONFIG_HOME=/home/arena/.config',
              '--env','XDG_DATA_HOME=/home/arena/.local/share',
              '--mount',f'type=bind,source={work},target=/work,readonly',
              '--workdir','/work',IMAGE,'opencode','models']
        code,out,err=docker(args,timeout=90,cleanup=label)
        if code: raise RuntimeError('Model catalog failed: '+err[-500:])
        selected=[line for line in out.splitlines() if line.strip().startswith(group+'/')]
        print('Available matching routes for',group)
        print('\n'.join(selected) if selected else 'None returned; verify provider connection, route and CLI version')
        print('Model listing is NOT a proof of quota, free pricing, tool support or successful requests.')

def publish(confirm):
    if not confirm:
        print('DRY RUN only. To publish results to GitHub run: python arena.py publish --confirm')
        return
    if not (ROOT/'.git').exists():
        raise RuntimeError('Clone the GitHub repository with git first (not a ZIP download)')
    def git(*args):
        p=subprocess.run(['git',*args],cwd=ROOT,text=True,capture_output=True,timeout=60)
        if p.returncode: raise RuntimeError('git '+' '.join(args)+': '+p.stderr[-800:])
        return p.stdout
    git('add','--','README.md','results/runs','results/latest.json')
    staged=git('diff','--cached','--name-only').splitlines()
    if not staged:
        print('No unpublished result changes.'); return
    if any(p!='README.md' and p!='results/latest.json' and not p.startswith('results/runs/') for p in staged):
        raise RuntimeError('Unexpected staged paths; publication aborted')
    git('commit','-m','results: publish timestamped AI Arena evaluation')
    git('push','origin','HEAD:main')
    print('Published result files on GitHub main. No model was allowed to push.')


def main():
    ap=argparse.ArgumentParser(description='OpenCode-first isolated AI Arena evaluator')
    sp=ap.add_subparsers(dest='command',required=True)
    sp.add_parser('selftest');sp.add_parser('build');sp.add_parser('report')
    sp.add_parser('doctor')
    pp=sp.add_parser('catalog');pp.add_argument('--group',choices=['opencode-go','openrouter'],required=True);pp.add_argument('--env-file',type=pathlib.Path,required=True)
    pp=sp.add_parser('publish');pp.add_argument('--confirm',action='store_true')
    pp=sp.add_parser('run');pp.add_argument('--model',required=True);pp.add_argument('--group',choices=['opencode-go','openrouter'],required=True)
    pp.add_argument('--profile',choices=['full','triage'],default='full');pp.add_argument('--env-file',type=pathlib.Path,required=True)
    pp.add_argument('--repeats',type=int,default=1,choices=[1,2,3]);pp.add_argument('--consent-go-included',action='store_true')
    pp=sp.add_parser('run-six');pp.add_argument('--matrix',type=pathlib.Path,default=ROOT/'models.example.json');pp.add_argument('--env-file',type=pathlib.Path,required=True)
    pp.add_argument('--profile',choices=['full','triage'],default='full');pp.add_argument('--repeats',type=int,default=1,choices=[1,2,3]);pp.add_argument('--consent-go-included',action='store_true')
    args=ap.parse_args()
    try:
        if args.command=='selftest': selftest()
        elif args.command=='build': build()
        elif args.command=='doctor':
            available(); print('Docker and evaluation image ready. OpenCode model authentication is not checked by this command.')
        elif args.command=='catalog': catalog(args.group,args.env_file.resolve())
        elif args.command=='report': render()
        elif args.command=='publish': publish(args.confirm)
        elif args.command=='run':
            if args.group=='opencode-go' and not args.consent_go_included:
                raise ValueError('Go is subscription-included, not necessarily free. Use --consent-go-included after verifying your allowance.')
            make_run(args.model,args.group,args.profile,args.env_file.resolve(),args.repeats)
        elif args.command=='run-six':
            matrix=json.loads(args.matrix.read_text())['models']
            if len(matrix)!=6 or [x['group'] for x in matrix].count('opencode-go')!=3 or [x['group'] for x in matrix].count('openrouter')!=3:
                raise ValueError('Six-model matrix must contain exactly 3 Go and 3 OpenRouter entries')
            if not args.consent_go_included: raise ValueError('Go uses included plan allowances; pass --consent-go-included after review.')
            for m in matrix:
                if not m['model'] or m['model'].endswith('/CHOOSE-ACTUAL-MODEL'):
                    raise ValueError('First replace every placeholder in your matrix with exact IDs from opencode models')
            for m in matrix:
                path=make_run(m['model'],m['group'],args.profile,args.env_file.resolve(),args.repeats)
                recorded=json.loads(path.read_text())
                if any(x['status']=='PROVIDER_LIMIT' for x in recorded['trials']):
                    print('GLOBAL QUOTA PAUSE: remaining models not attempted; retry individually after quota reset.')
                    break
    except (ValueError, RuntimeError, OSError) as exc:
        print('ERROR:',exc,file=sys.stderr);sys.exit(2)


if __name__=='__main__': main()
