import { RetrievedChunk } from './query.repository';

export type HybridSearchResult = RetrievedChunk & {
  sources: Array<'vector' | 'keyword'>;
  hybridScore: number;
};

const RRF_K = 60;

export function mergeHybridResults(input: {
  vectorResults: RetrievedChunk[];
  keywordResults: RetrievedChunk[];
  limit: number;
}): HybridSearchResult[] {
  const merged = new Map<string, HybridSearchResult>();

  addResults({
    merged,
    results: input.vectorResults,
    source: 'vector',
  });

  addResults({
    merged,
    results: input.keywordResults,
    source: 'keyword',
  });

  return [...merged.values()]
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, input.limit);
}

function addResults(input: {
  merged: Map<string, HybridSearchResult>;
  results: RetrievedChunk[];
  source: 'vector' | 'keyword';
}): void {
  input.results.forEach((result, index) => {
    const key = getChunkKey(result);
    const rank = index + 1;
    const score = 1 / (RRF_K + rank);

    const existing = input.merged.get(key);

    if (existing) {
      existing.hybridScore += score;

      if (!existing.sources.includes(input.source)) {
        existing.sources.push(input.source);
      }

      return;
    }

    input.merged.set(key, {
      ...result,
      sources: [input.source],
      hybridScore: score,
    });
  });
}

function getChunkKey(result: RetrievedChunk): string {
  return `${result.documentId}:${result.chunkIndex}`;
}
