import { buildContext } from './context-builder';
import { HybridSearchResult } from './hybrid-search';

function result(input: {
  documentId: string;
  chunkIndex: number;
  content: string;
}): HybridSearchResult {
  return {
    documentId: input.documentId,
    filename: `${input.documentId}.md`,
    chunkIndex: input.chunkIndex,
    content: input.content,
    score: 0,
    sources: ['vector'],
    hybridScore: 1,
  };
}

describe('buildContext', () => {
  it('formats selected chunks with matching source metadata', () => {
    const context = buildContext({
      results: [
        result({
          documentId: 'doc-a',
          chunkIndex: 0,
          content: 'Refunds are allowed within 30 days.',
        }),
        result({
          documentId: 'doc-b',
          chunkIndex: 2,
          content: 'Proof of purchase is required.',
        }),
      ],
    });

    expect(context.text).toContain('[source:1] Refunds are allowed');
    expect(context.text).toContain('[source:2] Proof of purchase');
    expect(context.sources).toEqual([
      {
        sourceId: 1,
        documentId: 'doc-a',
        filename: 'doc-a.md',
        chunkIndex: 0,
        snippet: 'Refunds are allowed within 30 days.',
      },
      {
        sourceId: 2,
        documentId: 'doc-b',
        filename: 'doc-b.md',
        chunkIndex: 2,
        snippet: 'Proof of purchase is required.',
      },
    ]);
  });

  it('respects the max context character budget', () => {
    const context = buildContext({
      maxCharacters: 40,
      results: [
        result({
          documentId: 'doc-a',
          chunkIndex: 0,
          content: 'Short chunk.',
        }),
        result({
          documentId: 'doc-b',
          chunkIndex: 1,
          content: 'This second chunk should not fit in the budget.',
        }),
      ],
    });

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].documentId).toBe('doc-a');
  });
});
