"""Collect real API responses and score them with RAGAS; run --help for options."""
import argparse
import json
import math
import os
from pathlib import Path
import urllib.request


def collect(questions, base_url, api_key):
    samples = []
    for item in questions:
        request = urllib.request.Request(
            base_url.rstrip('/') + '/api/query',
            data=json.dumps({'question': item['question']}).encode(),
            headers={'Content-Type': 'application/json', 'x-api-key': api_key},
            method='POST',
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)
        # This is the actual bounded context sent to the generator, not every hit.
        context = result['debug']['context']['text']
        samples.append({
            'user_input': item['question'],
            'response': result['answer'],
            'retrieved_contexts': [context] if context else [],
            'reference': item['reference'],
        })
    return samples


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--questions', type=Path, default=Path(__file__).with_name('questions.jsonl'))
    parser.add_argument('--base-url', default=os.getenv('RAG_BASE_URL', 'http://localhost:3000'))
    parser.add_argument('--output', type=Path, default=Path('evaluation/results.json'))
    parser.add_argument('--collect-only', action='store_true', help='Save API responses without calling an evaluator LLM')
    parser.add_argument('--min-score', type=float, default=0.0, help='Exit nonzero if any metric mean is below this threshold')
    args = parser.parse_args()
    if not 0 <= args.min_score <= 1:
        parser.error('--min-score must be between 0 and 1')
    questions = [json.loads(line) for line in args.questions.read_text().splitlines() if line.strip()]
    if not questions or any(not item.get('question') or not item.get('reference') for item in questions):
        parser.error('Each JSONL row must have a question and reference answer')
    if not args.collect_only and not os.getenv('EVAL_API_KEY'):
        parser.error('Set EVAL_API_KEY for the evaluator model, or use --collect-only')
    samples = collect(questions, args.base_url, os.getenv('API_KEY', ''))
    report = {'samples': samples}
    failed = False
    if not args.collect_only:
        # Keep Python dependencies outside the NestJS runtime.
        os.environ.setdefault('RAGAS_DO_NOT_TRACK', 'true')
        from langchain_openai import ChatOpenAI
        from ragas import EvaluationDataset, evaluate
        from ragas.llms import LangchainLLMWrapper
        from ragas.metrics import Faithfulness, FactualCorrectness, LLMContextRecall

        judge = ChatOpenAI(
            model=os.getenv('EVAL_MODEL', 'gpt-4.1-mini'),
            api_key=os.environ['EVAL_API_KEY'],
            base_url=os.getenv('EVAL_BASE_URL', 'https://api.openai.com/v1'),
            temperature=0,
            timeout=120,
            max_retries=2,
        )
        result = evaluate(
            dataset=EvaluationDataset.from_list(samples),
            metrics=[Faithfulness(), FactualCorrectness(), LLMContextRecall()],
            llm=LangchainLLMWrapper(judge),
            raise_exceptions=True,
        )
        scores = result.scores
        means = {key: sum(row[key] for row in scores) / len(scores) for key in scores[0]}
        failed = any(not math.isfinite(value) or value < args.min_score for value in means.values())
        report['metrics'] = {key: value if math.isfinite(value) else None for key, value in means.items()}
        report['passed'] = not failed
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(f'Saved {len(samples)} samples to {args.output}')
    if failed:
        raise SystemExit('Evaluation failed: invalid score or threshold not met')


if __name__ == '__main__':
    main()
