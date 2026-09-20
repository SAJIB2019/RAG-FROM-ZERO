import { mergeHybridResults } from './hybrid-search';
import { RetrievedChunk } from './query.repository';

function chunk(input: {
  documentId: string;
  chunkIndex: number;
}): RetrievedChunk {
  return {
    documentId: input.documentId,
    filename: `${input.documentId}.md`,
    chunkIndex: input.chunkIndex,
    content: `chunk ${input.chunkIndex}`,
    score: 0,
  };
}

describe('mergeHybridResults', () => {
  it('deduplicates chunks and records both sources', () => {
    const results = mergeHybridResults({
      vectorResults: [
        chunk({ documentId: 'doc-a', chunkIndex: 0 }),
        chunk({ documentId: 'doc-b', chunkIndex: 0 }),
      ],
      keywordResults: [
        chunk({ documentId: 'doc-a', chunkIndex: 0 }),
        chunk({ documentId: 'doc-c', chunkIndex: 0 }),
      ],
      limit: 5,
    });

    expect(results).toHaveLength(3);
    expect(results[0].documentId).toBe('doc-a');
    expect(results[0].sources).toEqual(['vector', 'keyword']);
    expect(results[0].hybridScore).toBeGreaterThan(results[1].hybridScore);
  });
});
