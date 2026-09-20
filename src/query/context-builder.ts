import { HybridSearchResult } from './hybrid-search';

export type ContextSource = {
  sourceId: number;
  documentId: string;
  filename: string;
  chunkIndex: number;
  snippet: string;
};

export type BuiltContext = {
  text: string;
  sources: ContextSource[];
};

const DEFAULT_MAX_CONTEXT_CHARACTERS = 3_000;
const SNIPPET_CHARACTERS = 240;

export function buildContext(input: {
  results: HybridSearchResult[];
  maxCharacters?: number;
}): BuiltContext {
  const maxCharacters = input.maxCharacters ?? DEFAULT_MAX_CONTEXT_CHARACTERS;
  const selected: HybridSearchResult[] = [];
  let usedCharacters = 0;

  for (const result of input.results) {
    const sourceId = selected.length + 1;
    const formatted = formatChunk(sourceId, result.content);

    if (
      selected.length > 0 &&
      usedCharacters + formatted.length > maxCharacters
    ) {
      break;
    }

    selected.push(result);
    usedCharacters += formatted.length;
  }

  return {
    text: selected
      .map((result, index) => formatChunk(index + 1, result.content))
      .join('\n\n'),
    sources: selected.map((result, index) => ({
      sourceId: index + 1,
      documentId: result.documentId,
      filename: result.filename,
      chunkIndex: result.chunkIndex,
      snippet: createSnippet(result.content),
    })),
  };
}

function formatChunk(sourceId: number, content: string): string {
  return `[source:${sourceId}] ${content}`;
}

function createSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized.length <= SNIPPET_CHARACTERS) {
    return normalized;
  }

  return `${normalized.slice(0, SNIPPET_CHARACTERS)}...`;
}
