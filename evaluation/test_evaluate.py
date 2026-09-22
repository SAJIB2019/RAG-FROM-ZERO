import io
import json
import unittest
from unittest.mock import patch

from evaluate import collect


class CollectionTests(unittest.TestCase):
    def test_collects_generator_context_not_unused_retrieval_hits(self):
        response = {
            'answer': '30 days',
            'debug': {
                'context': {'text': '[source:1] Refunds within 30 days.'},
                'results': [{'content': 'This unused hit must not enter evaluation.'}],
            },
        }
        with patch('urllib.request.urlopen', return_value=io.BytesIO(json.dumps(response).encode())) as send:
            samples = collect([{'question': 'Deadline?', 'reference': '30 days'}], 'http://localhost:3000', 'test-key')
        self.assertEqual(samples[0]['retrieved_contexts'], ['[source:1] Refunds within 30 days.'])
        self.assertEqual(samples[0]['response'], '30 days')
        request = send.call_args.args[0]
        self.assertEqual(request.full_url, 'http://localhost:3000/api/query')
        self.assertEqual(request.get_header('X-api-key'), 'test-key')

    def test_preserves_empty_context(self):
        response = {'answer': 'Insufficient context', 'debug': {'context': {'text': ''}}}
        with patch('urllib.request.urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
            samples = collect([{'question': 'Unknown?', 'reference': 'Unknown'}], 'http://localhost:3000/', '')
        self.assertEqual(samples[0]['retrieved_contexts'], [])


if __name__ == '__main__':
    unittest.main()
