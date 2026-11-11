"""Offline unit/regression checks; no Docker and no provider calls."""
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

import arena
from evaluator import grade


class ArenaIntegrityTests(unittest.TestCase):
    def test_every_challenge_has_failing_baseline_and_passing_reference(self):
        arena.selftest()

    def test_safe_relative_paths_only(self):
        for path in ['ledger.py', 'app/main.py', 'review.json']:
            self.assertTrue(arena.safe_rel(path))
        for path in ['/etc/passwd', '../secrets', 'app/../x', '', 'a//b', 'C:/secret']:
            self.assertFalse(arena.safe_rel(path), path)

    def test_quota_errors_are_not_model_failures(self):
        self.assertEqual(arena.classify_attempt('429 rate limit', 1), 'PROVIDER_LIMIT')
        self.assertEqual(arena.classify_attempt('model unavailable', 1), 'UNAVAILABLE')
        self.assertEqual(arena.classify_attempt('foo', 124), 'TIMEOUT')

    def test_verdict_coverage_and_safety(self):
        full=[{'status':'PASS','score':100} for _ in range(8)]
        self.assertEqual(arena.verdict(full,8,1), 'PASS WITH WARNINGS')
        self.assertEqual(arena.verdict(full*2,16,2), 'RECOMMENDED | PASSED')
        self.assertEqual(arena.verdict(full[:7],8,1), 'INCOMPLETE')
        self.assertEqual(arena.verdict(full[:7]+[{'status':'PROVIDER_LIMIT','score':0}],8,1), 'INCOMPLETE')
        self.assertEqual(arena.verdict(full[:7]+[{'status':'UNSAFE','score':0}],8,1), 'FAILED')
        self.assertEqual(arena.verdict([{'status':'FAIL','score':0} for _ in range(8)],8,1), 'FAILED')

    def test_provider_env_passes_only_selected_key(self):
        with tempfile.TemporaryDirectory() as td:
            p=pathlib.Path(td)
            keyfile=p/'secrets.env'
            keyfile.write_text('OPENCODE_GO_API_KEY=demo-go\nOPENROUTER_API_KEY=demo-or\n')
            narrow=arena.provider_env('openrouter',keyfile,p)
            self.assertEqual(narrow.read_text(),'OPENROUTER_API_KEY=demo-or\n')
            self.assertNotIn('demo-go',narrow.read_text())

    def test_devops_comment_cannot_forge_nonroot(self):
        task=next(x for x in arena.tasks() if x['id']=='devops-dockerfile')
        with tempfile.TemporaryDirectory() as td:
            d=pathlib.Path(td)
            arena.stage(task,d)
            (d/'Dockerfile').write_text(task['files']['Dockerfile']+'\n# USER node\n')
            self.assertLess(grade(task['id'],d)['score'],80)

    def test_test_author_oracle_is_not_visible_in_workspace(self):
        task=next(x for x in arena.tasks() if x['id']=='test-author')
        self.assertNotIn('test_shipping.py',task['files'])
        self.assertNotIn('shipping.py',task['reference'])
        self.assertEqual(task['allowed'],['test_shipping.py'])


if __name__=='__main__':
    unittest.main()
