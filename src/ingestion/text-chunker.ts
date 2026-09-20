export type TextChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
};

export function chunkText(
  text: string,
  options = {
    maxCharacters: 800,
    overlapCharacters: 120,
  },
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + options.maxCharacters, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        content,
        tokenCount: estimateTokenCount(content),
      });
    }

    if (end === text.length) {
      break;
    }

    start = Math.max(0, end - options.overlapCharacters);
  }

  return chunks;
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
